// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HighSpeedDEX
 * @dev Simplified AMM DEX optimized for Monad's high-throughput capabilities
 * Designed for gaming tokens and in-game economies
 */
contract HighSpeedDEX is Ownable, ReentrancyGuard {
    
    struct Pool {
        address tokenA;
        address tokenB;
        uint256 reserveA;
        uint256 reserveB;
        uint256 totalLiquidity;
    }
    
    mapping(bytes32 => Pool) public pools;
    mapping(bytes32 => mapping(address => uint256)) public liquidityProviders;
    
    uint256 public constant FEE_DENOMINATOR = 1000;
    uint256 public swapFee = 3; // 0.3%
    
    event PoolCreated(bytes32 indexed poolId, address tokenA, address tokenB);
    event LiquidityAdded(bytes32 indexed poolId, address provider, uint256 amountA, uint256 amountB, uint256 liquidity);
    event LiquidityRemoved(bytes32 indexed poolId, address provider, uint256 amountA, uint256 amountB);
    event Swap(bytes32 indexed poolId, address indexed trader, address tokenIn, uint256 amountIn, uint256 amountOut);
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @dev Create a new liquidity pool
     */
    function createPool(address tokenA, address tokenB) external returns (bytes32 poolId) {
        require(tokenA != tokenB, "Identical tokens");
        require(tokenA != address(0) && tokenB != address(0), "Zero address");
        
        poolId = keccak256(abi.encodePacked(tokenA, tokenB));
        require(pools[poolId].tokenA == address(0), "Pool exists");
        
        pools[poolId] = Pool({
            tokenA: tokenA,
            tokenB: tokenB,
            reserveA: 0,
            reserveB: 0,
            totalLiquidity: 0
        });
        
        emit PoolCreated(poolId, tokenA, tokenB);
    }
    
    /**
     * @dev Add liquidity to pool
     */
    function addLiquidity(
        bytes32 poolId,
        uint256 amountA,
        uint256 amountB
    ) external nonReentrant returns (uint256 liquidity) {
        Pool storage pool = pools[poolId];
        require(pool.tokenA != address(0), "Pool doesn't exist");
        
        IERC20(pool.tokenA).transferFrom(msg.sender, address(this), amountA);
        IERC20(pool.tokenB).transferFrom(msg.sender, address(this), amountB);
        
        if (pool.totalLiquidity == 0) {
            liquidity = sqrt(amountA * amountB);
        } else {
            liquidity = min(
                (amountA * pool.totalLiquidity) / pool.reserveA,
                (amountB * pool.totalLiquidity) / pool.reserveB
            );
        }
        
        require(liquidity > 0, "Insufficient liquidity");
        
        pool.reserveA += amountA;
        pool.reserveB += amountB;
        pool.totalLiquidity += liquidity;
        liquidityProviders[poolId][msg.sender] += liquidity;
        
        emit LiquidityAdded(poolId, msg.sender, amountA, amountB, liquidity);
    }
    
    /**
     * @dev Swap tokens (optimized for high-frequency trades)
     */
    function swap(
        bytes32 poolId,
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant returns (uint256 amountOut) {
        Pool storage pool = pools[poolId];
        require(pool.tokenA != address(0), "Pool doesn't exist");
        require(tokenIn == pool.tokenA || tokenIn == pool.tokenB, "Invalid token");
        
        bool isTokenA = tokenIn == pool.tokenA;
        uint256 reserveIn = isTokenA ? pool.reserveA : pool.reserveB;
        uint256 reserveOut = isTokenA ? pool.reserveB : pool.reserveA;
        
        uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - swapFee);
        amountOut = (amountInWithFee * reserveOut) / (reserveIn * FEE_DENOMINATOR + amountInWithFee);
        
        require(amountOut >= minAmountOut, "Slippage exceeded");
        require(amountOut < reserveOut, "Insufficient liquidity");
        
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        
        address tokenOut = isTokenA ? pool.tokenB : pool.tokenA;
        IERC20(tokenOut).transfer(msg.sender, amountOut);
        
        if (isTokenA) {
            pool.reserveA += amountIn;
            pool.reserveB -= amountOut;
        } else {
            pool.reserveB += amountIn;
            pool.reserveA -= amountOut;
        }
        
        emit Swap(poolId, msg.sender, tokenIn, amountIn, amountOut);
    }
    
    /**
     * @dev Remove liquidity
     */
    function removeLiquidity(
        bytes32 poolId,
        uint256 liquidity
    ) external nonReentrant returns (uint256 amountA, uint256 amountB) {
        Pool storage pool = pools[poolId];
        require(liquidityProviders[poolId][msg.sender] >= liquidity, "Insufficient liquidity");
        
        amountA = (liquidity * pool.reserveA) / pool.totalLiquidity;
        amountB = (liquidity * pool.reserveB) / pool.totalLiquidity;
        
        require(amountA > 0 && amountB > 0, "Insufficient amounts");
        
        liquidityProviders[poolId][msg.sender] -= liquidity;
        pool.totalLiquidity -= liquidity;
        pool.reserveA -= amountA;
        pool.reserveB -= amountB;
        
        IERC20(pool.tokenA).transfer(msg.sender, amountA);
        IERC20(pool.tokenB).transfer(msg.sender, amountB);
        
        emit LiquidityRemoved(poolId, msg.sender, amountA, amountB);
    }
    
    // Helper functions
    function sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }
    
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
    
    /**
     * @dev Update swap fee (only owner)
     */
    function setSwapFee(uint256 newFee) external onlyOwner {
        require(newFee <= 30, "Fee too high"); // Max 3%
        swapFee = newFee;
    }
}

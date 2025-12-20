const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("HighSpeedDEX", function () {
  async function deployDEXFixture() {
    const [owner, trader1, trader2] = await ethers.getSigners();
    
    // Deploy DEX
    const HighSpeedDEX = await ethers.getContractFactory("HighSpeedDEX");
    const dex = await HighSpeedDEX.deploy();
    await dex.waitForDeployment();
    
    // Deploy two test tokens
    const Token = await ethers.getContractFactory("contracts/GenContract.sol:GenContract");
    const tokenA = await Token.deploy();
    const tokenB = await Token.deploy();
    await tokenA.waitForDeployment();
    await tokenB.waitForDeployment();
    
    // Mint tokens to traders
    const mintAmount = ethers.parseEther("100000");
    await tokenA.mint(trader1.address, mintAmount);
    await tokenA.mint(trader2.address, mintAmount);
    await tokenB.mint(trader1.address, mintAmount);
    await tokenB.mint(trader2.address, mintAmount);
    
    return { dex, tokenA, tokenB, owner, trader1, trader2 };
  }

  describe("Pool Creation", function () {
    it("Should create a new pool", async function () {
      const { dex, tokenA, tokenB } = await loadFixture(deployDEXFixture);
      
      await expect(dex.createPool(tokenA.target, tokenB.target))
        .to.emit(dex, "PoolCreated");
      
      const poolId = ethers.solidityPackedKeccak256(
        ["address", "address"],
        [tokenA.target, tokenB.target]
      );
      
      const pool = await dex.pools(poolId);
      expect(pool.tokenA).to.equal(tokenA.target);
      expect(pool.tokenB).to.equal(tokenB.target);
    });

    it("Should fail to create duplicate pool", async function () {
      const { dex, tokenA, tokenB } = await loadFixture(deployDEXFixture);
      
      await dex.createPool(tokenA.target, tokenB.target);
      await expect(
        dex.createPool(tokenA.target, tokenB.target)
      ).to.be.revertedWith("Pool exists");
    });

    it("Should fail with identical tokens", async function () {
      const { dex, tokenA } = await loadFixture(deployDEXFixture);
      
      await expect(
        dex.createPool(tokenA.target, tokenA.target)
      ).to.be.revertedWith("Identical tokens");
    });
  });

  describe("Add Liquidity", function () {
    it("Should add initial liquidity", async function () {
      const { dex, tokenA, tokenB, trader1 } = await loadFixture(deployDEXFixture);
      
      await dex.createPool(tokenA.target, tokenB.target);
      const poolId = ethers.solidityPackedKeccak256(
        ["address", "address"],
        [tokenA.target, tokenB.target]
      );
      
      const amountA = ethers.parseEther("1000");
      const amountB = ethers.parseEther("1000");
      
      await tokenA.connect(trader1).approve(dex.target, amountA);
      await tokenB.connect(trader1).approve(dex.target, amountB);
      
      await expect(dex.connect(trader1).addLiquidity(poolId, amountA, amountB))
        .to.emit(dex, "LiquidityAdded");
      
      const pool = await dex.pools(poolId);
      expect(pool.reserveA).to.equal(amountA);
      expect(pool.reserveB).to.equal(amountB);
    });

    it("Should add subsequent liquidity proportionally", async function () {
      const { dex, tokenA, tokenB, trader1, trader2 } = await loadFixture(deployDEXFixture);
      
      await dex.createPool(tokenA.target, tokenB.target);
      const poolId = ethers.solidityPackedKeccak256(
        ["address", "address"],
        [tokenA.target, tokenB.target]
      );
      
      const amountA1 = ethers.parseEther("1000");
      const amountB1 = ethers.parseEther("1000");
      
      await tokenA.connect(trader1).approve(dex.target, amountA1);
      await tokenB.connect(trader1).approve(dex.target, amountB1);
      await dex.connect(trader1).addLiquidity(poolId, amountA1, amountB1);
      
      const amountA2 = ethers.parseEther("500");
      const amountB2 = ethers.parseEther("500");
      
      await tokenA.connect(trader2).approve(dex.target, amountA2);
      await tokenB.connect(trader2).approve(dex.target, amountB2);
      await dex.connect(trader2).addLiquidity(poolId, amountA2, amountB2);
      
      const pool = await dex.pools(poolId);
      expect(pool.reserveA).to.equal(amountA1 + amountA2);
      expect(pool.reserveB).to.equal(amountB1 + amountB2);
    });
  });

  describe("Swapping", function () {
    async function setupPoolWithLiquidity() {
      const fixture = await loadFixture(deployDEXFixture);
      const { dex, tokenA, tokenB, trader1 } = fixture;
      
      await dex.createPool(tokenA.target, tokenB.target);
      const poolId = ethers.solidityPackedKeccak256(
        ["address", "address"],
        [tokenA.target, tokenB.target]
      );
      
      const liquidityAmount = ethers.parseEther("10000");
      await tokenA.connect(trader1).approve(dex.target, liquidityAmount);
      await tokenB.connect(trader1).approve(dex.target, liquidityAmount);
      await dex.connect(trader1).addLiquidity(poolId, liquidityAmount, liquidityAmount);
      
      return { ...fixture, poolId };
    }

    it("Should swap tokens correctly", async function () {
      const { dex, tokenA, tokenB, trader2, poolId } = await setupPoolWithLiquidity();
      
      const swapAmount = ethers.parseEther("100");
      await tokenA.connect(trader2).approve(dex.target, swapAmount);
      
      const balanceBefore = await tokenB.balanceOf(trader2.address);
      
      await expect(
        dex.connect(trader2).swap(poolId, tokenA.target, swapAmount, 0)
      ).to.emit(dex, "Swap");
      
      const balanceAfter = await tokenB.balanceOf(trader2.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should respect slippage protection", async function () {
      const { dex, tokenA, trader2, poolId } = await setupPoolWithLiquidity();
      
      const swapAmount = ethers.parseEther("100");
      await tokenA.connect(trader2).approve(dex.target, swapAmount);
      
      await expect(
        dex.connect(trader2).swap(poolId, tokenA.target, swapAmount, ethers.parseEther("1000"))
      ).to.be.revertedWith("Slippage exceeded");
    });

    it("Should apply correct fees", async function () {
      const { dex, tokenA, tokenB, trader2, poolId } = await setupPoolWithLiquidity();
      
      const swapAmount = ethers.parseEther("1000");
      await tokenA.connect(trader2).approve(dex.target, swapAmount);
      
      const pool = await dex.pools(poolId);
      const reserveIn = pool.reserveA;
      const reserveOut = pool.reserveB;
      
      // Get trader's initial balance
      const initialBalance = await tokenB.balanceOf(trader2.address);
      
      // Calculate expected output with 0.3% fee
      const amountInWithFee = swapAmount * 997n;
      const expectedOut = (amountInWithFee * reserveOut) / (reserveIn * 1000n + amountInWithFee);
      
      await dex.connect(trader2).swap(poolId, tokenA.target, swapAmount, 0);
      
      // Check that trader received approximately expected amount (accounting for precision)
      const finalBalance = await tokenB.balanceOf(trader2.address);
      const receivedAmount = finalBalance - initialBalance;
      expect(receivedAmount).to.be.closeTo(expectedOut, ethers.parseEther("1"));
    });
  });

  describe("Remove Liquidity", function () {
    async function setupPoolWithLiquidity() {
      const fixture = await loadFixture(deployDEXFixture);
      const { dex, tokenA, tokenB, trader1 } = fixture;
      
      await dex.createPool(tokenA.target, tokenB.target);
      const poolId = ethers.solidityPackedKeccak256(
        ["address", "address"],
        [tokenA.target, tokenB.target]
      );
      
      const liquidityAmount = ethers.parseEther("10000");
      await tokenA.connect(trader1).approve(dex.target, liquidityAmount);
      await tokenB.connect(trader1).approve(dex.target, liquidityAmount);
      await dex.connect(trader1).addLiquidity(poolId, liquidityAmount, liquidityAmount);
      
      return { ...fixture, poolId };
    }

    it("Should remove liquidity correctly", async function () {
      const { dex, tokenA, tokenB, trader1, poolId } = await setupPoolWithLiquidity();
      
      const liquidityToRemove = ethers.parseEther("5000");
      
      const balanceABefore = await tokenA.balanceOf(trader1.address);
      const balanceBBefore = await tokenB.balanceOf(trader1.address);
      
      await expect(
        dex.connect(trader1).removeLiquidity(poolId, liquidityToRemove)
      ).to.emit(dex, "LiquidityRemoved");
      
      const balanceAAfter = await tokenA.balanceOf(trader1.address);
      const balanceBAfter = await tokenB.balanceOf(trader1.address);
      
      expect(balanceAAfter).to.be.gt(balanceABefore);
      expect(balanceBAfter).to.be.gt(balanceBBefore);
    });

    it("Should fail if insufficient liquidity", async function () {
      const { dex, trader2, poolId } = await setupPoolWithLiquidity();
      
      await expect(
        dex.connect(trader2).removeLiquidity(poolId, ethers.parseEther("1"))
      ).to.be.revertedWith("Insufficient liquidity");
    });
  });

  describe("Fee Management", function () {
    it("Should allow owner to update swap fee", async function () {
      const { dex, owner } = await loadFixture(deployDEXFixture);
      
      const newFee = 5; // 0.5%
      await dex.connect(owner).setSwapFee(newFee);
      expect(await dex.swapFee()).to.equal(newFee);
    });

    it("Should fail if fee is too high", async function () {
      const { dex, owner } = await loadFixture(deployDEXFixture);
      
      await expect(
        dex.connect(owner).setSwapFee(31)
      ).to.be.revertedWith("Fee too high");
    });

    it("Should fail if non-owner tries to update fee", async function () {
      const { dex, trader1 } = await loadFixture(deployDEXFixture);
      
      await expect(
        dex.connect(trader1).setSwapFee(5)
      ).to.be.revertedWithCustomError(dex, "OwnableUnauthorizedAccount");
    });
  });
});

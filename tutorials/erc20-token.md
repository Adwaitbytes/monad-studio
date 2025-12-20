# Building Your First ERC20 Token on Somnia

## Welcome to Somnia Developer Studio! 🚀

This tutorial will guide you through creating and deploying your first ERC20 token on the Somnia blockchain.

## What You'll Learn
- Understanding ERC20 token standard
- Deploying to Somnia testnet
- Interacting with your token
- Best security practices

## Prerequisites
- MetaMask wallet connected to Somnia Testnet
- Basic understanding of blockchain concepts

## Step 1: Understanding ERC20 Tokens

ERC20 is the most popular token standard on EVM-compatible blockchains. It defines a common interface for fungible tokens (tokens where each unit is identical and interchangeable).

### Key Functions:
- `transfer()` - Send tokens to another address
- `approve()` - Allow another address to spend your tokens
- `transferFrom()` - Transfer tokens on behalf of someone else
- `balanceOf()` - Check token balance
- `totalSupply()` - Get total token supply

## Step 2: Template Overview

Our ERC20 template includes:
- ✅ **OpenZeppelin** - Battle-tested, audited code
- ✅ **Mintable** - Owner can create new tokens
- ✅ **Burnable** - Users can destroy their tokens
- ✅ **Ownable** - Access control for admin functions

```solidity
contract GenContract is ERC20, ERC20Burnable, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }
}
```

## Step 3: Customizing Your Token

### Token Name & Symbol
- **Name**: Full token name (e.g., "Somnia Gold")
- **Symbol**: Ticker symbol (e.g., "SGOLD")
- **Initial Supply**: Number of tokens to mint initially

### Example Parameters:
```javascript
Name: "My Awesome Token"
Symbol: "MAT"
Initial Supply: 1000000 (will be 1,000,000 tokens with 18 decimals)
```

## Step 4: Security Check

Before deployment, our system runs automatic security analysis:

### What We Check:
- ✅ Known vulnerability patterns
- ✅ OpenZeppelin best practices
- ✅ Access control implementation
- ✅ Gas optimization opportunities

### Risk Levels:
- 🟢 **LOW**: Safe to deploy
- 🟡 **MEDIUM**: Review recommended
- 🔴 **HIGH**: Fixes required
- ⛔ **CRITICAL**: DO NOT DEPLOY

## Step 5: Deploying to Somnia

### Network Details:
- **Network**: Somnia Dream Testnet
- **Chain ID**: 50312
- **RPC URL**: https://dream-rpc.somnia.network
- **Explorer**: https://explorer.somnia.network

### Deployment Process:
1. Click "Deploy to Testnet"
2. Review gas estimate (~800,000 gas)
3. Confirm transaction in MetaMask
4. Wait for deployment confirmation
5. Get your contract address!

## Step 6: Interacting With Your Token

Once deployed, you can:

### View Token Info:
```javascript
await contract.name() // Returns "My Awesome Token"
await contract.symbol() // Returns "MAT"
await contract.totalSupply() // Returns initial supply
```

### Transfer Tokens:
```javascript
await contract.transfer(recipientAddress, amount)
```

### Mint New Tokens (Owner Only):
```javascript
await contract.mint(recipientAddress, amount)
```

### Burn Tokens:
```javascript
await contract.burn(amount)
```

## Step 7: Best Practices

### DO:
- ✅ Test on testnet first
- ✅ Verify contract source code
- ✅ Document token economics
- ✅ Use OpenZeppelin libraries
- ✅ Add events for important actions

### DON'T:
- ❌ Deploy untested code to mainnet
- ❌ Skip security audits for production
- ❌ Store private keys in code
- ❌ Ignore gas optimization
- ❌ Use unaudited custom implementations

## Step 8: Advanced Features

### Pausable Tokens:
Add ability to pause all transfers:
```solidity
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
```

### Capped Supply:
Limit maximum supply:
```solidity
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
```

### Snapshots:
Track balances at specific points:
```solidity
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
```

## Step 9: Gas Optimization Tips

### Save Gas By:
- Use `external` instead of `public` for external functions
- Batch operations when possible
- Use events instead of storage for historical data
- Avoid unnecessary storage writes
- Use `immutable` for values set in constructor

### Somnia Advantages:
- ⚡ Sub-second finality
- 💰 Lower gas fees than Ethereum
- 🚀 Higher throughput (400k+ TPS)
- 🌐 EVM-compatible

## Step 10: Next Steps

### Continue Learning:
- 📖 [ERC721 NFT Tutorial](./erc721-nft.md)
- 📖 [Staking Contract Tutorial](./staking-rewards.md)
- 📖 [DAO Tutorial](./simple-dao.md)

### Resources:
- [Somnia Documentation](https://docs.somnia.network)
- [OpenZeppelin Docs](https://docs.openzeppelin.com)
- [Solidity by Example](https://solidity-by-example.org)

## Troubleshooting

### Common Issues:

**"Insufficient funds for gas"**
- Get testnet tokens from Somnia faucet

**"Transaction reverted"**
- Check function parameters
- Ensure you have necessary permissions (onlyOwner functions)

**"Contract not verified"**
- Use block explorer's verify feature
- Submit source code and compiler settings

## Congratulations! 🎉

You've successfully created and deployed your first ERC20 token on Somnia!

### What's Next?
- Add liquidity to DEX
- Create token sale contract
- Build DApp frontend
- Integrate with metaverse projects

---

**Need Help?**
- Join [Somnia Discord](https://discord.gg/somnia)
- Check [Developer Docs](https://docs.somnia.network)
- Ask in [Developer Forum](https://forum.somnia.network)

---

*Built with ❤️ by Somnia Developer Studio*

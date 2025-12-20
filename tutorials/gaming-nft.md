# Creating Gaming NFTs on Somnia

## What You'll Build
A high-performance NFT collection optimized for gaming assets with rarity tiers, batch minting, and metadata storage.

## Why Somnia for Gaming NFTs?

Somnia's **400,000+ TPS** enables:
- ⚡ Instant minting during gameplay
- 🎮 Real-time in-game asset creation
- 💰 Negligible gas costs
- 🚀 Batch operations for MMORPGs

## Step 1: Understanding Gaming NFTs

Traditional NFTs work for art, but games need:
- **Rarity system** (Common, Rare, Epic, Legendary)
- **Metadata** (stats, attributes, appearance)
- **Batch minting** (drop 1000s of items at once)
- **High-speed trading** (in-game marketplaces)

## Step 2: Template Features

```solidity
✓ ERC-721 standard (NFT base)
✓ Rarity tiers (1-4 levels)
✓ URI storage (metadata/images)
✓ Batch minting (gas-optimized)
✓ Burnable (destroy items)
✓ Max supply cap (10,000 default)
```

## Step 3: Customize Your Collection

### Collection Name & Symbol
```solidity
constructor() ERC721("GameAsset", "GAST") Ownable(msg.sender) {}
```

**Update these:**
- `"GameAsset"` → Your game's asset name
- `"GAST"` → Short symbol

### Rarity System
```solidity
mapping(uint256 => uint256) public tokenRarity;
// 1 = Common (70% drop rate)
// 2 = Rare (20% drop rate)
// 3 = Epic (8% drop rate)
// 4 = Legendary (2% drop rate)
```

### Mint Price
```solidity
uint256 public mintPrice = 0.01 ether;
```

Adjust based on your game economy.

## Step 4: Metadata Structure

Store metadata on IPFS or your server:

```json
{
  "name": "Legendary Sword #1234",
  "description": "A mythical blade forged in dragon fire",
  "image": "ipfs://QmXxxx.../sword.png",
  "attributes": [
    { "trait_type": "Rarity", "value": "Legendary" },
    { "trait_type": "Attack", "value": 95 },
    { "trait_type": "Durability", "value": 100 },
    { "trait_type": "Element", "value": "Fire" }
  ]
}
```

## Step 5: Minting Options

### Single Mint (Player Purchase)
```javascript
const mintPrice = await nft.mintPrice();
await nft.mint(
  playerAddress,
  "ipfs://QmXxxx/metadata.json",
  2, // Rarity: Rare
  { value: mintPrice }
);
```

### Batch Mint (Game Event Rewards)
```javascript
// Award 100 players at once
const recipients = [...playerAddresses]; // 100 addresses
const uris = [...metadataURIs]; // 100 URIs
const rarities = [...rarityLevels]; // 100 rarity values

await nft.batchMint(recipients, uris, rarities);
```

**Somnia advantage**: Batch 1000 NFTs in seconds, costs pennies!

## Step 6: Deploy & Test

1. Select "Gaming NFT Collection" template
2. Customize name, symbol, max supply
3. Run security analysis
4. Deploy to Somnia Testnet
5. Test minting in your game

**Gas Cost**: ~2,500,000 gas (deployment)

## Step 7: Integration with Game

### Unity Example
```csharp
using Web3Unity.Scripts.Library.Ethers.Contracts;

public async Task<string> MintGameAsset(string playerAddress) {
    string contract = "0xYourNFTContract";
    string method = "mint";
    string[] args = {
        playerAddress,
        "ipfs://metadata.json",
        "2" // Rare item
    };
    
    string value = "10000000000000000"; // 0.01 ETH
    string response = await ERC721.MintNFT(contract, method, args, value);
    return response;
}
```

### Unreal Engine Example
```cpp
#include "Web3/SomniaWeb3.h"

void AMintNFT::MintAsset(FString PlayerAddress) {
    USomniaWeb3* Web3 = USomniaWeb3::GetInstance();
    Web3->CallContractFunction(
        "0xYourNFTContract",
        "mint",
        {PlayerAddress, "ipfs://metadata.json", "2"}
    );
}
```

## Step 8: In-Game Marketplace

Allow players to trade NFTs:

```solidity
// In your game contract
function listForSale(uint256 tokenId, uint256 price) external {
    require(nft.ownerOf(tokenId) == msg.sender, "Not owner");
    nft.transferFrom(msg.sender, address(this), tokenId);
    listings[tokenId] = Listing(msg.sender, price);
}

function buyAsset(uint256 tokenId) external payable {
    Listing memory listing = listings[tokenId];
    require(msg.value >= listing.price, "Insufficient payment");
    
    nft.transferFrom(address(this), msg.sender, tokenId);
    payable(listing.seller).transfer(msg.value);
}
```

## Real-World Examples

### 1. MMORPG Loot System
```solidity
function dropLoot(address player, uint256 bossLevel) external onlyGame {
    uint256 rarity = calculateRarity(bossLevel); // Higher boss = better loot
    string memory uri = generateMetadata(bossLevel, rarity);
    _mint(player, uri, rarity);
}
```

### 2. Battle Royale Skins
```solidity
function awardSeasonReward(address[] memory topPlayers) external onlyOwner {
    string[] memory uris = new string[](topPlayers.length);
    uint256[] memory rarities = new uint256[](topPlayers.length);
    
    for (uint i = 0; i < topPlayers.length; i++) {
        uris[i] = "ipfs://season1/reward.json";
        rarities[i] = i < 10 ? 4 : 3; // Top 10 get Legendary
    }
    
    batchMint(topPlayers, uris, rarities);
}
```

### 3. TCG/CCG Card Packs
```solidity
function openCardPack(address player) external payable {
    require(msg.value >= packPrice, "Insufficient payment");
    
    uint256[] memory cards = generateRandomCards(5); // 5 cards per pack
    for (uint i = 0; i < 5; i++) {
        uint256 rarity = determineRarity(cards[i]);
        _mint(player, getCardMetadata(cards[i]), rarity);
    }
}
```

## Performance Tips

### 1. Batch Operations
```solidity
// ❌ DON'T: Loop externally
for (let i = 0; i < 100; i++) {
    await nft.mint(addresses[i], uris[i], rarities[i]);
}

// ✅ DO: Single batch transaction
await nft.batchMint(addresses, uris, rarities);
```

### 2. Off-Chain Metadata
```solidity
// Store heavy data off-chain
_setTokenURI(tokenId, "ipfs://Qm.../metadata.json");

// Not on-chain:
// ❌ string public stats = "ATK:95,DEF:80,SPD:70";
```

### 3. Event Indexing
```solidity
event AssetMinted(
    address indexed to,
    uint256 indexed tokenId,
    uint256 rarity
);

// Your backend listens and updates game DB
```

## Rarity Distribution

Implement fair randomness:

```solidity
function getRarity() private view returns (uint256) {
    uint256 random = uint256(keccak256(abi.encodePacked(
        block.timestamp,
        block.prevrandao,
        msg.sender
    ))) % 100;
    
    if (random < 2) return 4;      // 2% Legendary
    if (random < 10) return 3;     // 8% Epic
    if (random < 30) return 2;     // 20% Rare
    return 1;                       // 70% Common
}
```

⚠️ **For production**: Use Chainlink VRF for provably fair randomness.

## Analytics & Tracking

Monitor your NFT economy:

```javascript
// Total minted by rarity
const legendary = await nft.filters.AssetMinted(null, null, 4);
const legendaryCount = await nft.queryFilter(legendary);

// Top holders
const transfers = await nft.filters.Transfer();
// Process and rank holders
```

## Troubleshooting

### "Max supply reached"
**Solution**: Increase `MAX_SUPPLY` or implement burning for recycling:
```solidity
function burnAndMint(uint256 tokenIdToBurn, address to, string memory uri, uint256 rarity) external {
    require(ownerOf(tokenIdToBurn) == msg.sender, "Not owner");
    burn(tokenIdToBurn);
    mint(to, uri, rarity);
}
```

### "Array length mismatch"
**Solution**: Ensure all arrays in `batchMint` have same length:
```javascript
console.assert(
    recipients.length === uris.length && 
    uris.length === rarities.length
);
```

## Next Steps

🎮 **Build a Staking System**: Let players earn rewards for holding NFTs  
💱 **Create In-Game DEX**: Enable instant trades between players  
🏆 **Add Achievements**: Mint special NFTs for milestones

## Resources

- [ERC-721 Standard](https://eips.ethereum.org/EIPS/eip-721)
- [OpenSea Metadata Standards](https://docs.opensea.io/docs/metadata-standards)
- [IPFS for Game Assets](https://docs.ipfs.tech/concepts/what-is-ipfs/)

---

**Ready to mint?** Deploy your gaming NFT collection now! 🎮

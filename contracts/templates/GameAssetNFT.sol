// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GameAssetNFT
 * @dev NFT contract optimized for gaming and metaverse assets on Monad
 * Features: Metadata storage, burnable, batch minting for high-TPS scenarios
 */
contract GameAssetNFT is ERC721, ERC721URIStorage, ERC721Burnable, Ownable {
    uint256 private _tokenIdCounter;
    uint256 public constant MAX_SUPPLY = 10000;
    uint256 public mintPrice = 0.01 ether;
    
    mapping(uint256 => uint256) public tokenRarity; // 1=Common, 2=Rare, 3=Epic, 4=Legendary
    
    event AssetMinted(address indexed to, uint256 indexed tokenId, uint256 rarity);
    event PriceUpdated(uint256 newPrice);
    
    constructor() ERC721("GameAsset", "GAST") Ownable(msg.sender) {}
    
    /**
     * @dev Mint single NFT
     */
    function mint(address to, string memory uri, uint256 rarity) public payable {
        require(_tokenIdCounter < MAX_SUPPLY, "Max supply reached");
        require(msg.value >= mintPrice, "Insufficient payment");
        require(rarity >= 1 && rarity <= 4, "Invalid rarity");
        
        uint256 tokenId = _tokenIdCounter++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        tokenRarity[tokenId] = rarity;
        
        emit AssetMinted(to, tokenId, rarity);
    }
    
    /**
     * @dev Batch mint for high-throughput scenarios (Monad optimized)
     */
    function batchMint(
        address[] calldata recipients,
        string[] calldata uris,
        uint256[] calldata rarities
    ) external onlyOwner {
        require(recipients.length == uris.length && uris.length == rarities.length, "Array length mismatch");
        require(_tokenIdCounter + recipients.length <= MAX_SUPPLY, "Exceeds max supply");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 tokenId = _tokenIdCounter++;
            _safeMint(recipients[i], tokenId);
            _setTokenURI(tokenId, uris[i]);
            tokenRarity[tokenId] = rarities[i];
            emit AssetMinted(recipients[i], tokenId, rarities[i]);
        }
    }
    
    /**
     * @dev Update mint price
     */
    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
        emit PriceUpdated(newPrice);
    }
    
    /**
     * @dev Withdraw contract balance
     */
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    // Required overrides
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

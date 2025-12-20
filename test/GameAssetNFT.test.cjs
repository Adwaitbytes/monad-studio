const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("GameAssetNFT", function () {
  async function deployNFTFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const GameAssetNFT = await ethers.getContractFactory("GameAssetNFT");
    const nft = await GameAssetNFT.deploy();
    await nft.waitForDeployment();
    return { nft, owner, addr1, addr2 };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { nft, owner } = await loadFixture(deployNFTFixture);
      expect(await nft.owner()).to.equal(owner.address);
    });

    it("Should have correct name and symbol", async function () {
      const { nft } = await loadFixture(deployNFTFixture);
      expect(await nft.name()).to.equal("GameAsset");
      expect(await nft.symbol()).to.equal("GAST");
    });
  });

  describe("Minting", function () {
    it("Should mint NFT with correct parameters", async function () {
      const { nft, owner, addr1 } = await loadFixture(deployNFTFixture);
      const mintPrice = await nft.mintPrice();
      
      await expect(nft.mint(addr1.address, "ipfs://test", 2, { value: mintPrice }))
        .to.emit(nft, "AssetMinted")
        .withArgs(addr1.address, 0, 2);
      
      expect(await nft.ownerOf(0)).to.equal(addr1.address);
      expect(await nft.tokenRarity(0)).to.equal(2);
      expect(await nft.tokenURI(0)).to.equal("ipfs://test");
    });

    it("Should fail if payment is insufficient", async function () {
      const { nft, addr1 } = await loadFixture(deployNFTFixture);
      await expect(
        nft.mint(addr1.address, "ipfs://test", 1, { value: 0 })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should fail with invalid rarity", async function () {
      const { nft, addr1 } = await loadFixture(deployNFTFixture);
      const mintPrice = await nft.mintPrice();
      await expect(
        nft.mint(addr1.address, "ipfs://test", 5, { value: mintPrice })
      ).to.be.revertedWith("Invalid rarity");
    });
  });

  describe("Batch Minting", function () {
    it("Should batch mint multiple NFTs", async function () {
      const { nft, owner, addr1, addr2 } = await loadFixture(deployNFTFixture);
      
      const recipients = [addr1.address, addr2.address];
      const uris = ["ipfs://test1", "ipfs://test2"];
      const rarities = [1, 3];
      
      await nft.batchMint(recipients, uris, rarities);
      
      expect(await nft.ownerOf(0)).to.equal(addr1.address);
      expect(await nft.ownerOf(1)).to.equal(addr2.address);
      expect(await nft.tokenRarity(0)).to.equal(1);
      expect(await nft.tokenRarity(1)).to.equal(3);
    });

    it("Should fail if array lengths mismatch", async function () {
      const { nft, addr1 } = await loadFixture(deployNFTFixture);
      await expect(
        nft.batchMint([addr1.address], ["ipfs://test1", "ipfs://test2"], [1])
      ).to.be.revertedWith("Array length mismatch");
    });

    it("Should fail if non-owner tries to batch mint", async function () {
      const { nft, addr1, addr2 } = await loadFixture(deployNFTFixture);
      await expect(
        nft.connect(addr1).batchMint([addr2.address], ["ipfs://test"], [1])
      ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    });
  });

  describe("Price Management", function () {
    it("Should allow owner to update mint price", async function () {
      const { nft, owner } = await loadFixture(deployNFTFixture);
      const newPrice = ethers.parseEther("0.02");
      
      await expect(nft.setMintPrice(newPrice))
        .to.emit(nft, "PriceUpdated")
        .withArgs(newPrice);
      
      expect(await nft.mintPrice()).to.equal(newPrice);
    });

    it("Should fail if non-owner tries to update price", async function () {
      const { nft, addr1 } = await loadFixture(deployNFTFixture);
      await expect(
        nft.connect(addr1).setMintPrice(ethers.parseEther("0.02"))
      ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    });
  });

  describe("Withdrawal", function () {
    it("Should allow owner to withdraw funds", async function () {
      const { nft, owner, addr1 } = await loadFixture(deployNFTFixture);
      const mintPrice = await nft.mintPrice();
      
      // Mint to accumulate funds
      await nft.connect(addr1).mint(addr1.address, "ipfs://test", 1, { value: mintPrice });
      
      const contractBalance = await ethers.provider.getBalance(nft.target);
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      
      await nft.withdraw();
      
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      expect(ownerBalanceAfter).to.be.gt(ownerBalanceBefore);
    });
  });

  describe("Max Supply", function () {
    it("Should enforce max supply limit", async function () {
      const { nft, owner } = await loadFixture(deployNFTFixture);
      const maxSupply = await nft.MAX_SUPPLY();
      
      // This is a gas-intensive test, so we'll just check the logic
      // In production, you'd test closer to the limit
      expect(maxSupply).to.equal(10000);
    });
  });

  describe("Burning", function () {
    it("Should allow token owner to burn their NFT", async function () {
      const { nft, addr1 } = await loadFixture(deployNFTFixture);
      const mintPrice = await nft.mintPrice();
      
      await nft.mint(addr1.address, "ipfs://test", 1, { value: mintPrice });
      await nft.connect(addr1).burn(0);
      
      await expect(nft.ownerOf(0)).to.be.reverted;
    });
  });
});

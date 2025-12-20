const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GenContract - ERC20 Token", function () {
  let genContract;
  let owner;
  let addr1;
  let addr2;

  const INITIAL_SUPPLY = ethers.parseEther("100000000");

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    
    const GenContract = await ethers.getContractFactory("contracts/GenContract.sol:GenContract");
    genContract = await GenContract.deploy();
    await genContract.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await genContract.owner()).to.equal(owner.address);
    });

    it("Should assign the total supply to the owner", async function () {
      const ownerBalance = await genContract.balanceOf(owner.address);
      expect(await genContract.totalSupply()).to.equal(ownerBalance);
    });

    it("Should have correct name and symbol", async function () {
      expect(await genContract.name()).to.equal("GenesisToken");
      expect(await genContract.symbol()).to.equal("GNT");
    });

    it("Should have 18 decimals", async function () {
      expect(await genContract.decimals()).to.equal(18);
    });
  });

  describe("Transactions", function () {
    it("Should transfer tokens between accounts", async function () {
      await genContract.transfer(addr1.address, ethers.parseEther("50"));
      const addr1Balance = await genContract.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(ethers.parseEther("50"));

      await genContract.connect(addr1).transfer(addr2.address, ethers.parseEther("50"));
      const addr2Balance = await genContract.balanceOf(addr2.address);
      expect(addr2Balance).to.equal(ethers.parseEther("50"));
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const initialOwnerBalance = await genContract.balanceOf(owner.address);
      await expect(
        genContract.connect(addr1).transfer(owner.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(genContract, "ERC20InsufficientBalance");

      expect(await genContract.balanceOf(owner.address)).to.equal(initialOwnerBalance);
    });

    it("Should update balances after transfers", async function () {
      const initialOwnerBalance = await genContract.balanceOf(owner.address);

      await genContract.transfer(addr1.address, ethers.parseEther("100"));
      await genContract.transfer(addr2.address, ethers.parseEther("50"));

      const finalOwnerBalance = await genContract.balanceOf(owner.address);
      expect(finalOwnerBalance).to.equal(initialOwnerBalance - ethers.parseEther("150"));

      const addr1Balance = await genContract.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(ethers.parseEther("100"));

      const addr2Balance = await genContract.balanceOf(addr2.address);
      expect(addr2Balance).to.equal(ethers.parseEther("50"));
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint new tokens", async function () {
      const mintAmount = ethers.parseEther("1000");
      await genContract.mint(addr1.address, mintAmount);
      
      expect(await genContract.balanceOf(addr1.address)).to.equal(mintAmount);
      expect(await genContract.totalSupply()).to.equal(INITIAL_SUPPLY + mintAmount);
    });

    it("Should not allow non-owner to mint", async function () {
      await expect(
        genContract.connect(addr1).mint(addr2.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(genContract, "OwnableUnauthorizedAccount");
    });
  });

  describe("Burning", function () {
    it("Should allow users to burn their own tokens", async function () {
      await genContract.transfer(addr1.address, ethers.parseEther("100"));
      
      await genContract.connect(addr1).burn(ethers.parseEther("50"));
      
      expect(await genContract.balanceOf(addr1.address)).to.equal(ethers.parseEther("50"));
      expect(await genContract.totalSupply()).to.equal(INITIAL_SUPPLY - ethers.parseEther("50"));
    });

    it("Should not allow burning more than balance", async function () {
      await genContract.transfer(addr1.address, ethers.parseEther("100"));
      
      await expect(
        genContract.connect(addr1).burn(ethers.parseEther("200"))
      ).to.be.revertedWithCustomError(genContract, "ERC20InsufficientBalance");
    });
  });

  describe("Pausable", function () {
    it("Should allow owner to pause", async function () {
      await genContract.pause();
      expect(await genContract.paused()).to.equal(true);
    });

    it("Should not allow transfers when paused", async function () {
      await genContract.pause();
      
      await expect(
        genContract.transfer(addr1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(genContract, "EnforcedPause");
    });

    it("Should allow owner to unpause", async function () {
      await genContract.pause();
      await genContract.unpause();
      
      expect(await genContract.paused()).to.equal(false);
      await genContract.transfer(addr1.address, ethers.parseEther("100"));
      expect(await genContract.balanceOf(addr1.address)).to.equal(ethers.parseEther("100"));
    });

    it("Should not allow non-owner to pause/unpause", async function () {
      await expect(
        genContract.connect(addr1).pause()
      ).to.be.revertedWithCustomError(genContract, "OwnableUnauthorizedAccount");
    });
  });

  describe("ETH Handling", function () {
    it("Should receive ETH", async function () {
      await owner.sendTransaction({
        to: await genContract.getAddress(),
        value: ethers.parseEther("1")
      });
      
      const balance = await ethers.provider.getBalance(await genContract.getAddress());
      expect(balance).to.equal(ethers.parseEther("1"));
    });

    it("Should allow owner to withdraw ETH", async function () {
      await owner.sendTransaction({
        to: await genContract.getAddress(),
        value: ethers.parseEther("1")
      });
      
      const initialBalance = await ethers.provider.getBalance(owner.address);
      const tx = await genContract.withdrawETH();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      
      const finalBalance = await ethers.provider.getBalance(owner.address);
      expect(finalBalance).to.be.closeTo(
        initialBalance + ethers.parseEther("1") - gasCost,
        ethers.parseEther("0.01")
      );
    });

    it("Should not allow non-owner to withdraw ETH", async function () {
      await owner.sendTransaction({
        to: await genContract.getAddress(),
        value: ethers.parseEther("1")
      });
      
      await expect(
        genContract.connect(addr1).withdrawETH()
      ).to.be.revertedWithCustomError(genContract, "OwnableUnauthorizedAccount");
    });
  });

  describe("Gas Optimization Tests", function () {
    it("Should efficiently handle batch transfers", async function () {
      const recipients = [addr1.address, addr2.address];
      const amounts = [ethers.parseEther("100"), ethers.parseEther("200")];
      
      for (let i = 0; i < recipients.length; i++) {
        await genContract.transfer(recipients[i], amounts[i]);
      }
      
      expect(await genContract.balanceOf(addr1.address)).to.equal(amounts[0]);
      expect(await genContract.balanceOf(addr2.address)).to.equal(amounts[1]);
    });
  });
});

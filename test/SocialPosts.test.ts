import { expect } from "chai";
import hre from "hardhat";

const { ethers } = hre;

describe("SocialPosts", () => {
  async function deploy() {
    const [author, other, tipper] = await ethers.getSigners();
    const SocialPosts = await ethers.getContractFactory("SocialPosts");
    const contract = await SocialPosts.deploy();
    await contract.waitForDeployment();
    return { contract, author, other, tipper };
  }

  it("mints a post and records author", async () => {
    const { contract, author } = await deploy();

    const tokenUri = "ipfs://post-1";
    const tx = await contract.connect(author).mintPost(tokenUri);

    await expect(tx).to.emit(contract, "PostMinted").withArgs(author.address, 1n, tokenUri);
    expect(await contract.exists(1n)).to.equal(true);
    expect(await contract.authorOf(1n)).to.equal(author.address);
    expect(await contract.tokenURI(1n)).to.equal(tokenUri);
  });

  it("prevents non-author from updating and prevents updates after freeze", async () => {
    const { contract, author, other } = await deploy();

    await contract.connect(author).mintPost("ipfs://post-1");

    await expect(contract.connect(other).updatePostURI(1n, "ipfs://hacked")).to.be.revertedWith("Only author");

    await expect(contract.connect(author).updatePostURI(1n, "ipfs://updated")).to.emit(contract, "PostUpdated");
    expect(await contract.tokenURI(1n)).to.equal("ipfs://updated");

    await expect(contract.connect(author).freezePost(1n)).to.emit(contract, "PostFrozen");
    await expect(contract.connect(author).updatePostURI(1n, "ipfs://nope")).to.be.revertedWith("Post frozen");
  });

  it("like/unlike is single-toggle per account", async () => {
    const { contract, author, other } = await deploy();

    await contract.connect(author).mintPost("ipfs://post-1");

    await expect(contract.connect(other).likePost(1n)).to.emit(contract, "PostLiked");
    expect(await contract.likesOf(1n)).to.equal(1n);

    await expect(contract.connect(other).likePost(1n)).to.be.revertedWith("Already liked");

    await expect(contract.connect(other).unlikePost(1n)).to.emit(contract, "PostUnliked");
    expect(await contract.likesOf(1n)).to.equal(0n);

    await expect(contract.connect(other).unlikePost(1n)).to.be.revertedWith("Not liked");
  });

  it("records tips and allows withdraw", async () => {
    const { contract, author, tipper } = await deploy();

    await contract.connect(author).mintPost("ipfs://post-1");

    const tipAmount = 1234n;
    const tipTx = await contract.connect(tipper).tipPost(1n, { value: tipAmount });

    await expect(tipTx).to.emit(contract, "PostTipped").withArgs(tipper.address, author.address, 1n, tipAmount);
    expect(await contract.tipsOf(1n)).to.equal(tipAmount);
    expect(await contract.withdrawableOf(author.address)).to.equal(tipAmount);

    await expect(() => contract.connect(author).withdrawTips()).to.changeEtherBalance(author, tipAmount);
    expect(await contract.withdrawableOf(author.address)).to.equal(0n);

    await expect(contract.connect(author).withdrawTips()).to.be.revertedWith("Nothing to withdraw");
  });

  it("burn removes post existence", async () => {
    const { contract, author } = await deploy();

    await contract.connect(author).mintPost("ipfs://post-1");
    await expect(contract.connect(author).burnPost(1n)).to.emit(contract, "PostBurned").withArgs(author.address, 1n);

    expect(await contract.exists(1n)).to.equal(false);
    await expect(contract.authorOf(1n)).to.be.revertedWith("Post does not exist");
  });
});

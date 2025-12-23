// @ts-nocheck
import { expect } from "chai";
import hardhat from "hardhat";

const hre = (hardhat as any)?.default ?? (hardhat as any);
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

  it("setProfile enforces limits and emits", async () => {
    const { contract, author } = await deploy();

    await expect(contract.connect(author).setProfile("Alice", "Bio", "ipfs://avatar")).
      to.emit(contract, "ProfileUpdated").withArgs(author.address, "Alice", "Bio", "ipfs://avatar");

    const long = "x".repeat(65);
    await expect(contract.connect(author).setProfile(long, "", "")).to.be.revertedWith("Name too long");
    await expect(contract.connect(author).setProfile("", "y".repeat(281), "")).to.be.revertedWith("Bio too long");
    await expect(contract.connect(author).setProfile("", "", "z".repeat(513))).to.be.revertedWith("Avatar too long");
  });

  it("commentPost validates and increments comment count", async () => {
    const { contract, author, other } = await deploy();

    await contract.connect(author).mintPost("ipfs://post-1");

    await expect(contract.connect(other).commentPost(1n, "")).to.be.revertedWith("Empty comment");
    await expect(contract.connect(other).commentPost(1n, "c".repeat(281))).to.be.revertedWith("Comment too long");

    await expect(contract.connect(other).commentPost(1n, "Hi")).to.emit(contract, "PostCommented");
    expect(await contract.commentsOf(1n)).to.equal(1n);
  });

  it("share/unshare is single-toggle per account", async () => {
    const { contract, author, other } = await deploy();

    await contract.connect(author).mintPost("ipfs://post-1");

    await expect(contract.connect(other).sharePost(1n)).to.emit(contract, "PostShared");
    expect(await contract.sharesOf(1n)).to.equal(1n);
    expect(await contract.hasShared(1n, other.address)).to.equal(true);

    await expect(contract.connect(other).sharePost(1n)).to.be.revertedWith("Already shared");

    await expect(contract.connect(other).unsharePost(1n)).to.emit(contract, "PostUnshared");
    expect(await contract.sharesOf(1n)).to.equal(0n);
    expect(await contract.hasShared(1n, other.address)).to.equal(false);

    await expect(contract.connect(other).unsharePost(1n)).to.be.revertedWith("Not shared");
  });

  it("follow/unfollow validates inputs and updates isFollowing", async () => {
    const { contract, author, other } = await deploy();

    await expect(contract.connect(author).follow(ethers.ZeroAddress)).to.be.revertedWith("Invalid followee");
    await expect(contract.connect(author).follow(author.address)).to.be.revertedWith("Cannot follow self");

    await expect(contract.connect(author).follow(other.address)).to.emit(contract, "Followed").withArgs(author.address, other.address);
    expect(await contract.isFollowing(author.address, other.address)).to.equal(true);

    await expect(contract.connect(author).follow(other.address)).to.be.revertedWith("Already following");

    await expect(contract.connect(author).unfollow(other.address)).to.emit(contract, "Unfollowed").withArgs(author.address, other.address);
    expect(await contract.isFollowing(author.address, other.address)).to.equal(false);

    await expect(contract.connect(author).unfollow(other.address)).to.be.revertedWith("Not following");
  });

  it("freezePost cannot be called twice", async () => {
    const { contract, author } = await deploy();

    await contract.connect(author).mintPost("ipfs://post-1");
    await expect(contract.connect(author).freezePost(1n)).to.emit(contract, "PostFrozen");
    await expect(contract.connect(author).freezePost(1n)).to.be.revertedWith("Post already frozen");
    expect(await contract.isPostFrozen(1n)).to.equal(true);
  });

  it("tipPost requires value > 0", async () => {
    const { contract, author, tipper } = await deploy();

    await contract.connect(author).mintPost("ipfs://post-1");
    await expect(contract.connect(tipper).tipPost(1n, { value: 0n })).to.be.revertedWith("No tip sent");
  });
});

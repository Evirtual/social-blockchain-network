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

  it("blocks minting for non-allowed wallets unless owner approves", async () => {
    const { contract, author, other } = await deploy();

    await expect(contract.connect(other).mintPost("ipfs://post-x")).to.be.revertedWith("Poster not allowed");

    await expect(contract.connect(author).setPosterAllowed(other.address, true))
      .to.emit(contract, "PosterAllowed")
      .withArgs(other.address, true);

    await expect(contract.connect(other).mintPost("ipfs://post-x"))
      .to.emit(contract, "PostMinted")
      .withArgs(other.address, 1n, "ipfs://post-x");
  });

  it("allows users to request approval once, and clears request on approval", async () => {
    const { contract, author, other } = await deploy();

    await expect(contract.connect(other).requestPosterApproval())
      .to.emit(contract, "PosterApprovalRequested")
      .withArgs(other.address);

    expect(await contract.hasPosterRequested(other.address)).to.equal(true);
    await expect(contract.connect(other).requestPosterApproval()).to.be.revertedWith("Already requested");

    await contract.connect(author).setPosterAllowed(other.address, true);
    expect(await contract.hasPosterRequested(other.address)).to.equal(false);
  });

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

    await expect(contract.connect(other).freezePost(1n)).to.be.revertedWith("Only author");

    await expect(contract.connect(author).freezePost(1n)).to.emit(contract, "PostFrozen");
    await expect(contract.connect(author).updatePostURI(1n, "ipfs://nope")).to.be.revertedWith("Post frozen");
  });

  it("like/unlike is single-toggle per account", async () => {
    const { contract, author, other } = await deploy();

    await contract.connect(author).mintPost("ipfs://post-1");

    await expect(contract.connect(other).likePost(1n)).to.emit(contract, "PostLiked");
    expect(await contract.likesOf(1n)).to.equal(1n);
    expect(await contract.hasLiked(1n, other.address)).to.equal(true);

    await expect(contract.connect(other).likePost(1n)).to.be.revertedWith("Already liked");

    await expect(contract.connect(other).unlikePost(1n)).to.emit(contract, "PostUnliked");
    expect(await contract.likesOf(1n)).to.equal(0n);
    expect(await contract.hasLiked(1n, other.address)).to.equal(false);

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
    const { contract, author, other } = await deploy();

    await contract.connect(author).mintPost("ipfs://post-1");

    await expect(contract.connect(other).burnPost(1n)).to.be.revertedWith("Only author");

    await expect(contract.connect(author).burnPost(1n)).to.emit(contract, "PostBurned").withArgs(author.address, 1n);

    expect(await contract.exists(1n)).to.equal(false);
    await expect(contract.authorOf(1n)).to.be.revertedWith("Post does not exist");
  });

  it("owner can clear or override a user's profile", async () => {
    const { contract, author, other } = await deploy();

    await expect(contract.connect(author).adminSetProfile(other.address, "bad", "bio", "avatar")).to.emit(
      contract,
      "ProfileModerated"
    );
    expect(await contract.profileOf(other.address)).to.deep.equal(["bad", "bio", "avatar"]);

    await expect(contract.connect(other).adminClearProfile(other.address)).to.be.reverted;

    await expect(contract.connect(author).adminClearProfile(other.address))
      .to.emit(contract, "ProfileClearedByAdmin")
      .withArgs(author.address, other.address);
    expect(await contract.profileOf(other.address)).to.deep.equal(["", "", ""]);

    await expect(contract.connect(author).adminSetProfile(other.address, "clean", "", ""))
      .to.emit(contract, "ProfileModerated")
      .withArgs(author.address, other.address, "clean", "", "");
    expect(await contract.profileOf(other.address)).to.deep.equal(["clean", "", ""]);
  });

  it("owner can burn any post (moderation)", async () => {
    const { contract, author, other } = await deploy();

    await contract.connect(author).mintPost("ipfs://post-1");
    await expect(contract.connect(other).adminBurnPost(1n)).to.be.reverted;

    await expect(contract.connect(author).adminBurnPost(1n))
      .to.emit(contract, "PostBurnedByAdmin")
      .withArgs(author.address, author.address, 1n);

    expect(await contract.exists(1n)).to.equal(false);
  });

  it("blocks profile edits for non-approved wallets", async () => {
    const { contract, author, other } = await deploy();

    await expect(contract.connect(other).setProfile("name", "bio", "avatar")).to.be.revertedWith("Poster not allowed");

    await contract.connect(author).setPosterAllowed(other.address, true);
    await expect(contract.connect(other).setProfile("name", "bio", "avatar")).to.emit(contract, "ProfileUpdated");
  });

  it("tracks whether a wallet was ever disapproved", async () => {
    const { contract, author, other } = await deploy();

    expect(await contract.wasPosterDisapproved(other.address)).to.equal(false);

    await contract.connect(author).setPosterAllowed(other.address, true);
    expect(await contract.wasPosterDisapproved(other.address)).to.equal(false);

    await contract.connect(author).setPosterAllowed(other.address, false);
    expect(await contract.wasPosterDisapproved(other.address)).to.equal(true);

    // Should remain flagged even if later re-approved.
    await contract.connect(author).setPosterAllowed(other.address, true);
    expect(await contract.wasPosterDisapproved(other.address)).to.equal(true);
  });

  it("owner can edit any post (moderation)", async () => {
    const { contract, author, other } = await deploy();

    await contract.connect(author).setPosterAllowed(other.address, true);
    await contract.connect(other).mintPost("ipfs://post-1");

    await expect(contract.connect(other).adminUpdatePostURI(1n, "ipfs://mod"))
      .to.be.reverted;

    await expect(contract.connect(author).adminUpdatePostURI(1n, "ipfs://mod"))
      .to.emit(contract, "PostUpdatedByAdmin")
      .withArgs(author.address, other.address, 1n, "ipfs://mod");

    expect(await contract.tokenURI(1n)).to.equal("ipfs://mod");
  });

  it("setProfile enforces limits and emits", async () => {
    const { contract, author } = await deploy();

    await expect(contract.connect(author).setProfile("Alice", "Bio", "ipfs://avatar"))
      .to.emit(contract, "ProfileUpdated")
      .withArgs(author.address, "Alice", "Bio", "ipfs://avatar");

    const [name, bio, avatar] = await contract.profileOf(author.address);
    expect(name).to.equal("Alice");
    expect(bio).to.equal("Bio");
    expect(avatar).to.equal("ipfs://avatar");

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

    await expect(contract.connect(author).unfollow(ethers.ZeroAddress)).to.be.revertedWith("Invalid followee");

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

  it("reverts on non-existent token across post methods", async () => {
    const { contract, author, other } = await deploy();

    await expect(contract.authorOf(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.updatePostURI(999n, "ipfs://x")).to.be.revertedWith("Post does not exist");
    await expect(contract.freezePost(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.isPostFrozen(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.burnPost(999n)).to.be.revertedWith("Post does not exist");

    await expect(contract.likesOf(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.commentsOf(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.sharesOf(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.tipsOf(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.hasLiked(999n, author.address)).to.be.revertedWith("Post does not exist");
    await expect(contract.hasShared(999n, author.address)).to.be.revertedWith("Post does not exist");

    await expect(contract.connect(other).likePost(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.connect(other).unlikePost(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.connect(other).sharePost(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.connect(other).unsharePost(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.connect(other).commentPost(999n, "Hi")).to.be.revertedWith("Post does not exist");
    await expect(contract.connect(other).tipPost(999n, { value: 1n })).to.be.revertedWith("Post does not exist");
  });

  it("withdrawTips reverts when recipient rejects ETH (no state loss)", async () => {
    const { contract, author, tipper } = await deploy();

    const Reject = await ethers.getContractFactory("RejectEtherAuthor");
    const reject = await Reject.deploy(await contract.getAddress());
    await reject.waitForDeployment();

    await contract.connect(author).setPosterAllowed(await reject.getAddress(), true);

    await reject.mint("ipfs://post-1");

    const tipAmount = 77n;
    await contract.connect(tipper).tipPost(1n, { value: tipAmount });
    expect(await contract.withdrawableOf(await reject.getAddress())).to.equal(tipAmount);

    await expect(reject.withdraw()).to.be.revertedWith("Withdraw failed");
    expect(await contract.withdrawableOf(await reject.getAddress())).to.equal(tipAmount);
  });
});

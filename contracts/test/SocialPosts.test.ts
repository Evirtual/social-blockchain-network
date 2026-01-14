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

    await expect(contract.connect(other).mintPost("ipfs://post-x", "Post X", "Body X")).to.be.revertedWith(
      "Poster not allowed"
    );

    await expect(contract.connect(author).setPosterAllowed(other.address, true))
      .to.emit(contract, "PosterAllowed")
      .withArgs(other.address, true);

    await expect(contract.connect(other).mintPost("ipfs://post-x", "Post X", "Body X"))
      .to.emit(contract, "PostMinted")
      .withArgs(other.address, 1n, "Post X", "Body X", "ipfs://post-x");
  });

  it("reports whether a poster is allowed", async () => {
    const { contract, author, other } = await deploy();

    expect(await contract.isPosterAllowed(author.address)).to.equal(true);
    expect(await contract.isPosterAllowed(other.address)).to.equal(false);

    await contract.connect(author).setPosterAllowed(other.address, true);
    expect(await contract.isPosterAllowed(other.address)).to.equal(true);
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
    const tx = await contract.connect(author).mintPost(tokenUri, "First Post", "Hello world");

    await expect(tx).to.emit(contract, "PostMinted").withArgs(author.address, 1n, "First Post", "Hello world", tokenUri);
    expect(await contract.exists(1n)).to.equal(true);
    expect(await contract.authorOf(1n)).to.equal(author.address);
    expect(await contract.tokenURI(1n)).to.equal(tokenUri);
  });

  it("prevents non-author from updating and prevents updates after freeze", async () => {
    const { contract, author, other } = await deploy();

    await contract.connect(author).mintPost("ipfs://post-1", "Post 1", "Body 1");
    expect(await contract.isPostEdited(1n)).to.equal(false);

    await expect(contract.connect(other).updatePostURI(1n, "ipfs://hacked", "Hacked", "Hacked body")).to.be.revertedWith(
      "Only author"
    );

    await expect(contract.connect(author).updatePostURI(1n, "ipfs://updated", "Updated", "Updated body")).to.emit(
      contract,
      "PostUpdated"
    );
    expect(await contract.tokenURI(1n)).to.equal("ipfs://updated");
    expect(await contract.isPostEdited(1n)).to.equal(true);

    await expect(contract.connect(other).freezePost(1n)).to.be.revertedWith("Only author");

    await expect(contract.connect(author).freezePost(1n)).to.emit(contract, "PostFrozen");
    await expect(contract.connect(author).updatePostURI(1n, "ipfs://nope", "Nope", "Nope body")).to.be.revertedWith(
      "Post frozen"
    );
  });

  it("like/unlike is single-toggle per account", async () => {
    const { contract, author, other } = await deploy();

    await contract.connect(author).mintPost("ipfs://post-1", "Post 1", "Body 1");

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

    await contract.connect(author).mintPost("ipfs://post-1", "Post 1", "Body 1");

    const tipAmount = 1234n;
    const tipTx = await contract.connect(tipper).tipPost(1n, { value: tipAmount });

    await expect(tipTx).to.emit(contract, "PostTipped").withArgs(tipper.address, author.address, 1n, tipAmount);
    expect(await contract.tipsOf(1n)).to.equal(tipAmount);
    expect(await contract.withdrawableOf(author.address)).to.equal(tipAmount);

    await expect(() => contract.connect(author).withdrawTips()).to.changeEtherBalance(author, tipAmount);
    expect(await contract.withdrawableOf(author.address)).to.equal(0n);

    await expect(contract.connect(author).withdrawTips()).to.be.revertedWith("Nothing to withdraw");
  });

  it("withdrawTips charges withdraw fee and sends it to treasury", async () => {
    const { contract, author, other, tipper } = await deploy();

    await contract.connect(author).mintPost("ipfs://post-1", "Post 1", "Body 1");

    // Ensure protocol treasury is not the same as the withdrawing author.
    await expect(contract.connect(author).setProtocolTreasury(other.address))
      .to.emit(contract, "ProtocolTreasuryUpdated")
      .withArgs(author.address, other.address);

    const tipAmount = 1234n;
    await contract.connect(tipper).tipPost(1n, { value: tipAmount });
    expect(await contract.withdrawableOf(author.address)).to.equal(tipAmount);

    const feeBps = await contract.withdrawFeeBps();
    const feeWei = (tipAmount * BigInt(feeBps)) / 10_000n;
    const netWei = tipAmount - feeWei;

    const beforeAuthor = await ethers.provider.getBalance(author.address);
    const beforeTreasury = await ethers.provider.getBalance(other.address);

    const tx = await contract.connect(author).withdrawTips();
    const receipt = await tx.wait();

    await expect(tx).to.emit(contract, "WithdrawFeePaid").withArgs(author.address, other.address, feeWei, feeBps);
    await expect(tx).to.emit(contract, "TipsWithdrawn").withArgs(author.address, tipAmount);

    const afterAuthor = await ethers.provider.getBalance(author.address);
    const afterTreasury = await ethers.provider.getBalance(other.address);

    expect(afterTreasury - beforeTreasury).to.equal(feeWei);

    const gasPrice = (receipt as any).gasPrice ?? (receipt as any).effectiveGasPrice ?? 0n;
    const gasCost = (receipt?.gasUsed ?? 0n) * gasPrice;
    expect(afterAuthor - beforeAuthor + gasCost).to.equal(netWei);

    expect(await contract.withdrawableOf(author.address)).to.equal(0n);
  });

  it("burn removes post existence", async () => {
    const { contract, author, other } = await deploy();

    await contract.connect(author).mintPost("ipfs://post-1", "Post 1", "Body 1");

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

    await contract.connect(author).mintPost("ipfs://post-1", "Post 1", "Body 1");
    await expect(contract.connect(other).adminBurnPost(1n)).to.be.reverted;

    await expect(contract.connect(author).adminBurnPost(1n))
      .to.emit(contract, "PostBurnedByAdmin")
      .withArgs(author.address, author.address, 1n);

    expect(await contract.exists(1n)).to.equal(false);
  });

  it("owner can reset an account in a single call (block + clear + burn)", async () => {
    const { contract, author, other } = await deploy();

    await contract.connect(author).setPosterAllowed(other.address, true);
    await contract.connect(other).setProfile("name", "bio", "avatar");
    await contract.connect(other).mintPost("ipfs://post-1", "Post 1", "Body 1");

    expect(await contract.isPosterAllowed(other.address)).to.equal(true);
    expect(await contract.profileOf(other.address)).to.deep.equal(["name", "bio", "avatar"]);
    expect(await contract.exists(1n)).to.equal(true);
    expect(await contract.wasPosterDisapproved(other.address)).to.equal(false);

    await expect(contract.connect(author).adminResetAccount(other.address, [1n, 999n]))
      .to.emit(contract, "PosterAllowed")
      .withArgs(other.address, false);

    expect(await contract.isPosterAllowed(other.address)).to.equal(false);
    expect(await contract.wasPosterDisapproved(other.address)).to.equal(true);
    expect(await contract.profileOf(other.address)).to.deep.equal(["", "", ""]);
    expect(await contract.exists(1n)).to.equal(false);
  });

  it("adminResetAccount burns all posts when tokenIds is empty", async () => {
    const { contract, author, other } = await deploy();

    await contract.connect(author).setPosterAllowed(other.address, true);
    await contract.connect(other).mintPost("ipfs://post-1", "Post 1", "Body 1");
    await contract.connect(other).mintPost("ipfs://post-2", "Post 2", "Body 2");
    await contract.connect(other).mintPost("ipfs://post-3", "Post 3", "Body 3");

    expect(await contract.exists(1n)).to.equal(true);
    expect(await contract.exists(2n)).to.equal(true);
    expect(await contract.exists(3n)).to.equal(true);

    await expect(contract.connect(author).adminResetAccount(other.address, []))
      .to.emit(contract, "PosterAllowed")
      .withArgs(other.address, false);

    expect(await contract.exists(1n)).to.equal(false);
    expect(await contract.exists(2n)).to.equal(false);
    expect(await contract.exists(3n)).to.equal(false);
  });

  it("exposes author tokenIds (count/at/slice) and updates after burns", async () => {
    const { contract, author, other } = await deploy();

    await contract.connect(author).setPosterAllowed(other.address, true);
    await contract.connect(other).mintPost("ipfs://post-1", "Post 1", "Body 1");
    await contract.connect(other).mintPost("ipfs://post-2", "Post 2", "Body 2");
    await contract.connect(other).mintPost("ipfs://post-3", "Post 3", "Body 3");

    expect(await contract.authorTokenIdsCount(other.address)).to.equal(3n);
    expect(await contract.authorTokenIdAt(other.address, 0n)).to.equal(1n);
    expect(await contract.authorTokenIdAt(other.address, 1n)).to.equal(2n);
    expect(await contract.authorTokenIdAt(other.address, 2n)).to.equal(3n);

    expect(await contract.authorTokenIdsSlice(other.address, 0n, 2n)).to.deep.equal([1n, 2n]);
    expect(await contract.authorTokenIdsSlice(other.address, 2n, 10n)).to.deep.equal([3n]);
    expect(await contract.authorTokenIdsSlice(other.address, 3n, 10n)).to.deep.equal([]);

    await expect(contract.connect(other).burnPost(2n)).to.emit(contract, "PostBurned").withArgs(other.address, 2n);
    expect(await contract.authorTokenIdsCount(other.address)).to.equal(2n);

    const remaining = await contract.authorTokenIdsSlice(other.address, 0n, 10n);
    const sortBigints = (xs: bigint[]) =>
      [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(sortBigints(remaining)).to.deep.equal([1n, 3n]);

    await contract.connect(author).adminResetAccount(other.address, []);
    expect(await contract.authorTokenIdsCount(other.address)).to.equal(0n);
    expect(await contract.authorTokenIdsSlice(other.address, 0n, 10n)).to.deep.equal([]);
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
    await contract.connect(other).mintPost("ipfs://post-1", "Post 1", "Body 1");

    await expect(contract.connect(other).adminUpdatePostURI(1n, "ipfs://mod", "Mod", "Mod body"))
      .to.be.reverted;

    await expect(contract.connect(author).adminUpdatePostURI(1n, "ipfs://mod", "Mod", "Mod body"))
      .to.emit(contract, "PostUpdatedByAdmin")
      .withArgs(author.address, other.address, 1n, "Mod", "Mod body", "ipfs://mod");

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

    await contract.connect(author).mintPost("ipfs://post-1", "Post 1", "Body 1");

    await expect(contract.connect(other).commentPost(1n, "")).to.be.revertedWith("Empty comment");
    await expect(contract.connect(other).commentPost(1n, "c".repeat(281))).to.be.revertedWith("Comment too long");

    await expect(contract.connect(other).commentPost(1n, "Hi"))
      .to.emit(contract, "CommentAdded")
      .withArgs(other.address, 1n, 1n, 0n, "Hi");
    expect(await contract.commentsOf(1n)).to.equal(1n);
    const info = await contract.commentInfo(1n);
    expect(info[0]).to.equal(other.address);
    expect(info[1]).to.equal(1n);
    expect(info[2]).to.equal(0n);
    expect(info[3]).to.equal(false);
    expect(info[4]).to.equal(false);
  });

  it("supports replies, edits, and deletes for comments", async () => {
    const { contract, author, other, tipper } = await deploy();

    await contract.connect(author).mintPost("ipfs://post-1", "Post 1", "Body 1");
    await contract.connect(other).commentPost(1n, "Top level");

    await expect(contract.connect(tipper).replyToComment(1n, 999n, "Nope")).to.be.revertedWith("Parent comment missing");
    await expect(contract.connect(other).replyToComment(1n, 1n, "Reply"))
      .to.emit(contract, "CommentAdded")
      .withArgs(other.address, 1n, 2n, 1n, "Reply");
    expect(await contract.commentsOf(1n)).to.equal(2n);

    await expect(contract.connect(tipper).editComment(1n, 1n, "Edit")).to.be.revertedWith("Only comment author");
    await expect(contract.connect(other).editComment(1n, 1n, "")).to.be.revertedWith("Empty comment");
    await expect(contract.connect(other).editComment(1n, 1n, "Edited"))
      .to.emit(contract, "CommentEdited")
      .withArgs(other.address, 1n, 1n, "Edited");
    expect((await contract.commentInfo(1n))[4]).to.equal(true);

    await expect(contract.connect(tipper).deleteComment(1n, 1n)).to.be.revertedWith("Not authorized");
    await expect(contract.connect(author).deleteComment(1n, 1n))
      .to.emit(contract, "CommentDeleted")
      .withArgs(author.address, 1n, 1n);
    expect((await contract.commentInfo(1n))[3]).to.equal(true);
    expect(await contract.commentsOf(1n)).to.equal(1n);

    await expect(contract.connect(other).editComment(1n, 1n, "Nope")).to.be.revertedWith("Comment deleted");
  });

  it("tracks comment likes, saves, and tips", async () => {
    const { contract, author, other, tipper } = await deploy();

    await contract.connect(author).mintPost("ipfs://post-1", "Post 1", "Body 1");
    await contract.connect(other).commentPost(1n, "Comment");

    await expect(contract.connect(tipper).likeComment(1n, 1n)).to.emit(contract, "CommentLiked");
    expect(await contract.commentLikesOf(1n, 1n)).to.equal(1n);
    expect(await contract.hasLikedComment(1n, 1n, tipper.address)).to.equal(true);

    await expect(contract.connect(tipper).likeComment(1n, 1n)).to.be.revertedWith("Already liked");

    await expect(contract.connect(tipper).unlikeComment(1n, 1n)).to.emit(contract, "CommentUnliked");
    expect(await contract.commentLikesOf(1n, 1n)).to.equal(0n);
    expect(await contract.hasLikedComment(1n, 1n, tipper.address)).to.equal(false);

    await expect(contract.connect(tipper).saveComment(1n, 1n)).to.emit(contract, "CommentSaved");
    expect(await contract.commentSavesOf(1n, 1n)).to.equal(1n);
    expect(await contract.hasSavedComment(1n, 1n, tipper.address)).to.equal(true);

    await expect(contract.connect(tipper).unsaveComment(1n, 1n)).to.emit(contract, "CommentUnsaved");
    expect(await contract.commentSavesOf(1n, 1n)).to.equal(0n);
    expect(await contract.hasSavedComment(1n, 1n, tipper.address)).to.equal(false);

    const tipAmount = 99n;
    await expect(contract.connect(tipper).tipComment(1n, 1n, { value: tipAmount }))
      .to.emit(contract, "CommentTipped")
      .withArgs(tipper.address, other.address, 1n, 1n, tipAmount);
    expect(await contract.commentTipsOf(1n, 1n)).to.equal(tipAmount);
    expect(await contract.withdrawableOf(other.address)).to.equal(tipAmount);
  });

  it("emits report events for posts and comments", async () => {
    const { contract, author, other } = await deploy();

    await contract.connect(author).mintPost("ipfs://post-1", "Post 1", "Body 1");
    await contract.connect(other).commentPost(1n, "Hi");

    await expect(contract.connect(other).reportPost(1n, "")).to.be.revertedWith("Empty report");
    await expect(contract.connect(other).reportPost(1n, "Spam")).to.emit(contract, "PostReported");

    await expect(contract.connect(other).reportComment(1n, 1n, "")).to.be.revertedWith("Empty report");
    await expect(contract.connect(other).reportComment(1n, 1n, "Abuse")).to.emit(contract, "CommentReported");
  });

  it("save/unsave is single-toggle per account", async () => {
    const { contract, author, other } = await deploy();

    await contract.connect(author).mintPost("ipfs://post-1", "Post 1", "Body 1");

    await expect(contract.connect(other).savePost(1n)).to.emit(contract, "PostSaved");
    expect(await contract.savesOf(1n)).to.equal(1n);
    expect(await contract.hasSaved(1n, other.address)).to.equal(true);

    await expect(contract.connect(other).savePost(1n)).to.be.revertedWith("Already saved");

    await expect(contract.connect(other).unsavePost(1n)).to.emit(contract, "PostUnsaved");
    expect(await contract.savesOf(1n)).to.equal(0n);
    expect(await contract.hasSaved(1n, other.address)).to.equal(false);

    await expect(contract.connect(other).unsavePost(1n)).to.be.revertedWith("Not saved");
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

    await contract.connect(author).mintPost("ipfs://post-1", "Post 1", "Body 1");
    await expect(contract.connect(author).freezePost(1n)).to.emit(contract, "PostFrozen");
    await expect(contract.connect(author).freezePost(1n)).to.be.revertedWith("Post already frozen");
    expect(await contract.isPostFrozen(1n)).to.equal(true);
  });

  it("tipPost requires value > 0", async () => {
    const { contract, author, tipper } = await deploy();

    await contract.connect(author).mintPost("ipfs://post-1", "Post 1", "Body 1");
    await expect(contract.connect(tipper).tipPost(1n, { value: 0n })).to.be.revertedWith("No tip sent");
  });

  it("reverts on non-existent token across post methods", async () => {
    const { contract, author, other } = await deploy();

    await expect(contract.authorOf(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.updatePostURI(999n, "ipfs://x", "X", "Body X")).to.be.revertedWith("Post does not exist");
    await expect(contract.freezePost(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.isPostFrozen(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.isPostEdited(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.burnPost(999n)).to.be.revertedWith("Post does not exist");

    await expect(contract.likesOf(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.commentsOf(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.savesOf(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.tipsOf(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.hasLiked(999n, author.address)).to.be.revertedWith("Post does not exist");
    await expect(contract.hasSaved(999n, author.address)).to.be.revertedWith("Post does not exist");

    await expect(contract.connect(other).likePost(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.connect(other).unlikePost(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.connect(other).savePost(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.connect(other).unsavePost(999n)).to.be.revertedWith("Post does not exist");
    await expect(contract.connect(other).commentPost(999n, "Hi")).to.be.revertedWith("Post does not exist");
    await expect(contract.connect(other).tipPost(999n, { value: 1n })).to.be.revertedWith("Post does not exist");

    await expect(contract.commentInfo(999n)).to.be.revertedWith("Comment does not exist");
    await expect(contract.connect(other).likeComment(1n, 999n)).to.be.revertedWith("Comment does not exist");
    await expect(contract.connect(other).saveComment(1n, 999n)).to.be.revertedWith("Comment does not exist");
    await expect(contract.connect(other).tipComment(1n, 999n, { value: 1n })).to.be.revertedWith("Comment does not exist");
    await expect(contract.connect(other).reportComment(1n, 999n, "Nope")).to.be.revertedWith("Comment does not exist");
  });

  it("withdrawTips reverts when recipient rejects ETH (no state loss)", async () => {
    const { contract, author, tipper } = await deploy();

    const Reject = await ethers.getContractFactory("RejectEtherAuthor");
    const reject = await Reject.deploy(await contract.getAddress());
    await reject.waitForDeployment();

    await contract.connect(author).setPosterAllowed(await reject.getAddress(), true);

    await reject.mint("ipfs://post-1", "Post 1", "Body 1");

    const tipAmount = 77n;
    await contract.connect(tipper).tipPost(1n, { value: tipAmount });
    expect(await contract.withdrawableOf(await reject.getAddress())).to.equal(tipAmount);

    await expect(reject.withdraw()).to.be.revertedWith("Withdraw failed");
    expect(await contract.withdrawableOf(await reject.getAddress())).to.equal(tipAmount);
  });
});

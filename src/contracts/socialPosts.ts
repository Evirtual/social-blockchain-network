import { Contract, type ContractRunner, Interface } from "ethers";

export const SOCIAL_ABI = [
  "event ProfileUpdated(address indexed account, string name, string bio, string avatar)",
  "event ProfileModerated(address indexed admin, address indexed account, string name, string bio, string avatar)",
  "event ProfileClearedByAdmin(address indexed admin, address indexed account)",
  "event PostMinted(address indexed author, uint256 indexed tokenId, string tokenURI)",
  "event PosterAllowed(address indexed account, bool allowed)",
  "event PosterApprovalRequested(address indexed account)",
  "event PostLiked(address indexed liker, uint256 indexed tokenId)",
  "event PostUnliked(address indexed unliker, uint256 indexed tokenId)",
  "event PostCommented(address indexed commenter, uint256 indexed tokenId, string comment)",
  "event PostSaved(address indexed saver, uint256 indexed tokenId)",
  "event PostUnsaved(address indexed unsaver, uint256 indexed tokenId)",
  "event Followed(address indexed follower, address indexed followee)",
  "event Unfollowed(address indexed follower, address indexed followee)",
  "event PostTipped(address indexed tipper, address indexed author, uint256 indexed tokenId, uint256 amountWei)",
  "event TipsWithdrawn(address indexed author, uint256 amountWei)",
  "event PostUpdated(address indexed author, uint256 indexed tokenId, string tokenURI)",
  "event PostUpdatedByAdmin(address indexed admin, address indexed author, uint256 indexed tokenId, string tokenURI)",
  "event PostBurned(address indexed author, uint256 indexed tokenId)",
  "event PostBurnedByAdmin(address indexed admin, address indexed author, uint256 indexed tokenId)",
  "event PostFrozen(address indexed author, uint256 indexed tokenId)",

  "function MAX_NAME_LENGTH() external view returns (uint256)",
  "function MAX_BIO_LENGTH() external view returns (uint256)",
  "function MAX_AVATAR_LENGTH() external view returns (uint256)",
  "function MAX_COMMENT_LENGTH() external view returns (uint256)",

  "function setProfile(string name, string bio, string avatar) external",
  "function adminSetProfile(address account, string name, string bio, string avatar) external",
  "function adminClearProfile(address account) external",
  "function adminResetAccount(address account, uint256[] tokenIds) external",
  "function profileOf(address account) external view returns (string name, string bio, string avatar)",
  "function owner() external view returns (address)",
  "function setPosterAllowed(address account, bool allowed) external",
  "function isPosterAllowed(address account) external view returns (bool)",
  "function hasPosterRequested(address account) external view returns (bool)",
  "function wasPosterDisapproved(address account) external view returns (bool)",

  // Ownable
  "function owner() external view returns (address)",
  "function requestPosterApproval() external",
  "function mintPost(string tokenUri) external returns (uint256 tokenId)",
  "function likePost(uint256 tokenId) external",
  "function unlikePost(uint256 tokenId) external",
  "function commentPost(uint256 tokenId, string comment) external",
  "function savePost(uint256 tokenId) external",
  "function unsavePost(uint256 tokenId) external",

  "function follow(address followee) external",
  "function unfollow(address followee) external",
  "function isFollowing(address follower, address followee) external view returns (bool)",

  "function freezePost(uint256 tokenId) external",
  "function isPostFrozen(uint256 tokenId) external view returns (bool)",

  "function tipPost(uint256 tokenId) external payable",
  "function withdrawTips() external",
  "function updatePostURI(uint256 tokenId, string tokenUri) external",
  "function adminUpdatePostURI(uint256 tokenId, string tokenUri) external",
  "function burnPost(uint256 tokenId) external",
  "function adminBurnPost(uint256 tokenId) external",
  "function likesOf(uint256 tokenId) external view returns (uint256)",
  "function commentsOf(uint256 tokenId) external view returns (uint256)",
  "function savesOf(uint256 tokenId) external view returns (uint256)",
  "function tipsOf(uint256 tokenId) external view returns (uint256)",
  "function withdrawableOf(address account) external view returns (uint256)",
  "function authorOf(uint256 tokenId) external view returns (address)",
  "function exists(uint256 tokenId) external view returns (bool)",
  "function hasLiked(uint256 tokenId, address account) external view returns (bool)",
  "function hasSaved(uint256 tokenId, address account) external view returns (bool)",
  "function tokenURI(uint256 tokenId) external view returns (string)"
] as const;

export const socialInterface = new Interface(SOCIAL_ABI);

export function getSocialContract(address: string, runner: ContractRunner) {
  return new Contract(address, SOCIAL_ABI, runner);
}

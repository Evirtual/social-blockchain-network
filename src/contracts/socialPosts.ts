import { ethers } from "ethers";

export const SOCIAL_ABI = [
  "event ProfileUpdated(address indexed account, string name, string bio, string avatar)",
  "event PostMinted(address indexed author, uint256 indexed tokenId, string tokenURI)",
  "event PostLiked(address indexed liker, uint256 indexed tokenId)",
  "event PostCommented(address indexed commenter, uint256 indexed tokenId, string comment)",
  "event PostShared(address indexed sharer, uint256 indexed tokenId)",
  "event PostTipped(address indexed tipper, address indexed author, uint256 indexed tokenId, uint256 amountWei)",
  "event TipsWithdrawn(address indexed author, uint256 amountWei)",
  "event PostUpdated(address indexed author, uint256 indexed tokenId, string tokenURI)",
  "event PostBurned(address indexed author, uint256 indexed tokenId)",
  "function setProfile(string name, string bio, string avatar) external",
  "function profileOf(address account) external view returns (string name, string bio, string avatar)",
  "function mintPost(string tokenUri) external returns (uint256 tokenId)",
  "function likePost(uint256 tokenId) external",
  "function commentPost(uint256 tokenId, string comment) external",
  "function sharePost(uint256 tokenId) external",
  "function tipPost(uint256 tokenId) external payable",
  "function withdrawTips() external",
  "function updatePostURI(uint256 tokenId, string tokenUri) external",
  "function burnPost(uint256 tokenId) external",
  "function likesOf(uint256 tokenId) external view returns (uint256)",
  "function commentsOf(uint256 tokenId) external view returns (uint256)",
  "function sharesOf(uint256 tokenId) external view returns (uint256)",
  "function tipsOf(uint256 tokenId) external view returns (uint256)",
  "function withdrawableOf(address account) external view returns (uint256)",
  "function exists(uint256 tokenId) external view returns (bool)",
  "function tokenURI(uint256 tokenId) external view returns (string)"
] as const;

export const socialInterface = new ethers.Interface(SOCIAL_ABI);

export function getSocialContract(address: string, runner: ethers.ContractRunner) {
  return new ethers.Contract(address, SOCIAL_ABI, runner);
}

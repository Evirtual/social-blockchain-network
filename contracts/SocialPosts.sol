// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract SocialPosts is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    uint256 public constant MAX_NAME_LENGTH = 64;
    uint256 public constant MAX_BIO_LENGTH = 280;
    uint256 public constant MAX_AVATAR_LENGTH = 512;
    uint256 public constant MAX_COMMENT_LENGTH = 280;

    struct Profile {
        string name;
        string bio;
        string avatar;
    }

    mapping(address => Profile) private _profiles;

    mapping(uint256 => address) private _author;

    mapping(uint256 => uint256) private _likes;
    mapping(uint256 => uint256) private _comments;
    mapping(uint256 => uint256) private _shares;

    mapping(uint256 => uint256) private _tipsWei;
    mapping(address => uint256) private _withdrawableWei;

    mapping(uint256 => mapping(address => bool)) private _hasLiked;
    mapping(uint256 => mapping(address => bool)) private _hasShared;

    mapping(address => mapping(address => bool)) private _isFollowing;

    mapping(uint256 => bool) private _postFrozen;

    mapping(address => bool) private _posterAllowed;

    mapping(address => bool) private _posterRequested;

    mapping(address => bool) private _posterDisapprovedEver;

    event PostMinted(address indexed author, uint256 indexed tokenId, string tokenURI);
    event PosterAllowed(address indexed account, bool allowed);
    event PosterApprovalRequested(address indexed account);
    event ProfileUpdated(address indexed account, string name, string bio, string avatar);
    event ProfileModerated(address indexed admin, address indexed account, string name, string bio, string avatar);
    event ProfileClearedByAdmin(address indexed admin, address indexed account);
    event PostLiked(address indexed liker, uint256 indexed tokenId);
    event PostCommented(address indexed commenter, uint256 indexed tokenId, string comment);
    event PostShared(address indexed sharer, uint256 indexed tokenId);
    event PostUnliked(address indexed unliker, uint256 indexed tokenId);
    event PostUnshared(address indexed unsharer, uint256 indexed tokenId);
    event Followed(address indexed follower, address indexed followee);
    event Unfollowed(address indexed follower, address indexed followee);
    event PostTipped(address indexed tipper, address indexed author, uint256 indexed tokenId, uint256 amountWei);
    event TipsWithdrawn(address indexed author, uint256 amountWei);
    event PostUpdated(address indexed author, uint256 indexed tokenId, string tokenURI);
    event PostUpdatedByAdmin(address indexed admin, address indexed author, uint256 indexed tokenId, string tokenURI);
    event PostBurned(address indexed author, uint256 indexed tokenId);
    event PostBurnedByAdmin(address indexed admin, address indexed author, uint256 indexed tokenId);
    event PostFrozen(address indexed author, uint256 indexed tokenId);

    constructor() ERC721("Minted Social Posts", "MSP") Ownable(msg.sender) {
        _nextTokenId = 1;
        _posterAllowed[msg.sender] = true;
        emit PosterAllowed(msg.sender, true);
    }

    modifier onlyAllowedPoster() {
        require(msg.sender == owner() || _posterAllowed[msg.sender], "Poster not allowed");
        _;
    }

    function setPosterAllowed(address account, bool allowed) external onlyOwner {
        require(account != address(0), "Invalid account");
        _posterAllowed[account] = allowed;
        if (allowed) {
            _posterRequested[account] = false;
        } else {
            _posterDisapprovedEver[account] = true;
        }
        emit PosterAllowed(account, allowed);
    }

    function isPosterAllowed(address account) external view returns (bool) {
        return account == owner() || _posterAllowed[account];
    }

    function hasPosterRequested(address account) external view returns (bool) {
        return _posterRequested[account];
    }

    function wasPosterDisapproved(address account) external view returns (bool) {
        return _posterDisapprovedEver[account];
    }

    function requestPosterApproval() external {
        require(msg.sender != address(0), "Invalid account");
        require(msg.sender != owner(), "Owner already allowed");
        require(!_posterAllowed[msg.sender], "Already allowed");
        require(!_posterRequested[msg.sender], "Already requested");

        _posterRequested[msg.sender] = true;
        emit PosterApprovalRequested(msg.sender);
    }

    function setProfile(string calldata name, string calldata bio, string calldata avatar) external onlyAllowedPoster {
        require(bytes(name).length <= MAX_NAME_LENGTH, "Name too long");
        require(bytes(bio).length <= MAX_BIO_LENGTH, "Bio too long");
        require(bytes(avatar).length <= MAX_AVATAR_LENGTH, "Avatar too long");

        _profiles[msg.sender] = Profile({name: name, bio: bio, avatar: avatar});
        emit ProfileUpdated(msg.sender, name, bio, avatar);
    }

    function adminSetProfile(address account, string calldata name, string calldata bio, string calldata avatar) external onlyOwner {
        require(account != address(0), "Invalid account");
        require(bytes(name).length <= MAX_NAME_LENGTH, "Name too long");
        require(bytes(bio).length <= MAX_BIO_LENGTH, "Bio too long");
        require(bytes(avatar).length <= MAX_AVATAR_LENGTH, "Avatar too long");

        _profiles[account] = Profile({name: name, bio: bio, avatar: avatar});
        emit ProfileUpdated(account, name, bio, avatar);
        emit ProfileModerated(msg.sender, account, name, bio, avatar);
    }

    function adminClearProfile(address account) external onlyOwner {
        require(account != address(0), "Invalid account");

        delete _profiles[account];
        emit ProfileUpdated(account, "", "", "");
        emit ProfileClearedByAdmin(msg.sender, account);
    }

    function profileOf(
        address account
    ) external view returns (string memory name, string memory bio, string memory avatar) {
        Profile storage p = _profiles[account];
        return (p.name, p.bio, p.avatar);
    }

    function mintPost(string calldata tokenUri) external onlyAllowedPoster returns (uint256 tokenId) {
        tokenId = _nextTokenId;
        _nextTokenId += 1;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenUri);

        _author[tokenId] = msg.sender;

        emit PostMinted(msg.sender, tokenId, tokenUri);
    }

    function exists(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    function authorOf(uint256 tokenId) external view returns (address) {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        return _author[tokenId];
    }

    function updatePostURI(uint256 tokenId, string calldata tokenUri) external {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        require(_author[tokenId] == msg.sender, "Only author");
        require(!_postFrozen[tokenId], "Post frozen");

        _setTokenURI(tokenId, tokenUri);
        emit PostUpdated(msg.sender, tokenId, tokenUri);
    }

    function adminUpdatePostURI(uint256 tokenId, string calldata tokenUri) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        address author = _author[tokenId];

        _setTokenURI(tokenId, tokenUri);
        emit PostUpdatedByAdmin(msg.sender, author, tokenId, tokenUri);
    }

    function freezePost(uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        require(_author[tokenId] == msg.sender, "Only author");
        require(!_postFrozen[tokenId], "Post already frozen");

        _postFrozen[tokenId] = true;
        emit PostFrozen(msg.sender, tokenId);
    }

    function isPostFrozen(uint256 tokenId) external view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        return _postFrozen[tokenId];
    }

    function burnPost(uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        require(_author[tokenId] == msg.sender, "Only author");

        _burn(tokenId);

        delete _author[tokenId];
        delete _likes[tokenId];
        delete _comments[tokenId];
        delete _shares[tokenId];
        delete _tipsWei[tokenId];
        delete _postFrozen[tokenId];

        emit PostBurned(msg.sender, tokenId);
    }

    function adminBurnPost(uint256 tokenId) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        address author = _author[tokenId];

        _burn(tokenId);

        delete _author[tokenId];
        delete _likes[tokenId];
        delete _comments[tokenId];
        delete _shares[tokenId];
        delete _tipsWei[tokenId];
        delete _postFrozen[tokenId];

        emit PostBurnedByAdmin(msg.sender, author, tokenId);
    }

    function likePost(uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        require(!_hasLiked[tokenId][msg.sender], "Already liked");

        _hasLiked[tokenId][msg.sender] = true;
        _likes[tokenId] += 1;

        emit PostLiked(msg.sender, tokenId);
    }

    function unlikePost(uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        require(_hasLiked[tokenId][msg.sender], "Not liked");

        _hasLiked[tokenId][msg.sender] = false;
        _likes[tokenId] -= 1;

        emit PostUnliked(msg.sender, tokenId);
    }

    function commentPost(uint256 tokenId, string calldata comment) external {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        require(bytes(comment).length > 0, "Empty comment");
        require(bytes(comment).length <= MAX_COMMENT_LENGTH, "Comment too long");

        _comments[tokenId] += 1;
        emit PostCommented(msg.sender, tokenId, comment);
    }

    function sharePost(uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        require(!_hasShared[tokenId][msg.sender], "Already shared");

        _hasShared[tokenId][msg.sender] = true;
        _shares[tokenId] += 1;

        emit PostShared(msg.sender, tokenId);
    }

    function unsharePost(uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        require(_hasShared[tokenId][msg.sender], "Not shared");

        _hasShared[tokenId][msg.sender] = false;
        _shares[tokenId] -= 1;

        emit PostUnshared(msg.sender, tokenId);
    }

    function follow(address followee) external {
        require(followee != address(0), "Invalid followee");
        require(followee != msg.sender, "Cannot follow self");
        require(!_isFollowing[msg.sender][followee], "Already following");

        _isFollowing[msg.sender][followee] = true;
        emit Followed(msg.sender, followee);
    }

    function unfollow(address followee) external {
        require(followee != address(0), "Invalid followee");
        require(_isFollowing[msg.sender][followee], "Not following");

        _isFollowing[msg.sender][followee] = false;
        emit Unfollowed(msg.sender, followee);
    }

    function isFollowing(address follower, address followee) external view returns (bool) {
        return _isFollowing[follower][followee];
    }

    function tipPost(uint256 tokenId) external payable {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        require(msg.value > 0, "No tip sent");

        address author = _author[tokenId];

        _tipsWei[tokenId] += msg.value;
        _withdrawableWei[author] += msg.value;

        emit PostTipped(msg.sender, author, tokenId, msg.value);
    }

    function tipsOf(uint256 tokenId) external view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        return _tipsWei[tokenId];
    }

    function withdrawableOf(address account) external view returns (uint256) {
        return _withdrawableWei[account];
    }

    function withdrawTips() external {
        uint256 amount = _withdrawableWei[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        _withdrawableWei[msg.sender] = 0;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Withdraw failed");

        emit TipsWithdrawn(msg.sender, amount);
    }

    function likesOf(uint256 tokenId) external view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        return _likes[tokenId];
    }

    function commentsOf(uint256 tokenId) external view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        return _comments[tokenId];
    }

    function sharesOf(uint256 tokenId) external view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        return _shares[tokenId];
    }

    function hasLiked(uint256 tokenId, address account) external view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        return _hasLiked[tokenId][account];
    }

    function hasShared(uint256 tokenId, address account) external view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        return _hasShared[tokenId][account];
    }
}

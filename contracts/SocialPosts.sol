// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract SocialPosts is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

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

    event PostMinted(address indexed author, uint256 indexed tokenId, string tokenURI);
    event ProfileUpdated(address indexed account, string name, string bio, string avatar);
    event PostLiked(address indexed liker, uint256 indexed tokenId);
    event PostCommented(address indexed commenter, uint256 indexed tokenId, string comment);
    event PostShared(address indexed sharer, uint256 indexed tokenId);
    event PostTipped(address indexed tipper, address indexed author, uint256 indexed tokenId, uint256 amountWei);
    event TipsWithdrawn(address indexed author, uint256 amountWei);
    event PostUpdated(address indexed author, uint256 indexed tokenId, string tokenURI);
    event PostBurned(address indexed author, uint256 indexed tokenId);

    constructor() ERC721("Minted Social Posts", "MSP") Ownable(msg.sender) {
        _nextTokenId = 1;
    }

    function setProfile(string calldata name, string calldata bio, string calldata avatar) external {
        require(bytes(name).length <= 64, "Name too long");
        require(bytes(bio).length <= 280, "Bio too long");
        require(bytes(avatar).length <= 512, "Avatar too long");

        _profiles[msg.sender] = Profile({name: name, bio: bio, avatar: avatar});
        emit ProfileUpdated(msg.sender, name, bio, avatar);
    }

    function profileOf(
        address account
    ) external view returns (string memory name, string memory bio, string memory avatar) {
        Profile storage p = _profiles[account];
        return (p.name, p.bio, p.avatar);
    }

    function mintPost(string calldata tokenUri) external returns (uint256 tokenId) {
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

        _setTokenURI(tokenId, tokenUri);
        emit PostUpdated(msg.sender, tokenId, tokenUri);
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

        emit PostBurned(msg.sender, tokenId);
    }

    function likePost(uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        require(!_hasLiked[tokenId][msg.sender], "Already liked");

        _hasLiked[tokenId][msg.sender] = true;
        _likes[tokenId] += 1;

        emit PostLiked(msg.sender, tokenId);
    }

    function commentPost(uint256 tokenId, string calldata comment) external {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        require(bytes(comment).length > 0, "Empty comment");

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

    function tipPost(uint256 tokenId) external payable {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        require(msg.value > 0, "No tip sent");

        address author = _author[tokenId];
        if (author == address(0)) {
            // Safety fallback (should never happen for valid mints)
            author = ownerOf(tokenId);
        }

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

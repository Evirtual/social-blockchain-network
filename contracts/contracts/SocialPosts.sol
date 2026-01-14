// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract SocialPosts is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    uint16 public constant MAX_TIP_SUPPORT_BPS = 1000; // 10%
    uint16 public constant MAX_WITHDRAW_FEE_BPS = 500; // 5%
    uint16 public withdrawFeeBps;

    uint256 public constant MAX_NAME_LENGTH = 64;
    uint256 public constant MAX_BIO_LENGTH = 280;
    uint256 public constant MAX_AVATAR_LENGTH = 512;
    uint256 public constant MAX_COMMENT_LENGTH = 280;
    uint256 public constant MAX_POST_TITLE_LENGTH = 64;
    uint256 public constant MAX_POST_BODY_LENGTH = 280;
    uint256 public constant MAX_REPORT_LENGTH = 280;

    struct Profile {
        string name;
        string bio;
        string avatar;
    }

    struct Comment {
        address author;
        uint256 tokenId;
        uint256 parentId;
        bool deleted;
        bool edited;
        uint256 likeCount;
        uint256 saveCount;
        uint256 tipWei;
    }

    mapping(address => Profile) private _profiles;

    mapping(uint256 => address) private _author;

    // Author -> list of all tokenIds they minted (includes still-existing posts only).
    // This enables admin reset flows to burn all posts without requiring off-chain token discovery.
    mapping(address => uint256[]) private _tokenIdsByAuthor;
    mapping(uint256 => uint256) private _tokenIdAuthorIndexPlusOne;

    mapping(uint256 => uint256) private _likes;
    mapping(uint256 => uint256) private _comments;
    mapping(uint256 => uint256) private _saves;

    mapping(uint256 => uint256) private _tipsWei;
    mapping(address => uint256) private _withdrawableWei;

    address private _protocolTreasury;
    mapping(uint256 => uint256) private _protocolSupportWei;
    mapping(address => uint16) private _tipSupportBpsOf;

    mapping(uint256 => mapping(address => bool)) private _hasLiked;
    mapping(uint256 => mapping(address => bool)) private _hasSaved;

    mapping(address => mapping(address => bool)) private _isFollowing;

    mapping(uint256 => bool) private _postFrozen;
    mapping(uint256 => bool) private _postEdited;

    uint256 private _nextCommentId;
    mapping(uint256 => Comment) private _commentById;
    mapping(uint256 => mapping(address => bool)) private _hasCommentLiked;
    mapping(uint256 => mapping(address => bool)) private _hasCommentSaved;

    mapping(address => bool) private _posterAllowed;

    mapping(address => bool) private _moderators;

    address[] private _moderatorList;
    mapping(address => uint256) private _moderatorIndexPlusOne;

    mapping(address => bool) private _posterRequested;

    mapping(address => bool) private _posterDisapprovedEver;

    event PostMinted(address indexed author, uint256 indexed tokenId, string title, string body, string tokenURI);
    event PosterAllowed(address indexed account, bool allowed);
    event PosterAllowedBy(address indexed actor, address indexed account, bool allowed);
    event ModeratorSet(address indexed admin, address indexed account, bool enabled);
    event PosterApprovalRequested(address indexed account);
    event PosterApprovalRequestedTo(address indexed recipient, address indexed account);
    event ProfileUpdated(address indexed account, string name, string bio, string avatar);
    event ProfileModerated(address indexed admin, address indexed account, string name, string bio, string avatar);
    event ProfileClearedByAdmin(address indexed admin, address indexed account);
    event PostLiked(address indexed liker, uint256 indexed tokenId);
    event PostCommented(address indexed commenter, uint256 indexed tokenId, string comment);
    event PostSaved(address indexed saver, uint256 indexed tokenId);
    event PostUnliked(address indexed unliker, uint256 indexed tokenId);
    event PostUnsaved(address indexed unsaver, uint256 indexed tokenId);
    event Followed(address indexed follower, address indexed followee);
    event Unfollowed(address indexed follower, address indexed followee);
    event PostTipped(address indexed tipper, address indexed author, uint256 indexed tokenId, uint256 amountWei);
    event ProtocolTreasuryUpdated(address indexed admin, address indexed treasury);
    event ProtocolSupported(
        address indexed supporter,
        address indexed treasury,
        uint256 indexed tokenId,
        uint256 amountWei,
        uint16 supportBps
    );
    event TipSupportPreferenceUpdated(address indexed account, uint16 supportBps);
    event TipsWithdrawn(address indexed author, uint256 amountWei);
    event WithdrawFeeUpdated(address indexed admin, uint16 feeBps);
    event WithdrawFeePaid(address indexed author, address indexed treasury, uint256 feeWei, uint16 feeBps);
    event PostUpdated(address indexed author, uint256 indexed tokenId, string title, string body, string tokenURI);
    event PostEditedStatus(address indexed author, uint256 indexed tokenId, bool edited);
    event PostUpdatedByAdmin(
        address indexed admin,
        address indexed author,
        uint256 indexed tokenId,
        string title,
        string body,
        string tokenURI
    );
    event PostBurned(address indexed author, uint256 indexed tokenId);
    event PostBurnedByAdmin(address indexed admin, address indexed author, uint256 indexed tokenId);
    event PostFrozen(address indexed author, uint256 indexed tokenId);
    event CommentAdded(
        address indexed commenter,
        uint256 indexed tokenId,
        uint256 indexed commentId,
        uint256 parentId,
        string comment
    );
    event CommentEdited(address indexed editor, uint256 indexed tokenId, uint256 indexed commentId, string comment);
    event CommentDeleted(address indexed deleter, uint256 indexed tokenId, uint256 indexed commentId);
    event CommentLiked(address indexed liker, uint256 indexed tokenId, uint256 indexed commentId);
    event CommentUnliked(address indexed unliker, uint256 indexed tokenId, uint256 indexed commentId);
    event CommentSaved(address indexed saver, uint256 indexed tokenId, uint256 indexed commentId);
    event CommentUnsaved(address indexed unsaver, uint256 indexed tokenId, uint256 indexed commentId);
    event CommentTipped(
        address indexed tipper,
        address indexed author,
        uint256 indexed tokenId,
        uint256 commentId,
        uint256 amountWei
    );
    event PostReported(address indexed reporter, uint256 indexed tokenId, string reason);
    event CommentReported(address indexed reporter, uint256 indexed tokenId, uint256 indexed commentId, string reason);

    constructor() ERC721("Minted Social Posts", "MSP") Ownable(msg.sender) {
        _nextTokenId = 1;
        _nextCommentId = 1;
        _posterAllowed[msg.sender] = true;
        _protocolTreasury = msg.sender;
        withdrawFeeBps = 500;
        emit PosterAllowed(msg.sender, true);
        emit ProtocolTreasuryUpdated(msg.sender, msg.sender);
        emit WithdrawFeeUpdated(msg.sender, withdrawFeeBps);
    }

    function protocolTreasury() external view returns (address) {
        return _protocolTreasury;
    }

    function setProtocolTreasury(address treasury) external onlyOwner {
        require(treasury != address(0), "Invalid treasury");
        _protocolTreasury = treasury;
        emit ProtocolTreasuryUpdated(msg.sender, treasury);
    }

    function setWithdrawFeeBps(uint16 feeBps) external onlyOwner {
        require(feeBps <= MAX_WITHDRAW_FEE_BPS, "Fee too high");
        withdrawFeeBps = feeBps;
        emit WithdrawFeeUpdated(msg.sender, feeBps);
    }

    function tipSupportPreferenceOf(address account) external view returns (uint16) {
        return _tipSupportBpsOf[account];
    }

    function setTipSupportPreference(uint16 supportBps) external {
        require(supportBps <= MAX_TIP_SUPPORT_BPS, "Support too high");
        _tipSupportBpsOf[msg.sender] = supportBps;
        emit TipSupportPreferenceUpdated(msg.sender, supportBps);
    }

    modifier onlyAdminOrModerator() {
        require(msg.sender == owner() || _moderators[msg.sender], "Only admin/mod");
        _;
    }

    function _requireModeratorCanActOnAccount(address account) internal view {
        if (msg.sender == owner()) return;
        // Moderators must never be able to take admin actions against the owner/admin.
        require(account != owner(), "No owner");
    }

    function _requireModeratorCanActOnToken(uint256 tokenId) internal view {
        if (msg.sender == owner()) return;
        address author = _author[tokenId];
        require(author != owner(), "No owner");
    }

    modifier onlyAllowedPoster() {
        require(msg.sender == owner() || _posterAllowed[msg.sender], "Poster not allowed");
        _;
    }

    function setModerator(address account, bool enabled) external onlyOwner {
        require(account != address(0), "Invalid account");
        require(account != owner(), "Owner no mod");

        bool current = _moderators[account];
        if (enabled) {
            if (!current) {
                _moderators[account] = true;
                _moderatorList.push(account);
                _moderatorIndexPlusOne[account] = _moderatorList.length;
            }
        } else {
            if (current) {
                _moderators[account] = false;
                uint256 idxPlusOne = _moderatorIndexPlusOne[account];
                if (idxPlusOne != 0) {
                    uint256 idx = idxPlusOne - 1;
                    uint256 lastIdx = _moderatorList.length - 1;
                    if (idx != lastIdx) {
                        address moved = _moderatorList[lastIdx];
                        _moderatorList[idx] = moved;
                        _moderatorIndexPlusOne[moved] = idx + 1;
                    }
                    _moderatorList.pop();
                    _moderatorIndexPlusOne[account] = 0;
                }
            }
        }
        emit ModeratorSet(msg.sender, account, enabled);
    }

    function isModerator(address account) external view returns (bool) {
        return _moderators[account];
    }

    function getModerators() external view returns (address[] memory) {
        return _moderatorList;
    }

    function setPosterAllowed(address account, bool allowed) external onlyAdminOrModerator {
        require(account != address(0), "Invalid account");
        _requireModeratorCanActOnAccount(account);
        _posterAllowed[account] = allowed;
        if (allowed) {
            _posterRequested[account] = false;
        } else {
            _posterDisapprovedEver[account] = true;
        }
        emit PosterAllowed(account, allowed);
        emit PosterAllowedBy(msg.sender, account, allowed);
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

        // Emit a per-recipient event so indexers can create notifications without any contract calls.
        emit PosterApprovalRequestedTo(owner(), msg.sender);
        for (uint256 i = 0; i < _moderatorList.length; i++) {
            address recipient = _moderatorList[i];
            if (recipient == msg.sender) continue;
            emit PosterApprovalRequestedTo(recipient, msg.sender);
        }
    }

    function setProfile(string calldata name, string calldata bio, string calldata avatar) external onlyAllowedPoster {
        require(bytes(name).length <= MAX_NAME_LENGTH, "Name too long");
        require(bytes(bio).length <= MAX_BIO_LENGTH, "Bio too long");
        require(bytes(avatar).length <= MAX_AVATAR_LENGTH, "Avatar too long");

        _profiles[msg.sender] = Profile({name: name, bio: bio, avatar: avatar});
        emit ProfileUpdated(msg.sender, name, bio, avatar);
    }

    function adminSetProfile(address account, string calldata name, string calldata bio, string calldata avatar) external onlyAdminOrModerator {
        require(account != address(0), "Invalid account");
        _requireModeratorCanActOnAccount(account);
        require(bytes(name).length <= MAX_NAME_LENGTH, "Name too long");
        require(bytes(bio).length <= MAX_BIO_LENGTH, "Bio too long");
        require(bytes(avatar).length <= MAX_AVATAR_LENGTH, "Avatar too long");

        _profiles[account] = Profile({name: name, bio: bio, avatar: avatar});
        emit ProfileUpdated(account, name, bio, avatar);
        emit ProfileModerated(msg.sender, account, name, bio, avatar);
    }

    function adminClearProfile(address account) external onlyAdminOrModerator {
        require(account != address(0), "Invalid account");
        _requireModeratorCanActOnAccount(account);

        delete _profiles[account];
        emit ProfileUpdated(account, "", "", "");
        emit ProfileClearedByAdmin(msg.sender, account);
    }

    // Admin multicall: block poster, clear profile, and burn selected posts.
    // This is intended to reduce moderation/reset flows to a single transaction.
    function adminResetAccount(address account, uint256[] calldata tokenIds) external onlyAdminOrModerator {
        require(account != address(0), "Invalid account");
        _requireModeratorCanActOnAccount(account);

        // Block poster (mirrors setPosterAllowed(account, false) side effects).
        _posterAllowed[account] = false;
        _posterRequested[account] = false;
        _posterDisapprovedEver[account] = true;
        emit PosterAllowed(account, false);
        emit PosterAllowedBy(msg.sender, account, false);

        // Clear profile.
        delete _profiles[account];
        emit ProfileUpdated(account, "", "", "");
        emit ProfileClearedByAdmin(msg.sender, account);

        // Burn posts for the account.
        // - If tokenIds is provided, burn only those (best-effort; ignores unknown/already-burned/non-matching).
        // - If tokenIds is empty, burn ALL posts minted by the account (tracked on-chain).
        if (tokenIds.length == 0) {
            // Burn from the end so swap-and-pop index updates are simple.
            while (_tokenIdsByAuthor[account].length > 0) {
                uint256 tokenId = _tokenIdsByAuthor[account][_tokenIdsByAuthor[account].length - 1];

                // If something went out of sync, just untrack it.
                if (_ownerOf(tokenId) == address(0) || _author[tokenId] != account) {
                    _untrackAuthorToken(account, tokenId);
                    continue;
                }

                _burn(tokenId);
                _untrackAuthorToken(account, tokenId);

                delete _author[tokenId];
                delete _likes[tokenId];
                delete _comments[tokenId];
                delete _saves[tokenId];
                delete _tipsWei[tokenId];
                delete _postFrozen[tokenId];
                delete _postEdited[tokenId];

                emit PostBurnedByAdmin(msg.sender, account, tokenId);
            }
        } else {
            for (uint256 i = 0; i < tokenIds.length; i++) {
                uint256 tokenId = tokenIds[i];
                if (_ownerOf(tokenId) == address(0)) continue;
                if (_author[tokenId] != account) continue;

                _burn(tokenId);
                _untrackAuthorToken(account, tokenId);

                delete _author[tokenId];
                delete _likes[tokenId];
                delete _comments[tokenId];
                delete _saves[tokenId];
                delete _tipsWei[tokenId];
                delete _postFrozen[tokenId];
                delete _postEdited[tokenId];

                emit PostBurnedByAdmin(msg.sender, account, tokenId);
            }
        }
    }

    function authorTokenIdsCount(address author) external view returns (uint256) {
        return _tokenIdsByAuthor[author].length;
    }

    function authorTokenIdAt(address author, uint256 index) external view returns (uint256) {
        require(index < _tokenIdsByAuthor[author].length, "Index out of range");
        return _tokenIdsByAuthor[author][index];
    }

    function authorTokenIdsSlice(
        address author,
        uint256 start,
        uint256 limit
    ) external view returns (uint256[] memory) {
        uint256 len = _tokenIdsByAuthor[author].length;
        if (start >= len || limit == 0) {
            return new uint256[](0);
        }

        uint256 end = start + limit;
        if (end > len) end = len;

        uint256 outLen = end - start;
        uint256[] memory out = new uint256[](outLen);
        for (uint256 i = 0; i < outLen; i++) {
            out[i] = _tokenIdsByAuthor[author][start + i];
        }
        return out;
    }

    function _trackAuthorToken(address author, uint256 tokenId) internal {
        if (_tokenIdAuthorIndexPlusOne[tokenId] != 0) return;
        _tokenIdsByAuthor[author].push(tokenId);
        _tokenIdAuthorIndexPlusOne[tokenId] = _tokenIdsByAuthor[author].length;
    }

    function _untrackAuthorToken(address author, uint256 tokenId) internal {
        uint256 idxPlusOne = _tokenIdAuthorIndexPlusOne[tokenId];
        if (idxPlusOne == 0) return;

        uint256 idx = idxPlusOne - 1;
        uint256 lastIdx = _tokenIdsByAuthor[author].length - 1;
        if (idx != lastIdx) {
            uint256 moved = _tokenIdsByAuthor[author][lastIdx];
            _tokenIdsByAuthor[author][idx] = moved;
            _tokenIdAuthorIndexPlusOne[moved] = idx + 1;
        }

        _tokenIdsByAuthor[author].pop();
        _tokenIdAuthorIndexPlusOne[tokenId] = 0;
    }

    function profileOf(
        address account
    ) external view returns (string memory name, string memory bio, string memory avatar) {
        Profile storage p = _profiles[account];
        return (p.name, p.bio, p.avatar);
    }

    function mintPost(
        string calldata tokenUri,
        string calldata title,
        string calldata body
    ) external onlyAllowedPoster returns (uint256 tokenId) {
        require(bytes(title).length <= MAX_POST_TITLE_LENGTH, "Title too long");
        require(bytes(body).length <= MAX_POST_BODY_LENGTH, "Body too long");

        tokenId = _nextTokenId;
        _nextTokenId += 1;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenUri);

        _author[tokenId] = msg.sender;
        _trackAuthorToken(msg.sender, tokenId);

        emit PostMinted(msg.sender, tokenId, title, body, tokenUri);
    }

    function exists(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    function authorOf(uint256 tokenId) external view returns (address) {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        return _author[tokenId];
    }

    function updatePostURI(uint256 tokenId, string calldata tokenUri, string calldata title, string calldata body) external {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        require(_author[tokenId] == msg.sender, "Only author");
        require(!_postFrozen[tokenId], "Post frozen");
        require(bytes(title).length <= MAX_POST_TITLE_LENGTH, "Title too long");
        require(bytes(body).length <= MAX_POST_BODY_LENGTH, "Body too long");

        _setTokenURI(tokenId, tokenUri);
        _postEdited[tokenId] = true;
        emit PostUpdated(msg.sender, tokenId, title, body, tokenUri);
        emit PostEditedStatus(msg.sender, tokenId, true);
    }

    function adminUpdatePostURI(
        uint256 tokenId,
        string calldata tokenUri,
        string calldata title,
        string calldata body
    ) external onlyAdminOrModerator {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        _requireModeratorCanActOnToken(tokenId);
        address author = _author[tokenId];
        require(bytes(title).length <= MAX_POST_TITLE_LENGTH, "Title too long");
        require(bytes(body).length <= MAX_POST_BODY_LENGTH, "Body too long");

        _setTokenURI(tokenId, tokenUri);
        _postEdited[tokenId] = true;
        emit PostUpdatedByAdmin(msg.sender, author, tokenId, title, body, tokenUri);
        emit PostEditedStatus(author, tokenId, true);
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

    function isPostEdited(uint256 tokenId) external view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        return _postEdited[tokenId];
    }

    function burnPost(uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        require(_author[tokenId] == msg.sender, "Only author");

        address author = _author[tokenId];

        _burn(tokenId);

        _untrackAuthorToken(author, tokenId);

        delete _author[tokenId];
        delete _likes[tokenId];
        delete _comments[tokenId];
        delete _saves[tokenId];
        delete _tipsWei[tokenId];
        delete _postFrozen[tokenId];
        delete _postEdited[tokenId];

        emit PostBurned(author, tokenId);
    }

    function adminBurnPost(uint256 tokenId) external onlyAdminOrModerator {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        _requireModeratorCanActOnToken(tokenId);
        address author = _author[tokenId];

        _burn(tokenId);

        _untrackAuthorToken(author, tokenId);

        delete _author[tokenId];
        delete _likes[tokenId];
        delete _comments[tokenId];
        delete _saves[tokenId];
        delete _tipsWei[tokenId];
        delete _postFrozen[tokenId];
        delete _postEdited[tokenId];

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
        _createComment(tokenId, 0, comment);
    }

    function replyToComment(uint256 tokenId, uint256 parentCommentId, string calldata comment) external {
        _createComment(tokenId, parentCommentId, comment);
    }

    function editComment(uint256 tokenId, uint256 commentId, string calldata comment) external {
        Comment storage c = _commentById[commentId];
        require(c.author != address(0), "Comment does not exist");
        require(c.tokenId == tokenId, "Comment does not exist");
        require(!c.deleted, "Comment deleted");
        require(c.author == msg.sender, "Only comment author");
        require(bytes(comment).length > 0, "Empty comment");
        require(bytes(comment).length <= MAX_COMMENT_LENGTH, "Comment too long");

        c.edited = true;
        emit CommentEdited(msg.sender, tokenId, commentId, comment);
    }

    function deleteComment(uint256 tokenId, uint256 commentId) external {
        Comment storage c = _commentById[commentId];
        require(c.author != address(0), "Comment does not exist");
        require(c.tokenId == tokenId, "Comment does not exist");
        require(!c.deleted, "Comment deleted");
        require(
            c.author == msg.sender || _author[tokenId] == msg.sender || msg.sender == owner(),
            "Not authorized"
        );

        c.deleted = true;
        if (_comments[tokenId] > 0) {
            _comments[tokenId] -= 1;
        }
        emit CommentDeleted(msg.sender, tokenId, commentId);
    }

    function likeComment(uint256 tokenId, uint256 commentId) external {
        _requireCommentActive(tokenId, commentId);
        require(!_hasCommentLiked[commentId][msg.sender], "Already liked");

        _hasCommentLiked[commentId][msg.sender] = true;
        _commentById[commentId].likeCount += 1;

        emit CommentLiked(msg.sender, tokenId, commentId);
    }

    function unlikeComment(uint256 tokenId, uint256 commentId) external {
        _requireCommentActive(tokenId, commentId);
        require(_hasCommentLiked[commentId][msg.sender], "Not liked");

        _hasCommentLiked[commentId][msg.sender] = false;
        _commentById[commentId].likeCount -= 1;

        emit CommentUnliked(msg.sender, tokenId, commentId);
    }

    function saveComment(uint256 tokenId, uint256 commentId) external {
        _requireCommentActive(tokenId, commentId);
        require(!_hasCommentSaved[commentId][msg.sender], "Already saved");

        _hasCommentSaved[commentId][msg.sender] = true;
        _commentById[commentId].saveCount += 1;

        emit CommentSaved(msg.sender, tokenId, commentId);
    }

    function unsaveComment(uint256 tokenId, uint256 commentId) external {
        _requireCommentActive(tokenId, commentId);
        require(_hasCommentSaved[commentId][msg.sender], "Not saved");

        _hasCommentSaved[commentId][msg.sender] = false;
        _commentById[commentId].saveCount -= 1;

        emit CommentUnsaved(msg.sender, tokenId, commentId);
    }

    function tipComment(uint256 tokenId, uint256 commentId) external payable {
        _requireCommentActive(tokenId, commentId);
        require(msg.value > 0, "No tip sent");

        address author = _commentById[commentId].author;

        _commentById[commentId].tipWei += msg.value;
        _withdrawableWei[author] += msg.value;

        emit CommentTipped(msg.sender, author, tokenId, commentId, msg.value);
    }

    // msg.value is the TOTAL a tipper wants to spend.
    // supportBps is the portion of msg.value routed to the protocol treasury.
    // The remaining amount is credited to the comment author.
    // If savePreference is true, the supportBps is persisted as the caller's default.
    function tipCommentWithSupport(
        uint256 tokenId,
        uint256 commentId,
        uint16 supportBps,
        bool savePreference
    ) external payable {
        _requireCommentActive(tokenId, commentId);
        require(msg.value > 0, "No tip sent");
        require(supportBps <= MAX_TIP_SUPPORT_BPS, "Support too high");

        if (savePreference) {
            _tipSupportBpsOf[msg.sender] = supportBps;
            emit TipSupportPreferenceUpdated(msg.sender, supportBps);
        }

        uint256 protocolWei = (msg.value * supportBps) / 10_000;
        uint256 authorWei = msg.value - protocolWei;

        address author = _commentById[commentId].author;

        _commentById[commentId].tipWei += authorWei;
        _withdrawableWei[author] += authorWei;

        emit CommentTipped(msg.sender, author, tokenId, commentId, authorWei);

        if (protocolWei > 0) {
            address treasury = _protocolTreasury;
            require(treasury != address(0), "Treasury not set");
            _protocolSupportWei[tokenId] += protocolWei;
            _withdrawableWei[treasury] += protocolWei;
            emit ProtocolSupported(msg.sender, treasury, tokenId, protocolWei, supportBps);
        }
    }

    function savePost(uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        require(!_hasSaved[tokenId][msg.sender], "Already saved");

        _hasSaved[tokenId][msg.sender] = true;
        _saves[tokenId] += 1;

        emit PostSaved(msg.sender, tokenId);
    }

    function unsavePost(uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        require(_hasSaved[tokenId][msg.sender], "Not saved");

        _hasSaved[tokenId][msg.sender] = false;
        _saves[tokenId] -= 1;

        emit PostUnsaved(msg.sender, tokenId);
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

    // msg.value is the TOTAL a tipper wants to spend.
    // supportBps is the portion of msg.value routed to the protocol treasury.
    // The remaining amount is credited to the post author.
    // If savePreference is true, the supportBps is persisted as the caller's default.
    function tipPostWithSupport(uint256 tokenId, uint16 supportBps, bool savePreference) external payable {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        require(msg.value > 0, "No tip sent");
        require(supportBps <= MAX_TIP_SUPPORT_BPS, "Support too high");

        if (savePreference) {
            _tipSupportBpsOf[msg.sender] = supportBps;
            emit TipSupportPreferenceUpdated(msg.sender, supportBps);
        }

        uint256 protocolWei = (msg.value * supportBps) / 10_000;
        uint256 authorWei = msg.value - protocolWei;

        address author = _author[tokenId];

        _tipsWei[tokenId] += authorWei;
        _withdrawableWei[author] += authorWei;
        emit PostTipped(msg.sender, author, tokenId, authorWei);

        if (protocolWei > 0) {
            address treasury = _protocolTreasury;
            require(treasury != address(0), "Treasury not set");
            _protocolSupportWei[tokenId] += protocolWei;
            _withdrawableWei[treasury] += protocolWei;
            emit ProtocolSupported(msg.sender, treasury, tokenId, protocolWei, supportBps);
        }
    }

    function tipsOf(uint256 tokenId) external view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        return _tipsWei[tokenId];
    }

    function protocolSupportOf(uint256 tokenId) external view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        return _protocolSupportWei[tokenId];
    }

    function withdrawableOf(address account) external view returns (uint256) {
        return _withdrawableWei[account];
    }

    function withdrawTips() external {
        uint256 amount = _withdrawableWei[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        _withdrawableWei[msg.sender] = 0;

        uint256 feeWei = (amount * withdrawFeeBps) / 10_000;
        uint256 netWei = amount - feeWei;

        (bool ok, ) = payable(msg.sender).call{value: netWei}("");
        require(ok, "Withdraw failed");

        if (feeWei > 0) {
            address treasury = _protocolTreasury;
            require(treasury != address(0), "Treasury not set");
            (bool ok2, ) = payable(treasury).call{value: feeWei}("");
            require(ok2, "Fee transfer failed");
            emit WithdrawFeePaid(msg.sender, treasury, feeWei, withdrawFeeBps);
        }

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

    function savesOf(uint256 tokenId) external view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        return _saves[tokenId];
    }

    function hasLiked(uint256 tokenId, address account) external view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        return _hasLiked[tokenId][account];
    }

    function hasSaved(uint256 tokenId, address account) external view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        return _hasSaved[tokenId][account];
    }

    function commentInfo(
        uint256 commentId
    )
        external
        view
        returns (
            address author,
            uint256 tokenId,
            uint256 parentId,
            bool deleted,
            bool edited,
            uint256 likeCount,
            uint256 saveCount,
            uint256 tipWei
        )
    {
        Comment storage c = _commentById[commentId];
        require(c.author != address(0), "Comment does not exist");
        return (c.author, c.tokenId, c.parentId, c.deleted, c.edited, c.likeCount, c.saveCount, c.tipWei);
    }

    function commentLikesOf(uint256 tokenId, uint256 commentId) external view returns (uint256) {
        _requireCommentExists(tokenId, commentId);
        return _commentById[commentId].likeCount;
    }

    function commentSavesOf(uint256 tokenId, uint256 commentId) external view returns (uint256) {
        _requireCommentExists(tokenId, commentId);
        return _commentById[commentId].saveCount;
    }

    function commentTipsOf(uint256 tokenId, uint256 commentId) external view returns (uint256) {
        _requireCommentExists(tokenId, commentId);
        return _commentById[commentId].tipWei;
    }

    function hasLikedComment(uint256 tokenId, uint256 commentId, address account) external view returns (bool) {
        _requireCommentExists(tokenId, commentId);
        return _hasCommentLiked[commentId][account];
    }

    function hasSavedComment(uint256 tokenId, uint256 commentId, address account) external view returns (bool) {
        _requireCommentExists(tokenId, commentId);
        return _hasCommentSaved[commentId][account];
    }

    function reportPost(uint256 tokenId, string calldata reason) external {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        require(bytes(reason).length > 0, "Empty report");
        require(bytes(reason).length <= MAX_REPORT_LENGTH, "Report too long");

        emit PostReported(msg.sender, tokenId, reason);
    }

    function reportComment(uint256 tokenId, uint256 commentId, string calldata reason) external {
        _requireCommentActive(tokenId, commentId);
        require(bytes(reason).length > 0, "Empty report");
        require(bytes(reason).length <= MAX_REPORT_LENGTH, "Report too long");

        emit CommentReported(msg.sender, tokenId, commentId, reason);
    }

    function _createComment(uint256 tokenId, uint256 parentCommentId, string calldata comment) internal returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "Post does not exist");
        require(bytes(comment).length > 0, "Empty comment");
        require(bytes(comment).length <= MAX_COMMENT_LENGTH, "Comment too long");

        if (parentCommentId != 0) {
            Comment storage parent = _commentById[parentCommentId];
            require(parent.author != address(0), "Parent comment missing");
            require(parent.tokenId == tokenId, "Parent comment mismatch");
            require(!parent.deleted, "Parent comment deleted");
        }

        uint256 commentId = _nextCommentId;
        _nextCommentId += 1;

        _commentById[commentId] = Comment({
            author: msg.sender,
            tokenId: tokenId,
            parentId: parentCommentId,
            deleted: false,
            edited: false,
            likeCount: 0,
            saveCount: 0,
            tipWei: 0
        });

        _comments[tokenId] += 1;
        emit PostCommented(msg.sender, tokenId, comment);
        emit CommentAdded(msg.sender, tokenId, commentId, parentCommentId, comment);

        return commentId;
    }

    function _requireCommentExists(uint256 tokenId, uint256 commentId) internal view {
        Comment storage c = _commentById[commentId];
        require(c.author != address(0), "Comment does not exist");
        require(c.tokenId == tokenId, "Comment does not exist");
    }

    function _requireCommentActive(uint256 tokenId, uint256 commentId) internal view {
        _requireCommentExists(tokenId, commentId);
        require(!_commentById[commentId].deleted, "Comment deleted");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external returns (bytes4);
}

interface ISocialPosts {
    function mintPost(string calldata tokenUri, string calldata title, string calldata body) external returns (uint256);
    function withdrawTips() external;
}

contract RejectEtherAuthor is IERC721Receiver {
    ISocialPosts public immutable social;

    constructor(address social_) {
        social = ISocialPosts(social_);
    }

    function mint(string calldata tokenUri, string calldata title, string calldata body) external returns (uint256) {
        return social.mintPost(tokenUri, title, body);
    }

    function withdraw() external {
        social.withdrawTips();
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    receive() external payable {
        revert("NO_RECEIVE");
    }
}

// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.30;

import {ERC721} from "lib/openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "lib/openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract Looters is ERC721, ERC721URIStorage {
    address owner;
    uint256 private _nextTokenId = 1;
    string private constant FIXED_TOKEN_URI =
        "https://gateway.pinata.cloud/ipfs/bafkreicu5ldq3bgvd2cqq3732bmrbyhcowl5i7fb24htopelrktorhuu6i";


    constructor(address initialOwner) ERC721("Looters", "LOOT") {
        owner = initialOwner;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "unauthorized access");
        _;
    }
        // Function to issue a certificate NFT with a fixed URI
    function mint() external {
       uint256 token_id = _nextTokenId;
        _safeMint(msg.sender, token_id);
        _setTokenURI(token_id, FIXED_TOKEN_URI);        

        _nextTokenId++;
    }

      function mint_with_uri(address receiver, string memory uri) external {
       uint256 token_id = _nextTokenId;
        _safeMint(receiver, token_id);
        _setTokenURI(token_id, uri);        

        _nextTokenId++;
    }



    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }


}

// {
//   "name": "Aji",
//   "description": "Ajidokwu",
//   "image": "https://gateway.pinata.cloud/ipfs/bafkreibp2jiw2twsv445dq7y2gl6ykudt2qseu3lra4nzk62wrgxvpinvm"
// }
// import "./Wallet.sol";
// import {ERC721} from "lib/openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
// import {ERC721URIStorage} from "lib/openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
// import {TycoonLib} from "./TycoonLib.sol";

// contract Tycoon is ReentrancyGuard, ERC721, ERC721URIStorage {
//     using TycoonLib for TycoonLib.Game;
//     using TycoonLib for TycoonLib.GamePlayer;
//     using TycoonLib for TycoonLib.GameSettings;
//     using TycoonLib for TycoonLib.Property;

//     uint256 public totalUsers;
//     uint256 public totalGames;
//     uint256 private nextGameId;
//     address public immutable token; // in-game ERC20 token
//     address public paymaster;
//     uint256 private _nextTokenId = 1;
//     string private constant BASE_TOKEN_URI =
//         "https://gateway.pinata.cloud/ipfs/bafybeicyf4qlta7ago2ck4bdthpw3elp5y2fq723duvw5iwmyvwm67olnm/";

//     // -------------------------
//     // 📌 Storage
//     // -------------------------

//     mapping(string => TycoonLib.User) public users;
//     mapping(uint256 => TycoonLib.Game) public games;
//     mapping(uint256 => TycoonLib.GameSettings) public gameSettings;
//     mapping(uint256 => mapping(uint256 => TycoonLib.Property)) public properties;
//     mapping(uint256 => mapping(address => TycoonLib.GamePlayer)) public gamePlayers; // GameId => Wallet Address => Player

//     // -------------------------
//     // 📌 Events
//     // -------------------------

//     event PlayerCreated(string indexed username, address indexed player, uint64 timestamp);
//     event GameCreated(uint256 indexed gameId, address indexed creator, uint64 timestamp);
//     event DiceRolled(uint256 indexed gameId, address player, uint256 die1, uint256 die2, uint256 newPos);
//     event PlayerNFTBurned(address indexed player, uint256 indexed tokenId);

//     constructor(address _token) ERC721("Tycoon", "TYC") {
//         require(_token != address(0), "Invalid token address");
//         token = _token;
//         paymaster = msg.sender;
//     }

//     // -------------------------
//     // 📌 Modifiers
//     // -------------------------

//     modifier onlyPaymaster() {
//         require(msg.sender == paymaster, "Not paymaster");
//         _;
//     }

//     modifier nonEmptyUsername(string memory username) {
//         require(bytes(username).length > 0, "Username cannot be empty");
//         _;
//     }

//     // -------------------------
//     // 📌 Player Management
//     // -------------------------

//     /**
//      * @dev Registers a new player and mints three NFTs (variants a, b, c).
//      */
//     function registerPlayer(string memory username)
//         public
//         nonReentrant
//         nonEmptyUsername(username)
//         returns (uint256)
//     {
//         require(users[username].playerAddress == address(0), "Username taken");
//         totalUsers++;
//         uint64 nowTime = uint64(block.timestamp);
//         address userwallet = address(new Wallet(address(this)));

//         users[username] = TycoonLib.User({
//             id: totalUsers,
//             username: username,
//             playerAddress: userwallet,
//             registeredAt: nowTime,
//             gamesPlayed: 0,
//             gamesWon: 0,
//             gamesLost: 0,
//             totalStaked: 0,
//             totalEarned: 0,
//             totalWithdrawn: 0
//         });

//         IERC20(token).transfer(userwallet, 10 * 10 ** 18); // Initial token airdrop

//         // Mint all three NFT variants
//         mintNft(userwallet, "a");
//         mintNft(userwallet, "b");
//         mintNft(userwallet, "c");

//         emit PlayerCreated(username, userwallet, nowTime);
//         return totalUsers;
//     }

//     // -------------------------
//     // 📌 NFT Management
//     // -------------------------

//     /**
//      * @dev Burns an NFT by token ID. Only callable by paymaster.
//      */
//     function burnNft(uint256 tokenId) public onlyPaymaster {
//         address nftOwner = ownerOf(tokenId);
//         _burn(tokenId);
//         emit PlayerNFTBurned(nftOwner, tokenId);
//     }

//     /**
//      * @dev Mints an NFT with the specified URI suffix (e.g., "a" for variant a).
//      * Uses _mint instead of _safeMint since the recipient is a trusted Wallet contract.
//      * @param to The recipient address.
//      * @param suffix The URI suffix ("a", "b", or "c").
//      * @return The minted token ID.
//      */
//     function mintNft(address to, string memory suffix) internal returns (uint256) {
//         require(bytes(suffix).length > 0, "Invalid URI suffix");
//         uint256 tokenId = _nextTokenId;
//         _nextTokenId++;

//         string memory uri;
//         bytes32 hash = keccak256(bytes(suffix));
//         if (hash == keccak256("a")) {
//             uri = string.concat(BASE_TOKEN_URI, "a");
//         } else if (hash == keccak256("b")) {
//             uri = string.concat(BASE_TOKEN_URI, "b");
//         } else if (hash == keccak256("c")) {
//             uri = string.concat(BASE_TOKEN_URI, "c");
//         } else {
//             revert("Invalid URI suffix: must be 'a', 'b', or 'c'");
//         }

//         _mint(to, tokenId);
//         _setTokenURI(tokenId, uri);
//         return tokenId;
//     }

//     // -------------------------
//     // 📌 Game Lifecycle
//     // -------------------------

//     function createGame(
//         string memory creatorUsername,
//         string memory gameType,
//         string memory playerSymbol,
//         uint8 numberOfPlayers,
//         string memory code,
//         uint256 startingBalance
//     ) public onlyPaymaster nonReentrant returns (uint256) {
//         require(numberOfPlayers >= 2 && numberOfPlayers <= 8, "Invalid player count");
//         require(bytes(creatorUsername).length > 0, "Invalid creator");
//         require(bytes(gameType).length > 0, "Invalid game type");
//         require(bytes(playerSymbol).length > 0, "Invalid player symbol");
//         require(startingBalance > 0, "Invalid starting balance");

//         TycoonLib.User storage user = users[creatorUsername];
//         require(user.playerAddress != address(0), "User not registered");
//         address creator = user.playerAddress;
//         user.gamesPlayed += 1;
//         user.totalStaked += TycoonLib.STAKE_AMOUNT;
//         IWallet(creator).withdrawERC20(token, address(this), TycoonLib.STAKE_AMOUNT); // Stake to create game

//         uint8 gType = TycoonLib.stringToGameType(gameType);
//         uint8 pSym = TycoonLib.stringToPlayerSymbol(playerSymbol);

//         uint256 gameId = nextGameId++;

//         // Initialize game settings
//         gameSettings[gameId] = TycoonLib.GameSettings({
//             maxPlayers: numberOfPlayers,
//             auction: true, // default
//             rentInPrison: false, // default
//             mortgage: true, // default
//             evenBuild: true, // default
//             startingCash: startingBalance,
//             privateRoomCode: code // reuse code for private if needed
//         });

//         games[gameId] = TycoonLib.Game({
//             id: gameId,
//             code: code,
//             creator: creator,
//             status: TycoonLib.GameStatus.Pending,
//             nextPlayer: 1,
//             winner: address(0),
//             numberOfPlayers: numberOfPlayers,
//             joinedPlayers: 1,
//             mode: TycoonLib.GameType(gType),
//             createdAt: uint64(block.timestamp),
//             endedAt: 0,
//             totalStaked: TycoonLib.STAKE_AMOUNT // Start with creator's stake
//         });

//         // Register creator in game
//         gamePlayers[gameId][creator] = TycoonLib.GamePlayer({
//             gameId: gameId,
//             playerAddress: creator,
//             balance: startingBalance,
//             position: 0,
//             order: 1,
//             symbol: TycoonLib.PlayerSymbol(pSym),
//             username: user.username
//         });

//         totalGames++;
//         emit GameCreated(gameId, creator, uint64(block.timestamp));
//         return gameId;
//     }

//     function joinGame(uint256 gameId, string memory playerUsername, string memory playerSymbol)
//         public
//         onlyPaymaster
//         nonReentrant
//         returns (uint8)
//     {
//         TycoonLib.Game storage game = games[gameId];
//         require(game.creator != address(0), "Game not found");
//         require(game.status == TycoonLib.GameStatus.Pending, "Game not open");
//         require(game.joinedPlayers < game.numberOfPlayers, "Game full");
//         TycoonLib.User storage user = users[playerUsername];
//         require(user.playerAddress != address(0), "User not registered");
//         address player = user.playerAddress;
//         require(gamePlayers[gameId][player].playerAddress == address(0), "Already joined");
//         require(bytes(playerSymbol).length > 0, "Invalid player symbol");

//         user.gamesPlayed += 1;
//         user.totalStaked += TycoonLib.STAKE_AMOUNT;
//         IWallet(player).withdrawERC20(token, address(this), TycoonLib.STAKE_AMOUNT); // Stake to join game
//         game.totalStaked += TycoonLib.STAKE_AMOUNT;

//         uint8 pSym = TycoonLib.stringToPlayerSymbol(playerSymbol);

//         uint8 order = game.joinedPlayers + 1;
//         game.joinedPlayers++;

//         gamePlayers[gameId][player] = TycoonLib.GamePlayer({
//             gameId: gameId,
//             playerAddress: player,
//             balance: gameSettings[gameId].startingCash,
//             position: 0,
//             order: order,
//             symbol: TycoonLib.PlayerSymbol(pSym),
//             username: user.username
//         });

//         if (game.joinedPlayers == game.numberOfPlayers) {
//             game.status = TycoonLib.GameStatus.Ongoing;
//         }
//         return order;
//     }

//     function removePlayerFromGame(uint256 gameId, string memory playerUsername, string memory finalCandidateUsername, uint256 totalTurns)
//         public
//         onlyPaymaster
//         nonReentrant
//         returns (bool)
//     {
//         TycoonLib.Game storage game = games[gameId];
//         require(game.creator != address(0), "Game not found");
//         require(game.status == TycoonLib.GameStatus.Ongoing, "Game not ongoing");
//         require(bytes(playerUsername).length > 0, "Invalid player username");
//         TycoonLib.User storage userLost = users[playerUsername];
//         require(userLost.playerAddress != address(0), "User not registered");
//         address player = userLost.playerAddress;
//         require(gamePlayers[gameId][player].playerAddress != address(0), "Player not in game");

//         bool isFinalPhase = TycoonLib.isFinalPhase(game.joinedPlayers);
//         address finalCandidate;
//         if (isFinalPhase) {
//             require(bytes(finalCandidateUsername).length > 0, "Remaining player required");
//             TycoonLib.User storage finalUser = users[finalCandidateUsername];
//             require(finalUser.playerAddress != address(0), "Remaining player not registered");
//             finalCandidate = finalUser.playerAddress;
//             require(finalCandidate != player, "Candidate was removed");
//             require(gamePlayers[gameId][finalCandidate].playerAddress != address(0), "Remaining player not in game");
//         }

//         // Update player lost
//         userLost.gamesLost += 1;

//         // Remove the player
//         delete gamePlayers[gameId][player];
//         game.joinedPlayers -= 1;

//         // If only one player remains, finalize game
//         if (isFinalPhase) {
//             game.status = TycoonLib.GameStatus.Ended;
//             game.winner = finalCandidate;
//             game.endedAt = uint64(block.timestamp);

//             TycoonLib.User storage winnerUser = users[finalCandidateUsername];
//             winnerUser.gamesWon += 1;

//             // Pay bonus only if totalTurns >= MIN_TURNS_FOR_BONUS
//             uint256 reward = TycoonLib.calculateReward(totalTurns);
//             if (reward > 0) {
//                 winnerUser.totalEarned += reward;
//                 fund_smart_wallet_ERC20(finalCandidate, reward);
//             }
//         }

//         return true;
//     }

//     // -------------------------
//     // 📌 Gameplay
//     // -------------------------

//     function updatePlayerPosition(
//         uint256 gameId,
//         string memory playerUsername,
//         uint8 newPosition,
//         uint256 newBalance,
//         uint8 propertyId
//     ) public onlyPaymaster returns (bool) {
//         TycoonLib.Game storage game = games[gameId];
//         require(game.status == TycoonLib.GameStatus.Ongoing, "Game not ongoing");
//         require(bytes(playerUsername).length > 0, "Invalid player username");

//         TycoonLib.User storage user = users[playerUsername];
//         require(user.playerAddress != address(0), "User not registered");
//         address player = user.playerAddress;

//         TycoonLib.GamePlayer storage gp = gamePlayers[gameId][player];
//         require(gp.playerAddress != address(0), "Player not found");

//         gp.position = newPosition;
//         gp.balance = newBalance;

//         if (propertyId != 0 && propertyId < TycoonLib.BOARD_SIZE) {
//             TycoonLib.Property storage prop = properties[gameId][propertyId];
//             prop.id = propertyId;  // Set ID for consistency
//             prop.gameId = gameId;  // Though keyed, for completeness
//             prop.owner = player;
//         }

//         return true;
//     }

//     // -------------------------
//     // 📌 Views & Helpers
//     // -------------------------

//     function getUser(string memory username) public view returns (TycoonLib.User memory) {
//         require(users[username].playerAddress != address(0), "User not registered");
//         return users[username];
//     }

//     function getGame(uint256 gameId) public view returns (TycoonLib.Game memory) {
//         require(games[gameId].creator != address(0), "Game not found");
//         return games[gameId];
//     }

//     function getGamePlayer(uint256 gameId, string memory username) public view returns (TycoonLib.GamePlayer memory) {
//         TycoonLib.User storage user = users[username];
//         require(user.playerAddress != address(0), "User not registered");
//         address playerAddr = user.playerAddress;
//         require(gamePlayers[gameId][playerAddr].playerAddress != address(0), "Player not in game");
//         return gamePlayers[gameId][playerAddr];
//     }

//     function getProperty(uint256 gameId, uint8 propertyId) public view returns (TycoonLib.Property memory) {
//         require(propertyId < TycoonLib.BOARD_SIZE, "Property not found");
//         return properties[gameId][propertyId];
//     }

//     function fund_smart_wallet_ERC20(address wallet, uint256 amount) internal returns (bool) {
//         IERC20 erc20 = IERC20(token);
//         bool success = erc20.transfer(wallet, amount);
//         require(success, "ERC20 transfer failed");
//         return true;
//     }

//     // ERC721 overrides
//     function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
//         return super.tokenURI(tokenId);
//     }

//     function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
//         return super.supportsInterface(interfaceId);
//     }

//     receive() external payable {}
// }

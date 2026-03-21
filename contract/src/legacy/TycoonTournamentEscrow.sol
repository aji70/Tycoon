// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TycoonTournamentEscrow
 * @notice Holds USDC for tournament entry fees and prize pools. Backend finalizes and distributes to winners.
 * @dev Tournament IDs match backend (uint256). Only owner or backend can create/finalize/cancel.
 */
contract TycoonTournamentEscrow is Ownable, ReentrancyGuard {
    IERC20 public immutable usdc;

    enum TournamentStatus {
        None,       // not created
        Open,       // registration open, accepting entry fees / prize deposit
        Locked,     // bracket locked, no more deposits
        Finalized,  // payouts done
        Cancelled   // refunds done
    }

    struct Tournament {
        uint256 entryFee;            // USDC per player (0 = free entry)
        uint256 prizePoolDeposited;  // USDC deposited by creator
        uint256 totalEntryFees;      // sum of entry fees received
        TournamentStatus status;
        address creator;             // who deposited prize pool (if any)
    }

    mapping(uint256 => Tournament) public tournaments;
    /// @dev Amount each user paid as entry for a tournament (for refunds)
    mapping(uint256 => mapping(address => uint256)) public entryPaid;
    /// @dev List of addresses who paid entry (for cancel refunds)
    mapping(uint256 => address[]) private _entrants;
    mapping(uint256 => mapping(address => bool)) private _entrantIndexed;

    /// @notice USDC left in escrow after finalize (e.g. house cut). Owner sweeps to treasury/reward via sweepTournamentResidualUSDC.
    mapping(uint256 => uint256) public pendingResidualUSDC;

    address public backend;

    event TournamentCreated(uint256 indexed tournamentId, uint256 entryFee, address indexed creator);
    event PrizePoolFunded(uint256 indexed tournamentId, address indexed funder, uint256 amount);
    event Registered(uint256 indexed tournamentId, address indexed player, uint256 amount);
    event TournamentLocked(uint256 indexed tournamentId);
    event TournamentFinalized(uint256 indexed tournamentId, uint256 recipientCount);
    event TournamentCancelled(uint256 indexed tournamentId);
    event Payout(uint256 indexed tournamentId, address indexed to, uint256 amount);
    event Refund(uint256 indexed tournamentId, address indexed to, uint256 amount);
    event BackendUpdated(address indexed previous, address indexed newBackend);
    event TournamentResidualRecorded(uint256 indexed tournamentId, uint256 residual);
    event TournamentResidualSwept(uint256 indexed tournamentId, address indexed to, uint256 amount);
    event StrandedUsdcRecovered(address indexed to, uint256 amount);

    error InvalidTournament();
    error InvalidStatus();
    error InvalidAmount();
    error TransferFailed();
    error AlreadyRegistered();
    error NotRegistered();

    modifier onlyBackendOrOwner() {
        require(msg.sender == backend || msg.sender == owner(), "Not backend or owner");
        _;
    }

    constructor(address _usdc, address initialOwner) Ownable(initialOwner) {
        require(_usdc != address(0), "Invalid USDC");
        usdc = IERC20(_usdc);
    }

    function setBackend(address newBackend) external onlyOwner {
        address previous = backend;
        backend = newBackend;
        emit BackendUpdated(previous, newBackend);
    }

    /**
     * @notice Create or reconfigure a tournament. Only backend or owner.
     * @param tournamentId Backend tournament id (use same as your DB).
     * @param entryFee USDC per player (0 = free entry).
     * @param creator Address that will fund prize pool (or 0 if no prize).
     */
    function createTournament(uint256 tournamentId, uint256 entryFee, address creator) external onlyBackendOrOwner {
        Tournament storage t = tournaments[tournamentId];
        require(t.status == TournamentStatus.None || t.status == TournamentStatus.Open, "Tournament exists");
        t.entryFee = entryFee;
        t.creator = creator;
        if (t.status == TournamentStatus.None) {
            t.status = TournamentStatus.Open;
        }
        emit TournamentCreated(tournamentId, entryFee, creator);
    }

    /**
     * @notice Fund prize pool for a tournament. Caller must approve this contract for USDC.
     */
    function fundPrizePool(uint256 tournamentId, uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        Tournament storage t = tournaments[tournamentId];
        if (t.status != TournamentStatus.Open) revert InvalidStatus();
        t.prizePoolDeposited += amount;
        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        emit PrizePoolFunded(tournamentId, msg.sender, amount);
    }

    /**
     * @notice Register for a tournament by paying entry fee. User must approve this contract for USDC.
     */
    function registerForTournament(uint256 tournamentId) external nonReentrant {
        Tournament storage t = tournaments[tournamentId];
        if (t.status != TournamentStatus.Open) revert InvalidStatus();
        if (entryPaid[tournamentId][msg.sender] > 0) revert AlreadyRegistered();
        uint256 amount = t.entryFee;
        if (amount > 0) {
            if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        }
        t.totalEntryFees += amount;
        entryPaid[tournamentId][msg.sender] = amount;
        if (!_entrantIndexed[tournamentId][msg.sender]) {
            _entrantIndexed[tournamentId][msg.sender] = true;
            _entrants[tournamentId].push(msg.sender);
        }
        emit Registered(tournamentId, msg.sender, amount);
    }

    /**
     * @notice Register a player for a free tournament. Backend calls on behalf of guests (no wallet).
     * Only backend or owner. Only works for tournaments with entryFee == 0.
     */
    function registerForTournamentFor(uint256 tournamentId, address player) external onlyBackendOrOwner nonReentrant {
        if (player == address(0)) revert InvalidTournament();
        Tournament storage t = tournaments[tournamentId];
        if (t.status != TournamentStatus.Open) revert InvalidStatus();
        if (t.entryFee != 0) revert InvalidAmount();
        if (entryPaid[tournamentId][player] > 0) revert AlreadyRegistered();
        t.totalEntryFees += 0;
        entryPaid[tournamentId][player] = 0;
        if (!_entrantIndexed[tournamentId][player]) {
            _entrantIndexed[tournamentId][player] = true;
            _entrants[tournamentId].push(player);
        }
        emit Registered(tournamentId, player, 0);
    }

    /**
     * @notice Lock tournament (no more deposits). Only backend or owner.
     */
    function lockTournament(uint256 tournamentId) external onlyBackendOrOwner {
        Tournament storage t = tournaments[tournamentId];
        require(t.status == TournamentStatus.Open, "Not open");
        t.status = TournamentStatus.Locked;
        emit TournamentLocked(tournamentId);
    }

    /**
     * @notice Pay out USDC to winners (or any list). Only backend or owner. Call after tournament completes.
     * @param tournamentId Backend tournament id.
     * @param recipients Addresses to receive USDC.
     * @param amounts Amount (USDC) for each recipient. Must sum <= available (entry fees + prize pool for this tournament).
     */
    function finalizeTournament(
        uint256 tournamentId,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyBackendOrOwner nonReentrant {
        Tournament storage t = tournaments[tournamentId];
        require(t.status == TournamentStatus.Locked, "Must be locked");
        require(recipients.length == amounts.length, "Length mismatch");
        uint256 total = t.totalEntryFees + t.prizePoolDeposited;
        uint256 sent;
        for (uint256 i; i < recipients.length; i++) {
            sent += amounts[i];
            if (amounts[i] > 0 && recipients[i] != address(0)) {
                if (!usdc.transfer(recipients[i], amounts[i])) revert TransferFailed();
                emit Payout(tournamentId, recipients[i], amounts[i]);
            }
        }
        require(sent <= total, "Exceeds pool");
        uint256 residual = total - sent;
        pendingResidualUSDC[tournamentId] = residual;
        if (residual > 0) {
            emit TournamentResidualRecorded(tournamentId, residual);
        }
        // Pool accounting cleared so tournamentPool() reflects post-payout state; residual is tracked in pendingResidualUSDC.
        t.totalEntryFees = 0;
        t.prizePoolDeposited = 0;
        t.status = TournamentStatus.Finalized;
        emit TournamentFinalized(tournamentId, recipients.length);
    }

    /**
     * @notice Send recorded post-finalize residual (house cut) to a recipient, typically the reward contract. Owner only.
     */
    function sweepTournamentResidualUSDC(uint256 tournamentId, address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidTournament();
        Tournament storage t = tournaments[tournamentId];
        if (t.status != TournamentStatus.Finalized) revert InvalidStatus();
        uint256 amt = pendingResidualUSDC[tournamentId];
        if (amt == 0) revert InvalidAmount();
        pendingResidualUSDC[tournamentId] = 0;
        if (!usdc.transfer(to, amt)) revert TransferFailed();
        emit TournamentResidualSwept(tournamentId, to, amt);
    }

    /**
     * @notice Recover USDC stuck in escrow (mis-sent tokens, legacy balance). Owner only — sweep tournament residuals first when applicable.
     */
    function recoverStrandedUSDC(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0) || amount == 0) revert InvalidAmount();
        if (!usdc.transfer(to, amount)) revert TransferFailed();
        emit StrandedUsdcRecovered(to, amount);
    }

    /**
     * @notice Cancel tournament and refund all entry fees. Prize pool can be refunded to creator by owner later.
     */
    function cancelTournament(uint256 tournamentId) external onlyBackendOrOwner nonReentrant {
        Tournament storage t = tournaments[tournamentId];
        require(t.status == TournamentStatus.Open || t.status == TournamentStatus.Locked, "Cannot cancel");
        address[] storage entrants = _entrants[tournamentId];
        for (uint256 i; i < entrants.length; i++) {
            address a = entrants[i];
            uint256 amt = entryPaid[tournamentId][a];
            if (amt > 0) {
                entryPaid[tournamentId][a] = 0;
                if (!usdc.transfer(a, amt)) revert TransferFailed();
                emit Refund(tournamentId, a, amt);
            }
        }
        t.totalEntryFees = 0;
        t.status = TournamentStatus.Cancelled;
        emit TournamentCancelled(tournamentId);
    }

    /**
     * @notice Refund prize pool to creator after cancel. Only owner.
     */
    function refundPrizeToCreator(uint256 tournamentId) external onlyOwner nonReentrant {
        Tournament storage t = tournaments[tournamentId];
        require(t.status == TournamentStatus.Cancelled, "Must be cancelled");
        uint256 amt = t.prizePoolDeposited;
        require(amt > 0 && t.creator != address(0), "Nothing to refund");
        t.prizePoolDeposited = 0;
        if (!usdc.transfer(t.creator, amt)) revert TransferFailed();
        emit Refund(tournamentId, t.creator, amt);
    }

    /**
     * @notice Get list of entrants for a tournament (for backend to build payout list).
     */
    function getEntrants(uint256 tournamentId) external view returns (address[] memory) {
        return _entrants[tournamentId];
    }

    /**
     * @notice Total USDC available for a tournament (entry fees + prize pool).
     */
    function tournamentPool(uint256 tournamentId) external view returns (uint256) {
        Tournament storage t = tournaments[tournamentId];
        return t.totalEntryFees + t.prizePoolDeposited;
    }
}

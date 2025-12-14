;; ------------------------------------------------------------
;; Tycoon Contract (Clarity)
;; Allows users to register, create, join, and manage game sessions
;; ------------------------------------------------------------

;; ---- GLOBAL STATE ----
(define-data-var latest-game-id uint u0)

;; ---- CONSTANTS ----
(define-constant STATUS_PENDING u1)
(define-constant STATUS_ONGOING u2)
(define-constant STATUS_ENDED u3)
(define-constant STAKE_AMOUNT u1000000000)
(define-constant CONTRACT-PRINCIPAL current-contract)



(define-constant MIN_TURNS_FOR_BONUS u10)
(define-constant BONUS_MULTIPLIER u150) ;; 1.5x as uint (150%)

;; ---- DATA MAPS ----
(define-map games 
  uint
  {
    id: uint,
    code: (string-ascii 32),
    creator: principal,
    game-type: uint,
    number-of-players: uint,
    ai: bool,
    winner: (optional principal),
    joined-players: uint,
    status: uint,
    next-player: principal,
    next-p: uint,
    created-at: uint,
    ended-at: uint,
    total-staked: uint,
    bet-amount: uint
  }
)

(define-map game-settings
  uint
  {
    max-players: uint,
    auction-enabled: bool,
    rent-in-prison: bool,
    mortgage-enabled: bool,
    even-build: bool,
    starting-cash: uint,
    private-code: (string-ascii 32)
  }
)

(define-map properties
  { game-id: uint, property-id: uint }
  {
    owner: principal,
    base-price: uint,
    current-rent: uint
  }
)

(define-map game-players
  { game-id: uint, player: principal }
  {
    balance: uint,
    player-symbol: uint,
    position: uint,
    order: uint,
    winner: (optional principal),
    username: (string-ascii 32)
  }
)

(define-map users
  principal
  { 
    username: (string-ascii 32), 
    registered-at: uint,
    games-played: uint,
    games-won: uint,
    games-lost: uint,
    total-staked: uint,
    total-earned: uint,
    total-withdrawn: uint
  }
)

(define-map usernames
  (string-ascii 32)
  principal
)
(define-map payouts
  principal
  uint
)
(define-map game-codes
  (string-ascii 32)
  {
    id: uint,
    code: (string-ascii 32),
    creator: principal,
    game-type: uint,
    number-of-players: uint,
    ai: bool,
    winner: (optional principal),
    joined-players: uint,
    status: uint,
    next-player: principal,
    next-p: uint,
    created-at: uint,
    ended-at: uint,
    total-staked: uint,
    bet-amount: uint
  }

)



;; ---- ERROR CONSTANTS ----
(define-constant ERR_ALREADY_REGISTERED (err u100))
(define-constant ERR_USERNAME_TAKEN (err u101))
(define-constant ERR_INVALID_USERNAME (err u102))
(define-constant ERR_INVALID_PLAYER_COUNT (err u103))
(define-constant ERR_INVALID_STARTING_BALANCE (err u104))
(define-constant ERR_NOT_REGISTERED (err u105))
(define-constant ERR_INVALID_BALANCE (err u106))
(define-constant ERR_GAME_NOT_ENDED (err u107))
(define-constant ERR_NO_WINNER (err u108))
(define-constant ERR_NOT_WINNER (err u109))
(define-constant ERR_ALREADY_CLAIMED (err u110))


(define-constant ERR_GAME_NOT_FOUND (err u200))
(define-constant ERR_USER_NOT_REGISTERED (err u201))
(define-constant ERR_GAME_NOT_OPEN (err u202))
(define-constant ERR_GAME_FULL (err u203))
(define-constant ERR_ALREADY_JOINED (err u204))
(define-constant ERR_PLAYER_NOT_IN_GAME (err u205))
(define-constant ERR_GAME_NOT_ONGOING (err u206))
(define-constant ERR_INVALID_PROPERTY_ID (err u207))
(define-constant ERR_NOT_PLAYER (err u208))

;; ---- READ-ONLY FUNCTIONS ----

(define-read-only (is-registered (user principal))
  (is-some (map-get? users user))
)

(define-read-only (get-user (user principal))
  (map-get? users user)
)

(define-read-only (get-game (game-id uint))
  (map-get? games game-id)
)

(define-read-only (get-game-settings (game-id uint))
  (map-get? game-settings game-id)
)

(define-read-only (get-property (game-id uint) (property-id uint))
  (map-get? properties { game-id: game-id, property-id: property-id })
)

(define-read-only (get-game-player (game-id uint) (player principal))
  (map-get? game-players { game-id: game-id, player: player })
)

(define-read-only (get-game-by-code (code (string-ascii 32)))
  (map-get? game-codes code)
)

(define-read-only (get-player-balance (player principal))
  (stx-get-balance player)
)

(define-read-only (get-owner)
  (stx-get-balance CONTRACT-PRINCIPAL)
)


;; ---- PUBLIC FUNCTIONS ----

(define-public (register (username (string-ascii 32)))
  (let (
      (caller tx-sender)
      (username-len (len username))
      (existing-user (map-get? users caller))
      (existing-username (map-get? usernames username))
    )
    (asserts! (not (is-some existing-user)) ERR_ALREADY_REGISTERED)
    (asserts! (and (> username-len u0) (<= username-len u32)) ERR_INVALID_USERNAME)
    (asserts! (not (is-some existing-username)) ERR_USERNAME_TAKEN)

    (map-set users caller { 
      username: username, 
      registered-at: stacks-block-time,
      games-played: u0,
      games-won: u0,
      games-lost: u0,
      total-staked: u0,
      total-earned: u0,
      total-withdrawn: u0
    })
    (map-set usernames username caller)
    (ok true)
  )
)

(define-public (create-game
    (game-type uint)
    (player-symbol uint)
    (number-of-players uint)
    (code (string-ascii 32))
    (starting-balance uint)
    (bet-amount uint)
  )
  (let (
      (caller tx-sender)
      (game-id (var-get latest-game-id))
      (user-data (map-get? users caller))
      (caller-balance (stx-get-balance tx-sender))
    )
    (asserts! (is-some user-data) ERR_NOT_REGISTERED)
    (asserts! (and (>= number-of-players u2) (<= number-of-players u8)) ERR_INVALID_PLAYER_COUNT)
    (asserts! (> starting-balance u0) ERR_INVALID_STARTING_BALANCE)

    (asserts! (>= caller-balance bet-amount) ERR_INVALID_BALANCE)  

    ;; (try! (stx-transfer? bet-amount  caller CONTRACT-PRINCIPAL))


    

    (let (
        (user (unwrap! user-data (err u999)))
        (new-game {
          id: game-id,
          code: code,
          creator: caller,
          game-type: game-type,
          number-of-players: number-of-players,
          ai: false,
          winner: none,
          joined-players: u1,
          status: STATUS_PENDING,
          next-player: caller,
          next-p: u1,
          created-at: stacks-block-time,
          ended-at: u0,
          total-staked: bet-amount,
          bet-amount: bet-amount
        })
        (new-player {
          balance: starting-balance,
          player-symbol: player-symbol,
          position: u0,
          order: u1,
          winner: none,
          username: (get username user)
        })
        (updated-user (merge user { 
          games-played: (+ (get games-played user) u1),
          total-staked: (+ (get total-staked user) bet-amount)
        }))
      )

      (map-set users caller updated-user)
      (map-set games game-id new-game)
      (map-set game-players { game-id: game-id, player: caller } new-player)
      (map-set game-settings game-id {
        max-players: number-of-players,
        auction-enabled: true,
        rent-in-prison: false,
        mortgage-enabled: true,
        even-build: true,
        starting-cash: starting-balance,
        private-code: code
      })
      (map-set game-codes code new-game)
      (var-set latest-game-id (+ game-id u1))

      (print { action: "create-game", data: new-game })
      (ok game-id)
    )
  )
)

(define-public (create-ai-game
    (creator-username (string-ascii 32))
    (game-type uint)
    (player-symbol uint)
    (number-of-ai-players uint)
    (code (string-ascii 32))
    (starting-balance uint)
  )
  (let (
      (caller tx-sender)
      (game-id (var-get latest-game-id))
      (user-data (map-get? users caller))
      (all-players (+ number-of-ai-players u1)) 
      (caller-balance (stx-get-balance tx-sender))
    )
    (asserts! (is-some user-data) ERR_NOT_REGISTERED)
    (asserts! (and (>= number-of-ai-players u1) (<= number-of-ai-players u8)) ERR_INVALID_PLAYER_COUNT)
    (asserts! (> starting-balance u0) ERR_INVALID_STARTING_BALANCE)

    ;; (asserts! (>= caller-balance STAKE_AMOUNT) ERR_INVALID_BALANCE)  
    ;; (try! (stx-transfer? STAKE_AMOUNT caller CONTRACT-PRINCIPAL ))

    (let (
        (user (unwrap! user-data (err u999)))
        (new-game {
          id: game-id,
          code: code,
          creator: caller,
          game-type: game-type,
          number-of-players: number-of-ai-players,
          ai: true,
          winner: none,
          joined-players: all-players,
          status: STATUS_ONGOING,
          next-player: caller,
          next-p: u1,
          created-at: stacks-block-time,
          ended-at: u0,
          total-staked: STAKE_AMOUNT,
          bet-amount: STAKE_AMOUNT
        })
        (new-player {
          balance: starting-balance,
          player-symbol: player-symbol,
          position: u0,
          order: u1,
          winner: none,
          username: (get username user)
        })
        (updated-user (merge user { 
          games-played: (+ (get games-played user) u1),
          total-staked: (+ (get total-staked user) STAKE_AMOUNT)
        }))
      )

      (map-set users caller updated-user)
      (map-set games game-id new-game)
      (map-set game-players { game-id: game-id, player: caller } new-player)
      (map-set game-settings game-id {
        max-players: number-of-ai-players,
        auction-enabled: true,
        rent-in-prison: true,
        mortgage-enabled: true,
        even-build: true,
        starting-cash: starting-balance,
        private-code: code
      })
      (map-set game-codes code new-game)
      (var-set latest-game-id (+ game-id u1))

      (print { action: "create-game", data: new-game })
      (ok game-id)
    )
  )
)

(define-public (join-game (game-id uint) (player-symbol uint))
  (let (
      (caller tx-sender)
      (game-opt (map-get? games game-id))
      (user-opt (map-get? users caller))
    )
    (asserts! (is-some game-opt) ERR_GAME_NOT_FOUND)
    (asserts! (is-some user-opt) ERR_USER_NOT_REGISTERED)

    (let (
        (game (unwrap! game-opt (err u200)))
        (user (unwrap! user-opt (err u201)))
        
        (joined-player (map-get? game-players { game-id: game-id, player: caller }))
        (caller-balance (stx-get-balance tx-sender))
      )

      (asserts! (is-eq (get status game) STATUS_PENDING) ERR_GAME_NOT_OPEN)
      (asserts! (< (get joined-players game) (get number-of-players game)) ERR_GAME_FULL)
      (asserts! (not (is-some joined-player)) ERR_ALREADY_JOINED)

    
    ;; (asserts! (>= caller-balance STAKE_AMOUNT) ERR_INVALID_BALANCE)  
    ;; (try! (stx-transfer? STAKE_AMOUNT caller CONTRACT-PRINCIPAL ))

      (let (
          (order (+ (get joined-players game) u1))
          (updated-user (merge user { 
            games-played: (+ (get games-played user) u1),
            total-staked: (+ (get total-staked user) (get bet-amount game))
          }))
          (new-status (if (is-eq order (get number-of-players game)) STATUS_ONGOING STATUS_PENDING))
        )

        (map-set users caller updated-user)
        (map-set game-players 
          { game-id: game-id, player: caller }
          {
            balance: (get bet-amount game),
            player-symbol: player-symbol,
            position: u0,
            order: order,
            winner: none,
            username: (get username user)
          }
        )

        (map-set games game-id
          (merge game
            {
              joined-players: order,
              total-staked: (+ (get total-staked game) (get bet-amount game)),
              status: new-status
            }
          )
        )

        (print { action: "join-game", player: caller, order: order })
        (ok order)
      )
    )
  )
)

(define-public (update-player-position (game-id uint) (player principal) (new-position uint) (new-balance uint) (property-id (optional uint)))
  (let (
      (caller tx-sender)
      (game-opt (map-get? games game-id))
      (player-opt (map-get? game-players { game-id: game-id, player: player }))
    )
    (asserts! (is-some game-opt) ERR_GAME_NOT_FOUND)
    (asserts! (is-some player-opt) ERR_PLAYER_NOT_IN_GAME)
    (asserts! (is-eq (get status (unwrap! game-opt (err u999))) STATUS_ONGOING) ERR_GAME_NOT_ONGOING)
    (asserts! (is-eq caller player) ERR_NOT_PLAYER)

    (let (
        (game (unwrap! game-opt (err u200)))
        (player-data (unwrap! player-opt (err u205)))
        (updated-player (merge player-data { position: new-position, balance: new-balance }))
      )
      (map-set game-players { game-id: game-id, player: player } updated-player)

      ;; If property-id provided, update property owner (assume buy/land occurred)
      (if (is-some property-id)
        (let (
            (prop-id (unwrap! property-id (err u999)))
          )
          (asserts! (and (<= prop-id u39) (>= prop-id u1)) ERR_INVALID_PROPERTY_ID) ;; Assume 40 properties (Monopoly board)
          (map-set properties 
            { game-id: game-id, property-id: prop-id }
            { 
              owner: player, 
              base-price: u100, ;; Default/hardcoded; can expand later
              current-rent: u10
            }
          )
          (ok true)
        )
        (ok true)
      )
    )
  )
)

(define-public (finalize-game (game-id uint) (winner principal) (total-turns uint))
  (let (
      (game-opt (map-get? games game-id))
      (winner-opt (map-get? users winner))
    )
    (asserts! (is-some game-opt) ERR_GAME_NOT_FOUND)
    (asserts! (is-some winner-opt) ERR_USER_NOT_REGISTERED)
    (asserts! (is-eq (get status (unwrap! game-opt (err u999))) STATUS_ONGOING) ERR_GAME_NOT_ONGOING) ;; Or pending for auto-end

    (let (
        (game (unwrap! game-opt (err u200)))
        (total-staked (get total-staked game))
        (winner-user (unwrap! winner-opt (err u201)))
        ;; Simple reward: full pot, with bonus if turns >= MIN
        (reward-multiplier (if (>= total-turns MIN_TURNS_FOR_BONUS) BONUS_MULTIPLIER u100))
        (bonus-amount (* total-staked (/ (- reward-multiplier u100) u100)))
        (total-reward (+ total-staked bonus-amount)) ;; Note: bonus from where? Assume contract funds or simple full pot
        (updated-winner-user (merge winner-user { 
          games-won: (+ (get games-won winner-user) u1),
          total-earned: (+ (get total-earned winner-user) total-staked)
        }))
        (final-game (merge game {
          status: STATUS_ENDED,
          winner: (some winner),
          ended-at: stacks-block-time
        }))
      )

    
      (map-set payouts winner total-staked )
      (map-set users winner updated-winner-user)
      (map-set games game-id final-game)

      (print { action: "finalize-game", winner: winner, reward: total-staked, turns: total-turns })
      (ok total-staked)
    )
  )
)

;; (define-public (withdraw-payout (game-id uint))
;;   (let (
;;         ;; Fetch game
;;         (game-opt (map-get? games game-id))
;;       )
;;     (unwrap-panic game-opt) ;; abort if game doesn't exist

;;     (let ((game (unwrap! game-opt ERR_GAME_NOT_FOUND)))
;;       ;; Only allow if game has ended
;;       (asserts! (is-eq (get status game) STATUS_ENDED) ERR_GAME_NOT_ENDED)

;;       ;; Only winner can withdraw
;;       (let ((winner (unwrap! (get winner game) ERR_NO_WINNER)))
;;         (asserts! (is-eq tx-sender winner) ERR_NOT_WINNER)

;;         ;; Check if payout already claimed
;;         (let ((payout-opt (map-get? payouts winner)))
;;           (asserts! (is-none payout-opt) ERR_ALREADY_CLAIMED)

;;           ;; Amount to pay
;;           (let ((amount (get total-staked game)))
;;             ;; Record payout claimed
;;             (map-set payouts tx-sender amount)

;;             ;; Send STX to winner (tx-sender)
;;             (try! (stx-transfer? amount tx-sender tx-sender))

;;             ;; Return OK with amount
;;             (ok amount)
;;           )
;;         )
;;       )
;;     )
;;   )
;; )



(define-public (remove-player (game-id uint) (player principal) (final-candidate (optional principal)) (total-turns uint))
  (let (
      (game-opt (map-get? games game-id))
      (user-opt (map-get? users player))
    )
    (asserts! (is-some game-opt) ERR_GAME_NOT_FOUND)
    (asserts! (is-some user-opt) ERR_USER_NOT_REGISTERED)

    (let (
        (game (unwrap! game-opt (err u200)))
        (user (unwrap! user-opt (err u201)))
        (player-entry (map-get? game-players { game-id: game-id, player: player }))
      )
      (asserts! (is-some player-entry) ERR_PLAYER_NOT_IN_GAME)
      (asserts! (is-eq (get status game) u2) ERR_GAME_NOT_ONGOING)

      ;; Remove player record first
      (map-delete game-players { game-id: game-id, player: player })

      ;; Compute remaining players and persist updated joined count
      (let (
          (remaining (- (get joined-players game) u1))
          (updated-game (merge game { joined-players: remaining }))
        )
        ;; persist the updated joined-players count
        (map-set games game-id updated-game)

        ;; If only one (or zero) players remain => finalize the game
        (if (<= remaining u1)
          (let (
              (final-player (default-to player final-candidate))
              (final-game (merge updated-game {
                status: u3,
                winner: (some final-player),
                ended-at: stacks-block-time
              }))
            )
            ;; persist final state
            (map-set games game-id final-game)
            (print { action: "end-game", winner: final-player })
            (ok true)
          )
          ;; otherwise, done (game still ongoing or pending depending on status)
          (ok true)
        )
      )
    )
  )
)


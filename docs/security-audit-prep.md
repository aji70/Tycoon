# Security Audit Prep — Mainnet Checklist

**Version:** 1.0  
**Last updated:** March 2026  

Use this checklist before mainnet to verify auth, stakes, contract usage, and rate limits. The contract (e.g. `Tycoon.sol`) is in scope for audit; this doc focuses on **backend/frontend** security and how they interact with the contract.

---

## 1. Authentication

### 1.1 Backend

| Item | Where | Notes |
|------|--------|--------|
| **JWT secret** | `backend/middleware/auth.js`, `backend/controllers/guestAuthController.js` | `JWT_SECRET` must be set in production; default is `tycoon-guest-secret-change-in-production`. |
| **Guest auth** | `POST /api/auth/guest-register`, `POST /api/auth/guest-login` | Username/password; password hashed with keccak256 for contract. Guests get JWT with `isGuest: true`. |
| **Wallet auth** | `POST /api/auth/login-by-wallet` | Signature verified; user resolved by primary or linked wallet. |
| **Link / merge** | `POST /api/auth/link-wallet`, `POST /api/auth/merge-guest-into-wallet` | Link: guest stores linked wallet. Merge: guest data moved to wallet user; guest account deleted. Both require signature. |
| **Privy** | `POST /api/auth/privy-signin` | Requires `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_JWT_VERIFICATION_KEY`. |
| **Protected routes** | `requireAuth`, `optionalAuth` | Many game actions require `Authorization: Bearer <token>`; optionalAuth sets `req.user` when token present. |

**Checklist:**

- [ ] `JWT_SECRET` is strong and not the default in production.
- [ ] Privy env vars match frontend `NEXT_PUBLIC_PRIVY_APP_ID` and are kept secret on backend.
- [ ] No sensitive tokens or keys logged (PII/keys redacted in logs).

### 1.2 Frontend

- [ ] Tokens stored securely (e.g. localStorage; consider httpOnly cookies for production if needed).
- [ ] Wallet signatures use nonces or timestamps to avoid replay (e.g. merge/link messages include timestamp).

---

## 2. Stakes (USDC / value at risk)

### 2.1 Guest restriction

Guests **cannot** create or join staked games. Enforcement:

- **Backend:** Rejects with 403 if guest creates with `stake > 0` or joins a game with on-chain `stakePerPlayer > 0`.
- **Frontend:** Hides stake UI for guests; blocks join when `stakePerPlayer > 0`.
- **Contract:** No change; backend never calls `createGameByBackend` / `joinGameByBackend` with non-zero stake for guests.

See **`docs/guest-staked-games-restriction.md`** for full behavior and tests.

**Checklist:**

- [ ] Backend create-as-guest and join-as-guest enforce zero stake (no regression).
- [ ] Frontend create/join flows prevent guests from submitting staked game requests.
- [ ] On-chain stake read (e.g. `getGame` / `stakePerPlayer`) used for join check is correct for your contract ABI.

### 2.2 Staked game flows (wallet users)

- [ ] Create/join with stake use correct chain (CELO/Polygon/Base) and USDC (or stake token) approval/transfer flow.
- [ ] Payouts (e.g. winner, tournament) and any escrow are documented and tested; contract roles (e.g. backend vs user) are clear.

---

## 3. Contract calls (backend)

### 3.1 Keys and roles

| Chain | Env vars | Role |
|-------|----------|------|
| Celo | `BACKEND_GAME_CONTROLLER_PRIVATE_KEY` or `BACKEND_GAME_CONTROLLER_CELO_PRIVATE_KEY` | Backend wallet; must be set as `backendGameController` on contract. |
| Polygon | `BACKEND_GAME_CONTROLLER_POLYGON_PRIVATE_KEY` (fallback: `BACKEND_GAME_CONTROLLER_PRIVATE_KEY`) | Same role on Polygon contract. |
| Base | `BACKEND_GAME_CONTROLLER_BASE_PRIVATE_KEY` (fallback: `BACKEND_GAME_CONTROLLER_PRIVATE_KEY`) | Same role on Base contract. |

Config: `backend/config/chains.js`. Contract service: `backend/services/tycoonContract.js`.

**Checklist:**

- [ ] Per-chain private keys are for a wallet that is **only** the backend game controller (no user funds).
- [ ] Keys are not committed or logged; env vars are set in production secrets only.
- [ ] Contract’s `backendGameController` matches the key used per chain.

### 3.2 Concurrency and failure handling

- **Tx queue:** All backend contract **writes** go through `withTxQueue()` so only one tx is in flight per process (avoids nonce collisions). See `tycoonContract.js`.
- **Reads:** No queue; multiple concurrent reads are fine.
- **Failure handling:** Controllers typically `.catch()` contract call errors and return 500 or a clear message; some paths log and continue (e.g. finish-game cleanup). Verify no silent swallowing of revert reasons when user/operator should be informed.

**Checklist:**

- [ ] No backend path sends a contract write without going through the tx queue (or an equivalent serialization).
- [ ] Contract revert reasons or RPC errors are logged (and optionally returned to client where appropriate).
- [ ] DB and contract state stay consistent on partial failure (e.g. game created on-chain but DB fail → document recovery or idempotency).

### 3.3 Config-test and allowed write functions

- **`POST /api/config/call-contract`** (body: `fn`, `params`, `write`, `chain`) allows **manual** contract read/write for testing. It uses `ALLOWED_WRITE_FNS` and `ALLOWED_READ_FNS` in `tycoonContract.js`.
- **Allowed write functions** (for that endpoint) include: `registerPlayer`, `transferPropertyOwnership`, `setTurnCount`, `removePlayerFromGame`, `createGame`, `createAIGame`, `joinGame`, `leavePendingGame`, `exitGame`, `endAIGame`, `setBackendGameController`, `setMinTurnsForPerks`, `setMinStake`, `withdrawHouse`, `drainContract`.

**Checklist:**

- [ ] Config-test/call-contract is **disabled or strictly restricted** in production (e.g. NODE_ENV check or IP/API key). It must not be publicly callable on mainnet.
- [ ] If enabled in staging, `drainContract` / `withdrawHouse` and admin-style fns are understood and access-controlled.

---

## 4. Rate limits

### 4.1 HTTP

- **Middleware:** `express-rate-limit` in `backend/server.js`.
- **Default:** 500 requests per minute per IP (`RATE_LIMIT_MAX` env, default 500).
- **Window:** 1 minute.
- **Response:** 429 with message "Too many requests from this IP, please try again later."

**Checklist:**

- [ ] `RATE_LIMIT_MAX` is set for production load (and abuse) expectations.
- [ ] Trust proxy is set correctly (`app.set("trust proxy", 1)`) so client IP is taken from `X-Forwarded-For` when behind a reverse proxy.

### 4.2 Socket.IO

- **Per-IP connections:** Max **5** concurrent connections per IP (`CONNECTIONS_PER_IP`). Excess connections are disconnected.
- **Per-socket events:** Max **60** events per minute per socket (`EVENTS_PER_SOCKET_PER_MINUTE`). Excess triggers "Too many actions; slow down."

**Checklist:**

- [ ] Limits are acceptable for real multi-tab or multi-device users; adjust if needed.
- [ ] Connection limit is enforced after proxy (IP from `x-forwarded-for` or equivalent).

---

## 5. Other security

### 5.1 Headers and CORS

- **Helmet:** Enabled for security headers.
- **CORS:** Currently broad (`cors()`); for mainnet consider restricting `origin` to your frontend domain(s).

**Checklist:**

- [ ] CORS origin is restricted in production to known frontend URLs.
- [ ] No sensitive data exposed via headers (e.g. server version).

### 5.2 Analytics and admin

- **Analytics:** `GET /api/analytics/dashboard` and `GET /api/analytics/activity` are protected by `ANALYTICS_API_KEY` when set (header `X-Analytics-Key` or query `key`).
- [ ] `ANALYTICS_API_KEY` is set in production and not guessable; frontend does not send it for general users.

### 5.3 Input and payload limits

- **JSON body:** `express.json({ limit: "1mb" })`. Prevents huge payloads.
- [ ] No unvalidated user input is passed to contract (e.g. usernames/symbols validated or sanitized).

---

## 6. Contract-specific (audit focus)

These are reminders for the **smart contract** audit; the backend/frontend must align.

- [ ] **Access control:** Only `backendGameController` (and any other designated roles) can call `*ByBackend` and other restricted functions; no privilege escalation.
- [ ] **Stake flow:** Stake deposit, lock, and payout (including tournament escrow if used) are correct and reentrancy-safe.
- [ ] **Guest stake:** Contract does not rely on “guest” flag; backend never sends non-zero stake for guest flows (see §2.1).
- [ ] **Pause / upgrade:** If the contract is pausable or upgradeable, backend and frontend handle “contract unavailable” and retries appropriately.
- [ ] **Oracle / RNG:** If contract uses external data or randomness, those are reviewed and trusted.

---

## 7. Quick reference — env vars (secrets)

| Variable | Used for |
|----------|----------|
| `JWT_SECRET` | Guest and wallet JWT signing; **must** change in production. |
| `BACKEND_GAME_CONTROLLER_*_PRIVATE_KEY` | Contract writes (create/join/setTurnCount/removePlayer/…) per chain. |
| `PRIVY_APP_SECRET`, `PRIVY_JWT_VERIFICATION_KEY` | Privy sign-in verification. |
| `ANALYTICS_API_KEY` | Optional; protects analytics endpoints. |
| `ANTHROPIC_API_KEY` | Internal AI agent (gameplay); not contract. |

Ensure none of these are committed or logged; use a secrets manager or platform env for production.

---

*After completing the checklist, run through guest create/join (free), wallet create/join (staked), and contract payout paths in staging or testnet before mainnet.*

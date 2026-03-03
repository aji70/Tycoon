# Privy integration guide for Tycoon

This doc guides the full integration of [Privy](https://www.privy.io/) into Tycoon: auth + embedded wallets for guests and logged-in users, optional gas sponsorship, and backend verification.

---

## 1. What Privy will do for Tycoon

| Area | Today | With Privy |
|------|--------|------------|
| **Guests** | Backend guest-register + token; optional wallet link | Privy session + **auto-created embedded wallet**; same account can later add email/social |
| **Wallet connect** | Reown AppKit + Wagmi (Celo); user must have a wallet | Privy can create **embedded wallets** so users play without MetaMask; still support external wallets |
| **Auth on API** | Token from guest login / wallet signature | **Privy access token** (JWT) verified on backend via `@privy-io/node` |
| **Gas** | User pays gas | Optional **gas sponsorship** via Privy + paymaster for key actions |

---

## 2. Decisions (locked in and open)

### Chains and networks — decided

- **Frontend:** **Celo only.** PrivyProvider and wallet UX use Celo only (match current AppKit; one chain in UI).
- **Backend:** **Celo and Polygon.** Server can verify users and operate (e.g. create wallets, sign/send tx, index) on both Celo and Polygon.

---

## 2b. Decisions you still need to make (answer these before implementation)

### Gas sponsorship

- **Q2.** Do you want Tycoon to **sponsor gas** for users (so they don’t need native tokens)?
  - **Yes** → We’ll plan for smart wallets + paymaster (Privy dashboard + backend).
  - **No** → We’ll use standard embedded wallets only; user pays gas.

### Gas sponsorship

- **Q2.** Do you want Tycoon to **sponsor gas** for users (so they don’t need native tokens)?
  - **Yes** → We’ll plan for smart wallets + paymaster (Privy dashboard + backend).
  - **No** → We’ll use standard embedded wallets only; user pays gas.

### Login methods

- **Q3.** Which login methods should we enable in Privy?
  - **Email (OTP)** only for now?
  - **Email + social** (Google, Twitter, etc.)?
  - **“Continue as guest”** (device-bound, no email) then “Save account” later with email/social?

### Guest auth vs Privy

- **Q4.** How should we treat your **existing guest system** (GuestAuthProvider, `auth/guest-register`, `auth/me`, token in localStorage)?
  - **Option A:** **Replace** guest auth with Privy (all “guests” become Privy users with embedded wallets).
  - **Option B:** **Keep** guest auth for “play without account,” and use Privy only when user chooses “Connect wallet” or “Sign up with email” (hybrid).
  - **Option C:** **Migrate gradually**: new users get Privy; existing guest flows stay until we deprecate them.

### Wallet UX

- **Q5.** Should “Connect wallet” in the navbar:
  - **Only** open Privy (embedded + external wallets via Privy), or
  - **Keep** Reown AppKit for external wallets and use Privy only for “email / guest” users who get an embedded wallet?

---

## 3. Prerequisites

- [ ] **Privy account**  
  Sign up at [privy.io](https://www.privy.io/) and create an app.

- [ ] **App ID and Client ID**  
  From [Privy Dashboard](https://dashboard.privy.io/) → your app → copy **App ID**.  
  If you use multiple environments (e.g. dev/prod), create **App Clients** and use **Client ID** per environment.

- [ ] **App secret (backend only)**  
  For server-side verification and (optional) server-side wallet creation: Dashboard → App → copy **App Secret**.  
  Store in env (e.g. `PRIVY_APP_SECRET`), never in frontend.

- [ ] **Node version**  
  Backend: Node 20+ for `@privy-io/node`.

- [ ] **Backend env (for Privy DB user)**  
  Set `PRIVY_APP_ID` and `PRIVY_APP_SECRET` in the backend so `POST /auth/privy-signin` can verify tokens and create/link users.  
  **Important:** `PRIVY_APP_ID` must equal the frontend’s `NEXT_PUBLIC_PRIVY_APP_ID` (same Privy app). If they differ, token verification fails with "Invalid or expired Privy token".  
  Optional: set `PRIVY_JWT_VERIFICATION_KEY` (from Dashboard → Configuration → App settings) to verify tokens locally and avoid per-request API calls.

- [ ] **Migration**  
  Run `npm run migrate` in the backend to add the `privy_did` column to `users` (see migration `20260306000000_add_privy_did_to_users.js`).

---

## 3a. Troubleshooting: "Invalid or expired Privy token"

If the frontend shows *"Privy sign-in worked, but the game server couldn't link your session: Invalid or expired Privy token"*:

1. **Same backend as the one you're calling**  
   The frontend uses `NEXT_PUBLIC_API_URL` (e.g. Railway). That backend must have Privy env set. Local `.env` does not apply to Railway.

2. **Check the backend that serves the request**  
   Open in the browser (or `curl`):
   ```text
   https://<your-backend-host>/api/auth/privy-check
   ```
   You should see `privyConfigured: true` and `privyAppIdMasked: "cmm9...qh9z"` (or your app’s masked ID).  
   - If `privyConfigured: false` → set `PRIVY_APP_ID` and `PRIVY_APP_SECRET` in that backend’s env (e.g. Railway variables).  
   - If the masked ID does **not** match your frontend’s `NEXT_PUBLIC_PRIVY_APP_ID` (e.g. `cmm9kscwq03zy0cjoycdpqh9z` → `cmm9...qh9z`), the backend is using a different Privy app. Use the same app’s App ID and App Secret from [Privy Dashboard](https://dashboard.privy.io/).

3. **Add JWT verification key (recommended)**  
   In [Privy Dashboard](https://dashboard.privy.io/) → your app → **Configuration** → **App settings** → copy the **verification key** (“Verify with key instead”).  
   In your backend env (e.g. Railway), add:
   ```text
   PRIVY_JWT_VERIFICATION_KEY="-----BEGIN PUBLIC KEY-----
   ...
   -----END PUBLIC KEY-----"
   ```
   Use one line with `\n` for newlines if the platform requires it. This avoids extra network calls and often fixes verification failures.

4. **Redeploy**  
   After changing env vars on Railway (or your host), redeploy so the new values are applied.

---

## 3b. Privy users in the DB (username)

Privy-authenticated users are stored in the same `users` table with a **username** and `privy_did`:

- **First time:** After sign-in with Privy, the frontend shows a “Choose your username” modal and calls `POST /auth/privy-signin` with `Authorization: Bearer <privy_access_token>` and body `{ username }`. The backend verifies the token, creates a user (username, `privy_did`, placeholder address, `is_guest: true`), and returns our JWT + user. The frontend stores the JWT and refetches guest session so the rest of the app sees the user.
- **Returning:** If a user with that `privy_did` exists, `POST /auth/privy-signin` (with no body) returns our JWT + user; no username prompt.

---

## 4. High-level architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js) — Celo only                                  │
│  • PrivyProvider (root layout), chains: [Celo]                   │
│  • config: embeddedWallets.ethereum.createOnLogin                 │
│  • Login UI: guest / email / social → Privy                      │
│  • usePrivy(), useWallets() for address & send tx (Celo)        │
│  • Optional: Wagmi + Privy adapter if we keep wagmi for contracts│
└─────────────────────────────────────────────────────────────────┘
                                    │
                    Access token (Bearer) or session
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend (Node) — Celo + Polygon                                 │
│  • @privy-io/node: verifyAuthToken(token)                        │
│  • Map Privy DID → your player ID (DB)                           │
│  • Operate on Celo and Polygon (wallets, tx, indexing)            │
│  • Optional: create wallet / sign tx server-side for sensitive ops│
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Implementation steps (after you answer the questions)

### Phase 1 – Frontend foundation

1. **Install**  
   `npm i @privy-io/react-auth` (and, if using wagmi with Privy, `@privy-io/wagmi` per [Privy wagmi docs](https://docs.privy.io/guide/react/wallets/usage/wagmi)).

2. **Env**  
   Add to `.env.local`:
   - `NEXT_PUBLIC_PRIVY_APP_ID=your-app-id`
   - Optional: `NEXT_PUBLIC_PRIVY_CLIENT_ID=your-client-id` (if using app clients).

3. **PrivyProvider**  
   - Add a client component (e.g. `components/Providers/PrivyProviderWrapper.tsx`) that wraps children with `PrivyProvider`.
   - Config: `embeddedWallets.ethereum.createOnLogin: 'users-without-wallets'`, and **Celo only** for default chain / supported chains in the frontend.
   - In `app/layout.tsx`, wrap the app with this provider (e.g. inside or alongside `GuestAuthProvider` / `TycoonProvider`, depending on **Q4**).

4. **Auth UI**  
   - “Play as guest” / “Continue with email” / “Connect wallet” should trigger Privy login (e.g. `login()`, `loginWithEmail()`, or custom modal using Privy hooks).
   - After login, use `usePrivy().user` and `useWallets()` to get embedded/external wallet address.

5. **Use Privy wallet in game**  
   - In board/multiplayer pages, where you currently use `useAccount()` from wagmi, we’ll either:
     - Switch to Privy’s `useWallets()` and use the active wallet address for the same flows, or
     - Integrate Privy with wagmi via `@privy-io/wagmi` so `useAccount()` still works with Privy-backed wallets.
   - Ensure socket/API calls send the **Privy-backed address** (and optionally backend sends **Privy access token**).

### Phase 2 – Backend verification

6. **Install**  
   In backend: `npm i @privy-io/node`.

7. **Env**  
   Backend `.env`: `PRIVY_APP_ID`, `PRIVY_APP_SECRET` (and optional `PRIVY_JWT_VERIFICATION_KEY` for offline verification).

8. **Middleware / helper**  
   - Create a small helper that reads `Authorization: Bearer <token>` and calls `privy.verifyAuthToken(token)`.
   - On success, attach the Privy user (e.g. `did`, `userId`) to the request; resolve to your **player ID** from DB and use that for game logic.
   - Backend chain support: configure **Celo and Polygon** (chain IDs, RPCs) wherever you create wallets, send tx, or index (e.g. game state on Celo, rewards on Polygon).

9. **Protect routes**  
   Use this middleware on any route that should require a logged-in user (e.g. join game, submit move, claim reward). Optionally keep existing guest token routes during migration (**Q4**).

10. **Link Privy user to player**  
    - On first verified Privy request, create or link a player record keyed by Privy DID (or your chosen stable ID from Privy).
    - Reuse or migrate existing `GamePlayer` / user tables so one player can be “guest legacy” or “Privy user.”

### Phase 3 – Optional gas sponsorship

11. **Dashboard**  
    In Privy Dashboard, enable smart wallets and add your **paymaster URL** (e.g. Pimlico, Alchemy, or Privy’s offering if applicable).

12. **Backend**  
    If you sponsor from your server: use `@privy-io/node` to create/get wallet, then use `permissionless` + `viem` with a paymaster client to send gas-sponsored transactions. See [Privy: Sponsoring transactions on Ethereum](https://docs.privy.io/wallets/gas-and-asset-management/gas/ethereum).

13. **Frontend**  
    Ensure the app uses the smart wallet (and correct chain) when sending sponsored tx; document which actions are sponsored (e.g. “first move,” “claim reward”) and any rate limits.

### Phase 4 – Cleanup and docs

14. **Guest auth**  
    Depending on **Q4**, deprecate or remove `GuestAuthProvider` / guest-register flows and point everything to Privy.

15. **AppKit / Wagmi**  
    Depending on **Q5**, either remove Reown AppKit and use only Privy for connect, or keep both and document when each is used.

16. **Docs**  
    Update README or internal runbooks with env vars, dashboard links, and how to test “guest” vs “signed up” flows.

---

## 6. References

- [Privy React setup](https://docs.privy.io/basics/react/setup)
- [Privy Node SDK (recommended over server-auth)](https://docs.privy.io/basics/nodeJS-server-auth/quickstart) (use `@privy-io/node`)
- [Privy: Sponsoring transactions on Ethereum](https://docs.privy.io/wallets/gas-and-asset-management/gas/ethereum)
- [Privy + wagmi](https://docs.privy.io/guide/react/wallets/usage/wagmi)

---

## 7. Next step

**Answer the remaining questions in Section 2b** (Q2–Q5). With those, we can implement Phase 1 and 2 step-by-step in the repo (exact file changes and code snippets).

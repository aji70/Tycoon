# Tycoon Mobile (Android)

Native home + **Web3Auth email login** (same flow as the website).

## Setup (once)

```bash
cd tycoon
flutter pub get
chmod +x tool/sync_env.sh
./tool/sync_env.sh
```

`sync_env.sh` copies **`WEB3AUTH_CLIENT_ID1`** from `backend/.env` (mobile client — separate from web `WEB3AUTH_CLIENT_ID`).

In **backend** env (local `.env` or Railway):

```
WEB3AUTH_CLIENT_ID1=BMxxxxxxxx...   # Flutter / Android
WEB3AUTH_CLIENT_ID=BJxxxxxxxx...    # web (Vercel / frontend)
```

In Web3Auth dashboard for the **mobile** client, allowlist: `w3a://com.example.tycoon/auth`

## Run

```bash
./tool/sync_env.sh
flutter run
```

Auth hits `POST /auth/web3auth-signin` — backend accepts tokens for **either** client ID.

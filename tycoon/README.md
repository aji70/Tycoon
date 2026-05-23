# Tycoon Mobile (Android)

Native home + **in-app Privy email login** (same backend as the website).

## Setup (once)

```bash
cd tycoon
flutter pub get
chmod +x tool/sync_env.sh tool/patch_privy_android.sh
./tool/sync_env.sh
./tool/patch_privy_android.sh   # Privy plugin Android fix (after each pub get)
cp .env.example .env   # if .env missing
```

`sync_env.sh` copies **PRIVY_APP_ID** and **API URL** from `frontend/.env.local`.

Add **PRIVY_CLIENT_ID** to `.env` (Privy Dashboard → **Clients** → Android → `com.example.tycoon`).

No `--dart-define` needed for daily runs.

## Run

```bash
flutter pub get
flutter run
```

## Release APK

```bash
flutter build apk --release
```

(`.env` is read at build time when present in the project root.)

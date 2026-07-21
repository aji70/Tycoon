# Tycoon Mobile (Android)

Native home + **email sign-in** (looks up your existing Tycoon account on the backend).

## Setup

```bash
cd tycoon
flutter pub get
chmod +x tool/sync_env.sh
./tool/sync_env.sh   # copies API URL from frontend/.env.local
flutter run
```

Sign-in calls `POST /auth/mobile-email-login` with the user's email. The account must already exist (same email as on the website).

## Release APK

```bash
flutter build apk --release
```

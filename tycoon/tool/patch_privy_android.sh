#!/usr/bin/env bash
# Fixes privy_flutter Android build (run after flutter pub get).
set -euo pipefail
PRIVY_GRADLE="${PUB_CACHE:-$HOME/.pub-cache}/hosted/pub.dev/privy_flutter-0.7.0/android/build.gradle"
if [[ ! -f "$PRIVY_GRADLE" ]]; then
  echo "privy_flutter android/build.gradle not found at $PRIVY_GRADLE"
  exit 1
fi
sed -i 's/compileSdk = 34/compileSdk = 35/' "$PRIVY_GRADLE"
echo "Patched $PRIVY_GRADLE (compileSdk 35)"

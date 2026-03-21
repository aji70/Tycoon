#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export EXPECT_PARTICIPANTS=2
exec node -r dotenv/config scripts/finalize-tournament-admin.js 42 0x9F3C421895bBCee5fA2BfD94E8C2eE36FdC7A80E

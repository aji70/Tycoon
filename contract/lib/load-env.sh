#!/usr/bin/env bash
# Safe .env loader: export KEY=VALUE lines only. Does not execute trailing shell commands.
# Use instead of `source .env` when .env may contain accidental "KEY=... node scripts/foo.js" lines.
load_env_file() {
  local file="$1"
  [ -f "$file" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%%#*}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [ -z "$line" ] && continue
    [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue
    local key="${line%%=*}"
    local value="${line#*=}"
    if [[ "$key" == "PRIVATE_KEY" || "$key" == "TYCOON_OWNER_PRIVATE_KEY" ]]; then
      if [[ "$value" == *" "* ]]; then
        echo "WARN: Skipping malformed $key in $file (value has spaces — put PRIVATE_KEY on its own line, 0x...)" >&2
        continue
      fi
      if [[ "$value" != 0x* ]]; then
        value="0x${value}"
      fi
    fi
    export "${key}=${value}"
  done < "$file"
}

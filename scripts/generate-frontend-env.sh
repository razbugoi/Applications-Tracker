#!/usr/bin/env bash
# Generates a Supabase-focused Next.js environment file.
set -euo pipefail

OUTPUT_FILE=${1:-../frontend/.env.production}

function require_var() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
  echo "$name=$value"
}

function optional_var() {
  local name="$1"
  local value="${!name:-}"
  if [[ -n "$value" ]]; then
    echo "$name=$value"
  fi
}

OUTPUT_ABS=$(cd "$(dirname "${OUTPUT_FILE}")" && pwd)/$(basename "${OUTPUT_FILE}")

{
  require_var NEXT_PUBLIC_SUPABASE_URL
  require_var NEXT_PUBLIC_SUPABASE_ANON_KEY
  optional_var NEXT_PUBLIC_SUPABASE_BYPASS_AUTH
  require_var SUPABASE_SERVICE_ROLE_KEY
  optional_var SUPABASE_DB_URL
  optional_var SUPABASE_JWT_SECRET
  optional_var SUPABASE_DEFAULT_TEAM_ID
} >"${OUTPUT_ABS}"

echo "Wrote Supabase environment to ${OUTPUT_FILE}" >&2

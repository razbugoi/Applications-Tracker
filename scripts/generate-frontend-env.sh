#!/usr/bin/env bash
# Writes a Next.js .env file using available environment variables and optionally
# falls back to CloudFormation stack outputs when values are missing.
set -euo pipefail

STACK_NAME=${STACK_NAME:-planning-tracker}
REGION=${AWS_REGION:-eu-west-2}
OUTPUT_FILE=${1:-../frontend/.env.production}

api_base="${NEXT_PUBLIC_API_BASE_URL:-}"
user_pool_id="${NEXT_PUBLIC_COGNITO_USER_POOL_ID:-}"
user_pool_client_id="${NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID:-}"
identity_pool_id="${NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID:-}"

need_lookup=false
if [[ -z "$api_base" || -z "$user_pool_id" || -z "$user_pool_client_id" || -z "$identity_pool_id" ]]; then
  need_lookup=true
fi

if $need_lookup; then
  if command -v aws >/dev/null 2>&1; then
    echo "Fetching CloudFormation outputs for stack: ${STACK_NAME}" >&2
    if CF_OUTPUTS=$(aws cloudformation describe-stacks \
      --stack-name "${STACK_NAME}" \
      --region "${REGION}" \
      --output json \
      --query 'Stacks[0].Outputs' 2>/dev/null); then
      if [[ -n "${CF_OUTPUTS}" && "${CF_OUTPUTS}" != "null" ]]; then
        export CF_OUTPUTS
        while IFS== read -r key value; do
          case "$key" in
            NEXT_PUBLIC_API_BASE_URL)
              if [[ -z "$api_base" ]]; then api_base="$value"; fi
              ;;
            NEXT_PUBLIC_COGNITO_USER_POOL_ID)
              if [[ -z "$user_pool_id" ]]; then user_pool_id="$value"; fi
              ;;
            NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID)
              if [[ -z "$user_pool_client_id" ]]; then user_pool_client_id="$value"; fi
              ;;
            NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID)
              if [[ -z "$identity_pool_id" ]]; then identity_pool_id="$value"; fi
              ;;
          esac
        done < <(python3 <<'PY'
import json
import os

outputs = json.loads(os.environ["CF_OUTPUTS"])
lookup = {item["OutputKey"]: item["OutputValue"] for item in outputs}

mapping = {
    "NEXT_PUBLIC_API_BASE_URL": "ApiUrl",
    "NEXT_PUBLIC_COGNITO_USER_POOL_ID": "UserPoolId",
    "NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID": "UserPoolClientId",
    "NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID": "IdentityPoolId",
}

for env_key, cf_key in mapping.items():
    if cf_key in lookup:
        print(f"{env_key}={lookup[cf_key]}")
PY
        )
      else
        echo "CloudFormation outputs not found for stack ${STACK_NAME}." >&2
      fi
    else
      echo "Unable to query CloudFormation outputs (missing permissions?)." >&2
    fi
  else
    echo "aws CLI not available; skipping CloudFormation lookup." >&2
  fi
fi

missing=()
if [[ -z "$api_base" ]]; then missing+=("NEXT_PUBLIC_API_BASE_URL"); fi
if [[ -z "$user_pool_id" ]]; then missing+=("NEXT_PUBLIC_COGNITO_USER_POOL_ID"); fi
if [[ -z "$user_pool_client_id" ]]; then missing+=("NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID"); fi
if [[ -z "$identity_pool_id" ]]; then missing+=("NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID"); fi

if (( ${#missing[@]} > 0 )); then
  echo "Missing required environment values: ${missing[*]}" >&2
  exit 1
fi

OUTPUT_ABS=$(cd "$(dirname "${OUTPUT_FILE}")" && pwd)/$(basename "${OUTPUT_FILE}")

{
  printf 'NEXT_PUBLIC_API_BASE_URL=%s\n' "$api_base"
  printf 'NEXT_PUBLIC_COGNITO_USER_POOL_ID=%s\n' "$user_pool_id"
  printf 'NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=%s\n' "$user_pool_client_id"
  printf 'NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID=%s\n' "$identity_pool_id"
  if [[ -n "${NEXT_PUBLIC_AWS_REGION:-}" ]]; then
    printf 'NEXT_PUBLIC_AWS_REGION=%s\n' "${NEXT_PUBLIC_AWS_REGION}"
  elif [[ -n "${REGION}" ]]; then
    printf 'NEXT_PUBLIC_AWS_REGION=%s\n' "${REGION}"
  fi
  printf 'NEXT_PUBLIC_BYPASS_AUTH=%s\n' "${NEXT_PUBLIC_BYPASS_AUTH:-false}"
} > "${OUTPUT_ABS}"

echo "Wrote frontend environment to ${OUTPUT_FILE}" >&2

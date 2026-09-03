#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

push_env() {
  local env_file="$1"
  local wrangler_env="$2"
  local prefix="$3"
  local label="$4"

  if [[ ! -f "$env_file" ]]; then
    echo "Skipping $label — $env_file not found"
    return
  fi

  echo "==> Pushing secrets for $label"
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$env_file" | xargs)

  local service_key="${prefix}SUPABASE_SERVICE_KEY"
  local jwt_secret="${prefix}SUPABASE_JWT_SECRET"

  local flag=""
  [[ -n "$wrangler_env" ]] && flag="--env $wrangler_env"

  cd "$ROOT/worker/park-management-api"
  echo "${!service_key}" | npx wrangler secret put SUPABASE_SERVICE_KEY $flag
  echo "${!jwt_secret}"  | npx wrangler secret put SUPABASE_JWT_SECRET  $flag
  local jwks_key="${prefix}SUPABASE_JWT_JWKS"
  echo "${!jwks_key}"   | npx wrangler secret put SUPABASE_JWT_JWKS    $flag
  echo "Done $label"
}

push_env "$ROOT/.env.production" ""        ""         "production"
push_env "$ROOT/.env.test"       "staging" "STAGING_" "staging"

#!/usr/bin/env bash
# bootstrap-env.sh — Generate Strapi security keys into .env if not already present.
# This file is called by the CMS workflow before `strapi develop`.
# .env is gitignored so these values never enter version control.

ENV_FILE="$(dirname "$0")/../.env"

# Helper: check if a key is already set (either in the file or in process env)
has_key() {
  grep -q "^${1}=" "$ENV_FILE" 2>/dev/null || [ -n "${!1}" ]
}

# Create .env if it doesn't exist
touch "$ENV_FILE"

# Generate APP_KEYS (4 random base64 values)
if ! has_key "APP_KEYS"; then
  KEYS=$(node -e "console.log([1,2,3,4].map(()=>require('crypto').randomBytes(16).toString('base64')).join(','))")
  echo "APP_KEYS=${KEYS}" >> "$ENV_FILE"
  echo "[bootstrap] Generated APP_KEYS"
fi

# Generate remaining single-value secrets
for VAR in API_TOKEN_SALT ADMIN_JWT_SECRET JWT_SECRET TRANSFER_TOKEN_SALT REVALIDATION_SECRET; do
  if ! has_key "$VAR"; then
    VAL=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
    echo "${VAR}=${VAL}" >> "$ENV_FILE"
    echo "[bootstrap] Generated ${VAR}"
  fi
done

# Set non-secret defaults only if missing
set_default() {
  if ! has_key "$1"; then
    echo "${1}=${2}" >> "$ENV_FILE"
  fi
}

set_default HOST "0.0.0.0"
set_default PORT "3001"
set_default PUBLIC_URL "http://localhost:3001"
set_default DATABASE_CLIENT "sqlite"
set_default DATABASE_FILENAME ".tmp/data.db"
set_default NODE_ENV "development"
set_default NEXTJS_REVALIDATION_URL "http://localhost:5000/api/revalidate"

echo "[bootstrap] .env ready"

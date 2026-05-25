#!/bin/sh
# Container entrypoint: aplica migraciones SQL pendientes, luego arranca Next.js.
# App Runner StartCommand no interpreta `&&` cuando pasa el comando como exec,
# por eso encadenamos los dos pasos en un script real.
set -e

echo "[start.sh] Applying schema migrations..."
node scripts/apply-migrations.js

echo "[start.sh] Starting Next.js server on port ${PORT:-3000}..."
exec node server.js

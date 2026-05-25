#!/usr/bin/env bash
# Dispara generación de preguntas en lotes hasta procesar todos los docs.
#
# El endpoint /api/questions/generate-batch procesa hasta 60 docs por invocación
# (concurrency=3 internamente). Para 500+ docs pendientes hace falta múltiples
# invocaciones espaciadas para no chocar con el batch anterior.
#
# Uso:
#   PROD_URL=https://fbrwkqtydz.us-east-1.awsapprunner.com bash scripts/batch-loop.sh
#   PROD_URL=http://localhost:3000 bash scripts/batch-loop.sh
#
# Configurable:
#   SLEEP_MIN=90 (minutos entre lotes; debe ser > tiempo promedio de un lote)
#   MAX_BATCHES=20 (corte de seguridad)

set -euo pipefail

PROD_URL="${PROD_URL:-https://fbrwkqtydz.us-east-1.awsapprunner.com}"
SLEEP_MIN="${SLEEP_MIN:-90}"
MAX_BATCHES="${MAX_BATCHES:-20}"

echo "[batch-loop] target=$PROD_URL sleep=${SLEEP_MIN}min max=$MAX_BATCHES"

for i in $(seq 1 "$MAX_BATCHES"); do
  STATUS=$(curl -s "$PROD_URL/api/questions/generate-batch")
  PENDING=$(echo "$STATUS" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("pendingCount", 0))' 2>/dev/null || echo "?")
  echo "[batch-loop $(date +%H:%M:%S)] iter=$i pending=$PENDING"

  if [ "$PENDING" = "0" ]; then
    echo "[batch-loop] ✅ Sin docs pendientes. Done."
    exit 0
  fi

  TRIGGER=$(curl -s -X POST "$PROD_URL/api/questions/generate-batch")
  echo "[batch-loop $(date +%H:%M:%S)] triggered: $TRIGGER"

  if [ "$i" -lt "$MAX_BATCHES" ]; then
    echo "[batch-loop] sleeping ${SLEEP_MIN} min..."
    sleep "$((SLEEP_MIN * 60))"
  fi
done

echo "[batch-loop] reached MAX_BATCHES=$MAX_BATCHES"

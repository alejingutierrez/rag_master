#!/usr/bin/env bash
# Test paper-academico en producción vía /api/chat
# Usa una pregunta corta para minimizar tiempo de generación.

set -euo pipefail

PROD_URL="${PROD_URL:-https://fbrwkqtydz.us-east-1.awsapprunner.com}"
QUESTION="${QUESTION:-¿Cómo se consolidó el poder de la Iglesia Católica durante la Regeneración en Colombia?}"

echo "=== POST /api/chat con paper-academico ==="
echo "URL: $PROD_URL"
echo "Pregunta: $QUESTION"
echo ""

RESPONSE=$(curl -sS -X POST "$PROD_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg q "$QUESTION" '{question: $q, templateId: "paper-academico"}')")

echo "Respuesta inicial:"
echo "$RESPONSE" | jq .

DELIVERABLE_ID=$(echo "$RESPONSE" | jq -r .deliverableId)
if [ -z "$DELIVERABLE_ID" ] || [ "$DELIVERABLE_ID" = "null" ]; then
  echo "ERROR: no se obtuvo deliverableId"
  exit 1
fi

echo ""
echo "deliverableId: $DELIVERABLE_ID"
echo ""
echo "Esperando que termine (polling cada 30s hasta 8 min)..."

START=$(date +%s)
MAX_WAIT=480  # 8 min

while true; do
  ELAPSED=$(($(date +%s) - START))
  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    echo "TIMEOUT después de ${MAX_WAIT}s"
    exit 1
  fi

  STATUS_JSON=$(curl -sS "$PROD_URL/api/deliverables/$DELIVERABLE_ID")
  STATUS=$(echo "$STATUS_JSON" | jq -r .status)
  WORDS=$(echo "$STATUS_JSON" | jq -r '.answer | split(" ") | length')

  echo "[${ELAPSED}s] status=$STATUS palabras=$WORDS"

  if [ "$STATUS" = "COMPLETE" ]; then
    break
  fi
  if [ "$STATUS" = "ERROR" ]; then
    echo "ERROR en generación:"
    echo "$STATUS_JSON" | jq -r .answer | head -20
    exit 1
  fi
  sleep 30
done

echo ""
echo "=== ANÁLISIS DE OUTPUT ==="
ANSWER=$(echo "$STATUS_JSON" | jq -r .answer)
WORDS=$(echo "$ANSWER" | wc -w)
CITATIONS=$(echo "$ANSWER" | grep -oE '\[#[0-9]+(\s*,\s*[0-9]+)*\]' | wc -l)
BIBLIO_COUNT=$(echo "$ANSWER" | grep -cE '^## (Referencias|Bibliografía|Fuentes)')
HAS_PROBLEMA=$(echo "$ANSWER" | grep -cE '^## El problema')
HAS_FUENTES=$(echo "$ANSWER" | grep -cE '^## Sobre las fuentes')
HAS_TENSIONES=$(echo "$ANSWER" | grep -cE '^## Tensiones')
HAS_VACIOS=$(echo "$ANSWER" | grep -cE '^## Lo que las fuentes')
HAS_CONCLUSION=$(echo "$ANSWER" | grep -cE '^## Conclusión')

echo "Palabras totales: $WORDS"
echo "Citas inline [#N]: $CITATIONS"
echo "Secciones de bibliografía (debe ser 1): $BIBLIO_COUNT"
echo "Estructura paper-academico:"
echo "  ## El problema: $HAS_PROBLEMA"
echo "  ## Sobre las fuentes: $HAS_FUENTES"
echo "  ## Tensiones y matices: $HAS_TENSIONES"
echo "  ## Lo que las fuentes no responden: $HAS_VACIOS"
echo "  ## Conclusión: $HAS_CONCLUSION"
echo ""
echo "Detalle accesible en: $PROD_URL/producciones/$DELIVERABLE_ID"

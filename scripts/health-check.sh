#!/bin/bash
# health-check.sh - Lalamove Guardian
set -e

echo "🏥 Health Check - Lalamove Guardian"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
SUPABASE_URL="${VITE_SUPABASE_URL:-http://localhost:54321}"

echo ""
echo "🌐 Frontend ($FRONTEND_URL)"
if curl -sSf $FRONTEND_URL > /dev/null 2>&1; then
  echo "   ✅ OK"
else
  echo "   ❌ FALHOU"
  exit 1
fi

echo ""
echo "🔌 Supabase API"
if curl -sSf $SUPABASE_URL/rest/v1/ -H "apikey: test" > /dev/null 2>&1; then
  echo "   ✅ OK"
else
  echo "   ❌ FALHOU"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Health Check Completo!"

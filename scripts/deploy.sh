#!/bin/bash
# deploy.sh - Lalamove Guardian
set -e

echo "🚀 Deploy - Lalamove Guardian"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "❌ Erro: Deploy apenas de 'main'"
  echo "   Branch atual: $BRANCH"
  exit 1
fi

if ! git diff-index --quiet HEAD --; then
  echo "❌ Erro: Há alterações não commitadas"
  exit 1
fi

echo "✅ Branch: $BRANCH"
echo "✅ Sem alterações pendentes"

echo ""
echo "📦 Build..."
npm run build || {
  echo "❌ Build falhou!"
  exit 1
}
echo "✅ Build OK"



echo ""
echo "📤 Push para GitHub..."
git push origin main
echo "✅ Push OK"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deploy completo!"

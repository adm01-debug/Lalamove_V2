#!/usr/bin/env pwsh
# Deploy da Edge Function lalamove-gateway com CORS corrigido
# Execute este script após fazer login no Supabase CLI

Write-Host "🚀 Script de deploy da Edge Function lalamove-gateway" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para executar este deploy, você precisa primeiro:" -ForegroundColor Yellow
Write-Host "  1. supabase login"
Write-Host "  2. supabase link --project-ref iecgydonctmabiijadsf"
Write-Host ""
Write-Host "Depois execute:" -ForegroundColor Green
Write-Host "  supabase functions deploy lalamove-gateway --project-ref iecgydonctmabiijadsf --no-verify-jwt"
Write-Host ""

$deploy = Read-Host "Deseja tentar o deploy agora? (s/n)"
if ($deploy -eq "s") {
    try {
        Write-Host "Verificando login..." -ForegroundColor Cyan
        $env:SUPABASE_ACCESS_TOKEN = (supabase status 2>&1 | Select-String -Pattern "token" | Select-Object -First 1).ToString()
    } catch {
        Write-Host "❌ Você precisa estar logado. Execute: supabase login" -ForegroundColor Red
        exit 1
    }
}
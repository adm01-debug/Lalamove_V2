# P-11 · MFA/WebAuthn (auditoria 1.2)

**Status:** DESCARTADO — já implementado (evidência no código, 2026-11-21)
**Origem:** docs/audit_report.md seção 5, item 1.2 — "MFA (Multi-factor Authentication) ⚠️ Parcial (P1)"

## O que a auditoria afirma
MFA está "Parcial" — recomendação: "Tornar obrigatório o uso de Autenticação Multifator (MFA) para todos os perfis administrativos."

## Evidência real no código (main, HEAD 75b7bef)
O MFA/WebAuthn está **COMPLETO e integrado** — a auditoria (14/05/2026) está desatualizada:
- Hooks: `src/hooks/useMFA.ts`, `src/hooks/useWebAuthn.ts`
- Componentes: `src/components/auth/MFAEnroll.tsx`, `MFASettings.tsx`, `MFAVerify.tsx`, `PasskeyLoginButton.tsx`, `PasskeySettings.tsx`
- Rota: `src/App.tsx:142` — `<Route path="/mfa-verify" ...>`
- Guards por papel: rotas sensíveis exigem MFA (`ProtectedRoute requireMFA` em App.tsx:186-198: /risk-rules, /webhooks, /bitrix24, /settings/uapi, /settings/lalamove, /external-data)

## Decisão
DESCARTADO com evidência: o item 1.2 já está implementado de ponta a ponta (UI + rota + guard por papel). A marcação "Parcial" da auditoria de 14/05/2026 não reflete o código atual.

# P-02 · App Mobile para Motoristas (auditoria 5.1)

**Status:** Pendente (não implementado)
**Origem:** docs/audit_report.md seção 5, item 5.1 (P1)

## O que a auditoria pede
Front-end mobile nativo para motoristas — fechar o ciclo de rastreamento direto.

## Evidência do estado atual (2026-11-26)
- NÃO existe app mobile dedicado: src/pages/ não tem página de motorista standalone; não há rota /driver-app em src/App.tsx.
- O que existe e cobre parcialmente: MobileBottomNav.tsx, MobileSidebar.tsx (layout responsivo do app de gestão), PWA (public/manifest.json, sw.js, index.html) e use-mobile.tsx.
- O produto opera no navegador com PWA; o "app de motorista" como experiência separada não foi construído.

## Impacto no negócio
- Motoristas dependem do fluxo web/operador; sem app dedicado não há como o motorista confirmar entregas/rastreamento próprio.

## Decisão
- Confirmar com o dono se o app mobile de motorista é requisito atual (o doc é de 14/05/2026 e está desatualizado em outros itens — MFA que ele marca "Parcial" está completo).

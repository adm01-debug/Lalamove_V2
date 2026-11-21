# P-02 · App Mobile para Motoristas (auditoria 5.1)

**Status:** ADIADO PARA V3 (decisão do dono 2026-11-21) — a V3 será concorrente do Lalamove; a V2 atual é parceira
**Origem:** docs/audit_report.md seção 5, item 5.1 (P1)

## O que a auditoria pede
Front-end mobile nativo para motoristas — fechar o ciclo de rastreamento direto.

## Evidência do estado atual (2026-11-26)
- NÃO existe app mobile dedicado: src/pages/ não tem página de motorista standalone; não há rota /driver-app em src/App.tsx.
- O que existe e cobre parcialmente: MobileBottomNav.tsx, MobileSidebar.tsx (layout responsivo do app de gestão), PWA (public/manifest.json, sw.js, index.html) e use-mobile.tsx.
- O produto opera no navegador com PWA; o "app de motorista" como experiência separada não foi construído.

## Impacto no negócio
- Motoristas dependem do fluxo web/operador; sem app dedicado não há como o motorista confirmar entregas/rastreamento próprio.

## Decisão (2026-11-21, dono)
- **ADIADO para a V3.** A V3 será concorrente do Lalamove (plataforma própria de motoristas); a V2 atual é parceira (opera via operador/parceiros). No escopo V2 este item NÃO será executado.
- Escopo definido para quando abrir a V3: área/app do motorista (login de motorista, entregas atribuídas, aceite/recusa, coletada/entregue, rastreamento próprio) — PWA, sem app nativo de loja, reaproveitando a estrutura de cadastro/aprovação já existente (DriversPage, ApprovalsPage). P-03 depende deste item.

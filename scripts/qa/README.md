# scripts/qa — contraste WCAG e tipografia

Auditores estáticos de acessibilidade visual. Nenhum sobe navegador, nenhum usa rede, nenhum usa secret.
Portados do Zapp Web V2 e reapontados para os arquivos reais deste repo
(`src/index.css`, `src/components/ui/badge.tsx`, `src/components/ui/button.tsx`,
`src/components/ui/command.tsx`, `src/components/ui/highlight-match.tsx`, `tailwind.config.ts`,
`index.html`).

| Arquivo | O que audita | Comando |
|---|---|---|
| `contraste-tokens.mjs` | Pares de token do tema (claro/escuro) + **todas** as variantes de `badge.tsx` e `button.tsx`, lendo as receitas do próprio arquivo | `node scripts/qa/contraste-tokens.mjs [--check]` |
| `contraste-busca.mjs` | Lista do command palette (`bg-popover`) e o `<mark>` de `HighlightMatch` | `node scripts/qa/contraste-busca.mjs [--check]` |
| `contraste-auditores.unit.mjs` | Prova dos dois medidores contra os arquivos reais | `node --test scripts/qa/*.unit.mjs` |
| `medir-tipografia.cjs` | Escala de fonte: `text-[Npx]` arbitrário, meia-medida, `fontSize`/`fontFamily` inline, peso de fonte não carregado | `node scripts/qa/medir-tipografia.cjs [--check] [--json <arquivo>]` |
| `tipografia-budget.json` | Teto do ratchet de tipografia (gerado por `--json`) | — |

`--check` sai 1 quando reprova. Em `medir-tipografia.cjs` o `--check` é **ratchet**: compara com o teto do
budget e só reprova se a dívida subir. Para mexer o teto de propósito (depois de corrigir algo):

```sh
node scripts/qa/medir-tipografia.cjs --json scripts/qa/tipografia-budget.json
```

**Secrets: nenhum.**

## Estado atual (medido, não estimado)

- `contraste-tokens.mjs`: **34 de 80 pares abaixo de 4.5:1**. O mais sério é `bg-primary` +
  `text-primary-foreground` (3.63:1 nos dois temas), que é o botão e o badge padrão. Então **`--check`
  reprova hoje**: é auditoria de dívida real, não regressão desta porta.
- `contraste-busca.mjs`: 4 de 10 abaixo de 4.5:1 — o destaque `<mark>` (`bg-primary/20 text-primary`,
  `src/components/ui/highlight-match.tsx:25`) fica menos legível que o texto em volta.
- `medir-tipografia.cjs --check`: **verde** no budget gerado agora (20 `fontSize` inline, 7 `fontFamily`
  literal, 0 peso órfão, 0 meia-medida).

## Decisões de adaptação

- **Escala de fonte**: `tailwind.config.ts` não declara `fontSize`, então a escala é a padrão do Tailwind
  (`DEFAULT_SCALE` no script). Um bloco `fontSize:` adicionado no futuro passa a ter precedência sozinho.
- **CSS**: não existe `src/styles/`; a varredura é `src/**/*.css` (`src/index.css`,
  `src/components/map/liveMap.css`).
- **Temas**: dois (claro/escuro). Não há classe `.high-contrast` neste repo; os dois blocos
  `@media (prefers-contrast: high)` (`src/index.css:29` e `:289`) só mexem em `--border`/`--ring`, que não
  entram em contraste de texto. O parser avisa se algum dia um token medido for redefinido lá.

## O que NÃO foi portado do Zapp (e por quê)

- **`contatos-redesign-baseline.cjs` + `.unit.mjs`**: dependem de
  `e2e/fixtures/{contacts-page,talkx-demo,mapa-mocks}.ts` — sessão falsa, `mockAppShell` e guarda de rede
  que mocka 100% do Supabase. Nada disso existe aqui: o `e2e/` deste repo tem só `e2e/helpers/auth.ts`,
  que **exige sessão real injetada** por `LOVABLE_BROWSER_SUPABASE_*` e dá `test.skip` sem ela. Portar
  seria escrever um harness de mocks novo (centenas de linhas) que ninguém poderia rodar nesta sessão —
  não é porte, é feature nova.
- **Nomes `contraste-contatos.mjs` / `contraste-combobox.mjs`**: os alvos do Zapp
  (`src/components/contacts/contactTypeConfig.tsx`, combobox de endereços de `src/components/inbox/`) não
  existem aqui. Manter o nome descreveria algo que o script não mede; os equivalentes reais são as
  receitas de `badge.tsx`/`button.tsx` e o command palette — daí `contraste-tokens.mjs` e
  `contraste-busca.mjs`.

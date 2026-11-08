# scripts/lib — infraestrutura compartilhada dos scripts

Módulo usado pelos outros scripts de automação. Portado do Zapp Web V2 sem mudança de comportamento.

| Arquivo | O que faz |
|---|---|
| `seguranca-processo.mjs` | `resolverExecutavel(cmd)` devolve o caminho ABSOLUTO do binário (o que o shell resolveria, shims do PATH incluídos) antes de criar processo filho; `resolverCaminhoPermitido(valor, rotulo, raizes?)` recusa caminho vindo de argv/env que escape do repositório ou do tmpdir — fail-closed, resolvendo symlink mesmo quando o alvo ainda não existe; `estaDentro(raiz, candidato)`; `RAIZ_REPO`; `RAIZES_PERMITIDAS`. |
| `seguranca-processo.test.mjs` | Testes (`node --test`). |

## Como rodar

```sh
node --test scripts/lib/*.test.mjs
```

**Secrets: nenhum.** O módulo só resolve caminhos; não lê env além de `PATH` e nunca imprime valor de
variável.

## Por que existe

Duas coisas que o linter de segurança cobra em todo ponto de uso e que não devem ser recopiadas:

- `javascript:S4036` (binário sem caminho absoluto) é sintática: dispara quando o 1º argumento é literal
  que não começa com `/`, `./` ou `..`, e **nunca** olha o `env`. Passar `env: { PATH: '<fixo>' }` não
  silencia o achado e troca o binário resolvido.
- `jssecurity:S8707` (path traversal) em caminho recebido de argv/env.

Adaptação nesta porta: o último teste do Zapp afirmava `package.json#name === 'zapp-web-v2'`. Aqui o
`package.json` se chama `vite_react_shadcn_ts` (scaffold Lovable), nome que pode mudar sem a raiz estar
errada — o teste passou a checar os marcadores da raiz (`package.json`, `AGENTS.md`,
`tailwind.config.ts`, `src`).

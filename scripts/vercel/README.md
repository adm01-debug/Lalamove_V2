# scripts/vercel — automação de deploy

Projeto Vercel `lalamove-v2` (team `juca1`), produção em `https://lalamove-v2.vercel.app`.
Detalhe de infraestrutura: `docs/agentes/deploy.md`.

| Arquivo | O que faz | Comando |
|---|---|---|
| `verify-production.mjs` | Smoke de pós-deploy: SPA na raiz, bundle de entrada, cache do asset, **deep link** (`/orders`) e `/version.json` (opcional) | `node scripts/vercel/verify-production.mjs` |
| `verify-release-targets.mjs` | Confirma, com repetição, que a produção já serve **o build que você espera** (identidade = hash do bundle de entrada) | `node scripts/vercel/verify-release-targets.mjs --from-dist --attempts=30 --interval-ms=10000` |
| `ignore-build.sh` | `Ignored Build Step` do Vercel: pula preview quando nenhum arquivo de front mudou | configurado no painel (abaixo) |
| `*.unit.mjs` | Testes dos três, sem rede externa e sem tocar no git deste repo | `node --test scripts/vercel/*.unit.mjs` |

## Códigos de saída

`0` passou · `1` falhou de verdade · `2` entrada inválida · `3` **NÃO VERIFICADO**: a proteção de acesso do
Vercel barrou · `4` **NÃO VERIFICADO**: host inalcançável. Os dois últimos existem para o script nunca
dizer "ok" sem ter medido e nunca culpar o app por um 401 de infraestrutura.

## Proteção de acesso (importante)

`docs/agentes/deploy.md:14` registra `ssoProtection = all_except_custom_domains`: todo `*.vercel.app` do
projeto pede login do Vercel. Sem bypass, os dois verificadores saem **3**. Para medir de verdade, gere um
Protection Bypass em *Vercel > Project > Settings > Deployment Protection > Protection Bypass for
Automation* e passe:

```sh
node scripts/vercel/verify-production.mjs --bypass-token=<segredo>
# ou, preferível em CI:
VERCEL_AUTOMATION_BYPASS_SECRET=<segredo> node scripts/vercel/verify-production.mjs
```

**Secrets usados:** só `VERCEL_AUTOMATION_BYPASS_SECRET` (ou `--bypass-token`), enviado no header
`x-vercel-protection-bypass`. O valor **nunca** é impresso — a saída só diz `bypass de protecao: sim`.
Nunca comite esse segredo; ele mora no secret do GitHub Actions ou no env do Vercel.

Outras variáveis: `SMOKE_BASE_URL` / `--url` (alvo), `GITHUB_STEP_SUMMARY` (o
`verify-release-targets.mjs` anexa o resumo quando a variável existe).

## Confirmando um deploy depois do merge

```sh
npm run build                                       # gera dist/index.html
node scripts/vercel/verify-release-targets.mjs --from-dist --attempts=30 --interval-ms=10000
```

Sem `--from-dist`/`--expected-entry` ele só identifica o que está no ar. Isso responde ao risco registrado
em `docs/agentes/deploy.md:16`: a produção pode ficar **congelada** num deploy antigo porque o build novo
falha, e o merge "parece" ter subido.

## Ligar o `ignore-build.sh`

Vercel > Project > Settings > Git > **Ignored Build Step** > `sh scripts/vercel/ignore-build.sh`.
Contrato do Vercel: exit 1 = buildar, exit 0 = pular. Produção sempre builda; sem commit base ele
**fail-open** (builda). A lista `FRONT_PATHS` usa `package-lock.json` (npm), não `bun.lock`.

## Diferenças em relação ao Zapp Web V2

- **`/version.json` é opcional**, não obrigatório: este repo não publica o arquivo (não há `vercel.json`,
  nem `public/version.json`, nem `buildId` em lugar nenhum). Se um dia existir, é validado como SHA.
- **Headers de segurança** (`x-frame-options`, `x-content-type-options`, `referrer-policy`) são **aviso**,
  não falha — sem `vercel.json` nenhum está configurado. Depois de configurá-los, rode com
  `--strict-headers` para virar falha.
- **Deep link** é checagem nova: sem `vercel.json`, o fallback de SPA vem do preset `vite` do Vercel; se
  ele falhar, todo link direto cai em 404 e nenhum smoke de raiz perceberia.
- **`verify-release-targets.mjs` compara hash de bundle**, não SHA de commit, e tem **um** alvo em vez de
  dois (`v2`/`v3` do Zapp são dois domínios com donos diferentes; aqui é um projeto só).

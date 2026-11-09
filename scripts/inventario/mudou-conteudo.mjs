#!/usr/bin/env node
/**
 * O inventario mudou de verdade? Compara cada arquivo de inventario/estado/ com a versao do
 * HEAD depois de tirar os carimbos de data (`medido_em`, `gerado_em`, em qualquer nivel) e a
 * telemetria de janela rolante. Imprime `true` ou `false` (usado pelo
 * inventario-estado-semanal.yml para decidir se abre PR).
 *
 * Uso: node scripts/inventario/mudou-conteudo.mjs [arquivo...]   (padrao: banco, rotas e edges)
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const PADRAO = ['inventario/estado/banco.json', 'inventario/estado/rotas.json', 'inventario/estado/edges.json'];
const CARIMBOS = new Set(['medido_em', 'gerado_em']);
// Telemetria viva do cron: muda quase toda semana so pela janela rolante de 7 dias, sem mudanca
// estrutural nenhuma (mudar `taxa_falha_7d_pct` de 9 para 9.3 ja fazia `mudou()` dar `true`).
// `frescor` (lalamove.frescor) e o carimbo do ultimo pedido/evento/job: muda em toda execucao.
// Fora desses nomes nada muda: a lista de alertas, tabelas_orfas, particoes e o resto de
// banco.json/rotas.json/edges.json continuam comparados normalmente — inclusive `linhas` e
// `bytes` de cada tabela, que e crescimento real de producao e vale um PR.
const TELEMETRIA = new Set([
  'execucoes_24h', 'falhas_24h', 'execucoes_7d', 'falhas_7d', 'taxa_falha_7d_pct',
  'startup_timeout_7d', 'ultima_falha', 'duracao_max_s_7d', 'horas_paradas_7d',
  'mais_antigo', 'mais_de_7_dias', 'frescor',
]);
const IGNORADOS = new Set([...CARIMBOS, ...TELEMETRIA]);
// `historico.linhas`/`historico.bytes` tambem rolam todo dia com a retencao do pg_cron, mas os
// nomes `linhas`/`bytes` sao compartilhados com cada tabela em `tabelas[]`, onde a contagem real
// importa. So ignora dentro de `cron.historico`.
function limparHistoricoCron(historico) {
  if (!historico || typeof historico !== 'object') return historico;
  const { linhas, bytes, ...resto } = historico;
  return resto;
}

// `lalamove.grupos` e volume por status (pedidos, motoristas, fila de jobs, incidentes): o numero
// muda todo dia sem nada estrutural. O que importa e QUAIS status/tipos existem — status novo
// ("ON_HOLD") ou que desapareceu abre PR; a contagem, nao. Os alertas derivados do volume
// (fila_de_jobs_com_falhas e companhia) continuam comparados, com texto de limiar fixo.
function normalizarGrupos(grupos) {
  if (!grupos || typeof grupos !== 'object') return grupos;
  return Object.fromEntries(Object.entries(grupos).map(([chave, valor]) => [
    chave,
    valor && typeof valor === 'object' && !Array.isArray(valor) ? Object.keys(valor).sort() : valor,
  ]));
}

/** JSON canonico sem os carimbos de data e sem a telemetria viva. Texto que nao e JSON volta como esta. */
export function semCarimbos(texto) {
  if (texto === null) return null;
  let dado;
  try { dado = JSON.parse(texto); } catch { return texto; }
  const limpar = (v, chave) => {
    if (Array.isArray(v)) return v.map((x) => limpar(x));
    if (v && typeof v === 'object') {
      let base = v;
      if (chave === 'historico') base = limparHistoricoCron(base);
      if (chave === 'grupos') base = normalizarGrupos(base);
      return Object.fromEntries(
        Object.keys(base).filter((k) => !IGNORADOS.has(k)).sort().map((k) => [k, limpar(base[k], k)]),
      );
    }
    return v;
  };
  return JSON.stringify(limpar(dado));
}

/** true se algum arquivo mudou alem dos carimbos (arquivo novo ou apagado conta). */
export function mudou(arquivos, lerAntes, lerDepois) {
  return arquivos.some((f) => semCarimbos(lerAntes(f)) !== semCarimbos(lerDepois(f)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arquivos = process.argv.length > 2 ? process.argv.slice(2) : PADRAO;
  const lerAntes = (f) => {
    try { return execFileSync('git', ['show', `HEAD:${f}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; }
  };
  const lerDepois = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
  console.log(String(mudou(arquivos, lerAntes, lerDepois)));
}

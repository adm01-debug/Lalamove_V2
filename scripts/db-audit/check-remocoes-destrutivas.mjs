#!/usr/bin/env node
/**
 * Barra remocao DESTRUTIVA de objeto do banco: compara dois catalogos
 * (`scripts/db-audit/catalog.sql`, antigo x novo) e falha SO quando um objeto
 * que saiu (tabela/view/funcao/enum) ainda tem consumidor no codigo do app.
 *
 * Por que objeto e nao linha de diff: contar linhas removidas de
 * `src/integrations/supabase/types.ts` nao diz nada sobre o banco — renomear um
 * campo gera dezenas de linhas e derruba o gate a toa, enquanto
 * `DROP TABLE public.tabela_usada` cabe em 2 linhas e passa batido. A deteccao
 * de consumidor reaproveita o `supabase-usage-guard.mjs` (mesmo scan de
 * `.from()`/`.rpc()`, mesmos receptores ignorados). Troca de assinatura
 * (`DROP FUNCTION f(uuid)` + `CREATE FUNCTION f(uuid, boolean)`, ou
 * `CREATE OR REPLACE`) mantem o NOME no catalogo e passa: o gate observa o
 * objeto, nao o texto do types.ts.
 *
 * Roda OFFLINE, sem credencial de banco — mas depende de DOIS catalogos ja
 * gerados. Neste repo nenhum existe ainda (nao ha snapshot do banco
 * `iecgydonctmabiijadsf` versionado), entao ele sai com 2 e diz como gerar, em
 * vez de aprovar no vazio. Contrato de saida:
 *   0 = nenhuma remocao consumida
 *   1 = remocao de objeto ainda consumido (bloqueia)
 *   2 = erro de entrada (catalogo ausente ou invalido)
 *
 * Uso:
 *   node scripts/db-audit/check-remocoes-destrutivas.mjs [catalogo-antigo.json] [catalogo-novo.json]
 *   (padroes: supabase/schema-catalog.json  /tmp/catalog.new.json)
 */
import fs from 'node:fs';
import path from 'node:path';
import { scan, walk } from './supabase-usage-guard.mjs';

const ROOT = process.cwd();
const ANTIGO = process.argv[2] || path.join(ROOT, 'supabase/schema-catalog.json');
const NOVO = process.argv[3] || '/tmp/catalog.new.json';

function ler(arquivo) {
  if (!fs.existsSync(arquivo)) {
    console.error('ERRO: catalogo nao encontrado: ' + arquivo);
    console.error(
      'Gere os dois catalogos com o banco oficial antes de usar este gate:\n'
      + '  psql "$DESTINO_URL" -X -v ON_ERROR_STOP=1 -At -f scripts/db-audit/catalog.sql > supabase/schema-catalog.json   # antigo (commitado)\n'
      + '  psql "$DESTINO_URL" -X -v ON_ERROR_STOP=1 -At -f scripts/db-audit/catalog.sql > /tmp/catalog.new.json          # novo (depois do DDL)',
    );
    process.exit(2);
  }
  try {
    return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  } catch (error) {
    console.error('ERRO: catalogo invalido (' + arquivo + '): ' + error.message);
    process.exit(2);
  }
}

// O catalogo guarda so nomes de public.*; a chave qualificada casa com o `schema` +
// `name` que o scan() do guard devolve para cada call-site.
function objetos(catalogo) {
  const publicos = (nomes) => new Set((nomes || []).map((n) => 'public.' + n));
  return {
    relacoes: new Set([...publicos(catalogo.tables), ...publicos(catalogo.views)]),
    funcoes: publicos(catalogo.functions),
    enums: publicos(catalogo.enums),
  };
}

// Um enum nao tem call-site de `.from()`/`.rpc()`: o consumidor e a citacao do proprio
// NOME como tipo no codigo. `catalog.sql` (format_version 2) ainda nao exporta enums —
// a comparacao ja fica pronta para quando exportar.
function enumsCitados(removidos) {
  const citados = new Map();
  if (removidos.size === 0) return citados;
  const arquivos = [...walk('src'), ...walk('supabase/functions')];
  for (const arquivo of arquivos) {
    const texto = fs.readFileSync(arquivo, 'utf8');
    for (const alvo of removidos) {
      const nome = alvo.slice('public.'.length);
      if (new RegExp('\\b' + nome + '\\b').test(texto)) {
        if (!citados.has(alvo)) citados.set(alvo, []);
        citados.get(alvo).push(arquivo.split(path.sep).join('/'));
      }
    }
  }
  return citados;
}

function main() {
  const antigo = objetos(ler(ANTIGO));
  const novo = objetos(ler(NOVO));

  const removidas = [
    ['tabela/view', 'relacao', [...antigo.relacoes].filter((n) => !novo.relacoes.has(n)).sort()],
    ['funcao', 'funcao', [...antigo.funcoes].filter((n) => !novo.funcoes.has(n)).sort()],
    ['enum', 'enum', [...antigo.enums].filter((n) => !novo.enums.has(n)).sort()],
  ];

  const consumidores = scan();
  // Call-sites do cliente principal que apontam para o objeto removido.
  const callSites = (alvo, kind) => consumidores.filter(
    (c) => c.kind === kind && c.schema + '.' + c.name === alvo,
  );
  const enums = enumsCitados(new Set(removidas.flatMap(([, , alvos]) => alvos)));

  console.log('Gate 3 — remocoes destrutivas (objetos, nao linhas)');
  console.log('  catalogo antigo: ' + ANTIGO);
  console.log('  catalogo novo:   ' + NOVO);

  const destrutivas = [];
  for (const [rotulo, classe, alvos] of removidas) {
    if (alvos.length === 0) continue;
    console.log('Remocoes de ' + rotulo + ' (' + alvos.length + '):');
    for (const alvo of alvos) {
      const consumidoresDoAlvo = classe === 'enum'
        ? (enums.get(alvo) || []).map((arquivo) => arquivo)
        : callSites(alvo, classe === 'funcao' ? 'rpc' : 'from')
          .map((c) => c.file + ':' + c.line);
      // Ignora buraco de call-site no mesmo arquivo duas vezes.
      const pontos = [...new Set(consumidoresDoAlvo)];
      console.log('  - ' + alvo + (pontos.length ? '  <- consumido em ' + pontos.join(', ') : '  (sem call-site)'));
      if (pontos.length) destrutivas.push({ rotulo, alvo, pontos });
    }
  }

  const total = removidas.reduce((soma, [, , alvos]) => soma + alvos.length, 0);
  if (total === 0) {
    console.log('OK: nenhum objeto do catalogo foi removido pelo sync.');
    return;
  }
  if (destrutivas.length === 0) {
    console.log('OK: houve remocao, mas nenhum objeto removido tem consumidor no codigo.');
    return;
  }

  console.error('');
  console.error('BLOQUEADO — remocao destrutiva (objeto do banco ainda consumido pelo codigo):');
  for (const d of destrutivas) {
    for (const ponto of d.pontos) console.error('  ' + d.rotulo + ' ' + d.alvo + ' <- ' + ponto);
  }
  console.error('');
  console.error('Se a remocao for intencional, remova o consumidor no mesmo PR. Nao ha atalho');
  console.error('por contagem de linhas: o gate olha o objeto e os call-sites.');
  process.exit(1);
}

main();

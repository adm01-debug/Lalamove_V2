#!/usr/bin/env node
// Guarda: nenhuma Edge Function pode devolver detalhe interno (`error.message`,
// `error.stack`) ao cliente numa resposta 5xx.
//
// ORIGEM: portada do Zapp_Web_V2, onde fechou o alerta de Code Scanning #13
// (js/stack-trace-exposure). A regua e a mesma: 4xx PODE explicar o erro ao
// cliente (e validacao de entrada); 5xx nao, porque o detalhe e interno — e
// stack trace nao vai em resposta nenhuma.
//
// ADAPTACAO PARA O LALAMOVE_V2 (medido em 2026-11-08):
//   - `jsonResponse(corpo, status, headers, version?)` de
//     `supabase/functions/_shared/contract.ts` tem o status no SEGUNDO argumento,
//     igual ao helper do Zapp — a leitura da chamada inteira vale sem mudanca.
//   - `errorResponse(result, headers)` daqui recebe um ContractResult, nao
//     (mensagem, status): o corpo ja vem de `buildErrorBody`. Os padroes legados
//     de `errorResponse(msg, 5xx)` ficam na lista por seguranca, mas quem pega
//     vazamento neste repo e a leitura de `new Response(...)` (184 usos).
//   - NAO existe `internalErrorResponse` nem envelope documentado de IA: a lista
//     de excecoes por nome de funcao foi removida.
//   - Divida conhecida: 6 ocorrencias ja na main (medidas 2026-11-08) ficam
//     registradas em `check-edge-error-exposure-baseline.json`. A guarda falha so
//     com ocorrencia NOVA; `--update-baseline` reescreve o registro.
//
// Uso:
//   node scripts/ci/check-edge-error-exposure.mjs                  # exit 1 se houver NOVA exposicao
//   node scripts/ci/check-edge-error-exposure.mjs --listar          # so lista os arquivos varridos
//   node scripts/ci/check-edge-error-exposure.mjs --update-baseline # regrava a divida conhecida
//
// LIMITACAO CONHECIDA (a mesma do Zapp): a guarda casa com ACESSO A MEMBRO
// (`err.message`, `err.stack`) dentro do corpo da resposta. Um valor guardado antes
// numa variavel (`const msg = err.message; ... { error: msg }`) nao e detectado. Isso
// e proposital: inferir fluxo de dados pediria AST + analise de alias, e o padrao real
// dos 6 achados deste repo e o acesso direto no corpo.
//
// A deteccao mora em `acharExposicoes`, funcao pura: e ela que os testes exercitam.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const RAIZ_PADRAO = "supabase/functions";

// Formas de vazar detalhe interno na resposta HTTP (varredura por linha, legado).
//
// Regua: 4xx e mensagem para o cliente (o repo ja faz isso: create-user devolve o motivo do
// `auth.admin.createUser` num 400). O que nao pode vazar e detalhe interno num 5xx, ou stack trace
// em qualquer status. O alerta #13 era exatamente disso: err.message indo ao corpo da resposta.
const PADROES = [
  { nome: ".stack na resposta HTTP", re: /errorResponse\s*\([^;]*\.stack\b|JSON\.stringify\s*\([^;]*\.stack\b/ },
  { nome: ".message em resposta 5xx", re: /errorResponse\s*\([^,;]*\.message\s*,\s*5\d\d\b/ },
  { nome: ".message em corpo 500", re: /status\s*:\s*5\d\d[^\n]{0,120}?\b\w+\.message\b/ },
];

// Respostas montadas à mão ou via helper que não sanitiza. `new Response(corpo,
// { status: 5xx })` e `jsonResponse(corpo, 5xx, req)` entram como um bloco só: a
// ordem dos argumentos e o número de linhas não importam. No `jsonResponse` o
// status é o SEGUNDO argumento (`jsonResponse(corpo, 503, req)`), não um
// `status: 5xx` dentro de objeto.
//
// Sem excecao por nome de funcao: qualquer corpo (objeto literal, template ou
// chamada) com `.message`/`.stack` num 5xx e achado.
// `errorResponse(msg, 5xx)` já é coberto pelos PADROES acima.
const RESPOSTAS_MANUAIS = /\bnew\s+Response\s*\(|\bjsonResponse\s*\(/gu;


/**
 * Troca comentários por espaços preservando as quebras de linha (o número da linha não muda).
 * Preserva strings/templates: um `${err.message}` dentro de template continua visível.
 */
function limparComentarios(fonte) {
  let saida = "";
  let i = 0;
  let emString = null;
  let escapado = false;
  let emBloco = false;
  let emLinha = false;
  while (i < fonte.length) {
    const c = fonte[i];
    const d = fonte[i + 1];
    if (emBloco) {
      if (c === "*" && d === "/") {
        saida += "  ";
        i += 2;
        emBloco = false;
        continue;
      }
      saida += c === "\n" ? "\n" : " ";
      i += 1;
      continue;
    }
    if (emLinha) {
      if (c === "\n") {
        saida += "\n";
        emLinha = false;
        i += 1;
        continue;
      }
      saida += " ";
      i += 1;
      continue;
    }
    if (emString) {
      saida += c;
      if (escapado) escapado = false;
      else if (c === "\\") escapado = true;
      else if (c === emString) emString = null;
      i += 1;
      continue;
    }
    if (c === "/" && d === "/") {
      emLinha = true;
      saida += "  ";
      i += 2;
      continue;
    }
    if (c === "/" && d === "*") {
      emBloco = true;
      saida += "  ";
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      emString = c;
      saida += c;
      i += 1;
      continue;
    }
    saida += c;
    i += 1;
  }
  return saida;
}

/** Índice do `)` que fecha o `(` em `abre`, contando parênteses/colchetes/chaves e strings. */
function fimDoBloco(texto, abre) {
  let profundidade = 0;
  let i = abre;
  let emString = null;
  let escapado = false;
  while (i < texto.length) {
    const c = texto[i];
    if (emString) {
      if (escapado) escapado = false;
      else if (c === "\\") escapado = true;
      else if (c === emString) emString = null;
    } else if (c === '"' || c === "'" || c === "`") {
      emString = c;
    } else if (c === "(" || c === "[" || c === "{") {
      profundidade += 1;
    } else if (c === ")" || c === "]" || c === "}") {
      profundidade -= 1;
      if (profundidade === 0) return i;
    }
    i += 1;
  }
  return texto.length;
}

/** Separa os argumentos de nível raiz da chamada (vírgula fora de parênteses/colchetes/chaves). */
function separarArgumentos(bloco) {
  const partes = [];
  let atual = "";
  let profundidade = 0;
  let emString = null;
  let escapado = false;
  for (const c of bloco) {
    if (emString) {
      atual += c;
      if (escapado) escapado = false;
      else if (c === "\\") escapado = true;
      else if (c === emString) emString = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      emString = c;
      atual += c;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") profundidade += 1;
    else if (c === ")" || c === "]" || c === "}") profundidade -= 1;
    if (c === "," && profundidade === 0) {
      partes.push(atual);
      atual = "";
      continue;
    }
    atual += c;
  }
  partes.push(atual);
  return partes;
}

/**
 * Achados em respostas montadas à mão (`new Response`) ou via `jsonResponse`.
 * A ordem dos argumentos e o número de linhas não importam: `status` pode vir
 * depois do corpo (searchbox-budget-alert) ou na linha seguinte
 * (webhook-diagnostic).
 */
function exposicoesEmRespostasManuais(limpo) {
  const achados = [];
  const linhas = limpo.split("\n");
  const jaVistos = new Set();
  for (const chamada of limpo.matchAll(RESPOSTAS_MANUAIS)) {
    const abre = limpo.indexOf("(", chamada.index);
    const fecha = fimDoBloco(limpo, abre);
    const linha = limpo.slice(0, chamada.index).split("\n").length;
    const textoLinha = (linhas[linha - 1] ?? "").trim();
    // Convenção do repo (e dos testes): linha de continuação de comentário não é código.
    if (textoLinha.startsWith("*")) continue;
    const args = separarArgumentos(limpo.slice(abre + 1, fecha));
    const corpo = args[0] ?? "";
    // `jsonResponse(corpo, status, headers)`: o status e o segundo argumento. No
    // `new Response` o status esta no inicializador (`{ status: 5xx }`).
    const ehJsonResponse = chamada[0].startsWith("jsonResponse");
    const cincoXX = ehJsonResponse
      ? /^\s*5\d\d\b/u.test(args[1] ?? "")
      : /status\s*:\s*5\d\d\b/u.test(args.slice(1).join(","));
    const vazaStack = /\.stack\b/u.test(corpo);
    const vazaMensagem = /\.message\b/u.test(corpo);
    const padrao = vazaStack
      ? ".stack na resposta HTTP"
      : cincoXX && vazaMensagem
        ? ".message em resposta 5xx"
        : null;
    if (!padrao) continue;
    const chave = `${linha}|${padrao}`;
    if (jaVistos.has(chave)) continue;
    jaVistos.add(chave);
    achados.push({ arquivo: "", linha, padrao, trecho: textoLinha.slice(0, 120) });
  }
  return achados;
}

/**
 * Devolve as exposições encontradas num fonte. Função pura — sem I/O, é o contrato dos testes.
 * Linhas de comentário são ignoradas; a varredura por linha (legado) roda junto com a leitura
 * da chamada inteira (R2-INF-016), para que a ordem dos argumentos não esconda nada.
 */
export function acharExposicoes(fonte, arquivo = "arquivo.ts") {
  const achados = [];
  const limpo = limparComentarios(fonte);
  const linhas = limpo.split("\n");

  for (let i = 0; i < linhas.length; i += 1) {
    const linha = linhas[i];
    const semEspaco = linha.trim();
    if (semEspaco.startsWith("*")) continue;
    for (const { nome, re } of PADROES) {
      if (re.test(linha)) achados.push({ arquivo, linha: i + 1, padrao: nome, trecho: semEspaco.slice(0, 120) });
    }
  }

  for (const achado of exposicoesEmRespostasManuais(limpo)) {
    // A varredura por linha já apontou esta linha: não conta duas vezes o mesmo vazamento.
    if (achados.some((a) => a.linha === achado.linha)) continue;
    achados.push({ ...achado, arquivo });
  }

  achados.sort((a, b) => a.linha - b.linha);
  return achados;
}

export function listarFontes(raiz = RAIZ_PADRAO) {
  const arquivos = [];
  const visitar = (dir) => {
    for (const entrada of readdirSync(dir)) {
      const completo = path.join(dir, entrada);
      if (statSync(completo).isDirectory()) visitar(completo);
      else if (/\.ts$/u.test(entrada) && !/\.test\.ts$/u.test(entrada)) arquivos.push(completo);
    }
  };
  visitar(raiz);
  return arquivos.sort((a, b) => a.localeCompare(b));
}

const BASELINE_PADRAO = "scripts/ci/check-edge-error-exposure-baseline.json";
const SCHEMA_BASELINE = 1;

/**
 * Chave de uma ocorrencia para o baseline: arquivo + padrao + o trecho normalizado.
 * SEM numero de linha de proposito — editar o arquivo em volta nao "cria" um
 * vazamento novo. O trecho entra porque duas respostas diferentes no mesmo
 * arquivo precisam ser distinguiveis; ele e codigo-fonte do repo, nunca um valor
 * de segredo (a guarda nao le env nem secret).
 */
export function chaveDaOcorrencia(achado) {
  return JSON.stringify([achado.arquivo, achado.padrao, achado.trecho.replace(/\s+/gu, " ").trim()]);
}

export function criarBaseline(achados) {
  const ocorrencias = achados
    .map((a) => ({ arquivo: a.arquivo, padrao: a.padrao, trecho: a.trecho.replace(/\s+/gu, " ").trim() }))
    .sort((a, b) => chaveDaOcorrencia(a).localeCompare(chaveDaOcorrencia(b)));
  return { schemaVersion: SCHEMA_BASELINE, ocorrencias };
}

/** Le o baseline; ausente = divida conhecida vazia (toda ocorrencia e nova). */
export function lerBaseline(caminho) {
  if (!existsSync(caminho)) return { schemaVersion: SCHEMA_BASELINE, ocorrencias: [] };
  const dados = JSON.parse(readFileSync(caminho, "utf8"));
  if (dados?.schemaVersion !== SCHEMA_BASELINE || !Array.isArray(dados.ocorrencias)) {
    throw new Error(`baseline invalido ou com schema diferente de ${SCHEMA_BASELINE}: ${caminho}`);
  }
  return dados;
}

/** Separa os achados em NOVOS (nao estao no baseline) e os do baseline que sumiram. */
export function compararComBaseline(baseline, achados) {
  const disponiveis = new Map();
  for (const o of baseline.ocorrencias) {
    const k = chaveDaOcorrencia(o);
    disponiveis.set(k, (disponiveis.get(k) ?? 0) + 1);
  }
  const novos = [];
  for (const a of achados) {
    const k = chaveDaOcorrencia(a);
    const restantes = disponiveis.get(k) ?? 0;
    if (restantes > 0) disponiveis.set(k, restantes - 1);
    else novos.push(a);
  }
  const pagos = [...disponiveis.values()].reduce((total, n) => total + n, 0);
  return { novos, pagos };
}

export function main(raiz = RAIZ_PADRAO, argv = process.argv.slice(2)) {
  // Diretorio alvo pode vir como argumento posicional (usado nos testes de mutacao).
  const raizEfetiva = argv.find((a) => !a.startsWith("--")) ?? raiz;
  const fontes = listarFontes(raizEfetiva);
  if (argv.includes("--listar")) {
    console.log(fontes.join("\n"));
    return 0;
  }
  const achados = fontes.flatMap((f) => acharExposicoes(readFileSync(f, "utf8"), f));
  const caminhoBaseline = path.resolve(
    argv.includes("--baseline") ? argv[argv.indexOf("--baseline") + 1] : BASELINE_PADRAO,
  );

  if (argv.includes("--update-baseline")) {
    const baseline = criarBaseline(achados);
    writeFileSync(caminhoBaseline, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
    console.log(`Baseline atualizado: ${baseline.ocorrencias.length} ocorrencia(s) em ${caminhoBaseline}`);
    return 0;
  }

  let baseline;
  try {
    baseline = lerBaseline(caminhoBaseline);
  } catch (erro) {
    console.error(`ERRO: ${erro.message}`);
    return 2;
  }

  const { novos, pagos } = compararComBaseline(baseline, achados);
  console.log(
    `Edge error exposure: ${fontes.length} arquivo(s) varrido(s), ${achados.length} ocorrencia(s), ` +
      `baseline=${baseline.ocorrencias.length}, novas=${novos.length}, do baseline que sumiram=${pagos}`,
  );
  if (pagos > 0) {
    console.log(
      `AVISO: ${pagos} ocorrencia(s) do baseline nao existem mais — divida ja paga que o registro ainda conta. ` +
        "Rode --update-baseline para baixar o teto.",
    );
  }
  if (novos.length === 0) {
    console.log("OK: nenhuma NOVA exposicao de stack/mensagem interna nas edges.");
    return 0;
  }
  console.error(`FALHA: ${novos.length} NOVA(S) exposicao(oes) de detalhe interno na resposta HTTP:`);
  for (const a of novos) console.error(`  ${a.arquivo}:${a.linha} [${a.padrao}] ${a.trecho}`);
  console.error(
    "Num catch de 5xx devolva corpo generico (ex.: buildErrorBody de _shared/contract.ts) e " +
      "mande o detalhe para o log (logger de _shared/logger.ts), nunca para o cliente.",
  );
  return 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.exit(main());
}

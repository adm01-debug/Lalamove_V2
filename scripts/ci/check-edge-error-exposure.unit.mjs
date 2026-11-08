import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { acharExposicoes, listarFontes, main } from "./check-edge-error-exposure.mjs";

test("fonte correta com internalErrorResponse não gera achado", () => {
  const fonte = [
    "import { internalErrorResponse } from './validation.ts';",
    "try {",
    "  await fazer();",
    "} catch (err) {",
    "  return internalErrorResponse(err, req);",
    "}",
  ].join("\n");
  assert.deepEqual(acharExposicoes(fonte), []);
});

test(".message num 5xx é achado (o caso do alerta #13)", () => {
  const achados = acharExposicoes("return errorResponse(err.message, 500, req);");
  assert.equal(achados.length, 1);
  assert.equal(achados[0].padrao, ".message em resposta 5xx");
  assert.equal(achados[0].linha, 1);
});

test(".stack na resposta HTTP é achado em qualquer status", () => {
  const achados = acharExposicoes("return errorResponse(String(e.stack), 400, req);");
  assert.equal(achados.length, 1);
  assert.equal(achados[0].padrao, ".stack na resposta HTTP");
});

test("JSON com .stack no corpo é achado", () => {
  const achados = acharExposicoes("const body = JSON.stringify({ erro: error.stack });");
  assert.equal(achados.length, 1);
  assert.equal(achados[0].padrao, ".stack na resposta HTTP");
});

test("corpo 500 montado à mão com .message é achado", () => {
  const achados = acharExposicoes("const r = { status: 500, message: err.message };");
  assert.equal(achados.length, 1);
  assert.equal(achados[0].padrao, ".message em corpo 500");
});

test("4xx com mensagem ao cliente NÃO é achado (convenção do repo)", () => {
  // Caso real de supabase/functions/create-user/index.ts:79 — o motivo do
  // auth.admin.createUser vai ao cliente num 400, e isso é intencional.
  const achados = acharExposicoes("return errorResponse(createError.message, 400, req);");
  assert.deepEqual(achados, []);
});

test("comentário que apenas DESCREVE o vazamento não é achado", () => {
  // Caso real de _shared/validation.ts: a docstring cita o bug que corrigiu.
  const fonte = [
    "/** Serializes `err` ... Isolates err.message access * from the Response construction scope so",
    " * CodeQL taint analysis does not trace err.message → Response body (js/stack-trace-exposure). */",
    "// Use no lugar de errorResponse(err.message, 500, req) em todos os catch de 5xx.",
    "  * errorResponse(err.message, 500, req)",
  ].join("\n");
  assert.deepEqual(acharExposicoes(fonte), []);
});

test("conta a linha certa quando o achado está no meio do arquivo", () => {
  const fonte = ["// ok", "const a = 1;", "  return errorResponse(err.message, 503);"].join("\n");
  const achados = acharExposicoes(fonte);
  assert.equal(achados.length, 1);
  assert.equal(achados[0].linha, 3);
});

// ─── R2-INF-016 (item 363) ────────────────────────────────────────────────────────────────
// Respostas 5xx montadas à mão (`new Response`) com o `.message` ANTES do status ou
// atravessando linhas ficavam invisíveis: o scanner antigo só olhava uma linha por vez e
// exigia `status` primeiro. Estes casos são as formas REAIS de searchbox-budget-alert e
// webhook-diagnostic, mais as mutações equivalentes.

test("resposta 500 montada à mão com .message ANTES do status é achado (searchbox-budget-alert)", () => {
  const achados = acharExposicoes("return new Response(JSON.stringify({ ok: false, erro: error.message }), { status: 500 });");
  assert.equal(achados.length, 1, `esperava 1 achado, veio ${JSON.stringify(achados)}`);
  assert.equal(achados[0].padrao, ".message em resposta 5xx");
});

test("resposta 500 montada à mão em VÁRIAS LINHAS é achada (webhook-diagnostic)", () => {
  const fonte = [
    "  } catch (err) {",
    "    return new Response(",
    "      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),",
    "      {",
    "        status: 500,",
    "        headers: cors,",
    "      },",
    "    );",
    "  }",
  ].join("\n");
  const achados = acharExposicoes(fonte);
  assert.equal(achados.length, 1, `esperava 1 achado, veio ${JSON.stringify(achados)}`);
  assert.equal(achados[0].padrao, ".message em resposta 5xx");
  assert.equal(achados[0].linha, 2);
});

test("resposta 500 com template em volta do .message é achada (talkx-send)", () => {
  const achados = acharExposicoes("return new Response(JSON.stringify({ error: `claim_failed: ${claimError.message}` }), { status: 500, headers });");
  assert.equal(achados.length, 1, `esperava 1 achado, veio ${JSON.stringify(achados)}`);
  assert.equal(achados[0].padrao, ".message em resposta 5xx");
});

test("resposta 500 com stack é achada mesmo montada à mão", () => {
  const achados = acharExposicoes("return new Response(JSON.stringify({ erro: err.stack }), { status: 500 });");
  assert.equal(achados.length, 1, `esperava 1 achado, veio ${JSON.stringify(achados)}`);
  assert.equal(achados[0].padrao, ".stack na resposta HTTP");
});

test("jsonResponse com .message no corpo num 5xx é achado (o status é o SEGUNDO argumento)", () => {
  // `jsonResponse(corpo, 5xx, headers)` nao sanitiza nada: objeto literal com o
  // detalhe interno num 5xx e achado.
  const achados = acharExposicoes("return jsonResponse({ error: err.message }, 503, req);");
  assert.equal(achados.length, 1, `esperava 1 achado, veio ${JSON.stringify(achados)}`);
  assert.equal(achados[0].padrao, ".message em resposta 5xx");
});

test("Lalamove_V2: NAO existe excecao por nome de funcao — construtor com .message num 5xx e achado", () => {
  // No Zapp havia lista fechada (buildAiEnvelope/persistenceFailureEnvelope) aceita como
  // corpo do jsonResponse. Este repo nao tem envelope de IA documentado, a lista foi
  // removida e qualquer construtor carregando o detalhe interno num 5xx e achado.
  for (const fonte of [
    "return jsonResponse(persistenceFailureEnvelope({ error: input.message }), 502, headers);",
    "return jsonResponse(buildAiEnvelope({ error: input.message }), 502, headers);",
  ]) {
    const achados = acharExposicoes(fonte);
    assert.equal(achados.length, 1, `esperava 1 achado, veio ${JSON.stringify(achados)}`);
    assert.equal(achados[0].padrao, ".message em resposta 5xx");
  }
});

test("jsonResponse com builder NÃO documentado carregando .message num 5xx é achado", () => {
  // Nenhuma fabrica e isenta: o corpo e lido do mesmo jeito.
  const achados = acharExposicoes("return jsonResponse(meuBuilder({ error: err.message }), 500, req);");
  assert.equal(achados.length, 1, `esperava 1 achado, veio ${JSON.stringify(achados)}`);
  assert.equal(achados[0].padrao, ".message em resposta 5xx");
});

test("jsonResponse com .message fora de 5xx NÃO é achado (2xx/4xx seguem liberados)", () => {
  assert.deepEqual(acharExposicoes("return jsonResponse({ error: err.message }, 200, req);"), []);
  assert.deepEqual(acharExposicoes("return jsonResponse({ error: err.message }, 400, req);"), []);
});

test("arquivo REAL do repo com a divida conhecida e acusado (apply-fixes/index.ts)", () => {
  // Uma das 6 ocorrencias medidas em 2026-11-08: o catch devolve `error.message` num 500.
  // Le o arquivo do disco (nao uma copia a mao) para provar que a guarda enxerga o real.
  const caminho = fileURLToPath(new URL("../../supabase/functions/apply-fixes/index.ts", import.meta.url));
  const fonte = readFileSync(caminho, "utf8");
  const achados = acharExposicoes(fonte, "supabase/functions/apply-fixes/index.ts");
  assert.equal(achados.length, 1, `esperava 1 achado, veio ${JSON.stringify(achados)}`);
  assert.equal(achados[0].padrao, ".message em resposta 5xx");

  // E, corrigido para corpo generico, o mesmo arquivo passa a estar limpo.
  const corrigido = fonte.replace("JSON.stringify({ error: error.message })", "JSON.stringify({ error: 'Internal server error' })");
  assert.notEqual(corrigido, fonte, "o trecho precisa ser substituivel");
  assert.deepEqual(acharExposicoes(corrigido, "supabase/functions/apply-fixes/index.ts"), []);
});

test("resposta 500 montada à mão SEM detalhe interno não é achado", () => {
  const achados = acharExposicoes('return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });');
  assert.deepEqual(achados, []);
});

test("resposta 4xx montada à mão com .message não é achado (convenção do repo)", () => {
  const achados = acharExposicoes("return new Response(JSON.stringify({ error: err.message }), { status: 400 });");
  assert.deepEqual(achados, []);
});

test("arquivo REAL limpo nao da falso positivo (lalamove-webhook/index.ts)", () => {
  // O catch LE `error.message` (vai para o logger) mas devolve corpo generico no 500:
  // a guarda tem de olhar o CORPO da resposta, nao o catch inteiro.
  const rel = "supabase/functions/lalamove-webhook/index.ts";
  const fonte = readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), "utf8");
  assert.ok(fonte.includes("error instanceof Error ? error.message"), `${rel} deveria ler .message para o log`);
  assert.deepEqual(acharExposicoes(fonte, rel), [], `${rel} nao deveria expor detalhe interno`);

  // Se o corpo generico virasse o detalhe interno, a guarda reprovaria o arquivo real.
  // A regressao usa o acesso `error.message` no proprio corpo: a guarda casa com acesso a
  // membro, nao com variavel intermediaria (ver "Limitacao conhecida" no cabecalho).
  const comRegressao = fonte.replace(
    "JSON.stringify({ error: 'Internal server error' })",
    "JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })",
  );
  assert.notEqual(comRegressao, fonte, "o corpo generico precisa ser substituivel");
  assert.equal(acharExposicoes(comRegressao, rel).length, 1);
});

test("baseline: ocorrencia conhecida nao e nova; ocorrencia inedita e", async () => {
  const { criarBaseline, compararComBaseline, chaveDaOcorrencia } = await import("./check-edge-error-exposure.mjs");
  const conhecida = { arquivo: "a/index.ts", linha: 10, padrao: ".message em resposta 5xx", trecho: "return new Response(" };
  const baseline = criarBaseline([conhecida]);
  assert.equal(baseline.ocorrencias.length, 1);
  assert.deepEqual(compararComBaseline(baseline, [{ ...conhecida, linha: 99 }]), { novos: [], pagos: 0 });

  const nova = { arquivo: "b/index.ts", linha: 3, padrao: ".message em resposta 5xx", trecho: "return new Response(" };
  const r = compararComBaseline(baseline, [conhecida, nova]);
  assert.equal(r.novos.length, 1);
  assert.equal(r.novos[0].arquivo, "b/index.ts");

  // Divida paga aparece como `pagos` e nao falha o gate.
  assert.deepEqual(compararComBaseline(baseline, []), { novos: [], pagos: 1 });
  assert.notEqual(chaveDaOcorrencia(conhecida), chaveDaOcorrencia(nova));
});

test("a varredura real dos edges passa (a correção de 28/09 se mantém)", () => {
  const fontes = listarFontes();
  assert.ok(fontes.length > 10, `esperava varrer vários edges, varreu ${fontes.length}`);
  assert.equal(main("supabase/functions", []), 0, "há exposição de detalhe interno nos edges");
});

test("MUTAÇÃO: as duas formas reais (searchbox e webhook-diagnostic) reprovam a varredura", () => {
  const raiz = mkdtempSync(path.join(tmpdir(), "edge-exposure-r2inf016-"));
  mkdirSync(path.join(raiz, "searchbox-budget-alert"), { recursive: true });
  mkdirSync(path.join(raiz, "webhook-diagnostic"), { recursive: true });
  writeFileSync(
    path.join(raiz, "searchbox-budget-alert", "index.ts"),
    "export const x = (err) => new Response(JSON.stringify({ ok: false, erro: err.message }), { status: 500 });\n",
  );
  writeFileSync(
    path.join(raiz, "webhook-diagnostic", "index.ts"),
    [
      "export const y = (err) => {",
      "  return new Response(",
      "    JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),",
      "    { status: 500 },",
      "  );",
      "};",
      "",
    ].join("\n"),
  );
  assert.equal(main(raiz, []), 1, "a guarda deveria reprovar as duas formas reais");
  // Sanitizadas pelo helper, as duas passam: prova que a reprovação vem do corpo, não do caminho.
  writeFileSync(path.join(raiz, "searchbox-budget-alert", "index.ts"), "export const x = (err, req) => internalErrorResponse(err, req);\n");
  writeFileSync(path.join(raiz, "webhook-diagnostic", "index.ts"), "export const y = (err, req) => internalErrorResponse(err, req);\n");
  assert.equal(main(raiz, []), 0, "as duas fontes sanitizadas deveriam passar");
});

// O teste acima não substitui a varredura real: ele prova que a DETECÇÃO funciona. A ausência
// de achados no repositório só é evidência junto com esta mutação (item 363 · acceptance 3).

test("MUTAÇÃO: vazamento injetado num edge de verdade é detectado (e o diretório é respeitado)", () => {
  const raiz = mkdtempSync(path.join(tmpdir(), "edge-exposure-"));
  mkdirSync(path.join(raiz, "create-user"), { recursive: true });
  writeFileSync(
    path.join(raiz, "create-user", "index.ts"),
    "export const x = (err) => errorResponse(err.message, 500, req);\n",
  );
  assert.equal(main(raiz, []), 1, "a guarda deveria reprovar a mutação injetada");
  // O mesmo diretório, sem a linha, passa: prova que a falha acima é do conteúdo, não do caminho.
  writeFileSync(path.join(raiz, "create-user", "index.ts"), "export const x = (err) => internalErrorResponse(err, req);\n");
  assert.equal(main(raiz, []), 0, "fonte limpa deveria passar");
});

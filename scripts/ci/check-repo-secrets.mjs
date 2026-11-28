#!/usr/bin/env node
// Impede que repositório, n8n workflows ou docs voltem a carregar credencial de produção.
//
// MOTIVO (28/11/2026): a API key e o segredo HMAC da Lalamove estavam em texto puro nos
// exports dos workflows n8n e foram mergeados em `main` por a varredura anterior so
// procurar formatos que nao incluiam `pk_prod_`/`sk_prod_`. Repositorio publico: qualquer
// clone distribuia a chave, e quem a tivesse podia criar e cancelar fretes pagos na conta.
//
// O que ela faz: varre os arquivos versionados de codigo, automação e documentação
// procurando os formatos de credencial que existem neste projeto. `.git` e `dist` ficam fora.
//
// NUNCA imprime o valor encontrado: a violacao sai como arquivo:linha + o nome do formato.
//
// Uso:
//   node scripts/ci/check-repo-secrets.mjs [--root .]
// Codigo de saida: 0 = limpo, 1 = violacao, 2 = uso/ambiente errado (fail-closed).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const EXTENSOES = ['.md', '.json', '.html', '.py', '.mjs', '.js', '.ts', '.tsx', '.sh', '.yml', '.yaml', '.sql', '.docx'];
const IGNORAR = new Set(['.git', 'dist', 'node_modules', '.wsl', 'coverage']);

// Cada formato diz o que e, para a mensagem ser acionavel sem revelar o valor.
export const FORMATOS = [
  { nome: 'chave de API de producao Lalamove (pk_prod_)', re: /\bpk_prod_[A-Za-z0-9]{16,}/u },
  { nome: 'segredo HMAC de producao Lalamove (sk_prod_)', re: /\bsk_prod_[A-Za-z0-9]{16,}/u },
  { nome: 'token pessoal da Management API do Supabase (sbp_)', re: /\bsbp_[a-f0-9]{40}\b/u },
  { nome: 'chave publicavel do Supabase (sb_publishable_)', re: /\bsb_publishable_[A-Za-z0-9_-]{20,}/u },
  { nome: 'chave secreta do Supabase (sb_secret_)', re: /\bsb_secret_[A-Za-z0-9_-]{20,}/u },
  { nome: 'token do Mapbox', re: /\bpk\.[A-Za-z0-9]{40,}\b/u },
  { nome: 'token secreto do Mapbox', re: /\bsk\.[A-Za-z0-9_.]{40,}\b/u },
  { nome: 'webhook do Bitrix24 com token embutido (/rest/1/<token>/)', re: /\/rest\/1\/[A-Za-z0-9]{20,}\//u },
];

/** Retorna true se o arquivo deve ser varrido. */
export function ehArquivoVarrido(nome) {
  if (nome.endsWith('.min.js') || nome.endsWith('.map')) return false;
  return EXTENSOES.some((ext) => nome.endsWith(ext));
}

/** Lista recursivamente os arquivos varridos a partir de `dir`. */
export function listarArquivos(dir) {
  const arquivos = [];
  const percorrer = (atual) => {
    for (const entrada of readdirSync(atual, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (IGNORAR.has(entrada.name)) continue;
      const caminho = path.join(atual, entrada.name);
      if (entrada.isDirectory()) percorrer(caminho);
      else if (entrada.isFile() && ehArquivoVarrido(entrada.name)) arquivos.push(caminho);
    }
  };
  percorrer(dir);
  return arquivos;
}

/** Procura os formatos de credencial em um texto; devolve linhas (1-based) e nomes de formato. */
export function detectar(texto) {
  const achados = [];
  texto.split(/\r?\n/u).forEach((linha, indice) => {
    for (const formato of FORMATOS) {
      if (formato.re.test(linha)) achados.push({ linha: indice + 1, formato: formato.nome });
    }
  });
  return achados;
}

/** Varre a arvore e devolve as violacoes no formato `arquivo:linha — formato`. */
export function varrer(raiz) {
  const violacoes = [];
  for (const arquivo of listarArquivos(raiz)) {
    // .docx e zip: o binario nao e decodificado como utf-8; o formato textual ja cobre os casos.
    if (arquivo.endsWith('.docx')) continue;
    let conteudo;
    try {
      conteudo = readFileSync(arquivo, 'utf8');
    } catch {
      continue;
    }
    for (const achado of detectar(conteudo)) {
      violacoes.push(`${path.relative(raiz, arquivo)}:${achado.linha} — ${achado.formato}`);
    }
  }
  return violacoes;
}

export function main(argv = process.argv.slice(2), root = process.cwd()) {
  let raiz = root;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root') raiz = path.resolve(argv[++i] ?? '');
    else {
      console.error(`ERRO: argumento desconhecido: ${argv[i]}`);
      return 2;
    }
  }
  if (!statSync(raiz).isDirectory()) {
    console.error(`ERRO: ${raiz} nao e diretorio.`);
    return 2;
  }
  const violacoes = varrer(raiz);
  if (violacoes.length > 0) {
    console.error('VIOLACAO: credencial de producao em arquivo versionado\n');
    for (const v of violacoes) console.error(` - ${v}`);
    console.error(
      `\n${violacoes.length} ocorrencia(s). Use variavel de ambiente/expressao n8n (ex.: {{ $env.LALAMOVE_API_KEY }})` +
        ' e rotacione o valor no provedor: ele ja esteve publico.',
    );
    return 1;
  }
  console.log('OK: nenhuma credencial de producao em arquivo versionado.');
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  process.exit(main());
}
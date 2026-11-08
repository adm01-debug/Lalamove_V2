/**
 * Extrai o className da raiz JSX de um componente de view.
 *
 * Heuristica deliberadamente conservadora, porque um extrator que erra o
 * elemento faz o guard dar verde sem auditar nada:
 *
 *  - o componente e o ultimo `export` do arquivo (function, const ou default);
 *  - so contam os `return` no nivel de indentacao do corpo do componente (2
 *    espacos). `return` dentro de callback (useMemo, map, useEffect) esta mais
 *    fundo e ficava de fora — era o que fazia o parser pegar a tag errada;
 *  - de cada return desses sai apenas a TAG DE ABERTURA do elemento, contando
 *    chaves para achar o '>' certo, senao um root com cn(...) faz o regex
 *    escorregar para um descendente;
 *  - guard clauses (`if (!x) return <.../>`) tambem sao raizes renderizadas,
 *    entao todas voltam, nao so a ultima.
 */

const CLASSNAME_RE =
  /className=(?:["'`]([^"'`]+)["'`]|\{(?:`([^`]+)`|"([^"]+)"|'([^']+)'))/;

/**
 * Argumentos de `cn(...)` a partir do '(' em `from`, respeitando parenteses
 * aninhados (ex.: `cn("p-6", isX ? "a" : "b")`).
 */
function argsDoCn(tag, from) {
  let profundidade = 0;
  for (let i = from; i < tag.length; i += 1) {
    const ch = tag[i];
    if (ch === "(") profundidade += 1;
    else if (ch === ")") {
      profundidade -= 1;
      if (profundidade === 0) return tag.slice(from + 1, i);
    }
  }
  return null;
}

/** Recorta a tag de abertura do primeiro elemento JSX a partir de `from`. */
function openingTagAt(source, from) {
  const tagStart = source.indexOf("<", from);
  if (tagStart === -1) return null;
  // Fragment (<>): raiz valida, so nao tem className — auditada como vazia.
  if (source[tagStart + 1] === ">") return "";

  let depth = 0;
  for (let i = tagStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    else if (ch === ">" && depth === 0) return source.slice(tagStart, i + 1);
  }
  return null;
}

/**
 * Inicio do corpo do componente exportado.
 *
 * Adaptacao para este repo: varias paginas usam
 * `function ProfilePage() {...}` + `export default ProfilePage;`
 * (ex.: src/pages/ProfilePage.tsx:12 e :276). O heuristico original do Zapp
 * so olhava `export function|const|class`, entao essas paginas voltavam zero
 * raizes e o guard as marcava como NAO AUDITAVEL. Aqui, quando nao ha export
 * inline, resolvemos o identificador do `export default` ate a declaracao.
 */
function inicioDoComponente(source) {
  const exportRe = /^export\s+(?:default\s+)?(?:function|const|class)\s+/gm;
  const exports = [...source.matchAll(exportRe)];
  if (exports.length > 0) return exports[exports.length - 1].index;

  const defaultId = source.match(/^export\s+default\s+([A-Za-z_$][\w$]*)\s*;/m);
  if (!defaultId) return -1;
  const decl = new RegExp(
    `^(?:function|const|let|var|class)\\s+${defaultId[1]}\\b`,
    "m",
  ).exec(source);
  return decl ? decl.index : -1;
}

/**
 * @returns {{tag:string, className:string}[]} uma entrada por raiz retornada.
 * `tag` e o nome do elemento ("div", "PullToRefresh", "" para fragmento) —
 * necessario aqui porque regras de gutter so valem para elemento DOM: quando a
 * raiz e um componente wrapper, o padding pode legitimamente estar dentro dele.
 */
export function extractRoots(source) {
  const inicio = inicioDoComponente(source);
  if (inicio === -1) return [];

  const body = source.slice(inicio);

  // `return` no nivel do corpo do componente: a LINHA comeca com exatamente 2
  // espacos. Vale tanto para `  return (` quanto para a guard clause inline
  // `  if (!user) return <LoadingSplash />;`, que um ancora em ^ {2}return
  // deixaria escapar. Callback esta mais fundo e nao entra.
  const roots = [];
  let offset = 0;
  for (const line of body.split("\n")) {
    const lineStart = offset;
    offset += line.length + 1;
    if (!/^ {2}\S/.test(line)) continue;
    const m = line.match(/\breturn\s*[(<]/);
    if (!m) continue;
    // `return () => ...` (cleanup de useEffect) casa com o regex acima e o
    // openingTagAt acabaria pegando uma tag descendente. Se a seta aparece
    // antes de qualquer '<' no resto da linha, o return nao e de JSX.
    const rest = line.slice(m.index + m[0].length - 1);
    const arrow = rest.indexOf('=>');
    const jsx = rest.indexOf('<');
    if (arrow !== -1 && (jsx === -1 || arrow < jsx)) continue;
    const tag = openingTagAt(body, lineStart + m.index);
    if (tag === null) continue;
    // `cn(...)` pode ter varios argumentos string/template (ex.:
    // `cn("space-y-4", "p-6")`); pegar so o primeiro literal perdia o gutter
    // quando ele nao era o primeiro argumento.
    const cnMatch = tag.match(/className=\{cn\(/);
    let className;
    if (cnMatch) {
      const args = argsDoCn(tag, cnMatch.index + cnMatch[0].length - 1);
      className = args
        ? [...args.matchAll(/["'`]([^"'`]*)["'`]/g)].map((m2) => m2[1]).join(" ")
        : "";
    } else {
      const cls = tag.match(CLASSNAME_RE);
      className = cls ? (cls[1] || cls[2] || cls[3] || cls[4] || "") : "";
    }
    roots.push({
      tag: tag.match(/^<([A-Za-z][\w.$-]*)/)?.[1] ?? "",
      className,
    });
  }
  return roots;
}

/**
 * @returns {string[]} um className por raiz retornada; vazio quando o arquivo
 * nao tem componente exportado ou nenhum return de JSX no nivel do corpo.
 */
export function extractRootClassNames(source) {
  return extractRoots(source).map((raiz) => raiz.className);
}

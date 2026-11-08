import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const GUARD = fileURLToPath(new URL("./layout-guard.mjs", import.meta.url));

function runGuard(files) {
  const root = mkdtempSync(path.join(tmpdir(), "layout-guard-"));
  try {
    for (const [relativePath, source] of Object.entries(files)) {
      const target = path.join(root, relativePath);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, source);
    }

    try {
      return {
        status: 0,
        output: execFileSync(process.execPath, [GUARD], {
          cwd: root,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        }),
      };
    } catch (error) {
      return {
        status: error.status,
        output: `${error.stdout ?? ""}${error.stderr ?? ""}`,
      };
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/**
 * App.tsx minimo com o mesmo formato do real (src/App.tsx:146-203): paginas
 * lazy no topo, `<Route element={<AppLayout />}>` com as rotas protegidas e uma
 * rota publica fora do shell.
 */
const appTsx = ({ dentro = [], fora = [] } = {}) => {
  const nomes = [...dentro, ...fora];
  const imports = nomes
    .map((n) => `const ${n} = lazy(() => import('./pages/${n}'));`)
    .join("\n");
  return `${imports}

const AppContent = () => {
  return (
    <Routes>
${fora.map((n) => `      <Route path="/${n}" element={<${n} />} />`).join("\n")}
      <Route element={<AppLayout />}>
${dentro.map((n) => `        <Route path="/${n}" element={<ProtectedRoute requiredRole="operator"><SuspenseWrapper><${n} /></SuspenseWrapper></ProtectedRoute>} />`).join("\n")}
      </Route>
    </Routes>
  );
};
`;
};

test("audita a raiz real de uma pagina reexportada por alias", () => {
  const result = runGuard({
    "src/App.tsx": appTsx({ dentro: ["AliasPage"] }),
    "src/pages/AliasPage.tsx":
      'export { TargetPage as AliasPage } from "../components/TargetPage";\n',
    "src/components/TargetPage.tsx":
      'export function TargetPage() {\n  return <main className="w-full min-w-0 p-6">ok</main>;\n}\n',
  });

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /0 violacoes em 1 paginas/);
});

test("nao confunde min-h-full com altura de viewport", () => {
  const result = runGuard({
    "src/App.tsx": appTsx({ dentro: ["MinHeightPage"] }),
    "src/pages/MinHeightPage.tsx":
      'export function MinHeightPage() {\n  return <div className="min-h-full p-4">ok</div>;\n}\n',
  });

  assert.equal(result.status, 0, result.output);
});

test("reprova altura de viewport na raiz (o shell ja limita)", () => {
  const result = runGuard({
    "src/App.tsx": appTsx({ dentro: ["TallPage"] }),
    "src/pages/TallPage.tsx":
      'export function TallPage() {\n  return <div className="min-h-screen p-4">erro</div>;\n}\n',
  });

  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /VIOLATION \[altura de viewport na raiz\]/);
});

test("reprova overflow proprio na raiz (quem rola e o main)", () => {
  const result = runGuard({
    "src/App.tsx": appTsx({ dentro: ["ScrollPage"] }),
    "src/pages/ScrollPage.tsx":
      'export function ScrollPage() {\n  return <div className="overflow-y-auto p-4">erro</div>;\n}\n',
  });

  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /VIOLATION \[overflow na raiz\]/);
});

test("reprova raiz DOM sem padding horizontal", () => {
  const result = runGuard({
    "src/App.tsx": appTsx({ dentro: ["FlushPage"] }),
    "src/pages/FlushPage.tsx":
      'export function FlushPage() {\n  return <div className="space-y-6">erro</div>;\n}\n',
  });

  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /VIOLATION \[raiz sem gutter horizontal\]/);
});

test("nao cobra gutter quando a raiz e componente wrapper", () => {
  const result = runGuard({
    "src/App.tsx": appTsx({ dentro: ["WrappedPage"] }),
    "src/pages/WrappedPage.tsx":
      'export function WrappedPage() {\n  return <PullToRefresh className="h-full">ok</PullToRefresh>;\n}\n',
  });

  assert.equal(result.status, 0, result.output);
});

test("acha o gutter em cn() mesmo quando nao e o primeiro argumento", () => {
  const result = runGuard({
    "src/App.tsx": appTsx({ dentro: ["CnPage"] }),
    "src/pages/CnPage.tsx":
      'export function CnPage() {\n  return <div className={cn("space-y-6", "p-6")}>ok</div>;\n}\n',
  });

  assert.equal(result.status, 0, result.output);
});

test("aceita px-* e p-[...] como gutter", () => {
  const result = runGuard({
    "src/App.tsx": appTsx({ dentro: ["PxPage", "ArbPage"] }),
    "src/pages/PxPage.tsx":
      'export function PxPage() {\n  return <div className="px-4 space-y-6">ok</div>;\n}\n',
    "src/pages/ArbPage.tsx":
      'export function ArbPage() {\n  return <div className="p-[18px]">ok</div>;\n}\n',
  });

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /0 violacoes em 2 paginas/);
});

test("rota fora do bloco do AppLayout nao e auditada", () => {
  const result = runGuard({
    "src/App.tsx": appTsx({ dentro: ["InsidePage"], fora: ["PublicPage"] }),
    "src/pages/InsidePage.tsx":
      'export function InsidePage() {\n  return <div className="p-6">ok</div>;\n}\n',
    // Pagina publica legitimamente usa min-h-screen e rola sozinha.
    "src/pages/PublicPage.tsx":
      'export function PublicPage() {\n  return <div className="min-h-screen overflow-y-auto">ok</div>;\n}\n',
  });

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /0 violacoes em 1 paginas/);
});

test("pagina no formato `export default Nome;` continua auditavel", () => {
  const result = runGuard({
    "src/App.tsx": appTsx({ dentro: ["DefaultPage"] }),
    "src/pages/DefaultPage.tsx":
      'function DefaultPage() {\n  return <div className="space-y-6">erro</div>;\n}\n\nexport default DefaultPage;\n',
  });

  assert.equal(result.status, 1, result.output);
  assert.doesNotMatch(result.output, /NAO AUDITAVEL/);
  assert.match(result.output, /VIOLATION \[raiz sem gutter horizontal\]/);
});

test("falha alto quando o App.tsx nao tem bloco do AppLayout", () => {
  const result = runGuard({
    "src/App.tsx": "const App = () => <Routes />;\n",
  });

  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /bloco <Route element=\{<AppLayout \/>\}> nao encontrado/);
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const SCRIPT = fileURLToPath(new URL('./check-screen-permission-db-guards.mjs', import.meta.url));
const ROOT = path.resolve(path.dirname(SCRIPT), '../..');

// Front de mentira: cada regra do extrator aparece UMA vez, e as armadilhas
// (papel ARIA, papel de mensagem de chatbot, permissao que so existe em teste da
// tela) aparecem de proposito para provar que NAO entram na tabela.
const FRONT = {
  'components/auth/Gate.tsx': [
    'export function Gate() {',
    '  return (',
    '    <ProtectedRoute requiredPermission="orders.delete"><X /></ProtectedRoute>',
    '  );',
    '}',
    'export const SoAdmin = () => <ProtectedRoute requiredRole="admin"><X /></ProtectedRoute>;',
  ].join('\n'),
  'pages/SecurityPage.tsx': [
    '<PermissionGate permission="security.manage" showLocked>',
    '<PermissionGate role="manager">',
    '<div role="alert">nao e papel RBAC, e ARIA</div>',
  ].join('\n'),
  'hooks/usePermissoesDaTela.ts': [
    "const podeVer = hasPermission('orders.view');",
    "const ehOperador = hasRole('operator');",
    "const mensagem = { role: 'assistant', content: 'nao e papel RBAC' };",
  ].join('\n'),
  'components/layout/sidebar-config.ts': [
    "export const itens = [{ id: 'roles', path: '/roles', requiredRole: 'viewer' }];",
  ].join('\n'),
  'hooks/__tests__/usePermissions.test.tsx': [
    "expect(result.current.hasPermission('permissao_de_teste')).toBe(true);",
  ].join('\n'),
};

const MIGRATIONS = {
  '20260101000000_trava_orders_delete.sql': [
    '-- comentario cita has_permission() e NAO pode virar trava',
    'DO $$ BEGIN',
    "  IF public.has_permission(auth.uid(), 'orders.delete') IS NOT TRUE THEN",
    "    RAISE EXCEPTION 'orders_delete_permission_required';",
    '  END IF;',
    'END $$;',
  ].join('\n'),
  '20260102000000_trava_papel.sql': [
    'CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)',
    'RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT true $$;',
    "ALTER POLICY p ON public.user_roles USING (public.has_role(auth.uid(), 'admin'));",
    "ALTER POLICY q ON public.alerts USING (public.has_role(auth.uid(), 'operator'::app_role));",
  ].join('\n'),
};

function escrever(raiz, arquivos) {
  for (const [relativo, conteudo] of Object.entries(arquivos)) {
    const completo = path.join(raiz, relativo);
    fs.mkdirSync(path.dirname(completo), { recursive: true });
    fs.writeFileSync(completo, conteudo + '\n');
  }
}

function fixture(front = FRONT, migrations = MIGRATIONS) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'permission-guards-test-'));
  const frontDir = path.join(tmp, 'src');
  const migrationsDir = path.join(tmp, 'supabase', 'migrations');
  escrever(frontDir, front);
  escrever(migrationsDir, migrations);
  return { tmp, frontDir, migrationsDir };
}

function executar(frontDir, migrationsDir, extra = []) {
  return spawnSync(process.execPath, [SCRIPT, frontDir, migrationsDir, ...extra], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function linhaDe(saida, tipo, nome) {
  return saida.split('\n').find((linha) => linha.startsWith('| ' + tipo + ' | ' + nome + ' |')) || '';
}

test('cruza permissao e papel da tela com a trava no banco e marca TRAVADA / SEM TRAVA', () => {
  const { frontDir, migrationsDir } = fixture();
  const r = executar(frontDir, migrationsDir);
  assert.equal(r.status, 0, r.stderr);
  // cada regra de leitura do front chega na tabela
  assert.match(linhaDe(r.stdout, 'permissao', 'orders.delete'), /Gate\.tsx:3/);
  assert.match(linhaDe(r.stdout, 'papel', 'admin'), /Gate\.tsx:6/);
  assert.match(linhaDe(r.stdout, 'permissao', 'security.manage'), /SecurityPage\.tsx:1/);
  assert.match(linhaDe(r.stdout, 'papel', 'manager'), /SecurityPage\.tsx:2/);
  assert.match(linhaDe(r.stdout, 'permissao', 'orders.view'), /usePermissoesDaTela\.ts:1/);
  assert.match(linhaDe(r.stdout, 'papel', 'operator'), /usePermissoesDaTela\.ts:2/);
  assert.match(linhaDe(r.stdout, 'papel', 'viewer'), /sidebar-config\.ts:1/);
  // e o estado de cada um
  assert.match(linhaDe(r.stdout, 'permissao', 'orders.delete'), /TRAVADA/);
  assert.match(linhaDe(r.stdout, 'permissao', 'orders.delete'), /20260101000000_trava_orders_delete\.sql:3/);
  assert.match(linhaDe(r.stdout, 'papel', 'admin'), /TRAVADA/);
  assert.match(linhaDe(r.stdout, 'papel', 'operator'), /TRAVADA/);
  assert.match(linhaDe(r.stdout, 'permissao', 'security.manage'), /SEM TRAVA/);
  assert.match(linhaDe(r.stdout, 'papel', 'manager'), /SEM TRAVA/);
  // a definicao de has_role (sem literal) e a linha de comentario nao viram trava
  assert.doesNotMatch(r.stdout, /\|\s*(UUID|TEXT|app_role)\s*\|/);
});

test('ignora papel ARIA, papel de mensagem e permissao que so aparece em teste da tela', () => {
  const { frontDir, migrationsDir } = fixture();
  const r = executar(frontDir, migrationsDir);
  assert.equal(r.status, 0, r.stderr);
  // role="alert" e role: 'assistant' nao estao no enum app_role
  assert.equal(linhaDe(r.stdout, 'papel', 'alert'), '');
  assert.equal(linhaDe(r.stdout, 'papel', 'assistant'), '');
  // arquivo em __tests__/ fica fora do scan
  assert.doesNotMatch(r.stdout, /permissao_de_teste/);
});

test('declara o vocabulario de papeis lido do enum app_role', () => {
  const { frontDir, migrationsDir } = fixture();
  const r = executar(frontDir, migrationsDir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Papeis do enum app_role: admin, manager, operator, viewer/);
});

test('resume a contagem e lista a trava do banco que a tela ainda nao usa', () => {
  const { frontDir, migrationsDir } = fixture();
  const r = executar(frontDir, migrationsDir);
  assert.equal(r.status, 0, r.stderr);
  // 7 nomes: 3 permissoes + 4 papeis; 3 com trava (orders.delete, admin, operator)
  assert.match(r.stdout, /Resumo: 7 nome\[s\] usado\[s\] pela tela; 3 com trava no banco; 4 SEM TRAVA/);
});

test('--exigir-trava falha quando ha nome da tela sem trava no banco', () => {
  const { frontDir, migrationsDir } = fixture();
  const r = executar(frontDir, migrationsDir, ['--exigir-trava']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /SEM TRAVA/);
  assert.match(r.stderr, /FALHA: 4 nome\[s\] da tela sem trava no banco/);
});

test('--exigir-trava passa quando todo nome da tela tem trava no banco', () => {
  const frontTravado = {
    'components/auth/Gate.tsx': '<ProtectedRoute requiredPermission="orders.delete"><X /></ProtectedRoute>',
  };
  const { frontDir, migrationsDir } = fixture(frontTravado, MIGRATIONS);
  const r = executar(frontDir, migrationsDir, ['--exigir-trava']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /\| permissao \| orders\.delete \|/);
  assert.match(r.stdout, /0 SEM TRAVA/);
});

test('entrada invalida: diretorio do front inexistente encerra com 2', () => {
  const { tmp, migrationsDir } = fixture();
  const r = executar(path.join(tmp, 'nao-existe'), migrationsDir);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /diretorio inexistente/);
});

test('recusa caminho fora das raizes permitidas (fora do repositorio e do temporario)', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '/etc', '/etc'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /fora das raizes permitidas/);
});

test('o repositorio real: toda permissao SEM TRAVA esta no conjunto ja registrado', () => {
  // ACHADO REGISTRADO (nao e divida do porte): estas tres permissoes nomeadas
  // escondem acao na tela (PermissionGate) e NENHUMA migration chama
  // has_permission(..., '<nome>'). Esconder botao nao bloqueia a acao: quem
  // chamar a tabela/RPC direto passa. Corrigir e' decisao do dono (policy/RPC
  // com has_permission, ou trocar o gate por papel). O teste trava o conjunto:
  // se aparecer UMA permissao sem trava nova, ele falha.
  const SEM_TRAVA_CONHECIDAS = ['permissao security.manage', 'permissao security.view', 'permissao users.roles'];
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const resumo = r.stdout.split('\n').find((linha) => linha.startsWith('Resumo: '));
  assert.ok(resumo, 'linha de resumo ausente');
  const lista = /SEM TRAVA \(([^)]*)\)/.exec(resumo);
  assert.deepEqual(lista ? lista[1].split(', ') : [], SEM_TRAVA_CONHECIDAS);
});

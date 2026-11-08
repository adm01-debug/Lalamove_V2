// Teste do gerador de contexto (scripts/ai-context/gerar.mjs).
// Monta um repositório sintético com a mesma forma do Lalamove V2 — rotas React Router em
// src/App.tsx com ProtectedRoute (requiredRole/requireMFA/requiredPermission), menu em
// src/components/layout/sidebar-config.ts (categorias + requiredRole escalar), hooks,
// edge functions Deno com supabase/config.toml, migrations em ordem, types.ts, workflow,
// scripts e e2e — e confere a saída em docs/contexto/codigo/.
// Rodar: node --test scripts/ai-context/gerar.unit.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const GERADOR = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'gerar.mjs');
const OUT_DIR = 'docs/contexto/codigo';
const w = (root, rel, text) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-lalamove-'));
  w(root, 'package.json', JSON.stringify({
    name: 'lalamove-fixture', private: true, version: '0.0.0', type: 'module',
    scripts: { dev: 'vite', lint: 'eslint .', 'test:e2e': 'playwright test', seed: 'tsx scripts/seed-database.ts' },
    dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1', 'react-router-dom': '^6.30.1', '@supabase/supabase-js': '^2.58.0', '@tanstack/react-query': '^5.83.0', 'mapbox-gl': '^3.0.0', zod: '^3.25.0', i18next: '^25.0.0' },
    devDependencies: { vitest: '^3.2.4', '@playwright/test': '^1.56.0', typescript: '^5.8.3', vite: '^5.4.19', tailwindcss: '^3.4.17' },
  }));
  w(root, 'tsconfig.json', JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } }, files: [] }));
  w(root, 'tsconfig.app.json', JSON.stringify({ compilerOptions: { strict: true, noImplicitAny: true } }));
  w(root, 'components.json', '{}');
  w(root, '.env.example', [
    '# Supabase', 'VITE_SUPABASE_URL=https://ref-do-fixture.exemplo', 'VITE_SUPABASE_PUBLISHABLE_KEY=valor-que-nao-pode-vazar',
    '', '# Lalamove (via Supabase Secrets)', '# LALAMOVE_API_KEY=xxx', '# LALAMOVE_API_SECRET=xxx',
    '', '# Mapbox (via Supabase Secrets)', '# MAPBOX_ACCESS_TOKEN=xxx', '',
  ].join('\n'));
  w(root, 'README.md', '# Fixture Lalamove\n');

  // --- front: rotas, layout, guard, menu ---
  w(root, 'src/main.tsx', `import { QueryClientProvider } from '@tanstack/react-query';\nimport App from './App';\nexport const Root = () => <QueryClientProvider><App/></QueryClientProvider>;`);
  w(root, 'src/App.tsx', `import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
const AuthPage = lazy(() => import('./pages/AuthPage').then(m => ({ default: m.AuthPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const OrdersPage = lazy(() => import('./pages/OrdersPage').then(m => ({ default: m.OrdersPage })));
const WebhooksPage = lazy(() => import('./pages/WebhooksPage'));
const RolesPage = lazy(() => import('./pages/RolesPage'));
const NotFound = lazy(() => import('./pages/NotFound'));
const SuspenseWrapper = ({ children }) => <Suspense fallback={null}>{children}</Suspense>;
export const AppContent = () => (
  <Routes>
    <Route path="/auth" element={<SuspenseWrapper><AuthPage /></SuspenseWrapper>} />
    <Route element={<AppLayout />}>
      <Route path="/" element={<SuspenseWrapper><DashboardPage /></SuspenseWrapper>} />
      <Route path="/orders" element={<ProtectedRoute requiredRole="operator"><SuspenseWrapper><OrdersPage /></SuspenseWrapper></ProtectedRoute>} />
      <Route path="/webhooks" element={<ProtectedRoute requiredRole="manager" requireMFA><SuspenseWrapper><WebhooksPage /></SuspenseWrapper></ProtectedRoute>} />
      <Route path="/roles" element={<ProtectedRoute requiredRole="admin"><SuspenseWrapper><RolesPage /></SuspenseWrapper></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute requiredPermission="settings.write"><SuspenseWrapper><RolesPage /></SuspenseWrapper></ProtectedRoute>}>
        <Route path="uapi" element={<SuspenseWrapper><WebhooksPage /></SuspenseWrapper>} />
      </Route>
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
);
export default AppContent;`);
  w(root, 'src/components/auth/ProtectedRoute.tsx', `import { useAuth } from '@/hooks/useAuth';
const roleHierarchy: Record<string, number> = { viewer: 1, operator: 2, manager: 3, admin: 4 };
export function ProtectedRoute({ children, requiredRole, requireMFA = false }) {
  const { role } = useAuth();
  if (requiredRole && roleHierarchy[role] < roleHierarchy[requiredRole]) return <div>sem acesso</div>;
  return <>{children}</>;
}`);
  w(root, 'src/components/layout/AppLayout.tsx', `import { Outlet } from 'react-router-dom';\nexport const AppLayout = () => <div><Outlet/></div>;`);
  w(root, 'src/components/layout/sidebar-config.ts', `import { Home, Package, Lock, Users, Webhook } from 'lucide-react';
export const menuCategories = [
  {
    id: 'main', label: 'Principal', icon: Home, defaultOpen: true,
    items: [
      { id: 'dashboard', path: '/', label: 'Dashboard', icon: Home },
      { id: 'orders', path: '/orders', label: 'Pedidos', icon: Package, badgeType: 'approvals' },
      { id: 'ghost', path: '/nada', label: 'Fantasma', icon: Home },
    ]
  },
  {
    id: 'security', label: 'Segurança', icon: Lock, requiredRole: 'admin',
    items: [
      { id: 'roles', path: '/roles', label: 'Roles', icon: Users, requiredRole: 'admin' },
      { id: 'webhooks', path: '/webhooks', label: 'Webhooks', icon: Webhook },
    ]
  },
];
export const roleHierarchy: Record<string, number> = { admin: 4, manager: 3, operator: 2, viewer: 1 };`);
  w(root, 'src/components/layout/MobileBottomNav.tsx', `const navItems = [{ id: 'home', label: 'Início', path: '/' }, { id: 'orders', label: 'Pedidos', path: '/orders' }, { id: 'more', label: 'Mais', path: '#more' }];
export const MobileBottomNav = () => <nav>{navItems.length}</nav>;`);

  // --- páginas / hooks / lógica ---
  w(root, 'src/pages/AuthPage.tsx', `export const AuthPage = () => <form/>;`);
  w(root, 'src/pages/DashboardPage.tsx', `import { useOrders } from '@/hooks/useOrders';\nexport const DashboardPage = () => { useOrders(); return <section/>; };`);
  w(root, 'src/pages/OrdersPage.tsx', `import { useOrders } from '@/hooks/useOrders';\nimport { Card } from '@/components/ui';\nexport const OrdersPage = () => { useOrders(); return <Card/>; };`);
  w(root, 'src/pages/WebhooksPage.tsx', `export default function WebhooksPage() { return <div/>; }`);
  w(root, 'src/pages/RolesPage.tsx', `export default function RolesPage() { const role = 'admin'; return <div>{role}</div>; }`);
  w(root, 'src/pages/NotFound.tsx', `export default function NotFound() { return <p/>; }`);
  w(root, 'src/components/ui/index.ts', `export { Card } from './Card';\nexport * from './Badge';`);
  w(root, 'src/components/ui/Card.tsx', `export const Card = () => <div/>;`);
  w(root, 'src/components/ui/Badge.tsx', `export const Badge = () => <span/>;`);
  w(root, 'src/components/ui/SemUso.tsx', `export const SemUso = () => <i/>;`);
  w(root, 'src/hooks/useAuth.tsx', `export const useAuth = () => ({ role: 'admin' });`);
  w(root, 'src/hooks/useOrders.ts', `import { supabase } from '@/integrations/supabase/client';
export function useOrders() {
  supabase.from('lalamove_orders').select('*');
  supabase.rpc('get_order_stats');
  supabase.rpc('rpc_inexistente');
  supabase.functions.invoke('lalamove-api', { body: {} });
  supabase.channel('orders-realtime');
  return [];
}`);
  w(root, 'src/hooks/__tests__/useOrders.test.ts', `import { useOrders } from '../useOrders';\nit('lista', () => {});\ntest('invoca', () => {});`);
  w(root, 'src/integrations/supabase/client.ts', `import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
export const versao = import.meta.env.VITE_APP_VERSION;
const novaTela = isFeatureEnabled('nova-cotacao');`);
  w(root, 'src/integrations/supabase/types.ts', `export type Database = {
  public: {
    Tables: {
      lalamove_orders: {
        Row: {
          id: string
          order_ref: string
          status: string | null
          driver_id: string | null
          extra_col: string
        }
        Insert: { id?: string }
      }
    }
  }
}`);

  // --- edge functions ---
  w(root, 'supabase/config.toml', `project_id = "fixture"\n\n[functions.lalamove-webhook]\nverify_jwt = false\n\n[functions.lalamove-api]\nverify_jwt = true\n`);
  w(root, 'supabase/functions/_shared/logger.ts', `export const log = (m: string) => console.log(m);`);
  w(root, 'supabase/functions/lalamove-api/index.ts', `import { log } from '../_shared/logger.ts';
const apiKey = Deno.env.get('LALAMOVE_API_KEY');
const apiSecret = Deno.env.get('LALAMOVE_API_SECRET');
const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('no', { status: 405 });
  const assinatura = await crypto.subtle.sign('HMAC', apiSecret, apiKey);
  await supabase.from('lalamove_orders').insert({});
  await fetch('https://rest.sandbox.lalamove.com/v3/quotations');
  log('ok');
  return new Response('ok');
});`);
  w(root, 'supabase/functions/lalamove-webhook/index.ts', `Deno.serve(async (req) => { await supabase.from('webhook_events').insert({}); return new Response('ok'); });`);
  w(root, 'supabase/functions/rotate-tokens/index.ts', `Deno.serve(() => new Response('x'));`);
  w(root, 'supabase/functions/lalamove-api/index.test.ts', `Deno.test('contrato', () => {});`);

  // --- migrations em ordem ---
  w(root, 'supabase/migrations/20260101000000_init.sql', `create table public.lalamove_orders (
  id uuid primary key default gen_random_uuid(),
  order_ref text not null,
  status text,
  total numeric(10,2),
  created_at timestamptz default now()
);
alter table public.lalamove_orders enable row level security;
create policy "orders_select" on public.lalamove_orders for select to authenticated using (true);
create index lalamove_orders_status_idx on public.lalamove_orders (status);
create table public.webhook_events (id uuid primary key, order_id uuid references public.lalamove_orders(id));
create table public.legacy_quotes (id int);
create or replace function public.get_order_stats() returns json language sql as $$ select '{}'::json; $$;
create type public.app_role as enum ('viewer', 'operator', 'manager', 'admin');
create extension if not exists pg_cron;
insert into storage.buckets (id, name, public) values ('pods', 'pods', false) on conflict do nothing;
select cron.schedule('refresh-lalamove-token', '*/30 * * * *', $$ select net.http_post('https://fixture.supabase.co/functions/v1/lalamove-api') $$);`);
  w(root, 'supabase/migrations/20260102000000_evolve.sql', `alter table public.lalamove_orders add column driver_id uuid, drop column total;
drop policy if exists "orders_select" on public.lalamove_orders;
create policy "orders_select" on public.lalamove_orders for select to authenticated using (auth.uid() = driver_id);
drop table public.legacy_quotes;
create table public.tracking_events (id bigint, order_id uuid) partition by range (id);
create table public.tracking_events_2026_01 partition of public.tracking_events for values from (1) to (100);
create trigger trg_orders after insert on public.lalamove_orders for each row execute function public.get_order_stats();
do $$ begin
  create policy "orders_update" on public.lalamove_orders for update to service_role using (true);
  execute format('create policy %I on public.webhook_events for select using (true)', 'dyn');
end $$;`);
  w(root, 'supabase/migrations/_superseded/000_antigo.sql', `create table public.tabela_arquivada (id int);`);

  // --- e2e, scripts, CI ---
  w(root, 'e2e/rbac.e2e.ts', `import { test } from '@playwright/test';\ntest('viewer não abre /roles', async () => {});`);
  w(root, 'scripts/seed-database.ts', `// Popula o banco de desenvolvimento com pedidos de exemplo.\nconsole.log(process.env.SUPABASE_DB_URL);`);
  w(root, 'scripts/orfao.sh', `#!/bin/sh\necho nada\n`);
  w(root, 'scripts/ci/commit-msg-lint.mjs', `const TIPOS = ['feat', 'fix', 'docs', 'chore', 'ci'];\nexport default TIPOS;`);
  w(root, 'scripts/ci/commit-msg-lint.unit.mjs', `import { test } from 'node:test';\ntest('tipos', () => {});`);
  w(root, 'src/pages/MapToolsPage.tsx', `import { Route } from 'lucide-react';\nexport default function MapToolsPage() { return <div><Route className="w-4 h-4" /> Rotas</div>; }`);
  w(root, '.github/workflows/ci.yml', `name: CI
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - run: npm ci
      - run: npm run lint
      - run: node scripts/seed-database.ts
        env:
          T: \${{ secrets.DB_TOKEN }}
`);
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A'], { cwd: root });
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'feat(fixture): repositorio sintetico'], { cwd: root });
  return root;
}

const root = fixture();
const out = path.join(root, OUT_DIR);
execFileSync(process.execPath, [GERADOR, '--quiet'], { cwd: root });
const J = (f) => JSON.parse(fs.readFileSync(path.join(out, f), 'utf8'));

test('escreve todos os arquivos em docs/contexto/codigo e sem erros de seção', () => {
  for (const f of ['INDEX.md', 'manifest.json', 'rotas.json', 'modulos.json', 'componentes.json', 'hooks.json', 'edge-functions.json',
    'banco.json', 'rbac.json', 'ferramentas.json', 'scripts.json', 'testes.json', 'logica.json', 'grafo.json', 'grafo-arestas.json',
    'convencoes.json', 'grafo-graphify.json', 'baseline.json']) assert.ok(fs.existsSync(path.join(out, f)), f);
  const m = J('manifest.json');
  assert.deepEqual(m.erros, []);
  assert.deepEqual(J('baseline.json').erros_do_gerador, []);
  assert.equal(m.commit.length, 40);
  for (const f of Object.keys(m.arquivos)) assert.ok(fs.existsSync(path.join(out, f)), f);
  const idx = fs.readFileSync(path.join(out, 'INDEX.md'), 'utf8');
  for (const f of Object.keys(m.arquivos)) if (f !== 'INDEX.md') assert.ok(idx.includes(f), 'INDEX.md cita ' + f);
});

test('rotas: lazy, layout sem path, RBAC do ProtectedRoute e herança pela rota pai', () => {
  const r = J('rotas.json'); const by = Object.fromEntries(r.urls.map((u) => [u.caminho, u]));
  assert.equal(by['/auth'].arquivo, 'src/pages/AuthPage.tsx');
  assert.equal(by['/auth'].protegida, false, 'AuthPage não é guard');
  assert.equal(by['/auth'].lazy, true);
  assert.equal(by['/'].arquivo, 'src/pages/DashboardPage.tsx');
  assert.equal(by['/'].protegida, false, 'AppLayout não protege');
  assert.equal(by['/orders'].papel_requerido, 'operator');
  assert.equal(by['/orders'].protegida, true);
  assert.equal(by['/webhooks'].papel_requerido, 'manager');
  assert.equal(by['/webhooks'].requer_mfa, true);
  assert.equal(by['/roles'].papel_requerido, 'admin');
  assert.equal(by['/roles'].requer_mfa, false);
  assert.equal(by['/settings'].permissao_requerida, 'settings.write');
  assert.equal(by['/settings/uapi'].pai, '/settings');
  assert.equal(by['/settings/uapi'].protegida, true, 'filha herda proteção do Route pai');
  assert.equal(by['/settings/uapi'].permissao_requerida, 'settings.write', 'filha herda requiredPermission');
  assert.deepEqual(r.layouts.map((l) => l.componente), ['AppLayout']);
  assert.deepEqual(by['/orders'].tabelas, ['lalamove_orders']);
  assert.deepEqual(by['/orders'].edges, ['lalamove-api']);
  assert.deepEqual(by['/orders'].hooks_locais, ['useOrders']);
  assert.deepEqual(by['/orders'].canais_realtime, ['orders-realtime']);
});

test('menu: grupo, requiredRole escalar do item e herdado da categoria, badge e item sem rota', () => {
  const r = J('rotas.json'); const m = Object.fromEntries(r.menu.map((x) => [x.rotulo, x]));
  assert.equal(m.Pedidos.grupo, 'Principal');
  assert.equal(m.Pedidos.badge, 'approvals');
  assert.equal(m.Pedidos.resolve_para, 'src/pages/OrdersPage.tsx');
  assert.equal(m.Pedidos.papel_efetivo, null, 'item do grupo Principal não restringe papel');
  assert.deepEqual(m.Roles.papeis, ['admin']);
  assert.equal(m.Roles.papel_efetivo, 'admin');
  assert.equal(m.Webhooks.papel_do_grupo, 'admin', 'requiredRole da categoria Segurança');
  assert.equal(m.Webhooks.papel_efetivo, 'admin');
  assert.deepEqual(J('baseline.json').alertas.menu_sem_destino, ['Fantasma -> /nada']);
  assert.equal(m.Mais.destino, '#more');
  assert.ok(!J('baseline.json').alertas.menu_sem_destino.some((x) => x.includes('#more')), 'âncora não é alerta de rota faltando');
});

test('rbac: rotas por papel, MFA, permissão e divergência menu × ProtectedRoute', () => {
  const rb = J('rbac.json');
  assert.deepEqual(rb.hierarquia_de_papeis, { admin: 4, manager: 3, operator: 2, viewer: 1 });
  assert.deepEqual(rb.guards, ['src/components/auth/ProtectedRoute.tsx']);
  assert.deepEqual(rb.rotas_com_mfa, ['/webhooks']);
  assert.deepEqual(rb.rotas_com_permissao, ['/settings (settings.write)', '/settings/uapi (settings.write)']);
  assert.deepEqual(rb.rotas_por_papel.admin, ['/roles']);
  assert.deepEqual(rb.rotas_por_papel.operator, ['/orders']);
  assert.deepEqual(rb.rotas_por_papel['(só autenticado)'], ['/settings', '/settings/uapi']);
  assert.deepEqual(rb.enums_de_papel_no_banco, [{ enum: 'app_role', valores: ['viewer', 'operator', 'manager', 'admin'] }]);
  assert.ok(rb.rpcs_de_autorizacao.length === 0 || Array.isArray(rb.rpcs_de_autorizacao));
  assert.deepEqual(rb.menu_visivel_sem_acesso, ['Pedidos -> /orders (menu: todos; rota: operator)']);
  assert.deepEqual(rb.menu_mais_restrito_que_a_rota, ['Webhooks -> /webhooks (menu: admin; rota: manager)']);
  assert.deepEqual(J('baseline.json').alertas.rotas_sem_protecao, ['/'], 'catch-all e páginas de auth não contam');
});

test('módulos: menu → módulo → hooks → edges → tabelas', () => {
  const mods = Object.fromEntries(J('modulos.json').modulos.map((m) => [m.modulo, m]));
  assert.deepEqual(mods.pages.itens_menu.sort(), ['Dashboard', 'Início', 'Pedidos', 'Roles', 'Webhooks'], 'inclui item do MobileBottomNav que aponta para /');
  assert.deepEqual(mods.pages.edges, ['lalamove-api']);
  assert.deepEqual(mods.pages.tabelas, ['lalamove_orders']);
  assert.deepEqual(mods.pages.hooks_locais, ['useOrders']);
  assert.deepEqual(mods.pages.papeis_das_telas.sort(), ['admin', 'manager', 'operator']);
  assert.deepEqual(mods.hooks.hooks_definidos.sort(), ['useAuth', 'useOrders']);
  assert.ok(mods.pages.depende_de_modulos.includes('components/ui'));
});

test('componentes: barrel não gera órfão; sem uso é órfão; página não é órfã', () => {
  const by = Object.fromEntries(J('componentes.json').componentes.map((x) => [x.arquivo, x]));
  assert.equal(by['src/components/ui/Card.tsx'].orfao, false, 'reexportado pelo index.ts');
  assert.equal(by['src/components/ui/Badge.tsx'].orfao, false, 'export * from');
  assert.equal(by['src/components/ui/SemUso.tsx'].orfao, true);
  assert.equal(by['src/pages/WebhooksPage.tsx'].export_default, 'WebhooksPage');
  assert.equal(by['src/pages/NotFound.tsx'].orfao, false, 'src/pages/ nunca é órfão');
});

test('hooks e testes: tabelas/edges, cobertura e tipos de teste', () => {
  const h = J('hooks.json').hooks.find((x) => x.arquivo === 'src/hooks/useOrders.ts');
  assert.deepEqual(h.hooks_exportados, ['useOrders']);
  assert.deepEqual(h.tabelas, ['lalamove_orders']);
  assert.equal(h.usado_por, 2);
  assert.equal(h.coberto_por_testes, 1);
  const t = J('testes.json');
  assert.deepEqual(t.por_tipo, { 'e2e (playwright)': 1, 'edge (deno)': 1, 'guard (node --test)': 1, 'unit (vitest)': 1 });
  assert.equal(t.arquivos.find((x) => x.arquivo === 'src/hooks/__tests__/useOrders.test.ts').casos, 2);
  assert.ok(t.comandos.unit.includes('vitest run'));
  assert.ok(t.sem_teste.edges.includes('rotate-tokens'));
});

test('edge functions: verify_jwt, serviço, HMAC, service_role, chamadores, cron e órfãs', () => {
  const e = J('edge-functions.json'); const by = Object.fromEntries(e.edges.map((x) => [x.nome, x]));
  assert.equal(by['lalamove-api'].servico, 'Lalamove API v3');
  assert.equal(by['lalamove-api'].verify_jwt, true);
  assert.equal(by['lalamove-api'].assina_hmac, true);
  assert.equal(by['lalamove-api'].usa_service_role, true);
  assert.deepEqual(by['lalamove-api'].env, ['LALAMOVE_API_KEY', 'LALAMOVE_API_SECRET', 'SUPABASE_SERVICE_ROLE_KEY']);
  assert.deepEqual(by['lalamove-api'].metodos, ['POST']);
  assert.deepEqual(by['lalamove-api'].usa_shared, ['logger.ts']);
  assert.deepEqual(by['lalamove-api'].hosts_externos, ['rest.sandbox.lalamove.com']);
  assert.deepEqual(by['lalamove-api'].chamada_pelo_front, ['src/hooks/useOrders.ts']);
  assert.equal(by['lalamove-api'].chamada_por_sql_ou_cron, true, 'cron aponta para /functions/v1/lalamove-api');
  assert.equal(by['lalamove-api'].testes, 1);
  assert.equal(by['lalamove-webhook'].verify_jwt, false);
  assert.equal(by['lalamove-webhook'].orfa, false, 'webhook sem jwt não é órfã');
  assert.equal(by['rotate-tokens'].orfa, true);
  assert.equal(by['rotate-tokens'].servico, 'Segredos/token');
  assert.deepEqual(e.shared, ['supabase/functions/_shared/logger.ts']);
  assert.deepEqual(J('baseline.json').alertas.edges_sem_verify_jwt, ['lalamove-webhook']);
});

test('banco: migrations em ordem, policy dentro de DO $$, partição, cron, bucket e drift', () => {
  const b = J('banco.json'); const t = b.tabelas.lalamove_orders;
  assert.equal(b.migrations, 2, '_superseded fica fora');
  assert.equal(b.tabelas.tabela_arquivada, undefined);
  assert.deepEqual(Object.keys(t.colunas), ['created_at', 'driver_id', 'id', 'order_ref', 'status'], 'total removida, driver_id adicionada');
  assert.equal(t.colunas.order_ref.nn, true);
  assert.equal(t.rls, true);
  assert.deepEqual(t.policies.map((p) => `${p.nome}:${p.comando}:${p.para}`), ['orders_select:select:authenticated', 'orders_update:update:service_role']);
  assert.deepEqual(t.indices.map((i) => i.nome), ['lalamove_orders_status_idx']);
  assert.deepEqual(t.triggers, ['trg_orders']);
  assert.equal(b.tabelas.legacy_quotes, undefined, 'drop table');
  assert.deepEqual(b.tabelas.webhook_events.fks, ['order_id->lalamove_orders']);
  assert.equal(b.tabelas.tracking_events_2026_01.particao_de, 'tracking_events');
  assert.equal(b.tabelas.tracking_events_2026_01.sem_rls, false, 'partição não é alertada por RLS');
  assert.equal(b.tabelas.webhook_events.sem_rls, true);
  assert.deepEqual(b.funcoes, ['get_order_stats']);
  assert.deepEqual(b.enums.app_role, ['viewer', 'operator', 'manager', 'admin']);
  assert.deepEqual(b.extensoes, ['pg_cron']);
  assert.deepEqual(b.cron_jobs, [{ nome: 'refresh-lalamove-token', agenda: '*/30 * * * *', migration: '20260101000000_init.sql', chama_edge: 'lalamove-api' }]);
  assert.ok(b.buckets.some((x) => x.nome === 'pods' && x.criado_em_sql));
  assert.equal(b.avisos.length, 1, 'DDL dinâmico sinalizado');
  assert.deepEqual(t.drift, { so_na_migration: ['created_at'], so_no_types: ['extra_col'] });
  assert.deepEqual(b.rpcs_usadas_no_codigo, [{ nome: 'get_order_stats', definida: true, usada_em: 1 }, { nome: 'rpc_inexistente', definida: false, usada_em: 1 }]);
  assert.deepEqual(J('baseline.json').alertas.rpcs_sem_definicao, ['rpc_inexistente']);
});

test('ferramentas: env (só nomes), workflows, scripts, integrações e flags', () => {
  const f = J('ferramentas.json');
  assert.deepEqual(f.env.declaradas_no_env_example, ['VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_URL']);
  assert.deepEqual(f.env.comentadas_no_env_example, ['LALAMOVE_API_KEY', 'LALAMOVE_API_SECRET', 'MAPBOX_ACCESS_TOKEN']);
  assert.deepEqual(f.env.usadas_mas_nao_declaradas, ['VITE_APP_VERSION']);
  assert.ok(f.env.usadas_nas_edges.includes('LALAMOVE_API_SECRET'));
  assert.deepEqual(f.env.secrets_em_workflows, ['DB_TOKEN']);
  assert.equal(f.workflows[0].nome, 'CI');
  assert.deepEqual(f.workflows[0].gatilhos, ['pull_request', 'push']);
  assert.deepEqual(f.workflows[0].npm_scripts, ['lint']);
  assert.deepEqual(f.workflows[0].scripts_usados, ['scripts/seed-database.ts']);
  const s = Object.fromEntries(J('scripts.json').scripts.map((x) => [x.arquivo, x]));
  assert.equal(s['scripts/seed-database.ts'].descricao, 'Popula o banco de desenvolvimento com pedidos de exemplo.');
  assert.deepEqual(s['scripts/seed-database.ts'].npm_scripts, ['seed']);
  assert.equal(s['scripts/seed-database.ts'].solto_na_raiz_de_scripts, true);
  assert.equal(s['scripts/orfao.sh'].orfao, true);
  assert.equal(s['scripts/ci/commit-msg-lint.mjs'].solto_na_raiz_de_scripts, false);
  assert.ok(f.integracoes.sdks.some((x) => x.servico === 'Mapbox GL'));
  assert.ok(f.integracoes.servicos_por_edge.some((x) => x.servico === 'Lalamove API v3' && x.edges.includes('lalamove-api')));
  assert.deepEqual(f.integracoes.webhooks_recebidos, ['lalamove-webhook']);
  assert.ok(f.integracoes.env_de_integracao.includes('LALAMOVE_API_KEY'));
  assert.deepEqual(f.feature_flags.flags, [{ flag: 'nova-cotacao', arquivos: 1 }]);
  assert.equal(f.stack.framework, 'React');
  assert.ok(f.stack.gerenciador_pacotes.startsWith('npm') || f.stack.gerenciador_pacotes === 'não detectado');
  assert.ok(f.stack.banco.includes('fixture'));
});

test('grafo, convenções, graphify ausente e determinismo', () => {
  const g = J('grafo.json');
  assert.ok(g.nos > 0 && g.arestas > 0);
  assert.equal(g.ciclos.total, 0);
  assert.ok(g.hubs.some((h) => h.arquivo === 'src/hooks/useOrders.ts'));
  const c = J('convencoes.json');
  assert.equal(c.alias_imports['(raiz)']['@/'], 'src/');
  assert.equal(c.typescript.strict, true);
  assert.match(c.nomenclatura.componentes, /^PascalCase/);
  assert.deepEqual(c.onde_ficam.rotas, ['src/App.tsx'], 'MapToolsPage usa o ícone <Route> do lucide, não é arquivo de rotas');
  assert.deepEqual(c.onde_ficam.menu.sort(), ['src/components/layout/MobileBottomNav.tsx', 'src/components/layout/sidebar-config.ts']);
  assert.deepEqual(c.commits.tipos_aceitos, ['chore', 'ci', 'docs', 'feat', 'fix'], 'lidos de scripts/ci/commit-msg-lint.mjs, ordenados');
  // regra: sem graphify-out/ o gerador segue sem o grafo por AST
  const gg = J('grafo-graphify.json');
  assert.equal(gg.presente, false);
  assert.match(gg.como_gerar, /graph:setup/);
  assert.match(fs.readFileSync(path.join(out, 'INDEX.md'), 'utf8'), /não gerado neste run/);
  const antes = fs.readFileSync(path.join(out, 'rotas.json'), 'utf8');
  execFileSync(process.execPath, [GERADOR, '--quiet'], { cwd: root });
  assert.equal(fs.readFileSync(path.join(out, 'rotas.json'), 'utf8'), antes, 'saída determinística');
});

test('contexto gerado não contém valor de variável de ambiente nem segredo', () => {
  const todo = fs.readdirSync(out).map((f) => fs.readFileSync(path.join(out, f), 'utf8')).join('\n');
  assert.ok(!todo.includes('valor-que-nao-pode-vazar'), 'valor do .env.example não pode aparecer');
  assert.ok(!todo.includes('ref-do-fixture.exemplo'), 'URL do .env.example não pode aparecer');
  assert.ok(todo.includes('VITE_SUPABASE_PUBLISHABLE_KEY'), 'nome da env continua no inventário');
});

test('--out e ai-context.config.json redirecionam a saída', (t) => {
  const alt = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-out-'));
  t.after(() => fs.rmSync(alt, { recursive: true, force: true }));
  execFileSync(process.execPath, [GERADOR, '--quiet', '--out', path.join(alt, 'ctx')], { cwd: root });
  assert.ok(fs.existsSync(path.join(alt, 'ctx/manifest.json')));
  w(root, 'ai-context.config.json', JSON.stringify({ out: '.ctx-cfg', publicacao: 'Publicado à mão neste repo.' }));
  execFileSync(process.execPath, [GERADOR, '--quiet'], { cwd: root });
  assert.match(fs.readFileSync(path.join(root, '.ctx-cfg/INDEX.md'), 'utf8'), /Publicado à mão neste repo\./);
  fs.rmSync(path.join(root, 'ai-context.config.json'));
  fs.rmSync(path.join(root, '.ctx-cfg'), { recursive: true, force: true });
});

test('robustez: repo sem git, arquivos corrompidos e BOM/CRLF não quebram o gerador', (t) => {
  const r2 = fs.mkdtempSync(path.join(os.tmpdir(), 'ctx-rob-'));
  t.after(() => fs.rmSync(r2, { recursive: true, force: true }));
  w(r2, 'package.json', '{ "name": "quebrado", ');
  w(r2, 'tsconfig.json', '{\n  // comentario\n  "compilerOptions": { "paths": { "@/*": ["./src/*"] } }\n}');
  w(r2, 'src/a.ts', "import { b } from '@/b';\nexport const a = 1;");
  w(r2, 'src/b.ts', 'export const b = 1;');
  w(r2, 'src/pages/Ação Ü.tsx', '﻿export const Acao = () => <i/>;\r\n');
  w(r2, 'src/App.tsx', `import { Routes, Route } from 'react-router-dom';\nimport { Acao } from '@/pages/Ação Ü';\nexport const App = () => (<Routes><Route path="/ação" element={<Acao/>}/></Routes>);`);
  w(r2, 'supabase/migrations/1.sql', '﻿create table public.t (id int; alter tabl x; ))))(((( create policy');
  execFileSync(process.execPath, [GERADOR, '--quiet'], { cwd: r2 });
  const read = (f) => JSON.parse(fs.readFileSync(path.join(r2, OUT_DIR, f), 'utf8'));
  assert.deepEqual(read('manifest.json').erros, []);
  assert.equal(read('manifest.json').commit, null, 'sem git o commit é null');
  assert.deepEqual(read('grafo-arestas.json').arestas['src/a.ts'], ['src/b.ts'], 'alias @/ padrão quando o package.json falha');
  assert.equal(read('rotas.json').urls[0].arquivo, 'src/pages/Ação Ü.tsx');
});

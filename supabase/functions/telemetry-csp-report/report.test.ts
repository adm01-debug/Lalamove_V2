import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  blockedOrigin,
  createRateLimiter,
  documentPath,
  MAX_REPORTS,
  summarize,
} from './report.ts';

Deno.test('formato legado: extrai diretiva, host bloqueado e caminho', () => {
  const body = JSON.stringify({
    'csp-report': {
      'document-uri': 'https://painel.example/dashboard?token=segredo',
      'violated-directive': "script-src 'self'",
      'effective-directive': 'script-src-elem',
      'blocked-uri': 'https://cdn.invasor.example/x.js',
      disposition: 'report',
    },
  });

  assertEquals(summarize(body), [{
    directive: 'script-src-elem',
    disposition: 'report',
    blocked: 'cdn.invasor.example',
    document: '/dashboard',
  }]);
});

Deno.test('Reporting API: aceita lista e ignora outros tipos de relatório', () => {
  const body = JSON.stringify([
    { type: 'deprecation', body: { documentURL: 'https://a/ignorar' } },
    {
      type: 'csp-violation',
      body: {
        documentURL: 'https://painel.example/pedidos?x=1',
        effectiveDirective: 'connect-src',
        blockedURL: 'https://api.invasor.example/coleta',
        disposition: 'enforce',
      },
    },
  ]);

  const [first] = summarize(body);
  assertEquals(first.directive, 'connect-src');
  assertEquals(first.blocked, 'api.invasor.example');
  assertEquals(first.document, '/pedidos');
});

Deno.test('payload inválido não gera violação nem exceção', () => {
  assertEquals(summarize('nao e json'), []);
  assertEquals(summarize(JSON.stringify({ 'csp-report': {} })), []);
  assertEquals(summarize('42'), []);
});

Deno.test('documents e blocked sem host são normalizados sem vazar URL completa', () => {
  assertEquals(blockedOrigin('inline'), 'inline');
  assertEquals(blockedOrigin('data:text/html;base64,PHNjcmlwdD4='), 'data:');
  assertEquals(documentPath('https://painel.example/mapa?lat=-23.5&lng=-46.6'), '/mapa');
  assertEquals(documentPath('lixo'), '');
});

Deno.test('limite de relatos por requisição respeita MAX_REPORTS', () => {
  const body = JSON.stringify(
    Array.from({ length: 12 }, (_, i) => ({
      type: 'csp-violation',
      body: {
        documentURL: 'https://painel.example/x',
        effectiveDirective: 'img-src',
        blockedURL: `https://cdn${i}.example/a.png`,
      },
    })),
  );

  assertEquals(summarize(body).length, MAX_REPORTS);
});

Deno.test('rate limiter bloqueia acima do teto e libera após a janela', () => {
  const allow = createRateLimiter(2, 1000);
  assertEquals(allow('1.1.1.1', 0), true);
  assertEquals(allow('1.1.1.1', 1), true);
  assertEquals(allow('1.1.1.1', 2), false);
  assertEquals(allow('2.2.2.2', 3), true);
  assertEquals(allow('1.1.1.1', 1001), true);
});
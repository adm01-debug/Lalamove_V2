import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../html';

describe('escapeHtml', () => {
  it('escapa as 5 entidades de HTML', () => {
    expect(escapeHtml('<a href="x">&\'</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;',
    );
  });

  it('escapa cada símbolo individualmente', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
  });

  it('não altera strings sem caracteres especiais', () => {
    expect(escapeHtml('João Silva, Av. Paulista 1000')).toBe(
      'João Silva, Av. Paulista 1000',
    );
  });

  it('impede criação de elemento a partir de payload XSS', () => {
    const el = document.createElement('div');
    el.innerHTML = escapeHtml('<img src=x onerror=alert(1)>');
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { isBitrixConfigured, setBitrixConfigured } from './bitrix-config';

describe('isBitrixConfigured', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('libera o cadastro externo por padrão (nunca houve tela para gravar a flag)', () => {
    expect(isBitrixConfigured()).toBe(true);
  });

  it('respeita o desligamento explícito', () => {
    setBitrixConfigured(false);
    expect(isBitrixConfigured()).toBe(false);
  });

  it('volta a liberar quando religado', () => {
    setBitrixConfigured(false);
    setBitrixConfigured(true);
    expect(isBitrixConfigured()).toBe(true);
  });
});
import { describe, expect, it } from 'vitest';
import { statusColor, statusColorCss, STATUS_PALETTE } from '../statusPalette';

/**
 * O Mapbox GL usa `csscolorparser`, que só entende a sintaxe legada de cor.
 * `hsl(var(--x))` e `hsl(142 71% 31%)` fazem `addLayer` falhar com
 * "Could not parse color from value", derrubando a camada inteira — foi assim
 * que rota contratada, rastro e geofence ficaram invisíveis em produção.
 */
const MAPBOX_LEGACY_COLOR = /^hsla?\(\s*-?\d+(\.\d+)?\s*,\s*\d+(\.\d+)?%\s*,\s*\d+(\.\d+)?%\s*(,\s*[\d.]+)?\s*\)$/;

describe('statusColorCss', () => {
  it('emite hsl legado com vírgulas para o Mapbox', () => {
    for (const level of Object.keys(STATUS_PALETTE) as Array<keyof typeof STATUS_PALETTE>) {
      expect(statusColorCss(level)).toMatch(MAPBOX_LEGACY_COLOR);
    }
  });

  it('não emite var() — o Mapbox não resolve variáveis CSS', () => {
    for (const level of Object.keys(STATUS_PALETTE) as Array<keyof typeof STATUS_PALETTE>) {
      expect(statusColorCss(level)).not.toContain('var(');
    }
  });

  it('aplica alfa com hsla', () => {
    expect(statusColorCss('operational', 0.5)).toMatch(/^hsla\(.+,\s*0\.5\)$/);
  });

  it('mantém statusColor() com var() para uso em CSS/inline', () => {
    expect(statusColor('critical')).toBe('hsl(var(--destructive))');
  });
});

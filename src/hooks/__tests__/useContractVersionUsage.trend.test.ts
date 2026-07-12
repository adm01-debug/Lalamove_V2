import { describe, it, expect } from "vitest";
import {
  detectTrend,
  type ContractUsageDailyPoint,
} from "@/hooks/useContractVersionUsage";

/** Fábrica de pontos diários apenas com o campo relevante para a tendência. */
function pts(ratios: number[]): ContractUsageDailyPoint[] {
  return ratios.map((v1Ratio, i) => ({
    date: `2026-07-${String(i + 1).padStart(2, "0")}`,
    total: 100,
    v1: v1Ratio,
    v2: 100 - v1Ratio,
    v1Ratio,
  }));
}

describe("detectTrend — alerta de reversão de uso v1", () => {
  it("marca amostra insuficiente com menos de 4 pontos válidos", () => {
    for (const sample of [[], [5], [1, 2, 3]]) {
      const t = detectTrend(pts(sample));
      expect(t.insufficientData).toBe(true);
      expect(t.rising).toBe(false);
    }
  });

  it("não alerta quando a proporção está descendo", () => {
    const t = detectTrend(pts([20, 15, 10, 5, 2, 0.5]));
    expect(t.rising).toBe(false);
    expect(t.delta).toBeLessThan(0);
    expect(t.insufficientData).toBe(false);
  });

  it("não alerta quando a proporção é estável em zero", () => {
    const t = detectTrend(pts(Array.from({ length: 10 }, () => 0)));
    expect(t.rising).toBe(false);
    expect(t.delta).toBe(0);
  });

  it("alerta quando a proporção está subindo de forma sustentada", () => {
    const t = detectTrend(pts([1, 1, 2, 4, 7, 12]));
    expect(t.rising).toBe(true);
    expect(t.delta).toBeGreaterThan(0.5);
    expect(t.secondHalfAvg).toBeGreaterThan(t.firstHalfAvg);
  });

  it("alerta em pico recente mesmo com base historicamente baixa", () => {
    const t = detectTrend(pts([0, 0, 0, 0, 3, 9]));
    expect(t.rising).toBe(true);
  });

  it("é robusto a valores não finitos (NaN) na série", () => {
    const t = detectTrend(pts([NaN, 2, 3, NaN, 5, 8]));
    expect(t.insufficientData).toBe(false);
    expect(Number.isFinite(t.delta)).toBe(true);
    expect(t.rising).toBe(true);
  });
});

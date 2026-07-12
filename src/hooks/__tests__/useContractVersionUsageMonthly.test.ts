import { describe, it, expect } from "vitest";
import {
  aggregateMonthly,
  type MonthlyUsageRow,
} from "@/hooks/useContractVersionUsageMonthly";

/** Fábrica compacta de linhas mensais cruas. */
function row(
  usage_month: string,
  contract_version: string,
  request_count: number,
): MonthlyUsageRow {
  return { usage_month, contract_version, request_count };
}

describe("aggregateMonthly — consolidação da série mensal de versões", () => {
  it("retorna vazio para entrada vazia", () => {
    expect(aggregateMonthly([])).toEqual([]);
  });

  it("soma múltiplos contratos por mês e versão", () => {
    const out = aggregateMonthly([
      row("2026-01-01", "v1", 10),
      row("2026-01-01", "v1", 5),
      row("2026-01-01", "v2", 85),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].month).toBe("2026-01-01");
    expect(out[0].total).toBe(100);
    expect(out[0].byVersion).toEqual({ v1: 15, v2: 85 });
    expect(out[0].v1Ratio).toBe(15);
  });

  it("ordena os meses cronologicamente (ascendente)", () => {
    const out = aggregateMonthly([
      row("2026-03-01", "v2", 50),
      row("2026-01-01", "v2", 50),
      row("2026-02-01", "v2", 50),
    ]);
    expect(out.map((p) => p.month)).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
  });

  it("calcula proporção v1 arredondada a 1 casa decimal", () => {
    const out = aggregateMonthly([
      row("2026-01-01", "v1", 1),
      row("2026-01-01", "v2", 2),
    ]);
    // 1/3 = 33.33% -> 33.3
    expect(out[0].v1Ratio).toBe(33.3);
  });

  it("retorna proporção zero quando não há chamadas (total 0)", () => {
    const out = aggregateMonthly([row("2026-01-01", "v2", 0)]);
    expect(out[0].total).toBe(0);
    expect(out[0].v1Ratio).toBe(0);
  });

  it("é robusto a request_count não numérico", () => {
    const out = aggregateMonthly([
      { usage_month: "2026-01-01", contract_version: "v1", request_count: Number.NaN },
      row("2026-01-01", "v2", 10),
    ]);
    expect(out[0].total).toBe(10);
    expect(out[0].byVersion.v1).toBe(0);
    expect(out[0].v1Ratio).toBe(0);
  });
});

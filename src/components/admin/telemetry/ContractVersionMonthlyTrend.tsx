import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { CalendarRange } from "lucide-react";
import { useContractVersionUsageMonthly } from "@/hooks/useContractVersionUsageMonthly";

/** Formata `YYYY-MM-01` em rótulo curto (ex.: "jan/26"). */
function formatMonth(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
    month: "short",
    year: "2-digit",
  });
}

/**
 * Gráfico de tendência de longo prazo (série mensal agregada) da proporção de
 * chamadas em `v1`. Lê da tabela `contract_version_usage_monthly`, alimentada
 * pelo rollup mensal automático — permite visualizar a migração v1→v2 em
 * janelas muito maiores que a série diária (retida por 90 dias).
 */
export function ContractVersionMonthlyTrend() {
  const { data, isLoading, isError } = useContractVersionUsageMonthly(12);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarRange className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">
          Tendência de longo prazo — proporção mensal de v1 (12 meses)
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : isError ? (
        <p className="text-sm text-destructive">
          Não foi possível carregar a tendência de longo prazo.
        </p>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda não há dados mensais consolidados. A série é preenchida pelo
          rollup automático conforme os dados diários envelhecem (&gt; 90 dias).
        </p>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="v1MonthlyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonth}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis
                domain={[0, 100]}
                unit="%"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <Tooltip
                formatter={(value) => [`${value as number}%`, "Proporção v1"]}
                labelFormatter={(label) => formatMonth(String(label))}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  color: "hsl(var(--popover-foreground))",
                }}
              />
              <Area
                type="monotone"
                dataKey="v1Ratio"
                name="Proporção v1"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#v1MonthlyFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

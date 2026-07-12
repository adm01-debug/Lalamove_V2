import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { AlertTriangle, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import { useContractVersionUsage } from "@/hooks/useContractVersionUsage";
import { useContractV1SunsetReadiness } from "@/hooks/useContractV1SunsetReadiness";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS = [
  { label: "7 dias", value: 7 },
  { label: "30 dias", value: 30 },
  { label: "90 dias", value: 90 },
] as const;

/** Meta de proporção de v1 abaixo da qual a remoção é considerada segura. */
const SAFE_REMOVAL_THRESHOLD = 1; // %

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function ContractVersionUsagePanel() {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading, isError } = useContractVersionUsage(days);
  const { data: readiness } = useContractV1SunsetReadiness(
    days,
    SAFE_REMOVAL_THRESHOLD,
  );

  const ratioTone = useMemo(() => {
    const r = data?.overallV1Ratio ?? 0;
    if (r === 0) return "text-emerald-500";
    if (r <= SAFE_REMOVAL_THRESHOLD) return "text-amber-500";
    return "text-destructive";
  }, [data?.overallV1Ratio]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            Deprecação de Contratos — Proporção de chamadas em v1
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Rastreia integradores pendentes na versão descontinuada para planejar
            o sunset (v1 → v2).
          </p>
        </div>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={days === opt.value ? "default" : "outline"}
              onClick={() => setDays(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : isError ? (
          <p className="text-sm text-destructive">
            Não foi possível carregar a telemetria de contratos.
          </p>
        ) : !data || data.totalRequests === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma chamada registrada no período selecionado.
          </p>
        ) : (
          <>
            {/* Alerta automático de reversão de tendência (v1 voltando a subir) */}
            {data.trend.rising && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4"
              >
                <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-destructive">
                    Reversão de tendência detectada — v1 voltando a subir
                  </p>
                  <p className="text-xs text-muted-foreground">
                    A proporção de chamadas em v1 subiu{" "}
                    <span className="font-medium text-foreground">
                      +{data.trend.delta} p.p.
                    </span>{" "}
                    entre a 1ª metade ({data.trend.firstHalfAvg}%) e a 2ª metade
                    ({data.trend.secondHalfAvg}%) do período
                    {data.trend.recentDelta > 0.5 && (
                      <>
                        {" "}(últimos 3 dias:{" "}
                        <span className="font-medium text-foreground">
                          +{data.trend.recentDelta} p.p.
                        </span>
                        )
                      </>
                    )}
                    . Investigue os integradores pendentes antes de prosseguir com o sunset.
                  </p>
                  {data.trend.sustainedReversal && (
                    <p className="text-xs font-medium text-destructive">
                      ⚠ Reversão sustentada: alta contínua por{" "}
                      {data.trend.consecutiveRisingDays} dias consecutivos — sinal
                      de regressão persistente, não ruído pontual.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Métricas resumo */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">Proporção v1 (período)</p>
                <p className={cn("mt-1 text-2xl font-bold", ratioTone)}>
                  {data.overallV1Ratio}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.totalV1.toLocaleString("pt-BR")} de{" "}
                  {data.totalRequests.toLocaleString("pt-BR")} chamadas
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">Última chamada v1</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {data.lastV1Seen
                    ? new Date(data.lastV1Seen).toLocaleDateString("pt-BR")
                    : "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.lastV1Seen
                    ? new Date(data.lastV1Seen).toLocaleTimeString("pt-BR")
                    : "Sem uso de v1"}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">Status do sunset</p>
                {data.overallV1Ratio <= SAFE_REMOVAL_THRESHOLD ? (
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-emerald-500">
                    <CheckCircle2 className="h-4 w-4" />
                    Seguro remover v1
                  </p>
                ) : (
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-amber-500">
                    <AlertTriangle className="h-4 w-4" />
                    Migração em andamento
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Meta: v1 &le; {SAFE_REMOVAL_THRESHOLD}%
                </p>
              </div>
            </div>

            {/* Série temporal da proporção de v1 */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="v1RatioFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
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
                    labelFormatter={(label) => formatDate(String(label))}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <ReferenceLine
                    y={SAFE_REMOVAL_THRESHOLD}
                    stroke="hsl(var(--emerald-500, 152 76% 40%))"
                    strokeDasharray="4 4"
                  />
                  <Area
                    type="monotone"
                    dataKey="v1Ratio"
                    name="Proporção v1"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    fill="url(#v1RatioFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Contratos ainda em v1 */}
            {data.contractsUsingV1.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Contratos com chamadas em v1 (integradores pendentes)
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.contractsUsingV1.map((name) => (
                    <Badge key={name} variant="outline" className="border-amber-500/40 text-amber-600">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";

interface TelemetryRow {
  id: string;
  operation: string;
  table_name: string | null;
  rpc_name: string | null;
  duration_ms: number;
  severity: string;
  created_at: string;
}

interface Props {
  rows: TelemetryRow[];
  timeFilter: string;
}

function getBucketMs(timeFilter: string): number {
  switch (timeFilter) {
    case "1h": return 5 * 60 * 1000;      // 5 min
    case "6h": return 30 * 60 * 1000;     // 30 min
    case "24h": return 60 * 60 * 1000;    // 1 hour
    case "7d": return 6 * 60 * 60 * 1000; // 6 hours
    default: return 60 * 60 * 1000;
  }
}

function formatBucketTime(ts: number, timeFilter: string): string {
  const d = new Date(ts);
  if (timeFilter === "7d") {
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function TelemetryCharts({ rows, timeFilter }: Props) {
  if (rows.length === 0) return null;

  const bucketMs = getBucketMs(timeFilter);

  // === Stacked AreaChart: alerts over time by severity ===
  const timelineMap = new Map<number, { muitoLentas: number; lentas: number; erros: number }>();
  for (const r of rows) {
    const ts = Math.floor(new Date(r.created_at).getTime() / bucketMs) * bucketMs;
    const prev = timelineMap.get(ts) || { muitoLentas: 0, lentas: 0, erros: 0 };
    if (r.severity === "very_slow") prev.muitoLentas++;
    else if (r.severity === "slow") prev.lentas++;
    else if (r.severity === "error") prev.erros++;
    timelineMap.set(ts, prev);
  }
  const timelineData = [...timelineMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ts, d]) => ({ time: formatBucketTime(ts, timeFilter), ...d }));

  // === AreaChart: avg/max duration over time ===
  const durationMap = new Map<number, { totalMs: number; maxMs: number; count: number }>();
  for (const r of rows) {
    const ts = Math.floor(new Date(r.created_at).getTime() / bucketMs) * bucketMs;
    const prev = durationMap.get(ts) || { totalMs: 0, maxMs: 0, count: 0 };
    durationMap.set(ts, {
      totalMs: prev.totalMs + r.duration_ms,
      maxMs: Math.max(prev.maxMs, r.duration_ms),
      count: prev.count + 1,
    });
  }
  const durationData = [...durationMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ts, d]) => ({
      time: formatBucketTime(ts, timeFilter),
      mediaMs: Math.round(d.totalMs / d.count),
      maxMs: d.maxMs,
    }));

  // === Horizontal BarChart: alerts by table ===
  const tableMap = new Map<string, number>();
  for (const r of rows) {
    const key = r.rpc_name || r.table_name || "unknown";
    tableMap.set(key, (tableMap.get(key) || 0) + 1);
  }
  const alertsByTable = [...tableMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  const formatMs = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 1. Stacked AreaChart - Alerts over time */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Alertas ao Longo do Tempo</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="muitoLentas"
                name="Muito Lentas"
                stackId="1"
                stroke="hsl(var(--destructive))"
                fill="hsl(var(--destructive))"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="lentas"
                name="Lentas"
                stackId="1"
                stroke="hsl(45, 93%, 47%)"
                fill="hsl(45, 93%, 47%)"
                fillOpacity={0.5}
              />
              <Area
                type="monotone"
                dataKey="erros"
                name="Erros"
                stackId="1"
                stroke="hsl(0, 84%, 60%)"
                fill="hsl(0, 84%, 60%)"
                fillOpacity={0.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 2. AreaChart - Avg/Max Duration */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Duração Média / Máxima</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={durationData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={formatMs} />
              <Tooltip formatter={(v) => formatMs(Number(v))} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="maxMs"
                name="Máxima"
                stroke="hsl(var(--destructive))"
                fill="hsl(var(--destructive))"
                fillOpacity={0.2}
              />
              <Area
                type="monotone"
                dataKey="mediaMs"
                name="Média"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 3. Horizontal BarChart - Alerts by Table */}
      {alertsByTable.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Alertas por Tabela</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={alertsByTable} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                <Tooltip formatter={(v) => [`${Number(v)} alertas`, "Quantidade"]} />
                <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

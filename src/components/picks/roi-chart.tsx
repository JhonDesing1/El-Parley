"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export interface ChartPickData {
  created_at: string;
  profit_loss: number | null;
  result: string;
}

export function RoiChart({ picks }: { picks: ChartPickData[] }) {
  const data = useMemo(() => {
    const resolved = picks
      .filter((p) => (p.result === "won" || p.result === "lost") && p.profit_loss != null)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return resolved.reduce<{ date: string; pnl: number }[]>((acc, p) => {
      const prev = acc.length > 0 ? acc[acc.length - 1].pnl : 0;
      return [
        ...acc,
        {
          date: format(new Date(p.created_at), "d MMM", { locale: es }),
          pnl: Math.round(prev + p.profit_loss!),
        },
      ];
    }, []);
  }, [picks]);

  if (data.length < 2) return null;

  const lastPnl = data[data.length - 1].pnl;
  const color = lastPnl >= 0 ? "#34d399" : "#f87171";

  function formatTick(v: number) {
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
    return `$${v}`;
  }

  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.18} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatTick}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
              padding: "6px 10px",
            }}
            formatter={(value: number) => [`$${value.toLocaleString("es-CO")}`, "P&L acum."]}
            labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 2 }}
          />
          <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="pnl"
            stroke={color}
            strokeWidth={2}
            fill="url(#pnlGrad)"
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

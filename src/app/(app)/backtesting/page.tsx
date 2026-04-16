import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isProUser } from "@/lib/utils/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart2, TrendingUp, Target, Percent } from "lucide-react";

export const metadata = { title: "Backtesting — El Parley Pro" };

export default async function BacktestingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/backtesting");

  const pro = await isProUser();
  if (!pro) redirect("/premium");

  // Histórico de value bets resueltas
  const { data: bets } = await supabase
    .from("value_bets")
    .select(
      `id, market, selection, price, edge, kelly_fraction,
       confidence, result, detected_at,
       bookmaker:bookmakers(name, slug),
       match:matches(
         kickoff,
         league:leagues(name, country)
       )`,
    )
    .in("result", ["won", "lost"])
    .order("detected_at", { ascending: false })
    .limit(500);

  const resolved = bets ?? [];
  const total = resolved.length;
  const wins = resolved.filter((b) => b.result === "won").length;
  const losses = total - wins;
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

  // ROI simple: asumiendo 1 unidad por apuesta
  const roi = resolved.reduce((acc, b) => {
    if (b.result === "won") return acc + (Number(b.price) - 1);
    return acc - 1;
  }, 0);
  const roiPct = total > 0 ? ((roi / total) * 100).toFixed(1) : "0.0";

  const avgEdge =
    total > 0
      ? (
          (resolved.reduce((acc, b) => acc + Number(b.edge), 0) / total) *
          100
        ).toFixed(2)
      : "0.00";

  // Agrupar por mercado
  const byMarket: Record<string, { total: number; wins: number }> = {};
  for (const b of resolved) {
    if (!byMarket[b.market]) byMarket[b.market] = { total: 0, wins: 0 };
    byMarket[b.market].total++;
    if (b.result === "won") byMarket[b.market].wins++;
  }

  // Agrupar por bookmaker
  const byBookmaker: Record<string, { total: number; wins: number; name: string }> = {};
  for (const b of resolved) {
    const slug = (b.bookmaker as any)?.slug ?? "unknown";
    const name = (b.bookmaker as any)?.name ?? slug;
    if (!byBookmaker[slug]) byBookmaker[slug] = { total: 0, wins: 0, name };
    byBookmaker[slug].total++;
    if (b.result === "won") byBookmaker[slug].wins++;
  }

  return (
    <div className="container max-w-5xl py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
          <BarChart2 className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Backtesting histórico</h1>
          <p className="text-sm text-muted-foreground">
            Rendimiento real de las value bets detectadas por el modelo
          </p>
        </div>
        <Badge className="ml-auto border-amber-500/50 bg-amber-500/10 text-amber-400">PRO</Badge>
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-border/50 bg-muted/20 py-16 text-center">
          <BarChart2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Aún no hay value bets resueltas en el histórico.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <StatCard
              icon={Target}
              label="Total value bets"
              value={String(total)}
            />
            <StatCard
              icon={TrendingUp}
              label="Win rate"
              value={`${winRate}%`}
              valueClass={Number(winRate) >= 55 ? "text-emerald-400" : Number(winRate) >= 45 ? "" : "text-red-400"}
            />
            <StatCard
              icon={Percent}
              label="ROI"
              value={`${Number(roiPct) >= 0 ? "+" : ""}${roiPct}%`}
              valueClass={Number(roiPct) >= 0 ? "text-emerald-400" : "text-red-400"}
            />
            <StatCard
              icon={BarChart2}
              label="Edge promedio"
              value={`${avgEdge}%`}
              valueClass="text-amber-400"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Por mercado */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Rendimiento por mercado</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {Object.entries(byMarket)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([market, stats]) => {
                      const wr = ((stats.wins / stats.total) * 100).toFixed(0);
                      return (
                        <li
                          key={market}
                          className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2"
                        >
                          <span className="font-mono text-xs text-muted-foreground">{market}</span>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-muted-foreground">{stats.total} apuestas</span>
                            <span
                              className={
                                Number(wr) >= 55
                                  ? "font-bold text-emerald-400"
                                  : Number(wr) >= 45
                                    ? "font-bold"
                                    : "font-bold text-red-400"
                              }
                            >
                              {wr}% WR
                            </span>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              </CardContent>
            </Card>

            {/* Por bookmaker */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Rendimiento por casa</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {Object.entries(byBookmaker)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([slug, stats]) => {
                      const wr = ((stats.wins / stats.total) * 100).toFixed(0);
                      return (
                        <li
                          key={slug}
                          className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2"
                        >
                          <span className="text-xs font-semibold">{stats.name}</span>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-muted-foreground">{stats.total} apuestas</span>
                            <span
                              className={
                                Number(wr) >= 55
                                  ? "font-bold text-emerald-400"
                                  : Number(wr) >= 45
                                    ? "font-bold"
                                    : "font-bold text-red-400"
                              }
                            >
                              {wr}% WR
                            </span>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de últimas apuestas */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Últimas 50 apuestas resueltas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 text-left text-muted-foreground">
                      <th className="pb-2 pr-4 font-semibold">Partido / Liga</th>
                      <th className="pb-2 pr-4 font-semibold">Mercado</th>
                      <th className="pb-2 pr-4 font-semibold">Casa</th>
                      <th className="pb-2 pr-4 font-semibold tabular-nums">Cuota</th>
                      <th className="pb-2 pr-4 font-semibold tabular-nums">Edge</th>
                      <th className="pb-2 font-semibold">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolved.slice(0, 50).map((b) => (
                      <tr key={b.id} className="border-b border-border/20 last:border-0">
                        <td className="py-2 pr-4">
                          <div className="text-foreground">
                            {(b.match as any)?.league?.name ?? "—"}
                          </div>
                          <div className="text-muted-foreground">
                            {(b.match as any)?.kickoff
                              ? new Date((b.match as any).kickoff).toLocaleDateString("es-CO")
                              : "—"}
                          </div>
                        </td>
                        <td className="py-2 pr-4 font-mono text-muted-foreground">
                          {b.market} · {b.selection}
                        </td>
                        <td className="py-2 pr-4">{(b.bookmaker as any)?.name ?? "—"}</td>
                        <td className="py-2 pr-4 tabular-nums">{Number(b.price).toFixed(2)}</td>
                        <td className="py-2 pr-4 tabular-nums text-amber-400">
                          +{(Number(b.edge) * 100).toFixed(1)}%
                        </td>
                        <td className="py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              b.result === "won"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-red-500/15 text-red-400"
                            }`}
                          >
                            {b.result === "won" ? "Ganado" : "Perdido"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={`font-mono text-3xl font-bold tabular-nums ${valueClass ?? ""}`}>
        {value}
      </div>
    </Card>
  );
}

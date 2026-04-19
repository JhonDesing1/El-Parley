import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/utils/auth";
import { CreatePickModal, PicksTable, type TipsterPickRow } from "./admin-picks-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin · Picks — El Parley" };

export default async function AdminTipsterPicksPage() {
  if (!(await isAdminUser())) {
    redirect("/dashboard");
  }

  const supabase = createAdminClient() as any;

  // Fetch all picks (admin sees everything, including unpublished)
  const { data: picks } = await supabase
    .from("tipster_picks")
    .select("*")
    .order("created_at", { ascending: false });

  const rows = (picks ?? []) as TipsterPickRow[];

  // Stats
  const resolved = rows.filter((p) => p.result !== "pending" && p.result !== "void");
  const won = resolved.filter((p) => p.result === "won").length;
  const winRate = resolved.length > 0 ? Math.round((won / resolved.length) * 100) : null;
  const totalUnits = rows.reduce((s, p) => s + (p.profit_units ?? 0), 0);

  return (
    <div className="container max-w-4xl py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Admin · Picks de tipster
            </h1>
            <p className="text-sm text-muted-foreground">
              Gestiona los picks que se muestran en <strong>/picks</strong>
            </p>
          </div>
        </div>
        <CreatePickModal />
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Total picks
          </p>
          <p className="mt-1 font-mono text-2xl font-bold">{rows.length}</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Acierto
          </p>
          <p
            className={`mt-1 font-mono text-2xl font-bold ${
              winRate === null
                ? "text-muted-foreground"
                : winRate >= 55
                  ? "text-emerald-400"
                  : winRate >= 45
                    ? "text-foreground"
                    : "text-red-400"
            }`}
          >
            {winRate !== null ? `${winRate}%` : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Unidades
          </p>
          <p
            className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
              totalUnits > 0 ? "text-emerald-400" : totalUnits < 0 ? "text-red-400" : "text-muted-foreground"
            }`}
          >
            {totalUnits > 0 ? "+" : ""}
            {totalUnits.toFixed(2)}u
          </p>
        </div>
      </div>

      <PicksTable picks={rows} />
    </div>
  );
}

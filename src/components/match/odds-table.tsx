"use client";

import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type { Odd } from "@/types";

interface OddsTableProps {
  matchId: number;
  market: string;
  marketLabel: string;
  selections: Array<{ key: string; label: string }>;
  odds: Odd[];
  onAffiliateClick?: (bookmakerSlug: string, market: string, selection: string) => void;
}

export function OddsTable({
  matchId,
  market,
  marketLabel,
  selections,
  odds,
  onAffiliateClick,
}: OddsTableProps) {
  // Agrupar por bookmaker
  const byBook = new Map<number, Odd[]>();
  for (const o of odds) {
    if (o.market !== market) continue;
    const list = byBook.get(o.bookmaker.id) ?? [];
    list.push(o);
    byBook.set(o.bookmaker.id, list);
  }

  // Mejor cuota por selección (para destacarla)
  const bestBySelection = new Map<string, number>();
  for (const o of odds) {
    if (o.market !== market) continue;
    const current = bestBySelection.get(o.selection) ?? 0;
    if (o.price > current) bestBySelection.set(o.selection, o.price);
  }

  if (byBook.size === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Sin cuotas disponibles para {marketLabel}
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border/60 bg-muted/30 px-5 py-3">
        <h3 className="font-display text-base font-bold uppercase tracking-wide">
          {marketLabel}
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-border/40 bg-muted/20">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Casa
              </th>
              {selections.map((s) => (
                <th
                  key={s.key}
                  className="px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  {s.label}
                </th>
              ))}
              <th className="w-32 px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {Array.from(byBook.entries()).map(([bookId, bookOdds]) => {
              const book = bookOdds[0].bookmaker;
              return (
                <tr
                  key={bookId}
                  className="border-b border-border/30 transition-colors hover:bg-muted/20"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {book.logo_url && (
                        <Image
                          src={book.logo_url}
                          alt={book.name}
                          width={24}
                          height={24}
                          className="rounded"
                        />
                      )}
                      <span className="font-semibold">{book.name}</span>
                    </div>
                  </td>
                  {selections.map((s) => {
                    const o = bookOdds.find((x) => x.selection === s.key);
                    const isBest = o && bestBySelection.get(s.key) === o.price;
                    return (
                      <td key={s.key} className="px-4 py-3 text-center">
                        {o ? (
                          <span
                            className={cn(
                              "inline-block rounded-md px-2.5 py-1 font-mono text-sm font-bold tabular-nums",
                              isBest
                                ? "bg-value/15 text-value ring-1 ring-value/40"
                                : "text-foreground",
                            )}
                          >
                            {o.price.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right">
                    <Button
                      asChild
                      size="sm"
                      variant="value"
                      onClick={() => onAffiliateClick?.(book.slug, market, "")}
                    >
                      <a
                        href={`/api/track/affiliate?book=${book.slug}&match=${matchId}&market=${market}`}
                        target="_blank"
                        rel="noopener nofollow sponsored"
                      >
                        Apostar <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-border/40 bg-muted/20 px-5 py-2.5">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="value" className="text-[9px]">
            MEJOR
          </Badge>
          Cuota destacada = la más alta del mercado · 18+ Juega responsablemente
        </div>
      </div>
    </Card>
  );
}

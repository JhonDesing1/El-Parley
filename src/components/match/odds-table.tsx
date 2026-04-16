"use client";

import Image from "next/image";
import { useState } from "react";
import { ExternalLink, ClipboardList, ArrowUp, ArrowDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { RegisterPickModal } from "@/components/picks/register-pick-modal";
import type { Odd, MarketType } from "@/types";

interface OddsTableProps {
  matchId: number;
  market: string;
  marketLabel: string;
  selections: Array<{ key: string; label: string }>;
  odds: Odd[];
  /** Necesario para el modal de pick */
  matchLabel?: string;
  /** Si el partido no está disponible (finished/postponed) oculta el botón de pick */
  canRegisterPick?: boolean;
  onAffiliateClick?: (bookmakerSlug: string, market: string, selection: string) => void;
}

interface SelectedOdd {
  odd: Odd;
  selectionLabel: string;
}

function OddsMovement({ price, previousPrice }: { price: number; previousPrice?: number | null }) {
  if (!previousPrice || previousPrice === price) return null;
  if (price > previousPrice) {
    return <ArrowUp className="h-3 w-3 text-emerald-500" aria-label="cuota subió" />;
  }
  return <ArrowDown className="h-3 w-3 text-red-500" aria-label="cuota bajó" />;
}

export function OddsTable({
  matchId,
  market,
  marketLabel,
  selections,
  odds,
  matchLabel,
  canRegisterPick = false,
  onAffiliateClick,
}: OddsTableProps) {
  const [pickModal, setPickModal] = useState<SelectedOdd | null>(null);
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

  const bookEntries = Array.from(byBook.entries());

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border/60 bg-muted/30 px-5 py-3">
        <h3 className="font-display text-base font-bold uppercase tracking-wide">
          {marketLabel}
        </h3>
      </div>

      {/* ── Vista tabla (sm+) ── */}
      <div className="hidden overflow-x-auto sm:block">
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
              <th className="w-32 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {bookEntries.map(([bookId, bookOdds]) => {
              const book = bookOdds[0].bookmaker;
              return (
                <tr
                  key={bookId}
                  className="border-b border-border/30 transition-colors hover:bg-muted/20"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {book.logo_url && (
                        <Image src={book.logo_url} alt={book.name} width={24} height={24} sizes="24px" className="rounded" />
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
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-mono text-sm font-bold tabular-nums",
                              isBest ? "bg-value/15 text-value ring-1 ring-value/40" : "text-foreground",
                            )}>
                              {o.price.toFixed(2)}
                              <OddsMovement price={o.price} previousPrice={o.previous_price} />
                            </span>
                            {canRegisterPick && (
                              <button
                                type="button"
                                onClick={() => setPickModal({ odd: o, selectionLabel: s.label })}
                                className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                                title="Registrar pick"
                              >
                                <ClipboardList className="h-3 w-3" />
                                pick
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right">
                    <Button asChild size="sm" variant="value"
                      onClick={() => onAffiliateClick?.(book.slug, market, "")}>
                      <a href={`/api/track/affiliate?book=${book.slug}&match=${matchId}&market=${market}`}
                        target="_blank" rel="noopener nofollow sponsored">
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

      {/* ── Vista cards (< sm) ── */}
      <div className="divide-y divide-border/30 sm:hidden">
        {bookEntries.map(([bookId, bookOdds]) => {
          const book = bookOdds[0].bookmaker;
          return (
            <div key={bookId} className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {book.logo_url && (
                    <Image src={book.logo_url} alt={book.name} width={20} height={20} sizes="20px" className="rounded" />
                  )}
                  <span className="font-semibold text-sm">{book.name}</span>
                </div>
                <Button asChild size="sm" variant="value"
                  onClick={() => onAffiliateClick?.(book.slug, market, "")}>
                  <a href={`/api/track/affiliate?book=${book.slug}&match=${matchId}&market=${market}`}
                    target="_blank" rel="noopener nofollow sponsored">
                    Apostar <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${selections.length}, 1fr)` }}>
                {selections.map((s) => {
                  const o = bookOdds.find((x) => x.selection === s.key);
                  const isBest = o && bestBySelection.get(s.key) === o.price;
                  return (
                    <div
                      key={s.key}
                      className={cn(
                        "rounded-lg px-2 py-2 text-center",
                        isBest ? "bg-value/10 ring-1 ring-value/30" : "bg-muted/40",
                        canRegisterPick && o && "cursor-pointer transition-opacity hover:opacity-75",
                      )}
                      onClick={() => canRegisterPick && o && setPickModal({ odd: o, selectionLabel: s.label })}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {s.label}
                      </div>
                      <div className={cn(
                        "inline-flex items-center justify-center gap-0.5 font-mono text-sm font-bold tabular-nums",
                        isBest ? "text-value" : "text-foreground",
                      )}>
                        {o ? o.price.toFixed(2) : "—"}
                        {o && <OddsMovement price={o.price} previousPrice={o.previous_price} />}
                      </div>
                      {canRegisterPick && o && (
                        <div className="mt-0.5 flex items-center justify-center gap-0.5 text-[9px] text-muted-foreground">
                          <ClipboardList className="h-2.5 w-2.5" />
                          pick
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border/40 bg-muted/20 px-5 py-2.5">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="value" className="text-[9px]">MEJOR</Badge>
          Cuota destacada = la más alta del mercado · 18+ Juega responsablemente
        </div>
      </div>

      {/* Modal de registro de pick — instancia única controlada */}
      {canRegisterPick && pickModal && (
        <RegisterPickModal
          matchId={matchId}
          matchLabel={matchLabel ?? `Partido #${matchId}`}
          market={pickModal.odd.market as MarketType}
          selection={pickModal.odd.selection}
          odds={pickModal.odd.price}
          bookmakerName={pickModal.odd.bookmaker.name}
          bookmakerId={pickModal.odd.bookmaker.id}
          line={pickModal.odd.line ?? undefined}
          open={true}
          onOpenChange={(v) => { if (!v) setPickModal(null); }}
          hideTrigger
        />
      )}
    </Card>
  );
}

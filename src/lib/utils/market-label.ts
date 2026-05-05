const MARKET_LABELS: Record<string, string> = {
  "1x2": "1X2",
  btts: "Ambos anotan",
  over_under_2_5: "Más/Menos 2.5",
  over_under_1_5: "Más/Menos 1.5",
  double_chance: "Doble oportunidad",
  draw_no_bet: "Empate anula apuesta",
  asian_handicap: "Handicap asiático",
  correct_score: "Marcador exacto",
};

const STATIC_SELECTION_LABELS: Record<string, Record<string, string>> = {
  "1x2": { home: "Local", draw: "Empate", away: "Visitante" },
  btts: { yes: "Sí", no: "No" },
  over_under_2_5: { over: "Más 2.5", under: "Menos 2.5" },
  over_under_1_5: { over: "Más 1.5", under: "Menos 1.5" },
};

export function marketLabel(market: string): string {
  return MARKET_LABELS[market] ?? market;
}

export interface TeamNames {
  home?: string | null;
  away?: string | null;
}

export function selectionLabel(
  market: string,
  selection: string,
  teams?: TeamNames,
): string {
  if (market === "double_chance") {
    const home = teams?.home ?? "Local";
    const away = teams?.away ?? "Visitante";
    if (selection === "1x") return `gana ${home} o empate`;
    if (selection === "12") return `gana ${home} o gana ${away} (sin empate)`;
    if (selection === "x2") return `empate o gana ${away}`;
  }
  return STATIC_SELECTION_LABELS[market]?.[selection] ?? selection;
}

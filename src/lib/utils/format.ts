import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";

const TZ = "America/Bogota";

export function formatKickoff(date: Date | string, tz = TZ): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const zoned = toZonedTime(d, tz);
  if (isToday(zoned)) return `Hoy · ${format(zoned, "HH:mm")}`;
  if (isTomorrow(zoned)) return `Mañana · ${format(zoned, "HH:mm")}`;
  if (isYesterday(zoned)) return `Ayer · ${format(zoned, "HH:mm")}`;
  return formatInTimeZone(d, tz, "EEE d MMM · HH:mm", { locale: es });
}

export function formatTimeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { locale: es, addSuffix: true });
}

export function formatOdds(odd: number | null | undefined): string {
  if (odd == null) return "—";
  return odd.toFixed(2);
}

export function formatProbability(prob: number): string {
  return `${(prob * 100).toFixed(1)}%`;
}

/**
 * Clampa una probabilidad (0..1) a un rango realista para display.
 * El modelo nunca debe decir "100% seguro" — siempre existe varianza
 * (rojas, lesiones súbitas, penales). Usamos [1%, 99%] como cota.
 */
export function clampDisplayProb(prob: number): number {
  if (!Number.isFinite(prob)) return 0.5;
  return Math.min(0.99, Math.max(0.01, prob));
}

/** Formatea una probabilidad 0..1 como porcentaje entero, clamped a [1%, 99%]. */
export function formatProbPct(prob: number, digits: 0 | 1 = 0): string {
  const clamped = clampDisplayProb(prob);
  return `${(clamped * 100).toFixed(digits)}%`;
}

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatEdge(edge: number): string {
  const sign = edge >= 0 ? "+" : "";
  return `${sign}${(edge * 100).toFixed(1)}%`;
}

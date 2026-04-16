import { describe, it, expect } from "vitest";
import { calculateParlay, generateDailyParlay, type ParlayLeg } from "../parlay-calculator";

const leg = (matchId: number, odds: number, modelProb?: number): ParlayLeg => ({
  matchId,
  market: "1X2",
  selection: "Home",
  decimalOdds: odds,
  modelProb,
});

describe("calculateParlay", () => {
  it("lanza error con menos de 2 selecciones", () => {
    expect(() => calculateParlay([leg(1, 2.0)])).toThrow();
  });

  it("lanza error con más de 12 selecciones", () => {
    const legs = Array.from({ length: 13 }, (_, i) => leg(i, 2.0));
    expect(() => calculateParlay(legs)).toThrow();
  });

  it("calcula cuota total multiplicando las individuales", () => {
    const r = calculateParlay([leg(1, 2.0), leg(2, 3.0)]);
    expect(r.totalOdds).toBeCloseTo(6.0);
  });

  it("calcula probabilidad implícita combinada", () => {
    const r = calculateParlay([leg(1, 2.0), leg(2, 4.0)]);
    // (1/2) * (1/4) = 0.125
    expect(r.combinedImpliedProb).toBeCloseTo(0.125);
  });

  it("genera warning por selecciones del mismo partido", () => {
    const r = calculateParlay([leg(1, 2.0), leg(1, 3.0), leg(2, 1.8)]);
    expect(r.warnings.some((w) => w.includes("#1"))).toBe(true);
  });

  it("genera warning con más de 6 selecciones", () => {
    const legs = Array.from({ length: 7 }, (_, i) => leg(i, 1.5));
    const r = calculateParlay(legs);
    expect(r.warnings.some((w) => w.includes("7"))).toBe(true);
  });

  it("calcula EV y edge cuando todas las legs tienen modelProb", () => {
    const legs = [leg(1, 2.0, 0.6), leg(2, 2.0, 0.6)];
    const r = calculateParlay(legs);
    // combinedModelProb = 0.36, totalOdds = 4.0
    // edge = 0.36*4.0 - 1 = 0.44
    expect(r.combinedModelProb).toBeCloseTo(0.36);
    expect(r.edge).toBeCloseTo(0.44);
    expect(r.isValue).toBe(true);
  });

  it("no calcula EV si alguna leg no tiene modelProb", () => {
    const r = calculateParlay([leg(1, 2.0, 0.6), leg(2, 2.0)]);
    expect(r.combinedModelProb).toBeUndefined();
    expect(r.edge).toBeUndefined();
  });
});

describe("generateDailyParlay", () => {
  // 0.88 * 0.82 = 0.7216 > 0.68 → parlay válido de 2 legs
  const candidates = [
    { ...leg(1, 1.3, 0.88), confidence: "high" as const },
    { ...leg(2, 1.4, 0.82), confidence: "high" as const },
    { ...leg(3, 1.5, 0.75), confidence: "medium" as const },
    { ...leg(4, 1.7, 0.70), confidence: "medium" as const },
  ];

  it("retorna null si no hay suficientes candidatos high/medium con prob > 0.6", () => {
    const lowConf = [
      { ...leg(1, 2.0, 0.65), confidence: "low" as const },
      { ...leg(2, 2.0, 0.65), confidence: "low" as const },
    ];
    expect(generateDailyParlay(lowConf)).toBeNull();
  });

  it("devuelve entre minLegs y maxLegs selecciones", () => {
    const result = generateDailyParlay(candidates);
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThanOrEqual(2);
    expect(result!.length).toBeLessThanOrEqual(4);
  });

  it("respeta minCombinedProb personalizado", () => {
    // con umbral muy alto debería fallar
    const result = generateDailyParlay(candidates, { minCombinedProb: 0.999 });
    expect(result).toBeNull();
  });

  it("ordena por prob descendente (primero el más seguro)", () => {
    const result = generateDailyParlay(candidates);
    expect(result).not.toBeNull();
    // primer elemento debe tener modelProb >= segundo
    if (result!.length >= 2) {
      expect(result![0].modelProb).toBeGreaterThanOrEqual(result![1].modelProb ?? 0);
    }
  });
});

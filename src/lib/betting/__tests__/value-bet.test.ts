import { describe, it, expect } from "vitest";
import { detectValueBet, explainValueBet } from "../value-bet";

describe("detectValueBet", () => {
  it("lanza error con modelProb fuera de (0,1)", () => {
    expect(() => detectValueBet({ modelProb: 0, decimalOdds: 2.0 })).toThrow();
    expect(() => detectValueBet({ modelProb: 1, decimalOdds: 2.0 })).toThrow();
  });

  it("lanza error con cuota <= 1", () => {
    expect(() => detectValueBet({ modelProb: 0.5, decimalOdds: 1 })).toThrow();
    expect(() => detectValueBet({ modelProb: 0.5, decimalOdds: 0.8 })).toThrow();
  });

  it("detecta value bet con edge positivo", () => {
    // modelProb=0.6, cuota=2.0 → edge = 0.6*2.0 - 1 = 0.2 (20%)
    const r = detectValueBet({ modelProb: 0.6, decimalOdds: 2.0 });
    expect(r.isValue).toBe(true);
    expect(r.edge).toBeCloseTo(0.2);
  });

  it("rechaza apuesta sin value (edge < minEdge)", () => {
    // modelProb=0.48, cuota=2.0 → edge = -0.04 < 0.03
    const r = detectValueBet({ modelProb: 0.48, decimalOdds: 2.0 });
    expect(r.isValue).toBe(false);
  });

  it("respeta minEdge personalizado", () => {
    // edge 4% → isValue con default 3%, no value con minEdge 5%
    const r3 = detectValueBet({ modelProb: 0.52, decimalOdds: 2.0, minEdge: 0.03 });
    const r5 = detectValueBet({ modelProb: 0.52, decimalOdds: 2.0, minEdge: 0.05 });
    expect(r3.isValue).toBe(true);
    expect(r5.isValue).toBe(false);
  });

  it("calcula EV correctamente", () => {
    // EV = modelProb*(odds-1) - (1-modelProb) = 0.6*1 - 0.4 = 0.2
    const r = detectValueBet({ modelProb: 0.6, decimalOdds: 2.0 });
    expect(r.expectedValue).toBeCloseTo(0.2);
  });

  it("impliedProb es 1/odds", () => {
    const r = detectValueBet({ modelProb: 0.6, decimalOdds: 2.5 });
    expect(r.impliedProb).toBeCloseTo(1 / 2.5);
  });

  it("confidence=high con edge>=8% y prob>=40%", () => {
    // edge = 0.7*2.0 - 1 = 0.4 (40%), modelProb=0.7 >= 0.4
    const r = detectValueBet({ modelProb: 0.7, decimalOdds: 2.0 });
    expect(r.confidence).toBe("high");
  });

  it("confidence=medium con edge 5%-8%", () => {
    // modelProb=0.55, cuota=2.0 → edge = 0.10 (10%) ≥ 8%, prob=0.55≥0.4 → high
    // usamos cuota 1.8: edge = 0.55*1.8-1 = -0.01 — no sirve
    // modelProb=0.575, cuota=1.8: edge = 0.575*1.8-1 = 0.035 → < 0.05
    // modelProb=0.58, cuota=1.9: edge = 0.58*1.9-1 = 0.102 → high
    // modelProb=0.54, cuota=2.0: edge = 0.08 → high (0.08 >= 0.08 → high exacto)
    // modelProb=0.535, cuota=2.0: edge = 0.07 → medium
    const r = detectValueBet({ modelProb: 0.535, decimalOdds: 2.0 });
    expect(r.confidence).toBe("medium");
  });

  it("confidence=low con edge < 5%", () => {
    // modelProb=0.515, cuota=2.0 → edge = 0.03 → isValue=true, confidence=low
    const r = detectValueBet({ modelProb: 0.515, decimalOdds: 2.0 });
    expect(r.confidence).toBe("low");
  });

  it("kelly es 0 cuando no hay edge real", () => {
    // modelProb=0.48, cuota=2.0 → edge negativo → kelly=0
    const r = detectValueBet({ modelProb: 0.48, decimalOdds: 2.0 });
    expect(r.kelly).toBe(0);
  });
});

describe("explainValueBet", () => {
  const ctx = { selection: "Local gana", bookmaker: "Betway", market: "1X2" };

  it("devuelve mensaje de 'sin valor' cuando no hay value", () => {
    const r = detectValueBet({ modelProb: 0.48, decimalOdds: 2.0 });
    const msg = explainValueBet(r, ctx);
    expect(msg).toContain("Sin valor");
  });

  it("incluye el bookmaker y el edge en el mensaje de value", () => {
    const r = detectValueBet({ modelProb: 0.6, decimalOdds: 2.0 });
    const msg = explainValueBet(r, ctx);
    expect(msg).toContain("Betway");
    expect(msg).toContain("20.0%");
  });

  it("incluye la selección en el mensaje", () => {
    const r = detectValueBet({ modelProb: 0.6, decimalOdds: 2.0 });
    const msg = explainValueBet(r, ctx);
    expect(msg).toContain("Local gana");
  });
});

import { describe, it, expect } from "vitest";
import { poissonPMF, scoreMatrix, calculateMatchProbabilities } from "../poisson";

describe("poissonPMF", () => {
  it("k=0, lambda=0 retorna 1", () => {
    expect(poissonPMF(0, 0)).toBe(1);
  });

  it("k>0, lambda=0 retorna 0", () => {
    expect(poissonPMF(1, 0)).toBe(0);
    expect(poissonPMF(3, 0)).toBe(0);
  });

  it("k=0 es e^(-lambda)", () => {
    expect(poissonPMF(0, 1.5)).toBeCloseTo(Math.exp(-1.5), 10);
  });

  it("k=1, lambda=1: e^-1 * 1 = 0.3679", () => {
    expect(poissonPMF(1, 1)).toBeCloseTo(Math.exp(-1), 8);
  });

  it("la distribución suma aproximadamente 1 hasta k=20 para lambda=2", () => {
    let sum = 0;
    for (let k = 0; k <= 20; k++) sum += poissonPMF(k, 2);
    expect(sum).toBeCloseTo(1, 4);
  });
});

describe("scoreMatrix", () => {
  it("tiene dimensiones (maxGoals+1) x (maxGoals+1)", () => {
    const m = scoreMatrix(1.5, 1.2, 5);
    expect(m.length).toBe(6);
    expect(m[0].length).toBe(6);
  });

  it("todos los valores son probabilidades válidas (0..1)", () => {
    const m = scoreMatrix(1.5, 1.2);
    m.forEach((row) => row.forEach((p) => {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }));
  });

  it("la suma aproxima 1 con maxGoals suficiente", () => {
    const m = scoreMatrix(1.2, 0.9, 15);
    const sum = m.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);
    expect(sum).toBeCloseTo(1, 3);
  });
});

describe("calculateMatchProbabilities", () => {
  it("home + draw + away ≈ 1", () => {
    const r = calculateMatchProbabilities(1.5, 1.2);
    expect(r.home + r.draw + r.away).toBeCloseTo(1, 8);
  });

  it("over + under ≈ 1 para 2.5 y 1.5 goles", () => {
    const r = calculateMatchProbabilities(1.5, 1.2);
    expect(r.over25 + r.under25).toBeCloseTo(1, 5);
    expect(r.over15 + r.under15).toBeCloseTo(1, 5);
  });

  it("btts + noBtts ≈ 1", () => {
    const r = calculateMatchProbabilities(1.5, 1.2);
    expect(r.btts + r.noBtts).toBeCloseTo(1, 5);
  });

  it("equipo local dominante → prob home > away", () => {
    const r = calculateMatchProbabilities(2.5, 0.5);
    expect(r.home).toBeGreaterThan(r.away);
  });

  it("partido igualado → probs más equilibradas", () => {
    const r = calculateMatchProbabilities(1.2, 1.2);
    expect(Math.abs(r.home - r.away)).toBeLessThan(0.05);
  });

  it("xG muy alto → over25 dominante", () => {
    const r = calculateMatchProbabilities(3.0, 2.5);
    expect(r.over25).toBeGreaterThan(0.85);
  });

  it("xG muy bajo → under25 dominante", () => {
    const r = calculateMatchProbabilities(0.4, 0.3);
    expect(r.under25).toBeGreaterThan(0.7);
  });

  it("mostLikelyScore tiene una probabilidad positiva", () => {
    const r = calculateMatchProbabilities(1.4, 1.1);
    expect(r.mostLikelyScore.probability).toBeGreaterThan(0);
  });

  it("sin Dixon-Coles sigue siendo coherente (suma 1)", () => {
    const r = calculateMatchProbabilities(1.5, 1.2, { applyDixonColes: false });
    expect(r.home + r.draw + r.away).toBeCloseTo(1, 8);
  });
});

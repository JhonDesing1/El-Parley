import { describe, it, expect } from "vitest";
import {
  impliedProbability,
  overround,
  removeVigMultiplicative,
  removeVigShin,
  probabilityToFairOdds,
} from "../implied-probability";

describe("impliedProbability", () => {
  it("convierte cuota 2.0 a prob 0.5", () => {
    expect(impliedProbability(2.0)).toBeCloseTo(0.5);
  });

  it("lanza error con cuota <= 1", () => {
    expect(() => impliedProbability(1)).toThrow();
    expect(() => impliedProbability(0.5)).toThrow();
  });
});

describe("overround", () => {
  it("calcula el margen de una 1X2 típica", () => {
    // Cuotas: 2.0 / 3.5 / 3.8 → overround ≈ 0.048
    const vig = overround([2.0, 3.5, 3.8]);
    expect(vig).toBeGreaterThan(0);
    expect(vig).toBeLessThan(0.15);
  });

  it("retorna 0 con cuotas fair (sin margen)", () => {
    // fair: prob = [0.5, 0.5] → cuotas 2.0 / 2.0
    expect(overround([2.0, 2.0])).toBeCloseTo(0);
  });
});

describe("removeVigMultiplicative", () => {
  it("las probabilidades resultantes suman 1", () => {
    const probs = removeVigMultiplicative([2.0, 3.5, 3.8]);
    const sum = probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
  });

  it("mantiene la proporción relativa entre outcomes", () => {
    // El favorito (cuota más baja) debe tener la prob más alta
    const probs = removeVigMultiplicative([1.5, 4.0, 6.0]);
    expect(probs[0]).toBeGreaterThan(probs[1]);
    expect(probs[1]).toBeGreaterThan(probs[2]);
  });

  it("con cuotas sin margen devuelve probs iguales a 1/odds", () => {
    const probs = removeVigMultiplicative([2.0, 2.0]);
    expect(probs[0]).toBeCloseTo(0.5);
    expect(probs[1]).toBeCloseTo(0.5);
  });
});

describe("removeVigShin", () => {
  it("las probabilidades resultantes suman 1", () => {
    const probs = removeVigShin([2.0, 3.5, 3.8]);
    const sum = probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("produce probabilidades entre 0 y 1", () => {
    const probs = removeVigShin([1.4, 4.5, 8.0]);
    probs.forEach((p) => {
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
    });
  });

  it("el favorito tiene prob más alta que el desfavorecido", () => {
    const probs = removeVigShin([1.5, 4.0, 7.0]);
    expect(probs[0]).toBeGreaterThan(probs[2]);
  });
});

describe("probabilityToFairOdds", () => {
  it("convierte 0.5 a cuota 2.0", () => {
    expect(probabilityToFairOdds(0.5)).toBeCloseTo(2.0);
  });

  it("lanza error con prob fuera de (0,1)", () => {
    expect(() => probabilityToFairOdds(0)).toThrow();
    expect(() => probabilityToFairOdds(1)).toThrow();
    expect(() => probabilityToFairOdds(-0.1)).toThrow();
    expect(() => probabilityToFairOdds(1.1)).toThrow();
  });

  it("es la inversa de impliedProbability", () => {
    const odds = 3.5;
    const prob = impliedProbability(odds);
    expect(probabilityToFairOdds(prob)).toBeCloseTo(odds);
  });
});

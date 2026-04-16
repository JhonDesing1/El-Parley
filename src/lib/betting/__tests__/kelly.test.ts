import { describe, it, expect } from "vitest";
import { kellyFraction, suggestedStake } from "../kelly";

describe("kellyFraction", () => {
  it("devuelve 0 cuando no hay edge (EV negativo)", () => {
    // cuota 2.0, prob 0.4 → kelly < 0
    expect(kellyFraction(0.4, 2.0)).toBe(0);
  });

  it("calcula la fracción correctamente con edge claro", () => {
    // cuota 2.0, prob 0.55 → fullKelly = (1*0.55 - 0.45)/1 = 0.10
    // fraccional (25%) = 0.025 → cap de 5% no aplica
    const result = kellyFraction(0.55, 2.0);
    expect(result).toBeCloseTo(0.025, 4);
  });

  it("capea en 0.05 del bankroll aunque Kelly sugiera más", () => {
    // prob muy alta + cuota alta → fullKelly enorme
    const result = kellyFraction(0.95, 10.0);
    expect(result).toBe(0.05);
  });

  it("respeta la fracción 0.5 (half-Kelly)", () => {
    // cuota 2.5, prob 0.55 → fullKelly = 0.125, half = 0.0625 → cap = 0.05
    const half = kellyFraction(0.55, 2.5, 0.5);
    const quarter = kellyFraction(0.55, 2.5, 0.25);
    expect(half).toBeGreaterThanOrEqual(quarter);
  });

  it("full Kelly sin capping devuelve la fórmula clásica (low odds)", () => {
    // cuota 2.0, prob 0.6 → fullKelly = (1*0.6 - 0.4)/1 = 0.2 → ×1 = 0.2 → cap 0.05
    const full = kellyFraction(0.6, 2.0, 1);
    expect(full).toBe(0.05); // caped
  });
});

describe("suggestedStake", () => {
  it("retorna 0 con bankroll 0", () => {
    expect(suggestedStake(0, 0.6, 2.5)).toBe(0);
  });

  it("redondea al centavo", () => {
    const stake = suggestedStake(1000, 0.55, 2.0);
    // kellyFraction = 0.025 → stake = 25.00
    expect(stake).toBe(25);
  });

  it("nunca supera el 5% del bankroll", () => {
    const stake = suggestedStake(1000, 0.95, 10.0);
    expect(stake).toBeLessThanOrEqual(50); // 5% de 1000
  });
});

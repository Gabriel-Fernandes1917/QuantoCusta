import { describe, expect, it } from "vitest";
import { formatMoney, formatPercentage, MAX_MONEY_CENTS, moneyInput, parseMoney, percentage } from "../src/lib/money";

describe("valores brasileiros em centavos", () => {
  it.each([["", 0], ["   ", 0], ["0", 0], ["0,01", 1], ["0,1", 10], ["1234,56", 123456], ["1.234,56", 123456], ["R$ 1.234,56", 123456], ["10.000.000.000,00", MAX_MONEY_CENTS]])("converte %s para %i centavos sem multiplicar decimais", (text, cents) => {
    expect(parseMoney(text)).toBe(cents);
  });
  it.each(["-1", "1,234", "1.23", "12.34,56", "abc", "NaN", "Infinity", "1e6", "10.000.000.000,01", "999999999999999999999999"]) ("rejeita valores inválidos ou acima do limite: %s", value => {
    expect(() => parseMoney(value)).toThrow();
  });
  it.each([0, 1, 10, 99, 100, 123456, MAX_MONEY_CENTS])("preserva centavos ao formatar e reler %i", cents => {
    expect(parseMoney(moneyInput(cents))).toBe(cents);
  });
  it("formata reais, decimais, saldo negativo e total anual grande", () => {
    expect(formatMoney(123456)).toBe("R$ 1.234,56");
    expect(formatMoney(-1)).toBe("−R$ 0,01");
    expect(formatMoney(360_000_000_000_001)).toBe("R$ 3.600.000.000.000,01");
    expect(() => formatMoney(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });
  it("não divide por zero e mantém percentuais acima de 100%", () => {
    expect(percentage(100, 0)).toBeNull();
    expect(percentage(0, 100)).toBe(0);
    expect(percentage(150, 100)).toBe(150);
    expect(formatPercentage(38.4615)).toBe("38,5%");
  });
});

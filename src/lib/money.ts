// Cada campo aceita até R$ 10 bilhões. Os totais anuais permanecem inteiros seguros.
export const MAX_MONEY_CENTS = 1_000_000_000_000;

export function assertMoney(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MONEY_CENTS) {
    throw new Error("Informe um valor entre R$ 0,00 e R$ 10.000.000.000,00.");
  }
}

export function parseMoney(text: string): number {
  const value = text.trim().replace(/^R\$\s*/, "");
  if (!value) return 0;
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(value)) {
    throw new Error("Use um valor brasileiro, como 1.250,50, com até duas casas decimais.");
  }
  const [whole, fraction = ""] = value.replaceAll(".", "").split(",");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  assertMoney(cents);
  return cents;
}

export function moneyInput(cents: number): string {
  assertMoney(cents);
  return `${Math.floor(cents / 100).toLocaleString("pt-BR")},${String(cents % 100).padStart(2, "0")}`;
}

export function formatMoney(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error("Valor monetário fora do intervalo seguro.");
  // Formatação decimal em string evita perda de centavos perto do limite seguro.
  const absolute = Math.abs(cents);
  return `${cents < 0 ? "−" : ""}R$ ${Math.floor(absolute / 100).toLocaleString("pt-BR")},${String(absolute % 100).padStart(2, "0")}`;
}

export function percentage(part: number, total: number): number | null {
  return total === 0 ? null : (part / total) * 100;
}

export function formatPercentage(value: number): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

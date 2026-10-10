import type { CostOfLivingResult } from "../calculations/cost-of-living";
import { formatMoney, formatPercentage } from "../money";

export type ReportBrand = { name: string; domain: string };
export type ReportOptions = { brand: ReportBrand; generatedAt: Date };
export const REPORT_TITLE = "Meu planejamento de custo de vida";
export const REPORT_DISCLAIMER = "Este relatório apresenta estimativas baseadas exclusivamente nos valores informados pelo usuário. Não são utilizadas médias de mercado nesta versão e os resultados não constituem recomendação financeira.";

export function reportDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(date);
}

export function reportFilename(date: Date, extension: "pdf" | "xlsx"): string {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo" }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `coyler-planejamento-${part("year")}-${part("month")}-${part("day")}.${extension}`;
}

export function reportFooter(brand: ReportBrand): string {
  return `Planejamento criado com ${brand.name}${brand.domain ? ` — ${brand.domain}` : ""}`;
}

export function summaryItems(result: CostOfLivingResult) {
  return [
    { label: "Renda mensal em dinheiro", kind: "money", value: result.cashIncome },
    { label: "VA/VR", kind: "money", value: result.foodBenefits },
    { label: "Custo mensal estimado", kind: "money", value: result.monthlyExpenses },
    { label: "Despesas pagas em dinheiro", kind: "money", value: result.cashExpenses },
    { label: "Saldo mensal", kind: "money", value: result.balance },
    { label: "Custo anual estimado", kind: "money", value: result.annualExpenses },
    { label: "Percentual da renda comprometida", kind: "percentage", value: result.committedPercentage },
  ] as const;
}

export function summaryText(item: ReturnType<typeof summaryItems>[number]): string {
  return item.kind === "money" ? formatMoney(item.value) : item.value === null ? "Não calculável (renda zero)" : formatPercentage(item.value);
}

export function reportNotes(result: CostOfLivingResult): string[] {
  const notes = [
    `VA/VR aplicado em alimentação: ${formatMoney(result.appliedBenefits)}. Benefício não utilizado: ${formatMoney(result.unusedBenefits)}. VA/VR não foi somado à renda nem ao saldo em dinheiro.`,
    "A distribuição usa o total das despesas, incluindo pagamentos com VA/VR. Percentuais arredondados podem não somar exatamente 100%.",
    "O custo anual estimado é o custo mensal multiplicado por 12; não inclui custos iniciais da mudança, inflação ou reajustes.",
  ];
  if (result.details.some(item => item.period === "annual")) notes.push("Valores anuais foram divididos por 12 e arredondados para o centavo mais próximo (metade para cima). Repetir o equivalente mensal por 12 pode diferir em até R$ 0,06 por item do valor anual original.");
  if (result.appliedBenefits < result.requestedBenefits) notes.push("O VA/VR usado foi limitado ao benefício disponível e ao gasto de alimentação.");
  if (result.hasVehicle !== true) notes.push("Despesas de veículo próprio não foram incluídas neste planejamento.");
  notes.push(REPORT_DISCLAIMER);
  return notes;
}

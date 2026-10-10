import { styleExcelSheets } from "./excel-style";
import writeExcelFile, { type Cell, type Row, type Sheet } from "write-excel-file/universal";
import type { CostOfLivingResult } from "../calculations/cost-of-living";
import { reportDate, reportFooter, reportNotes, REPORT_TITLE, summaryItems, type ReportOptions } from "./report";

const currencyFormat = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const header = (value: string): Cell => ({ value, fontWeight: "bold", backgroundColor: "#164B3B", textColor: "#FFFFFF", height: 26, wrap: true });
const money = (cents: number): Cell => ({ value: cents / 100, type: Number, format: currencyFormat });

// Apenas apresentação: todos os totais e equivalentes já vieram do cálculo principal.
export function planningSheets(result: CostOfLivingResult, options: ReportOptions): Sheet<Blob>[] {
  const summary: Row[] = [
    [header(REPORT_TITLE), header(options.brand.name), header("")],
    ["Data de geração", reportDate(options.generatedAt)],
    [null],
    [header("Resumo financeiro"), header("Valor"), header("")],
    ...summaryItems(result).map(item => [item.label, item.kind === "money" ? money(item.value) : item.value === null ? "Não calculável (renda zero)" : { value: item.value / 100, type: Number, format: "0.0%" }]),
    ["VA/VR aplicado em alimentação", money(result.appliedBenefits)],
    ["VA/VR não utilizado", money(result.unusedBenefits)],
    [null],
    [header("Distribuição dos gastos"), header("Valor mensal"), header("Percentual das despesas")],
    ...result.categories.map(category => [category.label, money(category.cents), { value: category.percentage / 100, type: Number, format: "0.0%" }]),
    [null],
    [header("Observações"), header(""), header("")],
    ...reportNotes(result).map(note => [{ value: note, columnSpan: 3, wrap: true, height: 44 }]),
    [{ value: "Esta planilha é uma cópia editável dos resultados. Alterar valores não atualiza automaticamente os totais; não há fórmulas vinculadas entre as abas.", columnSpan: 3, wrap: true, height: 44 }],
    [{ value: reportFooter(options.brand), columnSpan: 3 }],
  ];
  const detail: Row[] = [
    ["Categoria", "Item", "Periodicidade", "Valor informado", "Equivalente mensal"].map(header),
    ...result.incomeDetails.map(item => ["Renda", item.label, "Mensal", money(item.cents), money(item.cents)]),
    ...result.details.map(item => [item.category, item.label, item.period === "annual" ? "Anual" : "Mensal", money(item.informedCents), money(item.monthlyCents)]),
  ];
  return [
    { sheet: "Resumo", data: summary, columns: [{ width: 43 }, { width: 29 }, { width: 27 }], showGridLines: false },
    { sheet: "Detalhamento", data: detail, columns: [{ width: 28 }, { width: 38 }, { width: 16 }, { width: 26 }, { width: 26 }], showGridLines: false },
  ];
}

export async function createPlanningExcel(result: CostOfLivingResult, options: ReportOptions): Promise<Blob> {
  return writeExcelFile(styleExcelSheets(planningSheets(result, options)), { fontFamily: "Arial", fontSize: 11 }).toBlob();
}

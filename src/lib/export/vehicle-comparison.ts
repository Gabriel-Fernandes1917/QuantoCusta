import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import writeExcelFile, { type Cell, type Row, type Sheet } from "write-excel-file/universal";
import { appLabels, ownershipLabels, vehicleDifferenceText, vehicleLabels, vehicleNotes, type VehicleResult } from "../calculations/vehicle-comparison";
import { formatVehicleHours } from "../vehicle-presentation";
import { formatMoney } from "../money";
import { reportDate, reportFooter, type ReportOptions } from "./report";

const header = (value: string): Cell => ({ value, fontWeight: "bold", backgroundColor: "#164B3B", textColor: "#FFFFFF", wrap: true, height: 40 });
const money = (value: number): Cell => ({ value: value / 100, type: Number, format: '"R$" #,##0.00;[Red]-"R$" #,##0.00' });
const number = (value: number | null | undefined): Cell | null => value == null ? null : { value, type: Number, format: "0.######" };
export function vehicleSummary(result: VehicleResult) {
  return [
    { label: "Custo de possuir / mês", value: result.own }, { label: "Custo de usar / mês", value: result.use },
    { label: "Total mensal do veículo", value: result.monthly }, { label: "Total anual do veículo", value: result.annual },
    { label: "Total mensal do aplicativo", value: result.app.monthly }, { label: "Total anual do aplicativo", value: result.app.annual },
    { label: "Diferença mensal (veículo - aplicativo)", value: result.delta.monthly }, { label: "Diferença anual (veículo - aplicativo)", value: result.delta.annual },
  ];
}
export function vehicleSheets(result: VehicleResult, options: ReportOptions): Sheet<Blob>[] {
  const v = result.input;
  const summary: Row[] = [[header("Veículo próprio ou aplicativo?"), header(options.brand.name)], ["Data", reportDate(options.generatedAt)], ["Veículo", vehicleLabels[v.vehicle!]], ["Situação", ownershipLabels[v.ownership!]], ...vehicleSummary(result).map(r => [r.label, money(r.value)]), ["Comparação", { value: vehicleDifferenceText(result.delta.monthly), wrap: true, height: 64 }], ["Espera mensal / horas", number(result.wait?.monthlyHours)], ["Espera anual / horas", number(result.wait?.annualHours)]];
  const costs: Row[] = [["Custo", "Categoria", "Periodicidade original", "Valor informado", "Equivalente mensal", "Equivalente anual", "% do custo mensal"].map(header), ...result.costs.map(c => [c.name, c.category === "own" ? "Possuir" : "Usar", c.id === "fuelMonthly" && v.fuelMode === "estimate" ? "Estimado pelo uso / mês" : c.period === "annual" ? "Anual" : "Mensal", c.id === "fuelMonthly" && v.fuelMode === "estimate" || c.informed === null ? null : money(c.informed), money(c.monthly), money(c.annual), number(c.share)])];
  if (v.fuelMode === "estimate") costs.push(["Km/mês", number(v.kilometers)], ["Consumo km/L", number(v.efficiency)], ["Preço/L", money(v.fuelPrice!)], ["Combustível mensal calculado", money(result.fuel)]);
  const app: Row[] = [[header("Transporte por aplicativo"), header("Valor")], ["Tipo", appLabels[v.app!]], ["Corridas por semana", number(v.rides)], ["Valor médio por corrida", money(v.fare!)], ["Custo semanal", money(result.app.weekly)], ["Custo mensal", money(result.app.monthly)], ["Custo anual", money(result.app.annual)], ["Espera por corrida / minutos", number(v.wait)], ["Espera semanal / minutos", number(result.wait?.weeklyMinutes)], ["Espera semanal / horas", number(result.wait?.weeklyHours)], ["Espera mensal / horas", number(result.wait?.monthlyHours)], ["Espera anual / horas", number(result.wait?.annualHours)]];
  const notes: Row[] = [[header("Premissas"), header("Conteúdo")], ...vehicleNotes.map(note => ["Premissa", { value: note, wrap: true, height: 64 }]), ["Planilha editável", { value: "Valores numéricos sem fórmulas vinculadas: editar as células não recalcula os totais. Células vazias indicam valor não informado ou não aplicável.", wrap: true, height: 64 }], ["Créditos", reportFooter(options.brand)]];
  return [{ sheet: "Resumo", data: summary, columns: [{ width: 48 }, { width: 85 }] }, { sheet: "Veículo", data: costs, columns: [28, 18, 30, 24, 24, 24, 24].map(width => ({ width })) }, { sheet: "Aplicativo", data: app, columns: [{ width: 40 }, { width: 32 }] }, { sheet: "Premissas", data: notes, columns: [{ width: 28 }, { width: 100 }] }].map(sheet => ({ ...sheet, showGridLines: false }));
}
export async function createVehicleExcel(result: VehicleResult, options: ReportOptions) { return writeExcelFile(vehicleSheets(result, options), { fontFamily: "Arial", fontSize: 11 }).toBlob(); }
export async function createVehiclePdf(result: VehicleResult, options: ReportOptions) {
  const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle("Veículo próprio ou aplicativo?"); doc.setAuthor(options.brand.name); doc.setCreationDate(options.generatedAt); doc.setLanguage("pt-BR");
  const green = rgb(22 / 255, 75 / 255, 59 / 255);
  let page = doc.addPage([595.28, 841.89]), y = 0;
  const safe = (value: string) => Array.from(value.replaceAll("−", "-").replaceAll("\u00a0", " ")).map(c => { try { font.encodeText(c); return c; } catch { return "?"; } }).join("");
  function heading() { page.drawRectangle({ x: 0, y: 744, width: 595.28, height: 98, color: green }); page.drawText("Veículo próprio ou aplicativo?", { x: 44, y: 797, font: bold, size: 22, color: rgb(1, 1, 1) }); page.drawText("Comparação do custo da sua mobilidade", { x: 44, y: 770, font, size: 12, color: rgb(1, 1, 1) }); y = 719; }
  heading();
  function text(value: string, title = false) {
    const size = title ? 13 : 10, selected = title ? bold : font; let line = "";
    for (const word of safe(value).split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (selected.widthOfTextAtSize(next, size) <= 505) { line = next; continue; }
      if (line) { draw(line); line = ""; }
      for (const char of word) { if (selected.widthOfTextAtSize(line + char, size) > 505) { draw(line); line = ""; } line += char; }
    }
    if (line) draw(line); y -= 7;
    function draw(value: string) { if (y < 75) { page = doc.addPage([595.28, 841.89]); heading(); } page.drawText(value, { x: 44, y, font: selected, size, color: green }); y -= size + 5; }
  }
  const v = result.input, decimal = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  text(`${options.brand.name} | Simulação: ${reportDate(options.generatedAt)} (horário de Brasília)`);
  text(`Veículo: ${vehicleLabels[v.vehicle!]} | Situação: ${ownershipLabels[v.ownership!]} | Aplicativo: ${appLabels[v.app!]}`);
  text("Resumo financeiro", true); vehicleSummary(result).forEach(row => text(`${row.label}: ${formatMoney(row.value)}`)); text(vehicleDifferenceText(result.delta.monthly));
  for (const category of ["own", "use"] as const) {
    text(category === "own" ? "Custo de possuir" : "Custo de usar", true);
    result.costs.filter(c => c.category === category).forEach(c => text(`${c.name}: ${formatMoney(c.monthly)}/mês | ${formatMoney(c.annual)}/ano${c.informed === null ? " | nenhum custo adicional informado" : c.id === "fuelMonthly" && v.fuelMode === "estimate" ? " | estimado pelo uso" : ` | informado: ${formatMoney(c.informed)} (${c.period === "annual" ? "anual" : "mensal"})`}.`));
  }
  if (v.fuelMode === "estimate") { text("Combustível estimado pelo uso", true); text(`${v.kilometers!.toLocaleString("pt-BR")} km/mês / ${v.efficiency!.toLocaleString("pt-BR")} km/L × ${formatMoney(v.fuelPrice!)}/L = ${formatMoney(result.fuel)}/mês.`); }
  text("Transporte por aplicativo", true); text(`${v.rides!.toLocaleString("pt-BR")} corridas/semana; valor médio ${formatMoney(v.fare!)}; custo semanal ${formatMoney(result.app.weekly)}.`);
  text("Tempo de espera informado", true);
  if (result.wait === null) text("Tempo de espera não informado.");
  else { text(`${decimal(v.wait!)} minutos/corrida; ${decimal(result.wait.weeklyMinutes)} minutos/semana (${formatVehicleHours(result.wait.weeklyHours)}).`); text(`Espera mensal: aproximadamente ${formatVehicleHours(result.wait.monthlyHours)}. Espera anual: aproximadamente ${formatVehicleHours(result.wait.annualHours)}.`); }
  text("Tempo separado do dinheiro, sem valor monetário."); text("Premissas e limites", true); vehicleNotes.forEach(note => text(note));
  doc.getPages().forEach((p, i, pages) => { p.drawText(safe(reportFooter(options.brand)).slice(0, 85), { x: 44, y: 35, font, size: 8, color: green }); p.drawText(`${i + 1}/${pages.length}`, { x: 520, y: 35, font, size: 8, color: green }); });
  return doc.save();
}

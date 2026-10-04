import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import writeExcelFile, { type Cell, type Row, type Sheet } from "write-excel-file/universal";
import { ingredientDetailText, mealTimeDifferenceText, mealInsights, mealNotes, quantityUnitLabel, type MealResult } from "../calculations/meal-comparison";
import { formatMoney } from "../money";
import { reportDate, reportFooter, type ReportOptions } from "./report";

const header = (value: string): Cell => ({ value, fontWeight: "bold", backgroundColor: "#164B3B", textColor: "#FFFFFF", wrap: true, height: 40 });
const number = (value: number, money = true): Cell => ({ value: money ? value / 100 : value, type: Number, format: money ? '"R$" #,##0.00;[Red]-"R$" #,##0.00' : "0.######" });
export function mealSummary(result: MealResult) {
  return [
    { label: "Alimentos/refeições por mês", home: result.foodHome, outside: result.foodOutside, money: true },
    { label: "Custos de preparo por mês", home: result.preparation, outside: null, money: true },
    { label: "Total mensal", home: result.homeMonthly, outside: result.outsideMonthly, money: true },
    { label: "Total anual", home: result.homeAnnual, outside: result.outsideAnnual, money: true },
    { label: "Tempo semanal (horas)", home: result.time.home.weekly, outside: result.time.outside.weekly, money: false },
    { label: "Tempo mensal (horas)", home: result.time.home.monthly, outside: result.time.outside.monthly, money: false },
    { label: "Tempo anual (horas)", home: result.time.home.annual, outside: result.time.outside.annual, money: false },
  ];
}
export function mealSheets(result: MealResult, options: ReportOptions): Sheet<Blob>[] {
  requireCompleteMeal(result);
  const summary: Row[] = [[header("Comer fora ou cozinhar?"), header(options.brand.name)], ["Data", reportDate(options.generatedAt)], ["Item", "Em casa", "Fora", "Diferença (fora − casa)"].map(header), ...mealSummary(result).map(r => [r.label, number(r.home, r.money), r.outside === null ? null : number(r.outside, r.money), r.outside === null ? null : number(r.outside - r.home, r.money)]), ["Diferença mensal", number(result.delta.monthly)], ["Diferença anual", number(result.delta.annual)], ["Gás de preparo / mês", number(result.preparationDetails.gas)], ["Energia de preparo / mês", number(result.preparationDetails.electricity)], ["Outros custos de preparo / mês", number(result.preparationDetails.other)], ["Compras / horas semanais", number(result.timeDetails.shopping, false)], ["Preparo / horas semanais", number(result.timeDetails.cooking, false)], ["Limpeza / horas semanais", number(result.timeDetails.cleaning, false)], ["Fora / horas semanais", number(result.timeDetails.outside, false)], ...mealInsights(result).map(insight => ["Comparação por refeição", { value: insight, wrap: true, height: 64 }])];
  const meals: Row[] = [["Refeição", "Frequência semanal", "Casa por refeição", "Fora por refeição", "Diferença por refeição", "Casa semanal", "Fora semanal", "Casa mensal", "Fora mensal", "Diferença mensal", "Casa anual", "Fora anual", "Diferença anual", "% alimentos em casa", "% refeições fora"].map(header), ...result.meals.map(m => {
    const distribution = result.distribution.find(d => d.id === m.id)!;
    return [m.name, number(m.frequency, false), number(m.home.portion), number(m.outside.portion), number(m.delta.portion), number(m.home.weekly), number(m.outside.weekly), number(m.home.monthly), number(m.outside.monthly), number(m.delta.monthly), number(m.home.annual), number(m.outside.annual), number(m.delta.annual), distribution.home === null ? null : number(distribution.home, false), distribution.outside === null ? null : number(distribution.outside, false)];
  })];
  summary.push(["Comparação de tempo", { value: mealTimeDifferenceText(result.time.home.monthly, result.time.outside.monthly), wrap: true, height: 64 }]);
  const detail: Row[] = [["Refeição", "Item", "Quantidade utilizada", "Unidade", "Preço da compra", "Quantidade comprada", "Unidade da compra", "Custo proporcional"].map(header), ...result.meals.flatMap(m => m.ingredients.map(i => [m.name, i.name || "Item sem nome", number(i.used, false), quantityUnitLabel(i.used, i.usedUnit), number(i.price), number(i.bought, false), quantityUnitLabel(i.bought, i.boughtUnit), number(i.cost)]))];
  const notes: Row[] = [[header("Premissas"), header("Conteúdo")], ...mealNotes.map(note => ["Premissa", { value: note, wrap: true, height: 64 }]), ["Planilha editável", { value: "Valores numéricos sem fórmulas vinculadas: editar as células não recalcula os totais.", wrap: true, height: 44 }], ["Créditos", reportFooter(options.brand)]];
  result.incomplete.forEach(meal => notes.push(["Refeição não comparada", { value: `${meal.name}: dados insuficientes; não incluída nos totais. ${Object.values(meal.issues).join(" ")}`, wrap: true, height: 64 }]));
  return [{ sheet: "Resumo", data: summary, columns: [42, 38, 28, 28].map(width => ({ width })) }, { sheet: "Refeições", data: meals, columns: [30, ...Array<number>(14).fill(24)].map(width => ({ width })) }, { sheet: "Detalhamento", data: detail, columns: [28, 28, 24, 18, 24, 24, 18, 24].map(width => ({ width })) }, { sheet: "Premissas", data: notes, columns: [{ width: 28 }, { width: 100 }] }].map(sheet => ({ ...sheet, showGridLines: false }));
}
export async function createMealExcel(result: MealResult, options: ReportOptions) { return writeExcelFile(mealSheets(result, options), { fontFamily: "Arial", fontSize: 11 }).toBlob(); }
function requireCompleteMeal(result: MealResult) { if (!result.meals.length) throw new Error("Complete pelo menos uma refeição antes de exportar a comparação."); }
export async function createMealPdf(result: MealResult, options: ReportOptions) {
  requireCompleteMeal(result);
  const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle("Comer fora ou cozinhar?"); doc.setAuthor(options.brand.name); doc.setCreationDate(options.generatedAt); doc.setLanguage("pt-BR");
  const green = rgb(22 / 255, 75 / 255, 59 / 255);
  let page = doc.addPage([595.28, 841.89]), y = 0;
  const safe = (value: string) => Array.from(value.replaceAll("−", "-").replaceAll("\u00a0", " ")).map(c => { try { font.encodeText(c); return c; } catch { return "?"; } }).join("");
  function heading() { page.drawRectangle({ x: 0, y: 744, width: 595.28, height: 98, color: green }); page.drawText("Comer fora ou cozinhar?", { x: 44, y: 797, font: bold, size: 22, color: rgb(1, 1, 1) }); page.drawText("Comparação da sua rotina de alimentação", { x: 44, y: 770, font, size: 12, color: rgb(1, 1, 1) }); y = 719; }
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
  text(`${options.brand.name} | Simulação: ${reportDate(options.generatedAt)} (horário de Brasília)`);
  if (result.incomplete.length) text(`Comparação somente das refeições completas. Fora dos totais: ${result.incomplete.map(m => m.name).join(", ")}. Custos de preparo informados permanecem no total geral.`);
  text("Resumo: em casa | fora | diferença (fora - casa)", true);
  mealSummary(result).forEach(r => { const format = (n: number) => r.money ? formatMoney(n) : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`; text(`${r.label}: ${format(r.home)} | ${r.outside === null ? "não se aplica" : format(r.outside)}${r.outside === null || !r.money ? "" : ` | ${format(r.outside - r.home)}`}`); });
  text(`Diferença mensal: ${formatMoney(result.delta.monthly)}. Diferença anual: ${formatMoney(result.delta.annual)}.`);
  text("Custos de preparo informados", true); text(`Gás: ${formatMoney(result.preparationDetails.gas)}/mês; energia: ${formatMoney(result.preparationDetails.electricity)}/mês; outros: ${formatMoney(result.preparationDetails.other)}/mês. Sem divisão entre refeições.`);
  text("Comparação por refeição: em casa | fora | diferença", true);
  result.meals.forEach(m => { text(`${m.name}: ${m.frequency.toLocaleString("pt-BR")} vezes/semana`, true); for (const [label, a, b, delta] of [["Por refeição", m.home.portion, m.outside.portion, m.delta.portion], ["Semanal", m.home.weekly, m.outside.weekly, m.delta.weekly], ["Mensal", m.home.monthly, m.outside.monthly, m.delta.monthly], ["Anual", m.home.annual, m.outside.annual, m.delta.annual]] as const) text(`${label}: ${formatMoney(a)} | ${formatMoney(b)} | ${formatMoney(delta)}`); });
  if (result.meals.length >= 2) text("O que muda entre as refeições?", true);
  mealInsights(result).forEach(insight => insight.split("\n").forEach((line, index) => text(line, index === 0 && insight.includes("\n"))));
  text("Tempo informado", true); text(`Horas semanais: compras ${result.timeDetails.shopping}; preparo ${result.timeDetails.cooking}; limpeza ${result.timeDetails.cleaning}; comprar/comer fora ${result.timeDetails.outside}. Tempo não convertido em dinheiro.`);
  text(mealTimeDifferenceText(result.time.home.monthly, result.time.outside.monthly));
  text("Detalhamento dos itens utilizados", true);
  result.meals.forEach(m => { text(m.name, true); m.ingredients.forEach(i => text(ingredientDetailText(i))); });
  text("Premissas e limites", true); mealNotes.forEach(note => text(note));
  doc.getPages().forEach((p, i, pages) => { p.drawText(safe(reportFooter(options.brand)).slice(0, 85), { x: 44, y: 35, font, size: 8, color: green }); p.drawText(`${i + 1}/${pages.length}`, { x: 520, y: 35, font, size: 8, color: green }); });
  return doc.save();
}

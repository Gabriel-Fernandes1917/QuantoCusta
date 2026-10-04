import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import writeExcelFile, { type Cell, type Row, type Sheet } from "write-excel-file/universal";
import { breakEvenNote, breakEvenText, comparisonNotes, periodLabels, type Detail, type ComparisonResult } from "../calculations/property-comparison";
import { formatMoney } from "../money";
import { reportDate, reportFooter, type ReportOptions } from "./report";

export function comparisonSummary(result: ComparisonResult) {
  const [a, b] = result.scenarios;
  return [
    { label: "Custo direto", a: a.direct, b: b.direct, money: true },
    { label: "Custos recorrentes adicionais", a: a.additional, b: b.additional, money: true },
    { label: "Transporte", a: a.transport, b: b.transport, money: true },
    { label: "Alimentação relacionada", a: a.food, b: b.food, money: true },
    { label: "Outros impactos", a: a.other, b: b.other, money: true },
    { label: "Custo recorrente mensal", a: a.total, b: b.total, money: true },
    { label: "Custo recorrente anual", a: a.annual, b: b.annual, money: true },
    { label: "Custos únicos", a: a.unique, b: b.unique, money: true },
    { label: "Deslocamento semanal (horas)", a: a.commute.weekly, b: b.commute.weekly, money: false },
    { label: "Deslocamento mensal (horas)", a: a.commute.monthly, b: b.commute.monthly, money: false },
    { label: "Deslocamento anual (horas)", a: a.commute.annual, b: b.commute.annual, money: false },
  ];
}
const header = (value: string): Cell => ({ value, fontWeight: "bold", backgroundColor: "#164B3B", textColor: "#FFFFFF", wrap: true, height: 30 });
const number = (value: number, money = true): Cell => ({ value: money ? value / 100 : value, type: Number, format: money ? '"R$" #,##0.00;[Red]-"R$" #,##0.00' : "0.0" });
export function comparisonSheets(result: ComparisonResult, options: ReportOptions): Sheet<Blob>[] {
  const [a, b] = result.scenarios;
  const summary: Row[] = [[header("Comparação de imóveis"), header(options.brand.name)], ["Data", reportDate(options.generatedAt)], ["Diferenças: B − A"], ["Item", `A: ${a.name}`, `B: ${b.name}`, "Diferença"].map(header), ...comparisonSummary(result).map(r => [r.label, number(r.a, r.money), number(r.b, r.money), number(r.b - r.a, r.money)])];
  summary.push(["Diferença recorrente mensal (B − A)", number(result.delta.monthly)], ["Diferença recorrente anual (B − A)", number(result.delta.annual)], ["Diferença de custos únicos (B − A)", number(result.delta.unique)]);
  if (result.breakEven) summary.push(["Ponto de equilíbrio (meses)", number(result.breakEven.months, false)], ["Comparação matemática", { value: breakEvenText(result), wrap: true, height: 64 }], ["Premissa do ponto de equilíbrio", { value: breakEvenNote, wrap: true, height: 64 }]);
  const detail: Row[] = [["Categoria", "Item", "Periodicidade A", "Periodicidade B", "A informado", "B informado", "A mensal", "B mensal", "Diferença mensal", "A único", "B único", "Diferença de custos únicos", "Diferença informada (mesma periodicidade)"].map(header), ...result.details.map(d => [d.category, d.item, periodLabels[d.periodA], periodLabels[d.periodB], number(d.informedA), number(d.informedB), d.periodA === "once" ? null : number(d.a), d.periodB === "once" ? null : number(d.b), d.periodA === "once" && d.periodB === "once" ? null : number(d.b - d.a), number(d.uniqueA), number(d.uniqueB), number(d.uniqueB - d.uniqueA), d.periodA === d.periodB ? number(d.informedB - d.informedA) : null])];
  const notes: Row[] = [[header("Premissas e itens incluídos"), header("Conteúdo")], ["A: " + a.name, a.included.join(", ") || "Nenhum item marcado"], ["B: " + b.name, b.included.join(", ") || "Nenhum item marcado"], ...comparisonNotes.map(note => ["Premissa", { value: note, wrap: true, height: 64 }]), ["Planilha editável", { value: "Valores numéricos sem fórmulas vinculadas: editar as células não recalcula os totais.", wrap: true, height: 44 }], ["Créditos", reportFooter(options.brand)]];
  if (result.unanswered.length) notes.push(["Sem resposta", { value: `Diferenças sem custo atribuído: ${result.unanswered.join(", ")}.`, wrap: true, height: 44 }]);
  return [{ sheet: "Resumo", data: summary, columns: [42, 32, 32, 26].map(width => ({ width })), showGridLines: false }, { sheet: "Comparação detalhada", data: detail, columns: [26, 32, 18, 18, 24, 24, 24, 24, 24, 24, 24, 28, 32].map(width => ({ width })), showGridLines: false }, { sheet: "Premissas", data: notes, columns: [{ width: 30 }, { width: 95 }], showGridLines: false }];
}
export async function createComparisonExcel(result: ComparisonResult, options: ReportOptions) { return writeExcelFile(comparisonSheets(result, options), { fontFamily: "Arial", fontSize: 11 }).toBlob(); }

export function comparisonDetailLines(d: Detail) {
  const lines = [`${d.category} - ${d.item}: A ${formatMoney(d.informedA)} (${periodLabels[d.periodA]}) | B ${formatMoney(d.informedB)} (${periodLabels[d.periodB]})`];
  if (d.periodA !== "once" || d.periodB !== "once") lines.push(`Equivalente mensal: A ${d.periodA === "once" ? "sem equivalente mensal" : formatMoney(d.a)} | B ${d.periodB === "once" ? "sem equivalente mensal" : formatMoney(d.b)} | Diferença recorrente mensal ${formatMoney(d.b - d.a)}`);
  if (d.periodA === "once" || d.periodB === "once") lines.push(`Custos únicos: A ${formatMoney(d.uniqueA)} | B ${formatMoney(d.uniqueB)} | Diferença ${formatMoney(d.uniqueB - d.uniqueA)}`);
  return lines;
}

export async function createComparisonPdf(result: ComparisonResult, options: ReportOptions) {
  const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle("Comparação de imóveis"); doc.setAuthor(options.brand.name); doc.setCreationDate(options.generatedAt); doc.setLanguage("pt-BR");
  const green = rgb(22 / 255, 75 / 255, 59 / 255);
  let page = doc.addPage([595.28, 841.89]), y = 0;
  const safe = (text: string) => Array.from(text.replaceAll("−", "-").replaceAll("\u00a0", " ")).map(c => { try { font.encodeText(c); return c; } catch { return "?"; } }).join("");
  function heading() { page.drawRectangle({ x: 0, y: 744, width: 595.28, height: 98, color: green }); page.drawText("Comparação de imóveis", { x: 44, y: 797, font: bold, size: 22, color: rgb(1, 1, 1) }); page.drawText(safe(options.brand.name), { x: 44, y: 770, font, size: 12, color: rgb(1, 1, 1) }); y = 719; }
  heading();
  function text(value: string, title = false) {
    const size = title ? 13 : 10, selected = title ? bold : font;
    // Envelopa também palavras longas e nomes personalizados sem suporte WinAnsi.
    let line = "";
    for (const char of safe(value)) {
      if (selected.widthOfTextAtSize(line + char, size) > 505) { draw(line); line = ""; }
      line += char;
    }
    if (line) draw(line);
    y -= 7;
    function draw(line: string) { if (y < 75) { page = doc.addPage([595.28, 841.89]); heading(); } page.drawText(line, { x: 44, y, font: selected, size, color: green }); y -= size + 5; }
  }
  const [a, b] = result.scenarios;
  text(`Simulação: ${reportDate(options.generatedAt)} (horário de Brasília)`);
  text(`A: ${a.name} | B: ${b.name}`, true); text("Diferença = B - A. Dinheiro e tempo são métricas separadas.");
  text("Resumo lado a lado: A | B | Diferença", true);
  comparisonSummary(result).forEach(r => { const format = (n: number) => r.money ? formatMoney(n) : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`; text(`${r.label}: ${format(r.a)} | ${format(r.b)} | ${format(r.b - r.a)}`); });
  text(`Diferença recorrente mensal: ${formatMoney(result.delta.monthly)}`);
  text(`Diferença recorrente anual: ${formatMoney(result.delta.annual)}`);
  text(`Diferença de custos únicos: ${formatMoney(result.delta.unique)}`);
  if (result.breakEven) { text("Ponto de equilíbrio matemático", true); breakEvenText(result).split("\n\n").forEach(paragraph => text(paragraph)); text(breakEvenNote); }
  text("Detalhamento: recorrentes e únicos separados", true);
  result.details.filter(d => d.a || d.b || d.informedA || d.informedB).forEach(d => {
    comparisonDetailLines(d).forEach(line => text(line));
  });
  text("Itens incluídos e serviços disponíveis", true); text(`A: ${a.included.join(", ") || "Nenhum item marcado"}`); text(`B: ${b.included.join(", ") || "Nenhum item marcado"}`);
  text("Premissas", true); comparisonNotes.forEach(note => text(note));
  if (result.unanswered.length) text(`Diferenças sem resposta e sem custo atribuído: ${result.unanswered.join(", ")}.`);
  doc.getPages().forEach((p, i, pages) => { p.drawText(safe(reportFooter(options.brand)).slice(0, 85), { x: 44, y: 35, font, size: 8, color: green }); p.drawText(`${i + 1}/${pages.length}`, { x: 520, y: 35, font, size: 8, color: green }); });
  return doc.save();
}

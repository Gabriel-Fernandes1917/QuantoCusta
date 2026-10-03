import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import writeExcelFile, { type Cell, type Row, type Sheet } from "write-excel-file/universal";
import { comparisonNotes, type ComparisonResult } from "../calculations/property-comparison";
import { formatMoney } from "../money";
import { reportDate, reportFooter, type ReportOptions } from "./report";

export function comparisonSummary(result: ComparisonResult) {
  const [a, b] = result.scenarios;
  return [
    { label: "Custo direto", a: a.direct, b: b.direct, money: true },
    { label: "Custos adicionais identificados", a: a.additional, b: b.additional, money: true },
    { label: "Transporte", a: a.transport, b: b.transport, money: true },
    { label: "Alimentação relacionada", a: a.food, b: b.food, money: true },
    { label: "Outros impactos", a: a.other, b: b.other, money: true },
    { label: "Custo total mensal", a: a.total, b: b.total, money: true },
    { label: "Custo total anual", a: a.annual, b: b.annual, money: true },
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
  const detail: Row[] = [["Categoria", "Item", "Periodicidade A", "Periodicidade B", "A informado", "B informado", "A mensal", "B mensal", "Diferença mensal"].map(header), ...result.details.map(d => [d.category, d.item, d.periodA === "annual" ? "Anual" : "Mensal", d.periodB === "annual" ? "Anual" : "Mensal", number(d.informedA), number(d.informedB), number(d.a), number(d.b), number(d.b - d.a)])];
  const notes: Row[] = [[header("Premissas e itens incluídos"), header("Conteúdo")], ["A: " + a.name, a.included.join(", ") || "Nenhum item marcado"], ["B: " + b.name, b.included.join(", ") || "Nenhum item marcado"], ...comparisonNotes.map(note => ["Premissa", { value: note, wrap: true, height: 64 }]), ["Planilha editável", { value: "Valores numéricos sem fórmulas vinculadas: editar as células não recalcula os totais.", wrap: true, height: 44 }], ["Créditos", reportFooter(options.brand)]];
  if (result.unanswered.length) notes.push(["Sem resposta", { value: `Diferenças sem custo atribuído: ${result.unanswered.join(", ")}.`, wrap: true, height: 44 }]);
  return [{ sheet: "Resumo", data: summary, columns: [42, 32, 32, 26].map(width => ({ width })), showGridLines: false }, { sheet: "Comparação detalhada", data: detail, columns: [26, 32, 18, 18, 24, 24, 24, 24, 24].map(width => ({ width })), showGridLines: false }, { sheet: "Premissas", data: notes, columns: [{ width: 30 }, { width: 95 }], showGridLines: false }];
}
export async function createComparisonExcel(result: ComparisonResult, options: ReportOptions) { return writeExcelFile(comparisonSheets(result, options), { fontFamily: "Arial", fontSize: 11 }).toBlob(); }

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
  text("Detalhamento: equivalentes mensais", true);
  result.details.filter(d => d.a || d.b || d.informedA || d.informedB).forEach(d => {
    text(`${d.category} - ${d.item}: A ${formatMoney(d.a)} | B ${formatMoney(d.b)} | Diferença ${formatMoney(d.b - d.a)}`);
    if (d.periodA === "annual" || d.periodB === "annual") text(`Valores informados: A ${formatMoney(d.informedA)}/${d.periodA === "annual" ? "ano" : "mês"}; B ${formatMoney(d.informedB)}/${d.periodB === "annual" ? "ano" : "mês"}.`);
  });
  text("Itens incluídos e serviços disponíveis", true); text(`A: ${a.included.join(", ") || "Nenhum item marcado"}`); text(`B: ${b.included.join(", ") || "Nenhum item marcado"}`);
  text("Premissas", true); comparisonNotes.forEach(note => text(note));
  if (result.unanswered.length) text(`Diferenças sem resposta e sem custo atribuído: ${result.unanswered.join(", ")}.`);
  doc.getPages().forEach((p, i, pages) => { p.drawText(safe(reportFooter(options.brand)).slice(0, 85), { x: 44, y: 35, font, size: 8, color: green }); p.drawText(`${i + 1}/${pages.length}`, { x: 520, y: 35, font, size: 8, color: green }); });
  return doc.save();
}

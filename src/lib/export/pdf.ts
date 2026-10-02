import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { CostOfLivingResult } from "../calculations/cost-of-living";
import { formatMoney, formatPercentage } from "../money";
import { reportDate, reportFooter, reportNotes, REPORT_TITLE, summaryItems, summaryText, type ReportOptions } from "./report";

const green = rgb(22 / 255, 75 / 255, 59 / 255);
const ink = rgb(32 / 255, 59 / 255, 51 / 255);
const muted = rgb(83 / 255, 102 / 255, 94 / 255);
const line = rgb(220 / 255, 227 / 255, 213 / 255);
const pale = rgb(242 / 255, 244 / 255, 235 / 255);

// Helvetica/WinAnsi inclui os acentos portugueses; o sinal de menos é normalizado.
function printable(text: string): string { return text.replaceAll("−", "-").replaceAll("\u00a0", " "); }

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of printable(text).split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) { current = candidate; continue; }
    if (current) { lines.push(current); current = ""; }
    for (const char of word) {
      if (current && font.widthOfTextAtSize(current + char, size) > width) { lines.push(current); current = ""; }
      current += char;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function createPlanningPdf(result: CostOfLivingResult, options: ReportOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(REPORT_TITLE);
  doc.setAuthor(options.brand.name);
  doc.setCreator(options.brand.name);
  doc.setCreationDate(options.generatedAt);
  doc.setModificationDate(options.generatedAt);
  doc.setLanguage("pt-BR");
  const width = 595.28;
  const height = 841.89;
  const margin = 44;
  const contentWidth = width - margin * 2;
  const bottom = 72;
  let page = doc.addPage([width, height]);
  let y = 0;

  function header() {
    page.drawRectangle({ x: 0, y: height - 105, width, height: 105, color: green });
    page.drawText(REPORT_TITLE, { x: margin, y: height - 47, font: bold, size: 21, color: rgb(1, 1, 1) });
    page.drawText(printable(options.brand.name), { x: margin, y: height - 77, font: regular, size: 12, color: rgb(216 / 255, 235 / 255, 146 / 255) });
    page.drawText(`Gerado em ${reportDate(options.generatedAt)} (horário de Brasília)`, { x: margin, y: height - 126, font: regular, size: 9, color: muted });
    y = height - 158;
  }
  header();

  function ensure(space: number) {
    if (y - space < bottom) { page = doc.addPage([width, height]); header(); }
  }

  function section(title: string, minimum = 38) {
    ensure(minimum + 30);
    page.drawText(printable(title), { x: margin, y, size: 15, font: bold, color: green });
    y -= 24;
  }

  function paragraph(text: string, size = 10) {
    for (const row of wrap(text, regular, size, contentWidth)) {
      ensure(size + 7);
      page.drawText(row, { x: margin, y, size, font: regular, color: muted });
      y -= size + 5;
    }
    y -= 8;
  }

  function pair(label: string, value: string, shaded = false) {
    const valueText = printable(value);
    const valueWidth = bold.widthOfTextAtSize(valueText, 10);
    const labels = wrap(label, regular, 10, contentWidth - valueWidth - 22);
    const rowHeight = Math.max(24, labels.length * 14 + 10);
    ensure(rowHeight);
    if (shaded) page.drawRectangle({ x: margin - 8, y: y - rowHeight + 10, width: contentWidth + 16, height: rowHeight, color: pale });
    labels.forEach((row, index) => page.drawText(row, { x: margin, y: y - index * 14, size: 10, font: regular, color: ink }));
    page.drawText(valueText, { x: width - margin - valueWidth, y, size: 10, font: bold, color: ink });
    y -= rowHeight;
  }

  section("1. Resumo financeiro");
  summaryItems(result).forEach((item, index) => pair(item.label, summaryText(item), index % 2 === 0));
  y -= 20;

  section("2. Distribuição dos gastos");
  result.categories.forEach(category => pair(category.label, `${formatMoney(category.cents)}/mês · ${formatPercentage(category.percentage)}`));
  y -= 20;

  section("3. Detalhamento das despesas");
  if (!result.details.length) paragraph("Nenhuma despesa foi informada.");
  for (const category of result.categories) {
    const items = result.details.filter(item => item.categoryId === category.id);
    if (!items.length) continue;
    ensure(22 + (items[0].period === "annual" ? 54 : 24) + 16);
    page.drawText(category.label.toLocaleUpperCase("pt-BR"), { x: margin, y, size: 10, font: bold, color: green });
    y -= 22;
    for (const item of items) {
      if (item.period === "annual") {
        ensure(54);
        pair(item.label, `Valor anual: ${formatMoney(item.informedCents)}`);
        pair("Equivalente mensal", `${formatMoney(item.monthlyCents)}/mês`);
      } else pair(item.label, `${formatMoney(item.monthlyCents)}/mês`);
    }
    y -= 16;
  }

  section("4. Observações");
  reportNotes(result).forEach(note => paragraph(note, 9));
  const pages = doc.getPages();
  const footer = wrap(reportFooter(options.brand), regular, 8, contentWidth - 65);
  pages.forEach((reportPage, index) => {
    reportPage.drawLine({ start: { x: margin, y: 54 }, end: { x: width - margin, y: 54 }, thickness: 0.7, color: line });
    footer.slice(0, 2).forEach((row, rowIndex) => reportPage.drawText(row, { x: margin, y: 39 - rowIndex * 11, size: 8, font: regular, color: muted }));
    const counter = `${index + 1} / ${pages.length}`;
    reportPage.drawText(counter, { x: width - margin - regular.widthOfTextAtSize(counter, 8), y: 39, size: 8, font: regular, color: muted });
  });
  return doc.save();
}

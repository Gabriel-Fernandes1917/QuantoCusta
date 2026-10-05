import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import writeExcelFile, { type Cell, type Row, type Sheet } from "write-excel-file/universal";
import { formatTravelTime, lodgingDifferenceText, lodgingNotes, lodgingPriceInsight, lodgingTimeText, mealLabels, transportLabels, tripLabels, usesVehicle, type LodgingResult } from "../calculations/lodging-comparison";
import { formatMoney } from "../money";
import { reportDate, reportFooter, type ReportOptions } from "./report";

const header = (value: string): Cell => ({ value, fontWeight: "bold", backgroundColor: "#164B3B", textColor: "#FFFFFF", wrap: true, height: 40 });
const money = (value: number | null): Cell | null => value === null ? null : ({ value: value / 100, type: Number, format: '"R$" #,##0.00;[Red]-"R$" #,##0.00' });
const number = (value: number | null): Cell | null => value === null ? null : { value, type: Number, format: "0.######" };
const wrapped = (value: string): Cell => ({ value, wrap: true, height: 64 });
export function lodgingSheets(r: LodgingResult, options: ReportOptions): Sheet<Blob>[] {
  const v = r.input, [a, b] = r.scenarios, vehicle = usesVehicle(v.transport);
  const summary: Row[] = [[header("Comparar hospedagens"), header(a.name), header(b.name)], ["Data da simulação", reportDate(options.generatedAt)], ["Pessoas", number(v.people)], ["Noites", number(v.nights)], ["Transporte", transportLabels[v.transport!]], ["Preço da hospedagem", money(a.price), money(b.price)], ["Custos adicionais", money(a.additional), money(b.additional)], ["Custo total comparável", money(a.total), money(b.total)], ["Custo comparável por pessoa", money(a.perPerson), money(b.perPerson)], ["Diferença financeira (A - B)", money(r.delta)], ["Tempo total / minutos", number(a.minutes), number(b.minutes)], ["Diferença de tempo / minutos (A - B)", number(r.minutesDelta)], ["Comparação", wrapped(lodgingDifferenceText(r))], ["Reserva × total", wrapped(lodgingPriceInsight(r))], ["Comparação de tempo", wrapped(lodgingTimeText(r))], ["Custo por pessoa", wrapped("Divisão simples do total pelo número de pessoas informado.")]];
  const lodging: Row[] = [[header("Item"), header(a.name), header(b.name)]];
  const addMoney = (label: string, values: (number | null)[]) => lodging.push([label, ...values.map(money)]);
  const addNumbers = (label: string, values: (number | null)[]) => lodging.push([label, ...values.map(number)]);
  lodging.push(["Modo do preço", ...v.lodgings.map(l => l.priceMode === "total" ? "Total da estadia" : "Diária")]);
  addMoney("Preço informado", v.lodgings.map(l => l.price));
  a.breakdown.forEach((category, i) => addMoney(category.label, [category.value, b.breakdown[i].value]));
  Object.entries(mealLabels).forEach(([key, label], i) => {
    const meals = v.lodgings.map(l => l.meals[key as keyof typeof mealLabels]);
    lodging.push([`${label} incluído`, ...meals.map(m => m.included ? "Sim" : "Não")]);
    addMoney(`${label} / pessoa / dia informado`, meals.map(m => m.included ? null : m.price));
    addNumbers(`${label} / dias informados`, meals.map(m => m.included ? null : m.days));
    addMoney(`${label} adicional / total`, [a.meals[i].total, b.meals[i].total]);
  });
  lodging.push(["Estacionamento incluído", ...v.lodgings.map(l => l.parking.included ? "Sim" : "Não")], ["Estacionamento / periodicidade", ...v.lodgings.map(l => !vehicle || l.parking.included ? "Não aplicável" : l.parking.period === "day" ? "Por dia" : "Total da estadia")]);
  addMoney("Estacionamento / valor informado", v.lodgings.map(l => vehicle && !l.parking.included ? l.parking.price : null));
  addNumbers("Estacionamento / dias informados", v.lodgings.map(l => vehicle && !l.parking.included && l.parking.period === "day" ? l.parking.days : null));
  v.extras.forEach((e, i) => addMoney(e.name.trim() || `Outro custo ${i + 1}`, e.amounts));
  const travel: Row[] = [["Local", "Hospedagem", "Transporte", "Tipo de deslocamento", "Visitas", "Distância por trecho / km", "Distância total / km", "Consumo / km/L", "Combustível / R$/L", "Combustível total", "Estacionamento / visita", "Estacionamento total", "Pedágio / visita completa", "Pedágio total", "Aplicativo/manual / visita", "Aplicativo/manual total", "Custo total", "Tempo por trecho / min", "Tempo total / min"].map(header)];
  v.places.forEach((p, i) => r.scenarios.forEach((s, index) => {
    const j = p.journeys[index], calculated = s.journeys[i], parking = p.sameParking ? p.journeys[0] : j;
    travel.push([calculated.name, s.name, transportLabels[v.transport!], tripLabels[p.kind], number(p.visits), number(vehicle ? j.distance : null), number(calculated.distance), number(vehicle ? v.efficiency : null), money(vehicle ? v.fuelPrice : null), money(calculated.fuel), money(vehicle && parking.parkingPaid ? parking.parking : null), money(calculated.parking), money(vehicle && j.tollPaid ? j.toll : null), money(calculated.toll), money(vehicle ? null : j.fare), money(calculated.fare), money(calculated.total), number(j.minutes), number(calculated.minutes)]);
  }));
  const notes: Row[] = [[header("Premissas"), header("Conteúdo")], ...lodgingNotes.map(note => ["Premissa", wrapped(note)]), ["Planilha editável", wrapped("Valores numéricos sem fórmulas vinculadas: editar as células não recalcula os totais. Células vazias indicam valor não informado ou não aplicável. Tempos ficam separados do dinheiro.")], ["Créditos", reportFooter(options.brand)]];
  return [{ sheet: "Resumo", data: summary, columns: [{ width: 42 }, { width: 65 }, { width: 38 }] }, { sheet: "Hospedagens", data: lodging, columns: [{ width: 48 }, { width: 35 }, { width: 35 }] }, { sheet: "Deslocamentos", data: travel, columns: Array.from({ length: 19 }, (_, i) => ({ width: i < 4 ? 28 : 22 })) }, { sheet: "Premissas", data: notes, columns: [{ width: 28 }, { width: 100 }] }].map(sheet => ({ ...sheet, showGridLines: false }));
}
export async function createLodgingExcel(result: LodgingResult, options: ReportOptions) { return writeExcelFile(lodgingSheets(result, options), { fontFamily: "Arial", fontSize: 11 }).toBlob(); }
export async function createLodgingPdf(result: LodgingResult, options: ReportOptions) {
  const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle("Comparar hospedagens"); doc.setAuthor(options.brand.name); doc.setCreationDate(options.generatedAt); doc.setLanguage("pt-BR");
  const green = rgb(22 / 255, 75 / 255, 59 / 255);
  let page = doc.addPage([595.28, 841.89]), y = 0;
  const safe = (value: string) => Array.from(value.replaceAll("−", "-").replaceAll("\u00a0", " ")).map(c => { try { font.encodeText(c); return c; } catch { return "?"; } }).join("");
  function heading() { page.drawRectangle({ x: 0, y: 744, width: 595.28, height: 98, color: green }); page.drawText("Comparar hospedagens", { x: 44, y: 797, font: bold, size: 22, color: rgb(1, 1, 1) }); page.drawText("Comparação do custo real das opções da sua viagem", { x: 44, y: 770, font, size: 12, color: rgb(1, 1, 1) }); y = 719; }
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
  const v = result.input, decimal = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
  text(`${options.brand.name} | Simulação: ${reportDate(options.generatedAt)} (horário de Brasília)`);
  text(`${v.people} pessoas | ${v.nights} noites | ${transportLabels[v.transport!]}`);
  text("Resumo financeiro", true);
  result.scenarios.forEach(s => text(`${s.name}: reserva ${formatMoney(s.price)}; adicionais ${formatMoney(s.additional)}; custo total comparável ${formatMoney(s.total)}; por pessoa ${formatMoney(s.perPerson)}.`));
  text(lodgingDifferenceText(result)); text(`Diferença: ${formatMoney(Math.abs(result.delta))}.`); text(lodgingPriceInsight(result));
  result.scenarios.forEach((s, i) => {
    const l = v.lodgings[i]; text(s.name, true);
    text(`Preço informado: ${formatMoney(l.price!)} (${l.priceMode === "night" ? `diária × ${v.nights} noites` : "total da estadia"}). Total da hospedagem: ${formatMoney(s.price)}.`);
    s.breakdown.slice(1).forEach(b => text(`${b.label}: ${formatMoney(b.value)}.`));
    Object.entries(mealLabels).forEach(([key, label], j) => { const m = l.meals[key as keyof typeof mealLabels]; text(`${label}: ${m.included ? "incluído" : m.price === null ? "nenhum custo adicional informado" : `${formatMoney(m.price)}/pessoa/dia × ${v.people} pessoas × ${m.days} dias = ${formatMoney(s.meals[j].total)}`}.`); });
    text(`Estacionamento incluído: ${l.parking.included ? "sim" : "não"}. ${!usesVehicle(v.transport) ? "Sem veículo: não aplicável." : l.parking.included || l.parking.price === null ? "Nenhum custo adicional." : `Informado ${formatMoney(l.parking.price)} ${l.parking.period === "day" ? `por dia × ${l.parking.days} dias` : "no total da estadia"}; total ${formatMoney(s.parking)}.`}`);
    s.extras.forEach(e => text(`${e.name}: ${formatMoney(e.total)} no total da viagem.`));
  });
  text("Deslocamentos por local", true);
  if (usesVehicle(v.transport) && v.places.length) text(`Consumo: ${decimal(v.efficiency!)} km/L. Combustível: ${formatMoney(v.fuelPrice!)}/L.`);
  if (!v.places.length) text("Nenhum local cadastrado.");
  v.places.forEach((p, i) => {
    text(`${p.name.trim() || `Local ${i + 1}`} | ${p.visits} visita(s) | ${tripLabels[p.kind]}`, true);
    result.scenarios.forEach((s, index) => {
      const j = s.journeys[i], informed = p.journeys[index];
      text(`${s.name}: ${j.distance === null ? `${v.transport === "app" ? "corridas" : "custo manual"} ${formatMoney(informed.fare!)}/visita; total ${formatMoney(j.fare)}` : `${decimal(informed.distance!)} km/trecho; ${decimal(j.distance)} km totais; combustível ${formatMoney(j.fuel)}; estacionamento no destino ${formatMoney(j.parking)}; pedágio ${formatMoney(j.toll)}`}. Custo de deslocamentos: ${formatMoney(j.total)}.`);
      text(`Tempo: ${j.minutes === null ? "não informado" : `${decimal(informed.minutes!)} min/trecho; ${decimal(j.minutes)} min totais (aproximadamente ${formatTravelTime(j.minutes)})`}.`);
    });
  });
  text("Tempo total de deslocamento", true);
  result.scenarios.forEach(s => text(`${s.name}: ${s.minutes === null ? "incompleto: faltam tempos de locais" : `${decimal(s.minutes)} minutos (aproximadamente ${formatTravelTime(s.minutes)})`}.`)); text(lodgingTimeText(result));
  if (result.minutesDelta !== null) text(`Diferença de tempo: ${decimal(Math.abs(result.minutesDelta))} minutos (aproximadamente ${formatTravelTime(Math.abs(result.minutesDelta))}).`);
  text("Tempo separado do dinheiro, sem valor monetário.");
  text("Por que os custos são diferentes?", true); if (!result.differences.length) text("Os custos informados são iguais em todas as categorias.");
  result.differences.forEach(d => text(`${d.label}: ${result.scenarios[0].name} ${formatMoney(d.a)}; ${result.scenarios[1].name} ${formatMoney(d.b)}; diferença (A - B) ${formatMoney(d.delta)}.`));
  text("Premissas e limites", true); lodgingNotes.forEach(note => text(note));
  doc.getPages().forEach((p, i, pages) => { p.drawText(safe(reportFooter(options.brand)).slice(0, 85), { x: 44, y: 35, font, size: 8, color: green }); p.drawText(`${i + 1}/${pages.length}`, { x: 520, y: 35, font, size: 8, color: green }); });
  return doc.save();
}

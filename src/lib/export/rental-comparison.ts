import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import writeExcelFile, { type Cell, type Row, type Sheet } from "write-excel-file/universal";
import { additionalLabels, beyondRentalText, formatDuration, formatQuantity, fuelModeLabels, includedLabels, rentalDifferenceText, rentalNotes, rentalPriceLabels, rentalWaitText, rideKindLabels, vehicleLabels, type RentalResult } from "../calculations/rental-comparison";
import { formatMoney, formatPercentage } from "../money";
import { reportDate, reportFooter, type ReportOptions } from "./report";

const header = (value: string): Cell => ({ value, fontWeight: "bold", backgroundColor: "#164B3B", textColor: "#FFFFFF", wrap: true, height: 40 });
const money = (value: number | null): Cell | null => value === null ? null : { value: value / 100, type: Number, format: '"R$" #,##0.00;[Red]-"R$" #,##0.00' };
const number = (value: number | null): Cell | null => value === null ? null : { value, type: Number, format: "0.######" };
const wrapped = (value: string): Cell => ({ value, wrap: true, height: 78 });
export function rentalSheets(r: RentalResult, options: ReportOptions): Sheet<Blob>[] {
  const v = r.input;
  const summary: Row[] = [
    [header("Veículo alugado ou aplicativo?"), header("Veículo alugado"), header("Transporte por aplicativo")],
    ["Data da simulação", reportDate(options.generatedAt)], ["Dias da viagem", number(v.days)], ["Pessoas (opcional)", number(v.people)],
    ["Custo total", money(r.vehicleTotal), money(r.appTotal)], ["Diferença financeira absoluta", money(r.difference)],
    ["Quantidade estimada de corridas", null, number(r.totalRides)], ["Custo médio por corrida", null, money(r.appPerRide)], ["Custo médio por dia", money(r.vehiclePerDay), money(r.appPerDay)],
    ["Custo por pessoa", money(r.vehiclePerPerson), money(r.appPerPerson)], ["Espera informada / minutos", null, number(r.waitMinutes)],
    ["Cobertura da espera", null, r.waitMinutes === null ? "Não informada" : r.waitComplete ? "Completa" : "Parcial: faltam tempos de trechos"],
    ["Caução / fora do custo total", money(r.deposit)], ["Custos além da locação", money(r.beyondRental)],
    ["Comparação", wrapped(rentalDifferenceText(r))], ["Além da locação", wrapped(beyondRentalText(r))],
  ];
  const vehicle: Row[] = [[header("Veículo alugado"), header("Valor informado"), header("Custo calculado")],
    ["Tipo", vehicleLabels[v.vehicle!]], ["Método do preço", rentalPriceLabels[v.priceMode]],
    [v.priceMode === "daily" ? "Valor da diária" : "Valor total da locação", money(v.rentalPrice)],
    ["Quantidade de diárias", number(v.priceMode === "daily" ? v.rentalDays : null)], ["Locação", null, money(r.rental)],
    ...Object.entries(includedLabels).map(([key, label]): Row => [`${label} incluído`, v.included[key as keyof typeof includedLabels] ? "Sim" : "Não"]),
    ["Extras da locadora", null, money(r.breakdown.find(c => c.key === "additionals")!.value)],
    ...r.additionals.map(c => [additionalLabels[c.key as keyof typeof additionalLabels], money(v.included[c.key as keyof typeof additionalLabels] ? null : v[c.key as keyof typeof additionalLabels]), money(c.value)] as Row),
    ["Método do combustível", fuelModeLabels[v.fuelMode]], ["Combustível / valor direto", money(v.fuelMode === "direct" ? v.fuelDirect : null)],
    ["Distância estimada / km", number(v.fuelMode === "distance" ? v.kilometers : null)], ["Consumo / km/L", number(v.fuelMode === "distance" ? v.efficiency : null)],
    ["Preço do combustível / R$/L", money(v.fuelMode === "distance" ? v.fuelPrice : null)], ["Combustível", null, money(r.fuel)],
    ["Estacionamento pago", v.parkingPaid ? "Sim" : "Não"], ["Estacionamento / método", v.parkingPaid ? v.parkingMode === "daily" ? "Por dia" : "Total" : "Não aplicável"],
    ["Estacionamento / valor informado", money(v.parkingPaid ? v.parkingPrice : null)], ["Estacionamento / dias", number(v.parkingPaid && v.parkingMode === "daily" ? v.parkingDays : null)],
    ["Estacionamento", null, money(r.parking)], ["Pedágios", money(v.tollPaid ? v.tolls : null), money(v.tollPaid ? v.tolls! : 0)],
    ["Limpeza", money(v.cleaning), money(v.cleaning ?? 0)], ...r.extras.map(e => [e.name, money(e.price), money(e.total)] as Row),
    ["Outros / total", null, money(r.breakdown.find(c => c.key === "extras")!.value)], ["Custo total", null, money(r.vehicleTotal)],
    ["Caução / fora do custo total", money(v.deposit)],
  ];
  const rides: Row[] = [["Nome", "Tipo", "Quantidade", "Valor ida", "Valor volta", "Custo por ocorrência", "Custo total", "Espera ida / min", "Espera volta / min", "Espera informada / min", "Cobertura da espera"].map(header),
    ...r.rides.map(ride => [ride.name, rideKindLabels[ride.kind], number(ride.count), money(ride.outwardFare), money(ride.kind === "round" ? ride.returnFare : null), money(ride.unitCost), money(ride.total), number(ride.outwardWait), number(ride.kind === "round" ? ride.returnWait : null), number(ride.waitMinutes), ride.waitMinutes === null ? "Não informada" : ride.waitComplete ? "Completa" : "Parcial"] as Row)];
  const notes: Row[] = [[header("Premissas"), header("Conteúdo")], ...rentalNotes.map(note => ["Premissa", wrapped(note)] as Row),
    ["Planilha editável", wrapped("Valores numéricos sem fórmulas vinculadas: editar as células não recalcula os totais. Células vazias indicam valor não informado ou não aplicável. Espera parcial soma somente trechos preenchidos. Caução não integra o custo total.")],
    ["Créditos", reportFooter(options.brand)]];
  return [
    { sheet: "Resumo", data: summary, columns: [{ width: 44 }, { width: 56 }, { width: 40 }] },
    { sheet: "Veículo alugado", data: vehicle, columns: [{ width: 46 }, { width: 38 }, { width: 26 }] },
    { sheet: "Corridas", data: rides, columns: Array.from({ length: 11 }, (_, i) => ({ width: i === 0 ? 36 : 24 })) },
    { sheet: "Premissas", data: notes, columns: [{ width: 28 }, { width: 100 }] },
  ].map(sheet => ({ ...sheet, showGridLines: false }));
}
export async function createRentalExcel(r: RentalResult, options: ReportOptions) {
  return writeExcelFile(rentalSheets(r, options), { fontFamily: "Arial", fontSize: 11 }).toBlob();
}
export async function createRentalPdf(r: RentalResult, options: ReportOptions) {
  const doc = await PDFDocument.create(), font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle("Veículo alugado ou aplicativo?"); doc.setAuthor(options.brand.name); doc.setCreationDate(options.generatedAt); doc.setLanguage("pt-BR");
  const green = rgb(22 / 255, 75 / 255, 59 / 255);
  let page = doc.addPage([595.28, 841.89]), y = 0;
  const safe = (value: string) => Array.from(value.replaceAll("−", "-").replaceAll("\u00a0", " ").replaceAll("↔", "ida e volta").replaceAll("→", "para")).map(c => { try { font.encodeText(c); return c; } catch { return "?"; } }).join("");
  function heading() {
    page.drawRectangle({ x: 0, y: 744, width: 595.28, height: 98, color: green });
    page.drawText("Veículo alugado ou aplicativo?", { x: 44, y: 797, font: bold, size: 21, color: rgb(1, 1, 1) });
    page.drawText("Comparação dos custos de mobilidade da sua viagem", { x: 44, y: 770, font, size: 12, color: rgb(1, 1, 1) }); y = 719;
  }
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
    function draw(value: string) {
      if (y < 75) { page = doc.addPage([595.28, 841.89]); heading(); }
      page.drawText(value, { x: 44, y, font: selected, size, color: green }); y -= size + 5;
    }
  }
  const v = r.input, decimal = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
  text(`${options.brand.name} | Simulação: ${reportDate(options.generatedAt)} (horário de Brasília)`);
  text(`${formatQuantity(v.days!, "dia")}${v.people === null ? "" : ` | ${formatQuantity(v.people, "pessoa")}`}`);
  text("Resumo financeiro", true);
  text(`Veículo alugado: ${formatMoney(r.vehicleTotal)}. Transporte por aplicativo: ${formatMoney(r.appTotal)}.`);
  text(rentalDifferenceText(r)); text(`Diferença financeira: ${formatMoney(r.difference)}.`);
  text(`Custo médio por dia: veículo ${formatMoney(r.vehiclePerDay)}; aplicativo ${formatMoney(r.appPerDay)}.`);
  if (v.people !== null) { text(`Custo por pessoa: veículo ${formatMoney(r.vehiclePerPerson!)}; aplicativo ${formatMoney(r.appPerPerson!)}.`); text("Divisão simples do custo total pelo número de pessoas informado."); }
  text("Além da locação", true); text(beyondRentalText(r));
  text("Veículo alugado", true); text(`Tipo: ${vehicleLabels[v.vehicle!]}. Método do preço: ${rentalPriceLabels[v.priceMode]}.`);
  text(v.priceMode === "daily" ? `${formatMoney(v.rentalPrice!)} por diária × ${formatQuantity(v.rentalDays!, "diária")} = ${formatMoney(r.rental)}.` : `Valor total da locação: ${formatMoney(r.rental)}.`);
  Object.entries(includedLabels).forEach(([key, label]) => text(`${label} incluído: ${v.included[key as keyof typeof includedLabels] ? "sim" : "não"}.`));
  text("Extras da locadora", true);
  r.additionals.forEach(c => text(`${c.label}: ${formatMoney(c.value)}${v.included[c.key as keyof typeof additionalLabels] ? " (incluído, sem gasto adicional)" : v[c.key as keyof typeof additionalLabels] === null ? " (nenhum custo adicional informado)" : ""}.`));
  text(`Combustível: ${fuelModeLabels[v.fuelMode]}.`);
  if (v.fuelMode === "distance") text(`Distância estimada: ${decimal(v.kilometers!)} km. Consumo informado: ${decimal(v.efficiency!)} km/L. Preço: ${formatMoney(v.fuelPrice!)}/L.`);
  text(`Combustível estimado: ${formatMoney(r.fuel)}.`);
  text(`Estacionamento: ${!v.parkingPaid ? "sem gasto previsto" : v.parkingMode === "daily" ? `${formatMoney(v.parkingPrice!)} por dia × ${formatQuantity(v.parkingDays!, "dia")}` : `${formatMoney(v.parkingPrice!)} no total`}; total ${formatMoney(r.parking)}.`);
  text(`Pedágios: ${formatMoney(v.tollPaid ? v.tolls! : 0)}. Limpeza: ${formatMoney(v.cleaning ?? 0)}${v.cleaning === null ? " (nenhum gasto informado)" : ""}.`);
  r.extras.forEach(e => text(`${e.name}: ${formatMoney(e.total)}${e.price === null ? " (nenhum gasto informado)" : ""}.`));
  text(`Outros / total: ${formatMoney(r.breakdown.find(c => c.key === "extras")!.value)}. Custo total do veículo: ${formatMoney(r.vehicleTotal)}.`);
  if (r.deposit !== null) { text("Caução / limite temporariamente comprometido", true); text(`${formatMoney(r.deposit)}. Não incluído no custo total.`); }
  text("Composição do custo do veículo", true);
  r.breakdown.forEach(c => text(`${c.label}: ${formatMoney(c.value)}${c.share === null ? "" : ` (${formatPercentage(c.share)} do total)`}.`));
  text("Corridas informadas", true);
  r.rides.forEach(ride => {
    text(`${ride.name} | ${formatQuantity(ride.count!, "vez", "vezes")} | ${rideKindLabels[ride.kind]}`, true);
    text(`${ride.kind === "round" ? "Ida" : "Corrida"}: ${formatMoney(ride.outwardFare!)}${ride.kind === "round" ? `; volta: ${formatMoney(ride.returnFare!)}` : ""}. Custo por ocorrência: ${formatMoney(ride.unitCost)}; total: ${formatMoney(ride.total)}.`);
    text(`Espera ${ride.kind === "round" ? "na ida" : "por corrida"}: ${ride.outwardWait === null ? "não informada" : formatDuration(ride.outwardWait)}${ride.kind === "round" ? `; espera na volta: ${ride.returnWait === null ? "não informada" : formatDuration(ride.returnWait)}` : ""}.`);
    text(rentalWaitText(ride));
  });
  text(`Total do aplicativo: ${formatMoney(r.appTotal)}.`);
  text(`Quantidade estimada de corridas: ${formatQuantity(r.totalRides, "corrida")}.`);
  text(`Custo médio por corrida: ${r.appPerRide === null ? "não calculável: nenhuma corrida" : formatMoney(r.appPerRide)}.`);
  text("Corridas que mais pesam", true);
  [...r.rides].sort((a, b) => b.total - a.total).forEach(ride => text(`${ride.name}: ${formatMoney(ride.total)}${ride.share === null ? "" : ` (${formatPercentage(ride.share)} do total)`}.`));
  text("Tempo de espera por aplicativo", true); text(rentalWaitText(r));
  if (r.waitMinutes !== null) text(`${formatQuantity(r.waitMinutes, "minuto")} informados${r.waitComplete ? "" : "; soma parcial, faltam tempos de trechos"}.`);
  text("Esse tempo é baseado apenas nas estimativas informadas e não representa o tempo das viagens. Não é monetizado.");
  text("Premissas e limites", true); rentalNotes.forEach(note => text(note));
  doc.getPages().forEach((p, i, pages) => {
    p.drawText(safe(reportFooter(options.brand)).slice(0, 85), { x: 44, y: 35, font, size: 8, color: green });
    p.drawText(`${i + 1}/${pages.length}`, { x: 520, y: 35, font, size: 8, color: green });
  });
  return doc.save();
}

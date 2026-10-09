import writeExcelFile, { type Cell, type Row, type Sheet } from "write-excel-file/universal";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { differentUnitsNote, tripFinancialDifferences, tripNotes, tripInsights, tripComparisonInsights, tripCategories, type TripResult } from "../calculations/trip-cost";
import { formatMoney, formatPercentage } from "../money";
import { reportDate, reportFooter, type ReportOptions } from "./report";

import { quantityText } from "../quantity-text";

const modeLabels = { total: "Total", person: "Por pessoa", night: "Por noite", personDay: "Por pessoa por dia", unit: "Por unidade" };
const header = (value: string): Cell => ({ value, fontWeight: "bold", backgroundColor: "#164B3B", textColor: "#FFFFFF", wrap: true, height: 30 });
const money = (cents: number | null): Cell | null => cents === null ? null : ({ value: cents / 100, type: Number, format: '"R$" #,##0.00;[Red]-"R$" #,##0.00' });
const number = (value: number): Cell => ({ value, type: Number });
const wrapped = (value: string): Cell => ({ value, wrap: true, height: 54 });
export const tripExcelNote = "Esta planilha é um retrato da simulação. Os valores monetários são números editáveis, sem fórmulas vinculadas: editar as células não recalcula os totais. Células vazias indicam valores não informados ou não aplicáveis.";

export function tripSheets(r: TripResult, options: ReportOptions): Sheet<Blob>[] {
  const summary: Row[] = [[header("Quanto custa minha viagem?"), header(options.brand.name)], ["Gerado em", reportDate(options.generatedAt)]];
  r.scenarios.forEach(s => {
    const reserve = r.input.scenarios.find(input => input.id === s.id)!.reserve;
    summary.push(["Forma de reserva", reserve.mode === "none" ? "Não adicionada" : reserve.mode === "fixed" ? "Valor fixo" : "Percentual do subtotal"], ["Reserva fixa informada", reserve.mode === "fixed" ? money(reserve.amount) : null], ["Percentual da reserva informado", reserve.mode === "percent" ? { value: reserve.percent! / 100, type: Number, format: "0.00%" } : null]);
    summary.push([header("Destino"), header(s.name)], ["Dias", number(s.days)], ["Noites", number(s.nights)], ["Viajantes", number(s.people)], ["Gastos estimados", money(s.subtotal)], ["Reserva para imprevistos (planejada)", money(s.reserve)], ["Total planejado", money(s.total)], ["Custo por pessoa", money(s.perPerson)], ["Custo médio por dia", money(s.perDay)], ["Orçamento informado", money(s.budget)], ["Orçamento menos total planejado", money(s.budgetRemaining)], ["Orçamento comprometido", s.budgetPercentage === null ? null : { value: s.budgetPercentage / 100, type: Number, format: "0.0%" }], ["Participação da reserva no total", s.reservePercentage === null ? null : { value: s.reservePercentage / 100, type: Number, format: "0.0%" }], ["Maior categoria de gasto", s.largest?.label ?? "Nenhum gasto positivo"], ["Menor categoria positiva", s.smallest?.label ?? "Nenhum gasto positivo"]);
    s.categories.forEach(c => summary.push([c.label, c.considered ? money(c.total) : "Não considerado", c.percentage === null ? null : { value: c.percentage / 100, type: Number, format: "0.0%" }]));
    if(s.missing.length) summary.push(["Categorias não consideradas", wrapped(s.missing.join(", "))]);
    tripInsights(s).forEach(note => summary.push(["Insight", wrapped(note)]));
    summary.push([null]);
  });
  const details: Row[] = [["Destino", "Categoria", "Item", "Forma de cálculo", "Valor informado", "Quantidade / ocorrências", "Dias de refeição", "Viajantes", "Noites", "Total estimado"].map(header)];
  r.scenarios.forEach(s => s.details.forEach(i => details.push([s.name, tripCategories.find(c=>c.id===i.category)!.label, i.name || "Despesa sem nome", modeLabels[i.mode], money(i.amount), i.mode === "unit" || i.category === "activities" ? number(i.quantity) : null, i.mode === "personDay" ? number(i.days) : null, number(s.people), number(s.nights), money(i.total)])));
  const notes: Row[] = [[header("Premissas"),header("Conteúdo")], ...tripNotes.map(note=>["Premissa",wrapped(note)]),["Planilha editável",wrapped(tripExcelNote)],["Créditos",wrapped(reportFooter(options.brand))]];
  const sheets: Sheet<Blob>[] = [
    { sheet:"Resumo",data:summary,columns:[{width:48},{width:80},{width:22}] },
    { sheet:"Despesas detalhadas",data:details,columns:Array.from({length:10},(_,i)=>({width:i<4?30:22})) },
  ];
  if(r.scenarios.length>1) {
    const comparison: Row[] = [[header("Métrica / categoria"),...r.scenarios.map(s=>header(s.name))]];
    for(const [label,key] of [["Gastos estimados","subtotal"],["Reserva planejada","reserve"],["Total planejado","total"],["Custo por pessoa","perPerson"],["Custo médio por dia","perDay"]] as const) comparison.push([label,...r.scenarios.map(s=>money(s[key]))]);
    tripCategories.forEach((c,i)=>comparison.push([c.label,...r.scenarios.map(s=>s.categories[i].considered?money(s.categories[i].total):"Não considerado")]));
    if(r.differences) {
      comparison.push(["Diferenças: primeiro destino menos segundo",null], ["Total planejado",money(r.differences.total)],["Custo por pessoa",money(r.differences.perPerson)],["Custo médio por dia",money(r.differences.perDay)]);
      r.differences.categories.forEach(c=>comparison.push([`Diferença: ${c.label}`,money(c.delta)]));
    } else comparison.push(["Menor total planejado",money(r.lowest)],["Maior total planejado",money(r.highest)]);
    if (r.unitDifferences.length) {
      comparison.push(["Atenção", wrapped(differentUnitsNote)]);
      r.unitDifferences.forEach(d => comparison.push([d.name, wrapped(d.matches.map(m => `${m.destination}: ${modeLabels[m.mode]}`).join("; "))]));
    }
    tripFinancialDifferences(r).forEach(note => comparison.push(["Diferença financeira", wrapped(note)]));
    tripComparisonInsights(r).forEach(note=>comparison.push(["Interpretação",wrapped(note)]));
    sheets.push({sheet:"Comparação de destinos",data:comparison,columns:[{width:50},...r.scenarios.map(()=>({width:40}))]});
  }
  sheets.push({sheet:"Premissas",data:notes,columns:[{width:26},{width:110}]});
  return sheets.map(sheet=>({...sheet,showGridLines:false}));
}
export async function createTripExcel(result: TripResult, options: ReportOptions): Promise<Blob> {
  return writeExcelFile(tripSheets(result,options),{fontFamily:"Arial",fontSize:11}).toBlob();
}
export async function createTripPdf(r: TripResult, options: ReportOptions): Promise<Uint8Array> {
  const doc=await PDFDocument.create(), font=await doc.embedFont(StandardFonts.Helvetica), bold=await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle("Quanto custa minha viagem?"); doc.setAuthor(options.brand.name); doc.setCreationDate(options.generatedAt); doc.setLanguage("pt-BR");
  const green=rgb(22/255,75/255,59/255), muted=rgb(83/255,102/255,94/255);
  let page=doc.addPage([595.28,841.89]),y=0;
  const safe=(value:string)=>Array.from(value.replaceAll("−","-").replaceAll("\u00a0"," ")).map(c=>{try{font.encodeText(c);return c;}catch{return "?";}}).join("");
  function heading(){page.drawRectangle({x:0,y:744,width:595.28,height:98,color:green});page.drawText("Quanto custa minha viagem?",{x:44,y:794,font:bold,size:22,color:rgb(1,1,1)});page.drawText("Planejamento com os seus números",{x:44,y:770,font,size:12,color:rgb(1,1,1)});y=718;}
  heading();
  function text(value:string,title=false){
    const size=title?13:10,selected=title?bold:font;
    if(title && y<115){page=doc.addPage([595.28,841.89]);heading();}
    let line="";
    function draw(row:string){if(y<75){page=doc.addPage([595.28,841.89]);heading();}page.drawText(row,{x:44,y,font:selected,size,color:title?green:muted});y-=size+5;}
    for(const word of safe(value).split(/\s+/)){const next=line?`${line} ${word}`:word;if(selected.widthOfTextAtSize(next,size)<=505){line=next;continue;}if(line){draw(line);line="";}for(const char of word){if(selected.widthOfTextAtSize(line+char,size)>505){draw(line);line="";}line+=char;}}
    if(line)draw(line);y-=7;
  }
  text(`${options.brand.name} | Gerado em ${reportDate(options.generatedAt)} (horário de Brasília)`);
  text("Resumo do planejamento",true);
  for (const s of r.scenarios) {
    // Keep each summary together; the name can occupy several wrapped lines.
    if (y < 260) { page=doc.addPage([595.28,841.89]); heading(); }
    const top = y + 17;
    text(s.name, true);
    text(`${quantityText(s.days, "dia", "dias")} | ${quantityText(s.nights, "noite", "noites")} | ${quantityText(s.people, "viajante", "viajantes")}`);
    text(`Total planejado: ${formatMoney(s.total)}`, true);
    text(`Gastos estimados: ${formatMoney(s.subtotal)} | Reserva planejada: ${formatMoney(s.reserve)}`);
    text(`Custo por pessoa: ${formatMoney(s.perPerson)} | Custo médio por dia: ${formatMoney(s.perDay)}`);
    page.drawLine({start:{x:44,y:top},end:{x:551,y:top},thickness:2,color:green});
    page.drawLine({start:{x:44,y:y+5},end:{x:551,y:y+5},thickness:.5,color:muted});
    y -= 12;
  }
  if (r.unitDifferences.length) {
    text(differentUnitsNote, true);
    r.unitDifferences.forEach(d => text(`${d.name}: ${d.matches.map(m => `${m.destination}: ${modeLabels[m.mode]}`).join("; ")}.`));
  }
  tripComparisonInsights(r).forEach(note=>text(note));
  if (r.scenarios.length > 1) { text("Diferenças financeiras", true); tripFinancialDifferences(r).forEach(note => text(note)); }
  for(const s of r.scenarios){
    text(s.name,true);
    const input=r.input.scenarios.find(i=>i.id===s.id)!;
    text(`Reserva: ${input.reserve.mode === "none" ? "não adicionada" : input.reserve.mode === "percent" ? `${formatPercentage(input.reserve.percent!)} do subtotal` : "valor fixo"}. A reserva não representa gasto confirmado${s.reservePercentage === null ? "." : `; equivale a ${formatPercentage(s.reservePercentage)} do total planejado.`}`);
    if(s.budget!==null) text(`Orçamento informado ${formatMoney(s.budget)}; ${s.budgetRemaining!<0?"excedente projetado":"restante projetado"} ${formatMoney(Math.abs(s.budgetRemaining!))}; comprometido ${s.budgetPercentage===null?"não calculável (orçamento zero)":formatPercentage(s.budgetPercentage)}.`);
    text("Composição dos gastos (sem reserva)",true);
    for(const c of s.categories) {
      if (y < 135) { page=doc.addPage([595.28,841.89]); heading(); }
      text(`${c.label}: ${c.considered?`${formatMoney(c.total)}${c.percentage===null?"":` (${formatPercentage(c.percentage)} dos gastos estimados)`}`:"não considerado"}.`);
      if (c.considered) {
        page.drawRectangle({x:44,y:y+1,width:505,height:5,color:rgb(.9,.93,.9)});
        if (c.percentage && c.percentage > 0) page.drawRectangle({x:44,y:y+1,width:505*c.percentage/100,height:5,color:green});
        y -= 14;
      }
    }
    if(s.missing.length) text(`Categorias não consideradas: ${s.missing.join(", ")}.`);
    text("Detalhamento dos itens",true);
    const filled=s.details.filter(i=>i.total!==null);
    if(!filled.length)text("Nenhuma despesa preenchida.");
    filled.forEach(i=>text(`${tripCategories.find(c=>c.id===i.category)!.label} / ${i.name || "Despesa sem nome"}: ${formatMoney(i.amount!)} (${modeLabels[i.mode]}${i.mode==="personDay"?`, ${quantityText(i.days, "dia", "dias")} e ${quantityText(s.people, "viajante", "viajantes")}`:i.mode==="night"?`, ${quantityText(s.nights, "noite", "noites")}`:i.mode==="unit"?`, ${quantityText(i.quantity, "unidade", "unidades")}`:i.mode==="person"?`, ${quantityText(s.people, "viajante", "viajantes")}`:""}${i.category==="activities"?`, ${quantityText(i.quantity, "ocorrência", "ocorrências")}`:""}); total ${formatMoney(i.total!)}.`));
    text("O que mais pesa na sua viagem?",true);tripInsights(s).forEach(note=>text(note));
  }
  if(r.scenarios.length>1){text("Onde estão as maiores diferenças?",true);tripCategories.forEach((c,i)=>{text(`${c.label}: ${r.scenarios.map(s=>`${s.name}: ${s.categories[i].considered?formatMoney(s.categories[i].total):"não considerado"}`).join("; ")}.`);if(r.differences)text(r.differences.categories[i].delta===null?"Faltam valores para comparar esta categoria.":`Diferença absoluta: ${formatMoney(Math.abs(r.differences.categories[i].delta!))}.`);});}
  text("Premissas e limitações",true);tripNotes.forEach(note=>text(note));
  const pages=doc.getPages();pages.forEach((p,i)=>{p.drawLine({start:{x:44,y:55},end:{x:551,y:55},thickness:.7,color:muted});p.drawText(safe(reportFooter(options.brand)).slice(0,95),{x:44,y:38,font,size:8,color:muted});p.drawText(`${i+1} / ${pages.length}`,{x:520,y:38,font,size:8,color:muted});});
  return doc.save();
}

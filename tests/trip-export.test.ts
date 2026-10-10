import { describe, expect, it } from "vitest";
import { PDFDocument, PDFName, PDFRawStream, PDFArray } from "pdf-lib";
import { inflateSync } from "node:zlib";
import { calculateTrip, type TripPlan } from "../src/lib/calculations/trip-cost";
import { newTripScenario, parseTripDraft } from "../src/lib/trip-form";
import { createTripPdf, createTripExcel, tripSheets, tripExcelNote } from "../src/lib/export/trip-cost";

const options={brand:{name:"Coyler",domain:"coyler.example"},generatedAt:new Date("2026-10-07T12:00:00Z")};
function plan(count=1):TripPlan {
  const scenarios=Array.from({length:count},(_,i)=>{const s=newTripScenario(String(i),i===0?"Caxias do Sul":"Curitiba");s.days="7";s.nights="6";s.people=String(i+1);s.items[0].amount="600,00";s.items[4].amount="2.000,00";s.items[9].amount="1.000,00";s.reserve={mode:"percent",amount:"",percent:"10"};return s;});
  return parseTripDraft({mode:count===1?"single":"compare",scenarios});
}
describe("relatórios de viagem",()=>{
  it.each([1,2,3,4])("abas e moedas numéricas para %i destinos",n=>{const r=calculateTrip(plan(n)),sheets=tripSheets(r,options);expect(sheets.map(s=>s.sheet)).toEqual(n===1?["Resumo","Despesas detalhadas","Premissas"]:["Resumo","Despesas detalhadas","Comparação de destinos","Premissas"]);expect(sheets[0].data.find(row=>row[0]==="Gastos estimados")?.[1]).toMatchObject({value:3600,type:Number});expect(sheets[0].data.find(row=>row[0]==="Reserva para imprevistos (planejada)")?.[1]).toMatchObject({value:360,type:Number});expect(sheets[0].data.find(row=>row[0]==="Total planejado")?.[1]).toMatchObject({value:3960,type:Number});expect(JSON.stringify(sheets)).toContain("Não considerado");expect(JSON.stringify(sheets)).toContain(tripExcelNote);if(n>1)expect(JSON.stringify(sheets)).toContain("Os cenários possuem durações");});
  it("não recalcula valores exportados",()=>{const r=calculateTrip(plan());r.scenarios[0].total=12345;expect(tripSheets(r,options)[0].data.find(row=>row[0]==="Total planejado")?.[1]).toMatchObject({value:123.45});});
  it("registra a premissa de reserva percentual como número",()=>{const sheets=tripSheets(calculateTrip(plan()),options);expect(sheets[0].data.find(row=>row[0]==="Percentual da reserva informado")?.[1]).toMatchObject({value:0.1,type:Number,format:"0.00%"});});
  it("distingue zero informado de vazio no Excel",()=>{const p=plan();p.scenarios[0].items[0].amount=0;const details=tripSheets(calculateTrip(p),options)[1].data;expect(details[1][4]).toMatchObject({value:0,type:Number});expect(details[2][4]).toBeNull();expect(details[2][9]).toBeNull();});
  it("gera XLSX real com quatro destinos",async()=>{const blob=await createTripExcel(calculateTrip(plan(4)),options);const bytes=new Uint8Array(await blob.arrayBuffer());expect([...bytes.slice(0,2)]).toEqual([0x50,0x4b]);expect(bytes.length).toBeGreaterThan(2000);});
  it.each([1,2,3,4])("gera PDF válido para %i destinos sem páginas vazias",async n=>{const bytes=await createTripPdf(calculateTrip(plan(n)),options);const doc=await PDFDocument.load(bytes);expect(doc.getTitle()).toBe("Quanto custa minha viagem?");expect(doc.getAuthor()).toBe("Coyler");expect(doc.getPageCount()).toBeGreaterThan(0);for(const page of doc.getPages()){const contents=page.node.Contents();expect(contents).toBeInstanceOf(PDFArray);if(!(contents instanceof PDFArray))throw new Error("Expected PDF content array");const streams=Array.from({length:contents.size()},(_,i)=>doc.context.lookup(contents.get(i)) as PDFRawStream);const content=streams.map(s=>s.dict.get(PDFName.of("Filter"))===PDFName.of("FlateDecode")?inflateSync(s.contents).toString():Buffer.from(s.contents).toString()).join(" ");expect((content.match(/Tj/g)||[]).length).toBeGreaterThan(4);}});
  it("PDF com muitos itens e nomes longos pagina sem erro",async()=>{const p=plan();p.scenarios[0].name="Destino com nome longo ".repeat(4);p.scenarios[0].items=Array.from({length:100},(_,i)=>({id:String(i),name:"Passeio sem espaços "+"x".repeat(75),category:"activities",amount:i*123,mode:"person",quantity:2,days:1}));const doc=await PDFDocument.load(await createTripPdf(calculateTrip(p),options));expect(doc.getPageCount()).toBeGreaterThan(3);});
  it("PDF e Excel aceitam simulação sem despesas",async()=>{const p=plan();p.scenarios[0].items.forEach(i=>i.amount=null);const r=calculateTrip(p);expect(r.scenarios[0].subtotal).toBe(0);expect((await PDFDocument.load(await createTripPdf(r,options))).getPageCount()).toBeGreaterThan(0);expect((await createTripExcel(r,options)).size).toBeGreaterThan(1000);});
});


describe("estrutura das categorias no Resumo Excel", () => {
  it.each([1, 2, 4])("identifica percentuais e separa categorias dos indicadores para %i destinos", count => {
    const result = calculateTrip(plan(count));
    const summary = tripSheets(result, options)[0];
    expect(summary.columns).toEqual([{ width: 48 }, { width: 32 }, { width: 22 }]);
    const headings = summary.data.flatMap((row, index) => {
      const cell = row[0];
      return cell && typeof cell === "object" && "value" in cell && cell.value === "Categoria" ? [index] : [];
    });
    expect(headings).toHaveLength(count);
    headings.forEach((index, scenarioIndex) => {
      expect(summary.data[index - 1]).toEqual([null]);
      expect(summary.data[index]).toMatchObject([
        { value: "Categoria", backgroundColor: "#164B3B", textColor: "#FFFFFF", fontWeight: "bold", wrap: true },
        { value: "Valor estimado" }, { value: "Participação (%)" },
      ]);
      result.scenarios[scenarioIndex].categories.forEach((category, categoryIndex) => {
        const row = summary.data[index + categoryIndex + 1];
        expect(row[0]).toBe(category.label);
        if (category.considered) expect(row[1]).toMatchObject({ value: category.total / 100, type: Number, format: expect.stringContaining("R$") });
        else expect(row[1]).toBe("Não considerado");
        if (category.percentage === null) expect(row[2]).toBeNull();
        else expect(row[2]).toMatchObject({ value: category.percentage / 100, type: Number, format: "0.0%" });
      });
    });
    for (const row of summary.data.filter(row => row[0] === "Insight" || row[0] === "Categorias não consideradas")) {
      expect(row[1]).toMatchObject({ columnSpan: 2, wrap: true, height: expect.any(Number) });
    }
    expect(tripSheets(result, options).at(-1)?.columns).toEqual([{ width: 26 }, { width: 110 }]);
  });
});

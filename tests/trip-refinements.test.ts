import { describe, expect, it, vi } from "vitest";
import { PDFPage } from "pdf-lib";
import { calculateTrip, differentUnitsNote, tripFinancialDifferences } from "../src/lib/calculations/trip-cost";
import { newTripItem, newTripScenario, parseTripDraft } from "../src/lib/trip-form";
import { quantityText } from "../src/lib/quantity-text";
import { createTripPdf, tripSheets } from "../src/lib/export/trip-cost";

function draft(count = 2) {
  return { mode: "compare" as const, scenarios: Array.from({length: count}, (_, i) => {
    const s = newTripScenario(`destination-${i}`, `Destino ${i + 1}`);
    s.days = "3"; s.people = String(i + 1);
    const lunch = s.items.find(item => item.name === "Almoço")!;
    lunch.amount = "28,00"; lunch.days = "3"; lunch.mode = "personDay";
    return s;
  }) };
}
const options = { brand: { name: "QuantoCusta", domain: "" }, generatedAt: new Date("2026-10-08T12:00:00Z") };

describe("refinamentos da viagem", () => {
  it.each([0, 1, 2])("pluraliza quantidades %i", count => {
    expect(quantityText(count, "viajante", "viajantes")).toBe(`${count} ${count === 1 ? "viajante" : "viajantes"}`);
    expect(quantityText(count, "valor preenchido", "valores preenchidos")).toBe(`${count} ${count === 1 ? "valor preenchido" : "valores preenchidos"}`);
    expect(quantityText(count, "ocorrência", "ocorrências")).toBe(`${count} ${count === 1 ? "ocorrência" : "ocorrências"}`);
  });
  it("unidades iguais não geram alerta mesmo com grupos diferentes", () => {
    const r = calculateTrip(parseTripDraft(draft()));
    expect(r.unitDifferences).toEqual([]);
    expect(r.scenarios.map(s => s.total)).toEqual([8400, 16800]);
  });
  it("identifica almoço por ID mesmo com itens reordenados e preserva os valores", () => {
    const d = draft(); d.scenarios[1].items.reverse();
    d.scenarios[1].items.find(i => i.name === "Almoço")!.mode = "total";
    const before = structuredClone(d), r = calculateTrip(parseTripDraft(d));
    expect(r.unitDifferences).toEqual([{name:"Almoço", matches:[{destination:"Destino 1", mode:"personDay"}, {destination:"Destino 2", mode:"total"}]}]);
    expect(r.scenarios.map(s => s.total)).toEqual([8400, 2800]); expect(d).toEqual(before);
  });
  it.each(["custom", "renamed", "missing", "otherCategory"])("evita correspondência não confiável: %s", kind => {
    const d = draft(), s = d.scenarios[1], lunch = s.items.find(i => i.name === "Almoço")!;
    lunch.mode = "total";
    if (kind === "custom") lunch.id = "custom-lunch";
    if (kind === "renamed") lunch.name = "Jantar especial";
    if (kind === "missing") lunch.amount = "";
    if (kind === "otherCategory") lunch.category = "other";
    expect(calculateTrip(parseTripDraft(d)).unitDifferences).toEqual([]);
  });
  it("zero explícito participa da checagem de unidade", () => {
    const d = draft(); const lunch = d.scenarios[1].items.find(i => i.name === "Almoço")!;
    lunch.mode = "total"; lunch.amount = "0";
    expect(calculateTrip(parseTripDraft(d)).unitDifferences).toHaveLength(1);
  });
  it("compara quatro destinos com referência identificada e não altera destinos ao ler o ativo", () => {
    const d = draft(4), before = structuredClone(d);
    d.scenarios[3].items.find(i => i.name === "Almoço")!.mode = "total";
    const r = calculateTrip(parseTripDraft(d));
    expect(r.unitDifferences[0].matches).toHaveLength(4);
    expect(tripFinancialDifferences(r)).toHaveLength(9);
    expect(tripFinancialDifferences(r)[0]).toContain("Destino 2 tem R$ 84,00 a mais que Destino 1");
    for (const active of [0, 3, 1, 0]) calculateTrip(parseTripDraft({mode:"single",scenarios:[d.scenarios[active]]}));
    expect(d.scenarios.slice(0,3)).toEqual(before.scenarios.slice(0,3));
  });
  it("exporta todos os multiplicadores e reserva usando os mesmos resultados", () => {
    const d = draft();
    for (const s of d.scenarios) {
      s.nights = "2"; s.items[0].amount = "10,00"; s.items[0].mode = "person";
      s.items[4].amount = "20,00"; s.items[4].mode = "night";
      s.items.push({...newTripItem("activities", "Passeio"), amount:"5,00", mode:"person", quantity:"2"});
      s.items.push({...newTripItem("other", "Taxa"), amount:"3,00", mode:"unit", quantity:"4"});
      s.reserve = {mode:"percent",amount:"",percent:"10"};
    }
    const r = calculateTrip(parseTripDraft(d)), sheets = tripSheets(r, options);
    expect(r.scenarios.map(s => [s.subtotal, s.reserve, s.total])).toEqual([[15600,1560,17160],[26000,2600,28600]]);
    const comparison = sheets.find(s => s.sheet === "Comparação de destinos")!;
    for (const [label,key] of [["Gastos estimados","subtotal"],["Reserva planejada","reserve"],["Total planejado","total"]] as const) {
      expect(comparison.data.find(row => row[0] === label)?.slice(1)).toEqual(r.scenarios.map(s => expect.objectContaining({value:s[key]/100,type:Number})));
    }
    const details = sheets[1].data.slice(1);
    expect(details).toHaveLength(r.scenarios.reduce((n,s) => n+s.details.length,0));
    r.scenarios.forEach(s => s.details.forEach(i => {
      const row = details.find(row => row[0] === s.name && row[2] === i.name)!;
      expect(row[9]).toEqual(i.total === null ? null : expect.objectContaining({value:i.total/100}));
    }));
  });
  it("PDF inclui aviso, singular, diferenças e barras; Excel inclui o mesmo alerta", async () => {
    const d = draft(); d.scenarios[0].days = "1";
    d.scenarios[0].items.find(i => i.name === "Almoço")!.days = "1";
    d.scenarios[1].items.find(i => i.name === "Almoço")!.mode = "total";
    const r = calculateTrip(parseTripDraft(d)), text = vi.spyOn(PDFPage.prototype, "drawText"), rect = vi.spyOn(PDFPage.prototype, "drawRectangle");
    try {
      await createTripPdf(r, options);
      const drawn = text.mock.calls.map(c => c[0]).join(" ");
      expect(drawn).toContain(differentUnitsNote);
      expect(drawn).toContain("1 dia | 0 noites | 1 viajante");
      expect(drawn).toContain("Diferenças financeiras");
      expect(rect.mock.calls.some(([v]) => v?.height === 5 && v?.width === 505)).toBe(true);
      expect(JSON.stringify(tripSheets(r,options))).toContain(differentUnitsNote);
    } finally { text.mockRestore(); rect.mockRestore(); }
  });
});

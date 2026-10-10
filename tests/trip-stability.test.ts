import { describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import { calculateTrip, TripFieldError, tripItemModeLabel } from "../src/lib/calculations/trip-cost";
import { newTripItem, newTripScenario, parseTripDraft, type TripDraft } from "../src/lib/trip-form";
import { decodeTripPlan, encodeTripPlan } from "../src/lib/trip-storage";
import { createTripExcel, createTripPdf, tripSheets } from "../src/lib/export/trip-cost";

const options = { brand: { name: "Coyler", domain: "" }, generatedAt: new Date("2026-10-09T12:00:00Z") };
function draft(): TripDraft {
  const scenarios = [newTripScenario("a", "Visível"), newTripScenario("b", "Oculto")];
  scenarios[0].items[0].amount = "100,00";
  scenarios[1].items[0].amount = "200,00";
  return { mode: "compare", scenarios };
}

describe("estabilidade pré-publicação da viagem", () => {
  it.each(["days", "money", "people", "reserve"])("ignora destino oculto inválido (%s), preservando a comparação", kind => {
    const d = draft();
    if (kind === "days") d.scenarios[1].days = "";
    if (kind === "money") d.scenarios[1].items[0].amount = "-1";
    if (kind === "people") d.scenarios[1].people = "0";
    if (kind === "reserve") d.scenarios[1].reserve = { mode: "percent", amount: "", percent: "101" };
    const before = structuredClone(d.scenarios);
    d.mode = "single";
    const r = calculateTrip(parseTripDraft(d));
    expect(r.scenarios.map(s => [s.name, s.total])).toEqual([["Visível", 10000]]);
    expect(r.input.scenarios).toHaveLength(1);
    expect(d.scenarios).toEqual(before);
    d.mode = "compare";
    expect(() => parseTripDraft(d)).toThrow(TripFieldError);
    d.scenarios[1] = newTripScenario("b", "Oculto");
    d.scenarios[1].items[0].amount = "200,00";
    expect(calculateTrip(parseTripDraft(d)).scenarios.map(s => s.total)).toEqual([10000, 20000]);
  });

  it("o cálculo puro também valida apenas o cenário aplicável", () => {
    const p = parseTripDraft(draft()); p.mode = "single"; p.scenarios[1].people = 0;
    expect(calculateTrip(p).scenarios).toHaveLength(1);
    expect(p.scenarios[1].people).toBe(0);
    p.mode = "compare";
    expect(() => calculateTrip(p)).toThrow(TripFieldError);
  });

  it("mantém o limite de quatro destinos mesmo no modo simples", () => {
    const p = parseTripDraft(draft()); p.mode = "single";
    p.scenarios = Array.from({ length: 5 }, (_, index) => ({ ...p.scenarios[0], id: String(index) }));
    expect(() => calculateTrip(p)).toThrow(/quatro destinos/);
  });

  it("salvar mantém todos os destinos válidos e não aceita descartar um rascunho inválido", () => {
    const d = draft(); d.mode = "single";
    const stored = encodeTripPlan(parseTripDraft(d, "storage"));
    expect(decodeTripPlan(stored).scenarios).toHaveLength(2);
    d.scenarios[1].days = "";
    expect(() => parseTripDraft(d, "storage")).toThrow(TripFieldError);
    expect(decodeTripPlan(stored).scenarios[1].items[0].amount).toBe(20000);
    expect(d.scenarios[1].days).toBe("");
  });

  it("PDF e Excel de uma viagem excluem destinos ocultos incompletos", async () => {
    const d = draft(); d.mode = "single"; d.scenarios[1].days = "";
    const r = calculateTrip(parseTripDraft(d));
    const sheets = tripSheets(r, options);
    expect(sheets.map(s => s.sheet)).toEqual(["Resumo", "Despesas detalhadas", "Premissas"]);
    expect(JSON.stringify(sheets)).not.toContain("Oculto");
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const pdf = await PDFDocument.load(await createTripPdf(r, options));
      expect(pdf.getPageCount()).toBeGreaterThan(0);
      expect(draw.mock.calls.map(c => c[0]).join(" ")).toContain("Visível");
      expect(draw.mock.calls.map(c => c[0]).join(" ")).not.toContain("Oculto");
    } finally { draw.mockRestore(); }
    const bytes = new Uint8Array(await (await createTripExcel(r, options)).arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual([80, 75, 3, 4]);
  });

  it("padroniza quatro nomes vazios nos resultados, avisos e relatórios, preservando nomes personalizados", async () => {
    const d: TripDraft = { mode: "compare", scenarios: Array.from({ length: 4 }, (_, i) => newTripScenario(String(i), " ")) };
    d.scenarios.forEach(s => { s.items[0].amount = "10,00"; });
    d.scenarios[1].items[0].mode = "person";
    const r = calculateTrip(parseTripDraft(d));
    expect(r.scenarios.map(s => s.name)).toEqual(["Destino 1", "Destino 2", "Destino 3", "Destino 4"]);
    expect(r.unitDifferences[0].matches.map(m => m.destination)).toEqual(r.scenarios.map(s => s.name));
    const excel = JSON.stringify(tripSheets(r, options));
    r.scenarios.forEach(s => expect(excel).toContain(s.name));
    expect(excel).not.toContain("Destino sem nome");
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      await createTripPdf(r, options);
      const text = draw.mock.calls.map(c => c[0]).join(" ");
      r.scenarios.forEach(s => expect(text).toContain(s.name));
      expect(text).not.toContain("Destino sem nome");
    } finally { draw.mockRestore(); }
    d.scenarios[2].name = "São Paulo";
    expect(calculateTrip(parseTripDraft(d)).scenarios[2].name).toBe("São Paulo");
    expect(d.scenarios[0].name).toBe(" ");
  });

  it.each([
    ["days", "0", "a-days"], ["people", "", "a-people"], ["budget", "-1", "a-budget"],
    ["amount", "-1", "a-tickets-0-amount"], ["reserve", "101", "a-reserve-percent"],
  ])("identifica o campo %s inválido sem perder dados", (field, value, id) => {
    const d = draft();
    if (field === "amount") d.scenarios[0].items[0].amount = value;
    else if (field === "reserve") d.scenarios[0].reserve = { mode: "percent", amount: "", percent: value };
    else d.scenarios[0][field as "days" | "people" | "budget"] = value;
    const before = structuredClone(d);
    let error: unknown;
    try { parseTripDraft(d); } catch (e) { error = e; }
    expect(error).toBeInstanceOf(TripFieldError);
    expect(error).toMatchObject({ scenarioId: "a", fieldId: id });
    expect((error as Error).message).toContain("Visível:");
    expect(d).toEqual(before);
  });

  it.each(["total", "person"] as const)("esclarece passeio %s e mantém multiplicadores no cálculo e nos relatórios", async mode => {
    const s = newTripScenario("a", ""), item = newTripItem("activities", "Passeio", "tour");
    Object.assign(item, { amount: "500,00", quantity: "3", mode });
    s.people = "2"; s.items = [item];
    const r = calculateTrip(parseTripDraft({ mode: "single", scenarios: [s] }));
    const label = mode === "total" ? "Valor por ocorrência" : "Valor por pessoa por ocorrência";
    expect(tripItemModeLabel(r.scenarios[0].details[0])).toBe(label);
    expect(r.scenarios[0].total).toBe(mode === "total" ? 150000 : 300000);
    expect(tripSheets(r, options)[1].data[1][3]).toBe(label);
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try { await createTripPdf(r, options); expect(draw.mock.calls.map(c => c[0]).join(" ")).toContain(label); }
    finally { draw.mockRestore(); }
  });
});

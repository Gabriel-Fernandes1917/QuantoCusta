import { describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import { calculateLodgingComparison, emptyLodgingComparison, emptyTravelPlace, formatLodgingQuantity, formatTravelTime, lodgingDifference, lodgingDifferenceText, lodgingFields, lodgingIssues, lodgingName, lodgingParking, lodgingPerPerson, lodgingPrice, lodgingPriceInsight, lodgingTimeText, mealCost, parseLodgingQuantity, perVisitCost, storedLodgingFields, sumLodgingCosts, timeDifference, totalDistance, travelFuel, travelMinutes, validateLodgingShape, type LodgingComparison } from "../src/lib/calculations/lodging-comparison";
import { decodeLodgingComparison, encodeLodgingComparison } from "../src/lib/lodging-storage";
import { createLodgingExcel, createLodgingPdf, lodgingSheets } from "../src/lib/export/lodging-comparison";
import { travelTools } from "../src/lib/tools";

function scenario(): LodgingComparison {
  const v = emptyLodgingComparison();
  Object.assign(v, { people: 2, nights: 4, transport: "own", efficiency: 10, fuelPrice: 600 });
  Object.assign(v.lodgings[0], { name: "Hotel Centro", price: 200000 });
  Object.assign(v.lodgings[1], { name: "Hotel Econômico", price: 160000 });
  v.lodgings[0].meals.breakfast.included = true; v.lodgings[0].parking.included = true;
  Object.assign(v.lodgings[1].meals.breakfast, { price: 2500, days: 4 });
  const p = emptyTravelPlace("center"); p.name = "Centro turístico"; p.visits = 2;
  Object.assign(p.journeys[0], { distance: 2, minutes: 10, parkingPaid: true, parking: 2000 });
  Object.assign(p.journeys[1], { distance: 12, minutes: 30 });
  v.places.push(p); return v;
}
const options = { brand: { name: "QuantoCusta", domain: "" }, generatedAt: new Date("2026-10-04T12:00:00Z") };
describe("hospedagem e totais", () => {
  it("cenário solicitado, sem dados de exemplo na interface", () => {
    const v = scenario(), before = structuredClone(v), r = calculateLodgingComparison(v), [a, b] = r.scenarios;
    expect(a).toMatchObject({ price: 200000, additional: 4480, total: 204480, perPerson: 102240, minutes: 40 });
    expect(b).toMatchObject({ price: 160000, additional: 26880, total: 186880, perPerson: 93440, minutes: 120 });
    expect(a.journeys[0]).toMatchObject({ distance: 8, fuel: 480, parking: 4000, total: 4480 });
    expect(b.journeys[0]).toMatchObject({ distance: 48, fuel: 2880, parking: 4000, total: 6880 });
    expect(b.meals[0].total).toBe(20000); expect(r.delta).toBe(17600); expect(r.minutesDelta).toBe(-80);
    expect(v).toEqual(before); expect(emptyLodgingComparison().people).toBeNull(); expect(emptyLodgingComparison().places).toEqual([]);
  });
  it.each([["total", 160000], ["night", 640000]] as const)("preço %s", (mode, expected) => expect(lodgingPrice(160000, mode, 4)).toBe(expected));
  it("diária não é multiplicada por pessoas", () => { const v = scenario(); v.lodgings[0].priceMode = "night"; v.lodgings[0].price = 50000; expect(calculateLodgingComparison(v).scenarios[0].price).toBe(200000); });
  it("taxas e outros valores são totais do grupo", () => { const v = scenario(); v.lodgings[0].fees = 5000; v.extras.push({ id: "laundry", name: "Lavanderia", amounts: [1000, 2000] }); const r = calculateLodgingComparison(v); expect(r.scenarios[0].total).toBe(210480); expect(r.scenarios[1].total).toBe(188880); });
  it("nomes personalizados e default", () => { const v = scenario(); expect(lodgingName(v.lodgings[0], 0)).toBe("Hotel Centro"); v.lodgings[0].name = " "; v.lodgings[1].name = ""; expect(calculateLodgingComparison(v).scenarios.map(s => s.name)).toEqual(["Hospedagem A", "Hospedagem B"]); });
  it("custo total é hospedagem + todos os adicionais", () => { const r = calculateLodgingComparison(scenario()); r.scenarios.forEach(s => { expect(s.total).toBe(s.price + s.additional); expect(s.breakdown.reduce((sum, c) => sum + c.value, 0)).toBe(s.total); expect(s.breakdown.reduce((sum, c) => sum + c.share!, 0)).toBeCloseTo(100); }); expect(r.differences.reduce((sum, c) => sum + c.delta, 0)).toBe(r.delta); });
  it("total zero mantém percentuais não calculáveis", () => { const v = scenario(); v.places = []; v.lodgings.forEach(l => { l.price = 0; l.meals.breakfast.included = true; }); const r = calculateLodgingComparison(v); expect(r.scenarios.every(s => s.breakdown.every(c => c.share === null))).toBe(true); expect(r.delta).toBe(0); });
  it("agrega vários locais compartilhados e respectivas distâncias", () => { const v = scenario(); const p = structuredClone(v.places[0]); p.id = "beach"; p.name = "Praia"; p.visits = 3; v.places.push(p); const r = calculateLodgingComparison(v); expect(r.scenarios.map(s => s.journeys.map(j => j.name))).toEqual([["Centro turístico", "Praia"], ["Centro turístico", "Praia"]]); expect(r.scenarios[0]).toMatchObject({ transport: 11200, minutes: 100 }); expect(r.scenarios[1]).toMatchObject({ transport: 17200, minutes: 300 }); });
});
describe("refeições", () => {
  it.each([[2500, 2, 4, 20000], [2500, 2, 3, 15000], [1000, 1, 2, 2000], [0, 2, 4, 0], [2500, 2, 0, 0]])("%s × %s pessoas × %s dias", (price, people, days, expected) => expect(mealCost(price, people, days)).toBe(expected));
  it.each(["breakfast", "lunch", "dinner"] as const)("%s incluído em A, pago em B", key => { const v = scenario(); v.lodgings[0].meals[key].included = true; Object.assign(v.lodgings[1].meals[key], { price: 2500, days: 3 }); const r = calculateLodgingComparison(v); expect(r.scenarios[0].meals.find(m => m.key === key)?.total).toBe(0); expect(r.scenarios[1].meals.find(m => m.key === key)?.total).toBe(15000); });
  it.each(["breakfast", "lunch", "dinner"] as const)("%s incluído em ambas ignora valores antigos", key => { const v = scenario(); v.lodgings.forEach(l => Object.assign(l.meals[key], { included: true, price: 9900, days: 4 })); const r = calculateLodgingComparison(v); expect(r.scenarios.every(s => s.meals.find(m => m.key === key)?.total === 0)).toBe(true); });
  it("não incluído em nenhuma permite custos diferentes", () => { const v = scenario(); Object.assign(v.lodgings[0].meals.breakfast, { included: false, price: 3000, days: 2 }); expect(calculateLodgingComparison(v).scenarios[0].meals[0].total).toBe(12000); });
  it("opcionais vazios não geram gasto", () => { const r = calculateLodgingComparison(scenario()); expect(r.scenarios.every(s => s.meals[1].total === 0 && s.meals[2].total === 0)).toBe(true); });
  it.each(["price", "days"] as const)("%s necessário não vira zero", key => { const v = scenario(); v.lodgings[1].meals.breakfast[key] = null; expect(lodgingIssues(v)).toHaveProperty(`lodgings.1.meals.breakfast.${key}`); });
  it("valida dias e aceita chegada/saída até noites + 1", () => { const v = scenario(); v.lodgings[1].meals.breakfast.days = 5; expect(lodgingIssues(v)).toEqual({}); v.lodgings[1].meals.breakfast.days = 6; expect(lodgingIssues(v)).toHaveProperty("lodgings.1.meals.breakfast.days"); });
});
describe("estacionamento", () => {
  it.each([["total", 1500], ["day", 4500]] as const)("hospedagem %s", (period, expected) => expect(lodgingParking(1500, period, 3)).toBe(expected));
  it("incluído ignora gastos informados", () => { const v = scenario(); Object.assign(v.lodgings[0].parking, { price: 3000, period: "day", days: 4 }); expect(calculateLodgingComparison(v).scenarios[0].parking).toBe(0); });
  it("não incluído soma estacionamento da hospedagem separadamente", () => { const v = scenario(); Object.assign(v.lodgings[1].parking, { price: 3000, period: "day", days: 4 }); const b = calculateLodgingComparison(v).scenarios[1]; expect(b.parking).toBe(12000); expect(b.transport).toBe(6880); });
  it.each(["app", "manual"] as const)("sem veículo (%s) não cobra estacionamento de hospedagem ou destino", transport => { const v = scenario(); v.transport = transport; v.places.forEach(p => p.journeys.forEach(j => { j.fare = 0; })); v.lodgings[1].parking.price = 5000; const r = calculateLodgingComparison(v); expect(r.scenarios.every(s => s.parking === 0 && s.journeys[0].parking === 0)).toBe(true); });
  it("diário informado exige preço e dias juntos", () => { const v = scenario(); v.lodgings[1].parking.period = "day"; v.lodgings[1].parking.price = 1000; expect(lodgingIssues(v)).toHaveProperty("lodgings.1.parking.days"); v.lodgings[1].parking.days = 2; v.lodgings[1].parking.price = null; expect(lodgingIssues(v)).toHaveProperty("lodgings.1.parking.price"); });
  it("destino gratuito", () => { const v = scenario(); v.places[0].journeys[0].parkingPaid = false; expect(calculateLodgingComparison(v).scenarios.every(s => s.journeys[0].parking === 0)).toBe(true); });
  it("destino compartilhado evita duplicação", () => { const r = calculateLodgingComparison(scenario()); expect(r.scenarios.map(s => s.journeys[0].parking)).toEqual([4000, 4000]); });
  it("destino pode diferir em cada cenário", () => { const v = scenario(); v.places[0].sameParking = false; Object.assign(v.places[0].journeys[1], { parkingPaid: true, parking: 3000 }); expect(calculateLodgingComparison(v).scenarios.map(s => s.journeys[0].parking)).toEqual([4000, 6000]); });
  it("pagamento explicitamente zero permanece informado", () => { const v = scenario(); v.places[0].journeys[0].parking = 0; expect(lodgingIssues(v)).toEqual({}); expect(calculateLodgingComparison(v).scenarios[0].journeys[0].parking).toBe(0); });
});
describe("deslocamentos de carro próprio e alugado", () => {
  it.each(["own", "rented"] as const)("%s usa somente custos de localização", transport => { const v = scenario(); v.transport = transport; expect(calculateLodgingComparison(v).scenarios.map(s => s.journeys[0].fuel)).toEqual([480, 2880]); });
  it.each([["round", 20, 1200], ["outward", 10, 600], ["return", 10, 600]] as const)("distância e combustível %s", (kind, km, cents) => { expect(totalDistance(5, 2, kind)).toBe(km); expect(travelFuel(5, 2, kind, 10, 600)).toBe(cents); });
  it("consumo decimal sem arredondar litros", () => { expect(travelFuel(1, 1, "outward", 3, 100)).toBe(33); expect(travelFuel(1, 1, "outward", 2, 1)).toBe(1); expect(travelFuel(1.25, 3, "round", 12.5, 630)).toBe(378); });
  it.each([0, null])("consumo %s não calcula como zero", efficiency => { const v = scenario(); v.efficiency = efficiency; expect(lodgingIssues(v)).toHaveProperty("efficiency"); expect(() => calculateLodgingComparison(v)).toThrow(/Complete/); });
  it.each(["distance", "parking", "toll"] as const)("campo ativo %s ausente gera validação", key => { const v = scenario(); const j = v.places[0].journeys[0]; j.parkingPaid = j.tollPaid = true; j.toll = 500; j[key] = null; expect(lodgingIssues(v)).toHaveProperty(`places.0.journeys.0.${key}`); });
  it("preço do combustível obrigatório mesmo que distância seja zero", () => { const v = scenario(); v.fuelPrice = null; expect(lodgingIssues(v)).toHaveProperty("fuelPrice"); });
  it("zero explícito em distância ou combustível é aceito", () => { const v = scenario(); v.fuelPrice = 0; expect(calculateLodgingComparison(v).scenarios.every(s => s.journeys[0].fuel === 0)).toBe(true); expect(travelFuel(0, 1, "round", 10, 600)).toBe(0); });
  it("sem locais não exige consumo ou preço", () => { const v = scenario(); v.places = []; v.efficiency = v.fuelPrice = null; const r = calculateLodgingComparison(v); expect(r.scenarios.every(s => s.transport === 0 && s.minutes === 0)).toBe(true); });
  it("pedágio ausente não soma valores antigos", () => { const v = scenario(); v.places[0].journeys[0].toll = 1000; expect(calculateLodgingComparison(v).scenarios[0].journeys[0].toll).toBe(0); });
  it.each(["round", "outward", "return"] as const)("pedágio %s multiplica visita completa apenas pela frequência", kind => { const v = scenario(); v.places[0].kind = kind; Object.assign(v.places[0].journeys[0], { tollPaid: true, toll: 1500 }); expect(calculateLodgingComparison(v).scenarios[0].journeys[0].toll).toBe(3000); });
});
describe("aplicativo e outro/manual", () => {
  it.each(["app", "manual"] as const)("%s ignora consumo/distância/custos de veículo e respeita tarifas diferentes", transport => {
    const v = scenario(); v.transport = transport; v.efficiency = null; v.fuelPrice = null;
    v.places[0].journeys[0].fare = 2000; v.places[0].journeys[1].fare = 5000;
    const r = calculateLodgingComparison(v); expect(r.scenarios.map(s => s.transport)).toEqual([4000, 10000]); expect(r.scenarios.every(s => s.journeys[0].fuel === 0 && s.journeys[0].distance === null)).toBe(true);
  });
  it.each(["round", "outward", "return"] as const)("tarifa de visita %s não multiplica por trechos", kind => { const v = scenario(); v.transport = "app"; v.places[0].kind = kind; v.places[0].journeys.forEach(j => { j.fare = 2000; }); expect(calculateLodgingComparison(v).scenarios[0].transport).toBe(4000); });
  it("tarifa por visita vazia não vira zero", () => { const v = scenario(); v.transport = "app"; expect(lodgingIssues(v)).toHaveProperty("places.0.journeys.0.fare"); });
  it("aplicativo/manual/estacionamento por visita × frequência", () => expect(perVisitCost(2500, 3)).toBe(7500));
});
describe("tempo separado do dinheiro", () => {
  it.each([["round", 120], ["outward", 60], ["return", 60]] as const)("tempo %s", (kind, minutes) => expect(travelMinutes(20, 3, kind)).toBe(minutes));
  it.each([[0, "0 minutos"], [1, "1 minuto"], [12, "12 minutos"], [59, "59 minutos"], [60, "1 hora"], [61, "1h01"], [72, "1h12"], [90, "1h30"], [120, "2 horas"], [132, "2h12"]])("%s minutos para horas", (minutes, text) => expect(formatTravelTime(minutes as number)).toBe(text));
  it("tempo zero é explícito e ausência torna total incompleto", () => { const v = scenario(); v.places[0].journeys[0].minutes = null; let r = calculateLodgingComparison(v); expect(r.scenarios[0].minutes).toBeNull(); expect(r.minutesDelta).toBeNull(); expect(lodgingTimeText(r)).toContain("Informe os tempos"); v.places[0].journeys[0].minutes = 0; r = calculateLodgingComparison(v); expect(r.scenarios[0].minutes).toBe(0); });
  it("não monetiza tempo", () => { const v = scenario(), before = calculateLodgingComparison(v); v.places[0].journeys[0].minutes = 999; const after = calculateLodgingComparison(v); expect(after.delta).toBe(before.delta); expect(after.scenarios.map(s => s.total)).toEqual(before.scenarios.map(s => s.total)); expect(after.minutesDelta).not.toBe(before.minutesDelta); });
  it("frase usa nome e diferença de tempo", () => { const r = calculateLodgingComparison(scenario()); expect(lodgingTimeText(r)).toContain("Hotel Centro"); expect(timeDifference(40, 120)).toBe(-80); });
});
describe("diferenças, inversão da reserva e por pessoa", () => {
  it.each([[10000, 20000, -10000], [20000, 10000, 10000], [10000, 10000, 0]])("diferença %s - %s", (a, b, delta) => expect(lodgingDifference(a, b)).toBe(delta));
  it.each([[1000, 1, 1000], [1000, 2, 500], [1, 2, 1]])("custo por pessoa %s / %s", (total, people, expected) => expect(lodgingPerPerson(total, people)).toBe(expected));
  it("protege divisão por zero", () => expect(() => lodgingPerPerson(1000, 0)).toThrow());
  it.each([[100000, "Hotel Centro"], [300000, "Hotel Econômico"]])("cenário de menor custo %s", (price, less) => { const v = scenario(); v.lodgings[0].price = price as number; expect(lodgingDifferenceText(calculateLodgingComparison(v))).toContain(`${less} custa`); });
  it("empate", () => { const v = scenario(); v.places = []; v.lodgings.forEach(l => { l.price = 100000; l.meals.breakfast.included = true; }); const r = calculateLodgingComparison(v); expect(lodgingDifferenceText(r)).toContain("mesmo custo total comparável"); expect(lodgingTimeText(r)).toContain("mesmo tempo"); });
  it("reserva mais barata continua mais barata", () => expect(lodgingPriceInsight(calculateLodgingComparison(scenario()))).toContain("diferença final cai para R$ 176,00"));
  it("adicionais podem inverter a opção mais barata", () => { const v = scenario(); v.lodgings[1].fees = 50000; const r = calculateLodgingComparison(v); expect(lodgingPriceInsight(r)).toContain("Hotel Econômico custa R$ 400,00 a menos na hospedagem"); expect(lodgingPriceInsight(r)).toContain("Hotel Centro custa R$ 324,00 a menos no total"); });
  it("gastos iguais não criam linhas de diferenças irrelevantes", () => { const r = calculateLodgingComparison(scenario()); expect(r.differences.some(d => d.label === "Estacionamento nos locais")).toBe(false); expect(r.differences.some(d => d.label === "Almoço")).toBe(false); });
});
describe("validação e persistência", () => {
  it.each(["people", "nights"] as const)("%s > 0 e obrigatório", key => { const v = scenario(); v[key] = 0; expect(lodgingIssues(v)).toHaveProperty(key); v[key] = null; expect(lodgingIssues(v)).toHaveProperty(key); });
  it("visitas devem ser positivas e preço obrigatório", () => { const v = scenario(); v.places[0].visits = 0; v.lodgings[0].price = null; expect(lodgingIssues(v)).toHaveProperty("places.0.visits"); expect(lodgingIssues(v)).toHaveProperty("lodgings.0.price"); });
  it.each(["", " "])("vazio %s preserva null", text => expect(parseLodgingQuantity(text)).toBeNull());
  it.each([["0", 0], ["1,5", 1.5], ["0,000001", 0.000001]])("quantidade %s", (text, n) => expect(parseLodgingQuantity(text as string)).toBe(n));
  it.each(["-1", "NaN", "Infinity", "1,0000001", "1000001", "abc"])("quantidade inválida %s", text => expect(() => parseLodgingQuantity(text)).toThrow());
  it("pessoas, noites, dias e visitas são inteiros", () => expect(() => parseLodgingQuantity("1,5", true)).toThrow());
  it("campos negativos e dinheiro fracionário são rejeitados", () => { const v = scenario(); v.lodgings[0].price = -1; expect(() => validateLodgingShape(v)).toThrow(); v.lodgings[0].price = 1.5; expect(() => validateLodgingShape(v)).toThrow(); });
  it("totais não perdem precisão silenciosamente", () => { expect(() => lodgingPrice(1_000_000_000_000, "night", 100000)).toThrow(/seguro/); expect(() => sumLodgingCosts([Number.MAX_SAFE_INTEGER, 1])).toThrow(); });
  it("restaura toda a simulação e campos ocultos", () => { const v = scenario(); v.lodgings[0].meals.breakfast.price = 0; v.lodgings[1].parking.days = 4; v.extras.push({ id: "extra", name: "Transfer", amounts: [null, 12000] }); expect(decodeLodgingComparison(encodeLodgingComparison(v))).toEqual(v); });
  it("permite salvar simulação incompleta", () => expect(decodeLodgingComparison(encodeLodgingComparison(emptyLodgingComparison()))).toEqual(emptyLodgingComparison()));
  it.each(["invalid", '{"version":2}', '{"version":1,"values":{}}', '{"version":1,"values":null}'])("registro inválido %s", text => expect(() => decodeLodgingComparison(text)).toThrow());
  it("locais duplicados, enum inválido ou formato quebrado são rejeitados", () => { const v = scenario(); v.places.push(structuredClone(v.places[0])); expect(() => validateLodgingShape(v)).toThrow(); v.places.pop(); (v.places[0] as unknown as { kind: string }).kind = "invalid"; expect(() => validateLodgingShape(v)).toThrow(); });
  it("lista ativa exclui gastos incluídos e lista armazenada conserva dados", () => { const v = scenario(); expect(lodgingFields(v).some(f => f.path === "lodgings.0.meals.breakfast.price")).toBe(false); expect(storedLodgingFields(v).some(f => f.path === "lodgings.0.meals.breakfast.price")).toBe(true); });
  it("hospedagens continuam disponíveis sem ferramentas futuras no catálogo", () => { expect(travelTools.find(tool => tool.href === "/comparar-hospedagens/")).toMatchObject({ title: "Comparar hospedagens", href: "/comparar-hospedagens/" }); expect(travelTools).toHaveLength(3); });
});
describe("relatórios", () => {
  it.each(["own", "rented", "app", "manual"] as const)("PDF e Excel para %s recebem totais e detalhamento corretos", async transport => {
    const v = scenario(); v.transport = transport; if (transport === "app" || transport === "manual") v.places[0].journeys.forEach((j, i) => { j.fare = i === 0 ? 2000 : 5000; });
    const r = calculateLodgingComparison(v), sheets = lodgingSheets(r, options), draw = vi.spyOn(PDFPage.prototype, "drawText");
    expect(sheets.map(s => s.sheet)).toEqual(["Resumo", "Hospedagens", "Deslocamentos", "Premissas"]);
    expect(sheets[0].data.find(row => row[0] === "Custo total comparável")?.[1]).toMatchObject({ value: r.scenarios[0].total / 100, type: Number });
    expect(sheets[0].data.find(row => row[0] === "Diferença financeira (A - B)")?.[1]).toMatchObject({ value: r.delta / 100, type: Number });
    expect(sheets[2].data[1][16]).toMatchObject({ value: r.scenarios[0].transport / 100, type: Number });
    expect(sheets[2].data[1][18]).toMatchObject({ value: 40, type: Number });
    try {
      const bytes = await createLodgingPdf(r, options), doc = await PDFDocument.load(bytes), text = draw.mock.calls.map(args => args[0]).join(" ");
      expect(doc.getTitle()).toBe("Comparar hospedagens"); expect(doc.getPageCount()).toBeGreaterThan(1); expect(text).toContain("Hotel Centro"); expect(text).toContain("Centro turístico"); expect(text).toContain("Tempo separado do dinheiro"); expect(text).toContain("Café da manhã"); expect(text).toContain("R$ 200,00");
      expect(text).toContain(`custo total comparável R$ ${(r.scenarios[0].total / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      expect(text).toContain(transport === "app" ? "corridas R$ 20,00/visita" : transport === "manual" ? "custo manual R$ 20,00/visita" : "8 km totais; combustível R$ 4,80");
      expect(draw.mock.calls.every(([, config]) => !config?.y || config.y >= 35)).toBe(true);
    } finally { draw.mockRestore(); }
    const bytes = new Uint8Array(await (await createLodgingExcel(r, options)).arrayBuffer()); expect([...bytes.slice(0, 4)]).toEqual([80, 75, 3, 4]);
  });
  it("Excel preserva ausência de tempo e números explícitos zero", () => { const v = scenario(); v.places[0].journeys[0].minutes = null; v.lodgings[0].fees = 0; const sheets = lodgingSheets(calculateLodgingComparison(v), options); expect(sheets[0].data.find(row => row[0] === "Tempo total / minutos")?.[1]).toBeNull(); expect(sheets[2].data[1][18]).toBeNull(); expect(sheets[1].data.find(row => row[0] === "Taxas")?.[1]).toMatchObject({ value: 0, type: Number }); });
  it("PDF quebra nomes longos sem perder os totais", async () => { const v = scenario(); v.lodgings[0].name = "H".repeat(80); const bytes = await createLodgingPdf(calculateLodgingComparison(v), options); expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0); });
});

describe("acabamento da V1", () => {
  it.each([[0, "pessoa", "0 pessoas"], [1, "pessoa", "1 pessoa"], [2, "pessoa", "2 pessoas"], [1, "noite", "1 noite"], [2, "noite", "2 noites"], [1, "visita", "1 visita"], [2, "visita", "2 visitas"]] as const)("pluraliza %s %s", (n, word, expected) => expect(formatLodgingQuantity(n, word)).toBe(expected));
  it.each([
    [150000, 180000, 0, 0, "custos adicionais são iguais"],
    [150000, 180000, 8000, 0, "diferença final cai para R$ 220,00"],
    [150000, 180000, 70000, 20000, "Hospedagem B custa R$ 200,00 a menos no total comparável"],
    [150000, 180000, 0, 10000, "diferença total chega a R$ 400,00"],
    [150000, 150000, 0, 10000, "Hospedagem A custa R$ 100,00 a menos"],
    [150000, 180000, 30000, 0, "mesmo custo total comparável"],
    [150000, 150000, 0, 0, "mesmo custo total comparável"],
    [180000, 150000, 0, 8000, "diferença final cai para R$ 220,00"],
  ])("interpreta preços %s/%s e adicionais %s/%s", (a, b, x, y, expected) => {
    const v = emptyLodgingComparison(); Object.assign(v, { people: 1, nights: 1, transport: "manual" });
    Object.assign(v.lodgings[0], { price: a, fees: x }); Object.assign(v.lodgings[1], { price: b, fees: y });
    expect(lodgingPriceInsight(calculateLodgingComparison(v))).toContain(expected);
  });
  it("preserva o cenário real, exportações e armazenamento", async () => {
    const v = emptyLodgingComparison(); Object.assign(v, { people: 1, nights: 10, transport: "rented", efficiency: 10, fuelPrice: 700 });
    Object.assign(v.lodgings[0], { name: "Condomínio Vivare Matteo Gianella", price: 175000 });
    Object.assign(v.lodgings[1], { name: "Residencial Paseo Del Molino", price: 193900 });
    v.places = [["Jardim Zobotanico", 7, 15, 7, 15], ["Nova Petropolis", 38, 51, 34, 45]].map(([name, da, ma, db, mb], i) => {
      const p = emptyTravelPlace(String(i)); p.name = String(name); p.visits = 1;
      Object.assign(p.journeys[0], { distance: da, minutes: ma }); Object.assign(p.journeys[1], { distance: db, minutes: mb }); return p;
    });
    const r = calculateLodgingComparison(decodeLodgingComparison(encodeLodgingComparison(v)));
    expect(r.scenarios.map(s => s.journeys.map(j => [j.distance, j.fuel, j.minutes]))).toEqual([[[14, 980, 30], [76, 5320, 102]], [[14, 980, 30], [68, 4760, 90]]]);
    expect(r.scenarios.map(s => [s.transport, s.minutes, s.total, s.perPerson])).toEqual([[6300, 132, 181300, 181300], [5740, 120, 199640, 199640]]);
    expect(r.delta).toBe(-18340); expect(r.minutesDelta).toBe(12);
    expect(lodgingPriceInsight(r)).toContain("Residencial Paseo Del Molino custa R$ 189,00 a mais"); expect(lodgingPriceInsight(r)).toContain("economiza R$ 5,60"); expect(lodgingPriceInsight(r)).toContain("R$ 183,40");
    expect(lodgingTimeText(r)).toContain("12 minutos a menos");
    const sheets = lodgingSheets(r, options);
    expect(sheets[0].data.find(row => row[0] === "Diferença nos custos adicionais (A - B)")?.[1]).toMatchObject({ type: Number, value: 5.6 });
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try { await createLodgingPdf(r, options); const text = draw.mock.calls.map(c => c[0]).join(" ");
      expect(text).toContain("Impacto dos custos adicionais"); expect(text).toContain("1 pessoa"); expect(text).toContain("1 visita"); expect(text).toContain("132 minutos (2h12)"); expect(text).toContain("Diferença de tempo: 12 minutos"); expect(text).not.toMatch(/1 pessoas|visita\(s\)|aproximadamente|A - B/);
    } finally { draw.mockRestore(); }
  });
});

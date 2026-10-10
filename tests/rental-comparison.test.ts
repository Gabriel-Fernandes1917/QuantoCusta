import { describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import { activeRentalFields, beyondRentalText, calculateRentalComparison, calculateRentalRide, emptyRentalComparison, emptyRentalRide, formatDuration, formatQuantity, parseRentalField, rentalAverage, rentalDifferenceText, rentalIssues, rentalMultiply, rentalNotes, rentalRideMetrics, rentalSum, rentalWaitText, storedRentalFields, validateRentalShape, type RentalComparison } from "../src/lib/calculations/rental-comparison";
import { decodeRentalComparison, encodeRentalComparison, RENTAL_STORAGE_KEY } from "../src/lib/rental-storage";
import { createRentalExcel, createRentalPdf, rentalSheets } from "../src/lib/export/rental-comparison";
import { travelTools } from "../src/lib/tools";

function minimal(): RentalComparison {
  const v = emptyRentalComparison(); Object.assign(v, { days: 7, vehicle: "car", priceMode: "total", rentalPrice: 10000, fuelDirect: 0 });
  const ride = emptyRentalRide("one"); Object.assign(ride, { count: 1, outwardFare: 20000 }); v.rides = [ride]; return v;
}
function scenario(): RentalComparison {
  const v = minimal(); Object.assign(v, { people: 2, priceMode: "daily", rentalPrice: 15000, rentalDays: 7, fuelMode: "distance", kilometers: 500, efficiency: 10, fuelPrice: 600, parkingPaid: true, parkingMode: "daily", parkingPrice: 2000, parkingDays: 5, tollPaid: true, tolls: 8000, cleaning: 3000 });
  v.rides = [["Aeroporto ↔ Hotel", 1, 6000, 7000, 10, 15], ["Hotel ↔ Centro", 4, 2500, 3000, 8, 10], ["Hotel ↔ atração", 2, 4000, 4500, 10, 10]].map(([name, count, outwardFare, returnFare, outwardWait, returnWait], i) => Object.assign(emptyRentalRide(String(i)), { name, kind: "round", count, outwardFare, returnFare, outwardWait, returnWait }));
  return v;
}
const options = { brand: { name: "Coyler", domain: "coyler.test" }, generatedAt: new Date("2026-10-06T12:00:00Z") };
describe("locação e adicionais", () => {
  it("usa valor total sem depender de diárias antigas", () => { const v = minimal(); v.rentalDays = 100; expect(calculateRentalComparison(v).rental).toBe(10000); });
  it("diária × diárias, independente dos dias da viagem", () => { const v = minimal(); Object.assign(v, { priceMode: "daily", rentalDays: 3, rentalPrice: 15000 }); expect(calculateRentalComparison(v).rental).toBe(45000); expect(calculateRentalComparison(v).vehiclePerDay).toBe(6429); });
  it.each(["car", "motorcycle"] as const)("%s usa as mesmas fórmulas", vehicle => { const v = scenario(); v.vehicle = vehicle; expect(calculateRentalComparison(v).vehicleTotal).toBe(156000); });
  it.each(["protection", "fees", "driver"] as const)("%s incluído ignora o valor adicional antigo", key => {
    const v = minimal(); v[key] = 12345; v.included[key] = true;
    expect(calculateRentalComparison(v).vehicleTotal).toBe(10000); expect(activeRentalFields(v).some(f => f.path === key)).toBe(false);
    expect(storedRentalFields(v).some(f => f.path === key)).toBe(true);
    v.included[key] = false; expect(calculateRentalComparison(v).vehicleTotal).toBe(22345);
  });
  it.each(["protection", "fees", "driver"] as const)("%s adicional é total, sem multiplicar pelas diárias", key => { const v = scenario(); v[key] = 10000; expect(calculateRentalComparison(v).vehicleTotal).toBe(166000); });
  it("quilometragem livre é apenas informativa", () => { const v = scenario(); v.included.unlimited = true; expect(calculateRentalComparison(v).vehicleTotal).toBe(156000); });
  it.each([null, 0])("diárias %s bloqueiam o método diário", rentalDays => { const v = scenario(); v.rentalDays = rentalDays; expect(rentalIssues(v)).toHaveProperty("rentalDays"); expect(() => calculateRentalComparison(v)).toThrow(/Complete/); });
  it("preço vazio bloqueia; zero explícito é aceito", () => { const v = minimal(); v.rentalPrice = null; expect(rentalIssues(v)).toHaveProperty("rentalPrice"); v.rentalPrice = 0; expect(calculateRentalComparison(v).rental).toBe(0); });
});
describe("combustível", () => {
  it("valor direto ignora a estimativa armazenada", () => { const v = minimal(); Object.assign(v, { fuelDirect: 25000, kilometers: 900, efficiency: 0, fuelPrice: 700 }); expect(calculateRentalComparison(v).fuel).toBe(25000); });
  it("500 km / 10 km/L × R$6 = R$300", () => expect(calculateRentalComparison(scenario()).fuel).toBe(30000));
  it.each([[500, 20, 600, 15000], [500, 10, 700, 35000], [0, 10, 600, 0], [500, 10, 0, 0], [1, 3, 100, 33], [1, 2, 1, 1]])("km %s / consumo %s × preço %s = %s centavos", (kilometers, efficiency, fuelPrice, expected) => { const v = scenario(); Object.assign(v, { kilometers, efficiency, fuelPrice }); expect(calculateRentalComparison(v).fuel).toBe(expected); });
  it.each([null, 0])("consumo %s é protegido", efficiency => { const v = scenario(); v.efficiency = efficiency; expect(rentalIssues(v)).toHaveProperty("efficiency"); expect(() => calculateRentalComparison(v)).toThrow(); });
  it.each(["kilometers", "fuelPrice"] as const)("%s vazio é obrigatório no modo distância", key => { const v = scenario(); v[key] = null; expect(rentalIssues(v)).toHaveProperty(key); });
  it("valor direto vazio não vira zero", () => { const v = minimal(); v.fuelDirect = null; expect(rentalIssues(v)).toHaveProperty("fuelDirect"); });
});
describe("estacionamento, pedágio, limpeza, outros e caução", () => {
  it("sem estacionamento ignora valores antigos", () => { const v = minimal(); Object.assign(v, { parkingPrice: 10000, parkingDays: 7, parkingMode: "daily" }); expect(calculateRentalComparison(v).parking).toBe(0); });
  it("estacionamento total", () => { const v = minimal(); Object.assign(v, { parkingPaid: true, parkingPrice: 10000 }); expect(calculateRentalComparison(v).parking).toBe(10000); });
  it.each([[1, 2000], [5, 10000], [10, 20000]])("estacionamento por dia × %s dias", (parkingDays, expected) => { const v = minimal(); Object.assign(v, { parkingPaid: true, parkingMode: "daily", parkingDays, parkingPrice: 2000 }); expect(calculateRentalComparison(v).parking).toBe(expected); });
  it("estacionamento pago exige preço e dias quando ativos", () => { const v = minimal(); Object.assign(v, { parkingPaid: true, parkingMode: "daily" }); expect(rentalIssues(v)).toMatchObject({ parkingPrice: expect.any(String), parkingDays: expect.any(String) }); });
  it("sem pedágio ignora valores antigos", () => { const v = minimal(); v.tolls = 5000; expect(calculateRentalComparison(v).vehicleTotal).toBe(10000); });
  it("pedágio total e validação de campo necessário", () => { const v = minimal(); v.tollPaid = true; expect(rentalIssues(v)).toHaveProperty("tolls"); v.tolls = 8000; expect(calculateRentalComparison(v).vehicleTotal).toBe(18000); });
  it.each([[null, 10000], [0, 10000], [3000, 13000]])("limpeza %s é opcional", (cleaning, total) => { const v = minimal(); v.cleaning = cleaning; expect(calculateRentalComparison(v).vehicleTotal).toBe(total); });
  it.each([[[]], [[1000]], [[1000, 2000, 0]]])("outros custos %j", prices => { const v = minimal(); v.extras = prices.map((price, i) => ({ id: String(i), name: "", price })); const r = calculateRentalComparison(v); expect(r.vehicleTotal).toBe(10000 + prices.reduce((sum, n) => sum + n, 0)); expect(r.extras.map(e => e.name)).toEqual(prices.map((_, i) => `Outro custo ${i + 1}`)); });
  it("caução não altera custo, composição, diferença ou médias", () => { const v = scenario(), before = calculateRentalComparison(v); v.deposit = 200000; const after = calculateRentalComparison(v); expect(after.deposit).toBe(200000); expect(after.breakdown).toEqual(before.breakdown); expect(after.vehicleTotal).toBe(before.vehicleTotal); expect(after.delta).toBe(before.delta); expect(after.vehiclePerDay).toBe(before.vehiclePerDay); expect(after.vehiclePerPerson).toBe(before.vehiclePerPerson); });
});
describe("corridas", () => {
  it("somente ida é o padrão e usa valor × quantidade", () => { const v = minimal(); v.rides[0].count = 3; expect(v.rides[0].kind).toBe("outward"); expect(calculateRentalComparison(v).appTotal).toBe(60000); });
  it("ida e volta aceitam preços diferentes e várias ocorrências", () => { const ride = Object.assign(emptyRentalRide("x"), { kind: "round" as const, count: 3, outwardFare: 2500, returnFare: 3000 }); expect(calculateRentalRide(ride)).toMatchObject({ unitCost: 5500, total: 16500 }); });
  it("agrega várias corridas", () => expect(calculateRentalComparison(scenario()).rides.map(r => r.total)).toEqual([13000, 22000, 17000]));
  it("ida ignora preço e espera de volta antigos", () => { const v = minimal(); Object.assign(v.rides[0], { returnFare: 99999, returnWait: 30 }); const r = calculateRentalComparison(v); expect(r.appTotal).toBe(20000); expect(r.waitMinutes).toBeNull(); expect(activeRentalFields(v).some(f => f.path === "rides.0.returnFare")).toBe(false); });
  it("tarifa zero explícita é aceita", () => { const v = minimal(); v.rides[0].outwardFare = 0; expect(calculateRentalComparison(v).appTotal).toBe(0); });
  it.each(["outwardFare", "returnFare", "count"] as const)("campo necessário %s vazio bloqueia", key => { const v = scenario(); v.rides[0][key] = null; expect(rentalIssues(v)).toHaveProperty(`rides.0.${key}`); expect(() => calculateRentalComparison(v)).toThrow(/Complete/); });
  it("frequência zero não é aceita", () => { const v = minimal(); v.rides[0].count = 0; expect(rentalIssues(v)).toHaveProperty("rides.0.count"); });
  it("nenhuma corrida exige cadastro, sem presumir total zero", () => { const v = minimal(); v.rides = []; expect(rentalIssues(v)).toHaveProperty("rides"); });
});
describe("espera separada do dinheiro", () => {
  it("nenhuma espera fica não informada, diferente de zero", () => { const r = calculateRentalComparison(minimal()); expect(r.waitMinutes).toBeNull(); expect(rentalWaitText(r)).toBe("Tempo de espera não informado."); });
  it("zero explicitamente informado é espera conhecida", () => { const v = minimal(); v.rides[0].outwardWait = 0; expect(calculateRentalComparison(v)).toMatchObject({ waitMinutes: 0, waitComplete: true }); });
  it("somente ida multiplica por frequência", () => { const v = minimal(); Object.assign(v.rides[0], { count: 3, outwardWait: 10 }); expect(calculateRentalComparison(v).waitMinutes).toBe(30); });
  it("ida e volta somam esperas diferentes e multiplicam por frequência", () => expect(calculateRentalComparison(scenario()).rides[1]).toMatchObject({ waitMinutes: 72, waitComplete: true }));
  it("agrega todas as corridas em 137 minutos", () => { const r = calculateRentalComparison(scenario()); expect(r.waitMinutes).toBe(137); expect(r.waitComplete).toBe(true); expect(rentalWaitText(r)).toBe("Tempo total estimado de espera: 2h17."); });
  it("espera parcialmente preenchida é parcial, sem tratar vazio como zero conhecido", () => { const v = scenario(); v.rides[0].returnWait = null; const r = calculateRentalComparison(v); expect(r.waitMinutes).toBe(122); expect(r.waitComplete).toBe(false); expect(r.rides[0]).toMatchObject({ waitMinutes: 10, waitComplete: false }); expect(rentalWaitText(r)).toContain("parcial"); });
  it("uma corrida sem espera mantém agregação parcial", () => { const v = scenario(); v.rides[0].outwardWait = v.rides[0].returnWait = null; const r = calculateRentalComparison(v); expect(r.waitMinutes).toBe(112); expect(r.waitComplete).toBe(false); });
  it("espera não altera dinheiro", () => { const v = scenario(), before = calculateRentalComparison(v); v.rides.forEach(r => { r.outwardWait = 999; r.returnWait = null; }); const after = calculateRentalComparison(v); expect([after.vehicleTotal, after.appTotal, after.delta]).toEqual([before.vehicleTotal, before.appTotal, before.delta]); });
  it.each([[35, "35 minutos"], [75, "1h15"], [120, "2 horas"], [137, "2h17"]])("helper compartilhado %s minutos", (n, text) => expect(formatDuration(n as number)).toBe(text));
});
describe("totais, diferenças e divisões", () => {
  it("cenário de validação completo preserva entrada e centavos", () => {
    const v = scenario(), before = structuredClone(v), r = calculateRentalComparison(v);
    expect(r).toMatchObject({ rental: 105000, fuel: 30000, parking: 10000, vehicleTotal: 156000, appTotal: 52000, difference: 104000, totalRides: 14, appPerRide: 3714, beyondRental: 51000, vehiclePerDay: 22286, appPerDay: 7429, vehiclePerPerson: 78000, appPerPerson: 26000, waitMinutes: 137 });
    expect(r.breakdown.reduce((sum, c) => sum + c.value, 0)).toBe(r.vehicleTotal); expect(r.breakdown.reduce((sum, c) => sum + c.share!, 0)).toBeCloseTo(100); expect(r.rides.reduce((sum, ride) => sum + ride.share!, 0)).toBeCloseTo(100); expect(v).toEqual(before);
  });
  it.each([[10000, 20000, "o veículo alugado"], [30000, 20000, "o transporte por aplicativo"], [20000, 20000, "mesmo custo estimado"]])("veículo %s e app %s", (price, fare, text) => { const v = minimal(); v.rentalPrice = price as number; v.rides[0].outwardFare = fare as number; const r = calculateRentalComparison(v); expect(rentalDifferenceText(r)).toContain(text); expect(r).not.toHaveProperty("differencePercent"); });
  it.each([[0, 0], [10000, 0], [0, 20000]])("total zero %s/%s preserva diferença em reais", (rentalPrice, outwardFare) => { const v = minimal(); v.rentalPrice = rentalPrice; v.rides[0].outwardFare = outwardFare; expect(calculateRentalComparison(v).difference).toBe(Math.abs(rentalPrice - outwardFare)); });
  it("total zero não tem composição percentual", () => { const v = minimal(); v.rentalPrice = v.rides[0].outwardFare = 0; const r = calculateRentalComparison(v); expect(r.breakdown.every(c => c.share === null)).toBe(true); expect(r.rides[0].share).toBeNull(); });
  it("pessoas opcionais não geram médias e não multiplicam custos", () => { const v = scenario(), before = calculateRentalComparison(v); v.people = null; const r = calculateRentalComparison(v); expect(r.vehiclePerPerson).toBeNull(); expect(r.appPerPerson).toBeNull(); expect(r.vehicleTotal).toBe(before.vehicleTotal); expect(r.appTotal).toBe(before.appTotal); });
  it.each([1, 2])("%s pessoas só dividem o custo", people => { const v = scenario(); v.people = people; const r = calculateRentalComparison(v); expect(r.vehiclePerPerson).toBe(156000 / people); expect(r.appPerPerson).toBe(52000 / people); });
  it.each(["days", "people", "rentalDays", "parkingDays"] as const)("%s zero protegido quando ativo", key => { const v = scenario(); v[key] = 0; expect(rentalIssues(v)).toHaveProperty(key); expect(() => calculateRentalComparison(v)).toThrow(); });
  it("divisão arredonda metade para cima", () => { expect(rentalAverage(1, 2)).toBe(1); expect(() => rentalAverage(100, 0)).toThrow(); });
  it("custos além da locação são interpretados", () => expect(beyondRentalText(calculateRentalComparison(scenario()))).toContain("custos além da locação somam R$ 510,00"));
  it.each([[1, "dia", "1 dia"], [2, "dia", "2 dias"], [1, "pessoa", "1 pessoa"], [2, "pessoa", "2 pessoas"]] as const)("pluraliza %s %s", (n, unit, text) => expect(formatQuantity(n, unit)).toBe(text));
});
describe("validação e armazenamento", () => {
  it.each(["days", "people", "rentalDays"] as const)("%s exige inteiro", key => { const v = scenario(); v[key] = 1.5; expect(() => validateRentalShape(v)).toThrow(); });
  it.each(["rentalPrice", "fuelDirect", "parkingPrice", "tolls", "cleaning", "deposit"] as const)("%s negativo rejeitado", key => { const v = minimal(); v[key] = -1; expect(() => validateRentalShape(v)).toThrow(); });
  it("dinheiro fracionário, espera negativa e enum inválido rejeitados", () => { const v = minimal(); v.rentalPrice = 1.5; expect(() => validateRentalShape(v)).toThrow(); v.rentalPrice = 100; v.rides[0].outwardWait = -1; expect(() => validateRentalShape(v)).toThrow(); v.rides[0].outwardWait = null; (v.rides[0] as unknown as { kind: string }).kind = "return"; expect(() => validateRentalShape(v)).toThrow(); });
  it.each(["", " "])("entrada vazia %s continua null", text => expect(parseRentalField(text, "money")).toBeNull());
  it.each([["0", "money", 0], ["1.250,50", "money", 125050], ["1,5", "quantity", 1.5], ["2", "integer", 2]] as const)("parse %s como %s", (text, kind, expected) => expect(parseRentalField(text, kind)).toBe(expected));
  it("totais enormes não perdem precisão silenciosamente", () => { expect(() => rentalMultiply(1_000_000_000_000, 1_000_000)).toThrow(/seguro/); expect(() => rentalSum([Number.MAX_SAFE_INTEGER, 1])).toThrow(/seguro/); });
  it("salva e restaura todos os campos ativos e ocultos", () => { const v = scenario(); Object.assign(v, { fuelDirect: 12300, deposit: 200000, protection: 50000, driver: 0 }); v.included.protection = true; v.extras.push({ id: "seat", name: "Cadeirinha", price: 5000 }); expect(decodeRentalComparison(encodeRentalComparison(v))).toEqual(v); expect(RENTAL_STORAGE_KEY).toBe("quantocusta:rental-comparison:v1"); });
  it("salva simulação incompleta", () => expect(decodeRentalComparison(encodeRentalComparison(emptyRentalComparison()))).toEqual(emptyRentalComparison()));
  it.each(["invalid", '{"version":2}', '{"version":1,"values":{}}', '{"version":1,"values":null}'])("salvo inválido %s", text => expect(() => decodeRentalComparison(text)).toThrow());
  it("ids duplicados e lista acima de 50 são rejeitados", () => { const v = minimal(); v.rides.push(structuredClone(v.rides[0])); expect(() => validateRentalShape(v)).toThrow(); v.rides = Array.from({ length: 51 }, (_, i) => emptyRentalRide(String(i))); expect(() => validateRentalShape(v)).toThrow(); });
  it("checklist quebrado é rejeitado", () => { const v = minimal(); (v as unknown as { included: unknown }).included = {}; expect(() => validateRentalShape(v)).toThrow(); });
  it("catálogo de viagens contém as três ferramentas disponíveis", () => { expect(travelTools.find(tool => tool.href === "/veiculo-alugado-ou-aplicativo/")).toMatchObject({ href: "/veiculo-alugado-ou-aplicativo/" }); expect(travelTools).toHaveLength(3); });
});
describe("PDF e Excel", () => {
  it("quatro abas com números reais, espera e caução separados", async () => {
    const v = scenario(); v.deposit = 200000; const r = calculateRentalComparison(v), before = structuredClone(r), sheets = rentalSheets(r, options);
    expect(sheets.map(s => s.sheet)).toEqual(["Resumo", "Veículo alugado", "Corridas", "Premissas"]);
    expect(sheets[0].data.find(row => row[0] === "Custo total")?.slice(1)).toMatchObject([{ value: 1560, type: Number }, { value: 520, type: Number }]);
    expect(sheets[0].data.find(row => row[0] === "Diferença financeira absoluta")?.[1]).toMatchObject({ value: 1040, type: Number });
    expect(sheets[0].data.some(row => String(row[0]).includes("Diferença percentual"))).toBe(false);
    expect(sheets[0].data.find(row => row[0] === "Quantidade estimada de corridas")?.[2]).toMatchObject({ value: 14, type: Number });
    expect(sheets[0].data.find(row => row[0] === "Custo médio por corrida")?.[2]).toMatchObject({ value: 37.14, type: Number });
    expect(sheets[0].data.find(row => row[0] === "Espera informada / minutos")?.[2]).toMatchObject({ value: 137, type: Number });
    expect(sheets[0].data.find(row => row[0] === "Caução / fora do custo total")?.[1]).toMatchObject({ value: 2000, type: Number });
    expect(sheets[2].data[2].slice(3, 10)).toMatchObject([{ value: 25 }, { value: 30 }, { value: 55 }, { value: 220 }, { value: 8 }, { value: 10 }, { value: 72 }]);
    const bytes = new Uint8Array(await (await createRentalExcel(r, options)).arrayBuffer()); expect([...bytes.slice(0, 4)]).toEqual([80, 75, 3, 4]); expect(r).toEqual(before);
  });
  it("Excel não substitui ausências por zero conhecido", () => { const v = minimal(); v.rides[0].outwardFare = 0; const sheets = rentalSheets(calculateRentalComparison(v), options); expect(sheets[2].data[1][3]).toMatchObject({ value: 0, type: Number }); expect(sheets[2].data[1][4]).toBeNull(); expect(sheets[2].data[1][9]).toBeNull(); expect(sheets[0].data.find(row => row[0] === "Custo por pessoa")?.[1]).toBeNull(); expect(sheets[0].data.some(row => String(row[0]).includes("Diferença percentual"))).toBe(false); });
  it("Excel documenta espera parcial", () => { const v = scenario(); v.rides[0].returnWait = null; const sheets = rentalSheets(calculateRentalComparison(v), options); expect(sheets[2].data[1][10]).toBe("Parcial"); expect(sheets[0].data.find(row => row[0] === "Cobertura da espera")?.[2]).toContain("Parcial"); });
  it.each(["car", "motorcycle"] as const)("PDF de %s preserva resumo, premissas, espera e caução", async vehicle => {
    const v = scenario(); v.vehicle = vehicle; v.deposit = 200000; const r = calculateRentalComparison(v), draw = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const doc = await PDFDocument.load(await createRentalPdf(r, options)), text = draw.mock.calls.map(c => c[0]).join(" ");
      expect(doc.getTitle()).toBe("Veículo alugado ou aplicativo?"); expect(doc.getPageCount()).toBeGreaterThan(1);
      expect(text).toContain("R$ 1.560,00"); expect(text).toContain("R$ 520,00"); expect(text).toContain("R$ 1.040,00"); expect(text).toContain("2h17"); expect(text).toContain("Caução / limite temporariamente comprometido"); expect(text).toContain("R$ 2.000,00. Não incluído no custo total"); expect(text).toContain("Além da locação"); expect(text).toContain("disponibilidade de motoristas");
      expect(draw.mock.calls.every(([, config]) => !config?.y || config.y >= 35)).toBe(true);
    } finally { draw.mockRestore(); }
  });
  it("PDF preserva pessoas opcionais, espera não informada e nomes longos", async () => { const v = minimal(); v.rides[0].name = "H".repeat(80); const draw = vi.spyOn(PDFPage.prototype, "drawText"); try { const doc = await PDFDocument.load(await createRentalPdf(calculateRentalComparison(v), options)); expect(doc.getPageCount()).toBeGreaterThan(0); const text = draw.mock.calls.map(c => c[0]).join(" "); expect(text).toContain("Tempo de espera não informado"); expect(text).not.toContain("Custo por pessoa:"); } finally { draw.mockRestore(); } });
  it("premissas não recomendam escolha e documentam tarifa variável", () => { expect(rentalNotes.join(" ")).toContain("sem recomendação automática"); expect(rentalNotes.join(" ")).toContain("chuva"); });
});

function realScenario(): RentalComparison {
  const v = emptyRentalComparison();
  Object.assign(v, { days: 7, people: 1, vehicle: "car", rentalPrice: 56784, rentalDays: 7,
    fuelMode: "distance", kilometers: 100, efficiency: 10, fuelPrice: 700,
    parkingPaid: true, parkingMode: "daily", parkingPrice: 1500, parkingDays: 7,
    tollPaid: true, tolls: 0, cleaning: 5000 });
  v.extras = [{ id: "other", name: "Outros", price: 0 }];
  v.rides = [Object.assign(emptyRentalRide("work"), { name: "Trabalho", kind: "round" as const, count: 7, outwardFare: 3500, returnFare: 3500, outwardWait: 5, returnWait: 5 })];
  return v;
}
describe("refinamentos finais da V1", () => {
  it.each([["outward", 1, 1], ["outward", 7, 7], ["round", 1, 2], ["round", 7, 14]] as const)("%s × %s ocorrências representam %s corridas", (kind, count, expected) => {
    const v = minimal(); Object.assign(v.rides[0], { kind, count, returnFare: 1000 });
    expect(calculateRentalComparison(v).totalRides).toBe(expected);
  });
  it("soma corridas de vários deslocamentos", () => {
    const v = minimal(); v.rides = [Object.assign(emptyRentalRide("a"), { count: 3, outwardFare: 1000 }), Object.assign(emptyRentalRide("b"), { kind: "round" as const, count: 4, outwardFare: 2000, returnFare: 3000 })];
    const r = calculateRentalComparison(v);
    expect(r.totalRides).toBe(11); expect(r.appTotal).toBe(23000); expect(r.appPerRide).toBe(2091);
  });
  it.each([[49000, 7, 3500], [50000, 4, 6250]])("média de %s centavos em %s idas e voltas é %s centavos", (total, count, expected) => {
    expect(rentalRideMetrics(total, [{ kind: "round", count }])).toEqual({ totalRides: count * 2, appPerRide: expected });
  });
  it("zero corridas não divide por zero nem inventa média", () => {
    expect(rentalRideMetrics(0, [])).toEqual({ totalRides: 0, appPerRide: null });
    expect(rentalRideMetrics(10000, [])).toEqual({ totalRides: 0, appPerRide: null });
    const v = minimal(); v.rides = []; expect(rentalIssues(v)).toHaveProperty("rides"); expect(() => calculateRentalComparison(v)).toThrow(/Complete/);
  });
  it("corridas gratuitas têm média zero conhecida", () => expect(rentalRideMetrics(0, [{ kind: "outward", count: 2 }])).toEqual({ totalRides: 2, appPerRide: 0 }));
  it("média arredonda metade para cima e aceita quantidade agregada acima do limite de um campo", () => {
    expect(rentalRideMetrics(1, [{ kind: "round", count: 1 }]).appPerRide).toBe(1);
    expect(rentalRideMetrics(2000000, [{ kind: "round", count: 1000000 }])).toEqual({ totalRides: 2000000, appPerRide: 1 });
  });
  it.each([[1, "1 corrida"], [2, "2 corridas"], [14, "14 corridas"]])("pluraliza %s corridas", (count, text) => expect(formatQuantity(count as number, "corrida")).toBe(text));
  it("14 corridas preservam 70 minutos de espera, sem dupla multiplicação", () => {
    const r = calculateRentalComparison(realScenario());
    expect(r.totalRides).toBe(14); expect(r.waitMinutes).toBe(70); expect(r.rides[0].waitMinutes).toBe(70); expect(rentalWaitText(r)).toContain("1h10");
  });
  it("custo por ocorrência permanece diferente da média agregada por corrida", () => {
    const r = calculateRentalComparison(realScenario()); expect(r.rides[0].unitCost).toBe(7000); expect(r.appPerRide).toBe(3500);
  });
  it("espera não informada continua ausente após calcular as novas métricas", () => {
    const v = realScenario(); v.rides[0].outwardWait = v.rides[0].returnWait = null;
    const r = calculateRentalComparison(v); expect(r.totalRides).toBe(14); expect(r.appPerRide).toBe(3500); expect(r.waitMinutes).toBeNull(); expect(rentalWaitText(r)).toBe("Tempo de espera não informado.");
  });
  it("preserva o cenário real e as simulações salvas no formato v1", () => {
    const v = realScenario(), encoded = JSON.stringify({ version: 1, values: v });
    const restored = decodeRentalComparison(encoded); expect(restored).toEqual(v); expect(encodeRentalComparison(restored)).toBe(encoded);
    const r = calculateRentalComparison(restored);
    expect(r).toMatchObject({ rental: 397488, fuel: 7000, parking: 10500, vehicleTotal: 419988, appTotal: 49000,
      difference: 370988, totalRides: 14, appPerRide: 3500, waitMinutes: 70, beyondRental: 22500,
      vehiclePerDay: 59998, appPerDay: 7000, vehiclePerPerson: 419988, appPerPerson: 49000 });
    expect(r).not.toHaveProperty("differencePercent");
    expect(rentalDifferenceText(r)).toBe("Considerando os valores informados, o transporte por aplicativo custa R$ 3.709,88 a menos durante a viagem.");
    expect(beyondRentalText(r)).toContain("Os custos além da locação somam R$ 225,00");
    expect(r.breakdown.find(c => c.key === "additionals")).toMatchObject({ label: "Extras da locadora", value: 0 });
    expect(r.rides[0].share).toBe(100);
    expect(rentalNotes.join(" ")).not.toMatch(/Diferença percentual|menor total|Custos adicionais da locadora/);
  });
  it("Extras da locadora inclui somente os três adicionais do contrato", () => {
    const v = realScenario(); Object.assign(v, { protection: 1000, fees: 2000, driver: 3000 });
    const r = calculateRentalComparison(v);
    expect(r.breakdown.find(c => c.key === "additionals")).toMatchObject({ label: "Extras da locadora", value: 6000 });
    expect(r.fuel).toBe(7000); expect(r.parking).toBe(10500); expect(r.vehicleTotal).toBe(425988);
  });
  it("Excel remove a diferença percentual, acrescenta números reais e preserva a aba Corridas", async () => {
    const r = calculateRentalComparison(realScenario()), sheets = rentalSheets(r, options);
    expect(sheets[0].data.find(row => row[0] === "Quantidade estimada de corridas")?.[2]).toMatchObject({ type: Number, value: 14 });
    expect(sheets[0].data.find(row => row[0] === "Custo médio por corrida")?.[2]).toMatchObject({ type: Number, value: 35 });
    expect(sheets[0].data.find(row => row[0] === "Diferença financeira absoluta")?.[1]).toMatchObject({ type: Number, value: 3709.88 });
    expect(sheets[1].data.find(row => row[0] === "Extras da locadora")?.[2]).toMatchObject({ type: Number, value: 0 });
    expect(sheets[2].data[0]).toHaveLength(11); expect(sheets[2].data[1].slice(2, 10)).toMatchObject([{ value: 7 }, { value: 35 }, { value: 35 }, { value: 70 }, { value: 490 }, { value: 5 }, { value: 5 }, { value: 70 }]);
    expect(JSON.stringify(sheets)).not.toMatch(/Diferença percentual|757,1|Custos adicionais da locadora/);
    const bytes = new Uint8Array(await (await createRentalExcel(r, options)).arrayBuffer()); expect([...bytes.slice(0, 4)]).toEqual([80, 75, 3, 4]);
  });
  it("PDF mostra quantidade e média sem diferença percentual, preservando custos e espera", async () => {
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const doc = await PDFDocument.load(await createRentalPdf(calculateRentalComparison(realScenario()), options));
      const text = draw.mock.calls.map(call => call[0]).join(" ");
      expect(doc.getTitle()).toBe("Veículo alugado ou aplicativo?");
      expect(text).toContain("R$ 4.199,88"); expect(text).toContain("R$ 490,00"); expect(text).toContain("R$ 3.709,88");
      expect(text).toContain("Quantidade estimada de corridas: 14 corridas"); expect(text).toContain("Custo médio por corrida: R$ 35,00");
      expect(text).toContain("Custo por ocorrência: R$ 70,00"); expect(text).toContain("Tempo total estimado de espera: 1h10"); expect(text).toContain("Extras da locadora");
      expect(text).not.toMatch(/Diferença percentual|757,1|menor custo como base|Custos adicionais da locadora/);
    } finally { draw.mockRestore(); }
  });
});

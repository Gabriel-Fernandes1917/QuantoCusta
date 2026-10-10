import { formatVehicleHours } from "../src/lib/vehicle-presentation";
import { describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import { activeNumericFields, annualToMonthly, appCosts, calculateVehicleComparison, costDifference, emptyVehicleComparison, estimatedFuel, monthlyToAnnual, owningCost, parseVehicleQuantity, totalVehicleCost, usingCost, validateVehicleShape, vehicleDifferenceText, vehicleIssues, waitingTime, type VehicleComparison } from "../src/lib/calculations/vehicle-comparison";
import { decodeVehicleComparison, encodeVehicleComparison } from "../src/lib/vehicle-storage";
import { createVehicleExcel, createVehiclePdf, vehicleSheets } from "../src/lib/export/vehicle-comparison";

function scenario(): VehicleComparison {
  return { ...emptyVehicleComparison(), vehicle: "car", ownership: "financed", payment: 90000, ipva: 180000, licensing: 20000, insurance: 240000, maintenance: 120000, fuelMode: "estimate", kilometers: 800, efficiency: 12, fuelPrice: 630, tolls: 0, parking: 10000, app: "car", rides: 10, fare: 2500, wait: 8 };
}
const options = { brand: { name: "Coyler", domain: "" }, generatedAt: new Date("2026-10-04T12:00:00Z") };
describe("veículo e situação", () => {
  it.each(["car", "motorcycle"] as const)("%s usa a mesma matemática", vehicle => { const v = scenario(); v.vehicle = vehicle; expect(calculateVehicleComparison(v).monthly).toBe(188667); });
  it("já possuo ignora pagamento sem eliminar custos de possuir", () => { const v = scenario(); v.ownership = "owned"; const r = calculateVehicleComparison(v); expect(r.own).toBe(46667); expect(r.costs.some(c => c.id === "payment")).toBe(false); });
  it.each(["financed", "rented"] as const)("%s inclui somente a parcela mensal informada", ownership => { const v = scenario(); v.ownership = ownership; const r = calculateVehicleComparison(v); expect(r.own).toBe(136667); expect(r.costs[0]).toMatchObject({ name: ownership === "financed" ? "Financiamento" : "Aluguel/assinatura", monthly: 90000, annual: 1080000 }); });
  it.each(["financed", "rented"] as const)("%s exige pagamento", ownership => { const v = scenario(); v.ownership = ownership; v.payment = null; expect(vehicleIssues(v)).toHaveProperty("payment"); expect(() => calculateVehicleComparison(v)).toThrow(/Complete/); });
  it("opções não selecionadas geram mensagens associadas", () => { expect(vehicleIssues(emptyVehicleComparison())).toMatchObject({ vehicle: expect.any(String), ownership: expect.any(String), app: expect.any(String), fuelMonthly: expect.any(String), rides: expect.any(String), fare: expect.any(String) }); });
});
describe("periodicidades e totais", () => {
  it.each([[180000, 15000], [20000, 1667], [240000, 20000], [120000, 10000], [1, 0], [6, 1], [0, 0]])("anual %s para mensal %s", (annual, monthly) => expect(annualToMonthly(annual)).toBe(monthly));
  it.each(["insurance", "maintenance"] as const)("%s anual preserva original e mensal converte", field => { const v = scenario(); v[field] = 20000; const r = calculateVehicleComparison(v); expect(r.costs.find(c => c.id === field)).toMatchObject({ monthly: 1667, annual: 20000, period: "annual" }); });
  it.each(["insurance", "maintenance"] as const)("%s mensal multiplica por 12", field => { const v = scenario(); v[`${field}Period`] = "monthly"; v[field] = 20000; const r = calculateVehicleComparison(v); expect(r.costs.find(c => c.id === field)).toMatchObject({ monthly: 20000, annual: 240000 }); });
  it("conversão mensal para anual", () => expect(monthlyToAnnual(90000)).toBe(1080000));
  it("cenário completo preserva todos os totais e não altera entrada", () => {
    const v = scenario(), before = structuredClone(v), r = calculateVehicleComparison(v);
    expect(r.fuel).toBe(42000); expect(r.own).toBe(136667); expect(r.use).toBe(52000); expect(r.monthly).toBe(188667); expect(r.annual).toBe(2264000);
    expect(owningCost(r.costs)).toBe(r.own); expect(usingCost(r.costs)).toBe(r.use); expect(totalVehicleCost(r.costs, "annual")).toBe(r.annual);
    expect(r.app).toEqual({ weekly: 25000, monthly: 108333, annual: 1300000 }); expect(r.delta).toEqual({ monthly: 80334, annual: 964000 }); expect(v).toEqual(before);
  });
  it("opcionais vazios não acrescentam custo e permanecem ausentes", () => { const v = scenario(); v.ownership = "owned"; v.ipva = v.licensing = v.insurance = v.maintenance = v.tolls = v.parking = null; const r = calculateVehicleComparison(v); expect(r.own).toBe(0); expect(r.use).toBe(42000); expect(r.costs.find(c => c.id === "insurance")).toMatchObject({ informed: null, monthly: 0 }); });
  it("campos opcionais explicitamente zero continuam informados", () => { const v = scenario(); v.insurance = 0; expect(calculateVehicleComparison(v).costs.find(c => c.id === "insurance")?.informed).toBe(0); });
});
describe("combustível", () => {
  it("valor direto ignora estimativa armazenada", () => { const v = scenario(); v.fuelMode = "direct"; v.fuelMonthly = 45000; v.efficiency = 0; expect(calculateVehicleComparison(v).fuel).toBe(45000); expect(activeNumericFields(v)).not.toContain("efficiency"); });
  it("800 km / 12 km/L × 6,30", () => expect(estimatedFuel(800, 12, 630)).toBe(42000));
  it("moto: 800 km / 35 km/L × 6,30", () => { const v = scenario(); v.vehicle = v.app = "motorcycle"; v.ownership = "owned"; v.insurance = null; v.efficiency = 35; expect(calculateVehicleComparison(v).fuel).toBe(14400); });
  it("consumo zero impede divisão por zero", () => { expect(() => estimatedFuel(800, 0, 630)).toThrow(/maior que zero/); const v = scenario(); v.efficiency = 0; expect(vehicleIssues(v)).toHaveProperty("efficiency"); });
  it.each(["kilometers", "efficiency", "fuelPrice"] as const)("%s vazio impede estimativa", field => { const v = scenario(); v[field] = null; expect(vehicleIssues(v)).toHaveProperty(field); expect(() => calculateVehicleComparison(v)).toThrow(/Complete/); });
  it("combustível direto vazio não vira zero", () => { const v = scenario(); v.fuelMode = "direct"; expect(vehicleIssues(v)).toHaveProperty("fuelMonthly"); });
  it.each([[0, 12, 630], [800, 12, 0]])("zero explícito válido: %s / %s × %s", (km, consumption, price) => expect(estimatedFuel(km, consumption, price)).toBe(0));
  it.each([[-1, 12, 630], [800, -1, 630], [800, 12, -1]])("negativos são rejeitados", (km, consumption, price) => expect(() => estimatedFuel(km, consumption, price)).toThrow());
  it("arredonda metade para cima sem arredondar litros", () => { expect(estimatedFuel(1, 2, 1)).toBe(1); expect(estimatedFuel(1, 3, 100)).toBe(33); });
});
describe("aplicativo e espera", () => {
  it.each(["car", "motorcycle", "both"] as const)("%s não define tarifas automáticas", app => { const v = scenario(); v.app = app; expect(calculateVehicleComparison(v).app).toEqual({ weekly: 25000, monthly: 108333, annual: 1300000 }); });
  it("corridas usam 52 semanas/ano e 52/12 por mês", () => expect(appCosts(10, 2500)).toEqual({ weekly: 25000, monthly: 108333, annual: 1300000 }));
  it("frequência decimal não usa semanal previamente arredondado", () => expect(appCosts(0.5, 1)).toEqual({ weekly: 1, monthly: 2, annual: 26 }));
  it.each(["rides", "fare"] as const)("%s vazio não presume zero", key => { const v = scenario(); v[key] = null; expect(vehicleIssues(v)).toHaveProperty(key); });
  it("espera é separada do dinheiro", () => { const v = scenario(), r = calculateVehicleComparison(v); expect(r.wait?.weeklyMinutes).toBe(80); expect(r.wait?.weeklyHours).toBeCloseTo(4 / 3); expect(r.wait?.monthlyHours).toBeCloseTo(5.77777778); expect(r.wait?.annualHours).toBeCloseTo(69.3333333); v.wait = 100; expect(calculateVehicleComparison(v).monthly).toBe(r.monthly); expect(calculateVehicleComparison(v).app).toEqual(r.app); });
  it("espera zero é válida", () => expect(waitingTime(10, 0)).toEqual({ weeklyMinutes: 0, weeklyHours: 0, monthlyHours: 0, annualHours: 0 }));
  it("espera ausente não vira zero informado", () => { const v = scenario(); v.wait = null; expect(calculateVehicleComparison(v).wait).toBeNull(); });
  it("zero corridas e tarifa informados permite cenário sem gasto", () => expect(appCosts(0, 0)).toEqual({ weekly: 0, monthly: 0, annual: 0 }));
  it.each([[-1, 5], [10, -1]])("espera/frequência negativa rejeitada", (rides, minutes) => expect(() => waitingTime(rides, minutes)).toThrow());
});
describe("diferença e composição", () => {
  it.each([[10000, "o veículo próprio custa R$ 100,00 a mais"], [-10000, "o transporte por aplicativo custa R$ 100,00 a mais"], [0, "os dois cenários possuem o mesmo custo mensal"]])("direção %s", (delta, phrase) => expect(vehicleDifferenceText(delta as number)).toContain(phrase));
  it("diferenças mensal e anual usam os respectivos totais", () => { expect(costDifference(188667, 108333)).toBe(80334); expect(costDifference(2264000, 1300000)).toBe(964000); });
  it("participação percentual mantém denominador mensal", () => { const r = calculateVehicleComparison(scenario()); expect(r.costs.find(c => c.id === "payment")?.share).toBeCloseTo(90000 / 188667 * 100); expect(r.costs.reduce((total, c) => total + c.share!, 0)).toBeCloseTo(100); });
  it("total zero não divide por zero", () => { const v = emptyVehicleComparison(); Object.assign(v, { vehicle: "motorcycle", ownership: "owned", app: "both", fuelMonthly: 0, rides: 0, fare: 0 }); const r = calculateVehicleComparison(v); expect(r.monthly).toBe(0); expect(r.costs.every(c => c.share === null)).toBe(true); expect(r.delta.monthly).toBe(0); });
});
describe("validação e persistência", () => {
  it.each(["", "   "])("quantidade vazia %s permanece null", text => expect(parseVehicleQuantity(text)).toBeNull());
  it.each([["0", 0], ["1,5", 1.5], ["0,000001", 0.000001]])("quantidade %s", (text, n) => expect(parseVehicleQuantity(text as string)).toBe(n));
  it.each(["-1", "NaN", "Infinity", "1,0000001", "1000000001", "abc"])("quantidade inválida %s", text => expect(() => parseVehicleQuantity(text)).toThrow());
  it("totais excessivos não perdem centavos silenciosamente", () => expect(() => estimatedFuel(1_000_000_000, 0.000001, 1_000_000_000_000)).toThrow(/seguro/));
  it("restaura escolhas, periodicidades, null, zeros e valores", () => { const v = scenario(); v.insurance = null; v.wait = 0; v.maintenancePeriod = "monthly"; expect(decodeVehicleComparison(encodeVehicleComparison(v))).toEqual(v); });
  it("permite salvar simulação incompleta sem inventar valores", () => expect(decodeVehicleComparison(encodeVehicleComparison(emptyVehicleComparison()))).toEqual(emptyVehicleComparison()));
  it.each(["invalid", '{"version":2}', '{"version":1,"values":{}}'])("registro inválido %s", text => expect(() => decodeVehicleComparison(text)).toThrow());
  it("modelo inválido ou dinheiro fracionário é rejeitado", () => { const v = scenario(); v.fare = 1.5; expect(() => validateVehicleShape(v)).toThrow(); });
});
describe("relatórios", () => {
  it("Excel mantém números reais, valores anuais originais e tempo separado", async () => {
    const r = calculateVehicleComparison(scenario()), sheets = vehicleSheets(r, options);
    expect(sheets.map(s => s.sheet)).toEqual(["Resumo", "Veículo", "Aplicativo", "Premissas"]);
    expect(sheets[0].data.find(row => row[0] === "Total mensal do veículo")?.[1]).toMatchObject({ value: 1886.67, type: Number });
    expect(sheets[0].data.find(row => row[0] === "Total anual do veículo")?.[1]).toMatchObject({ value: 22640, type: Number });
    expect(sheets[1].data.find(row => row[0] === "Licenciamento")?.slice(3, 6)).toMatchObject([{ value: 200 }, { value: 16.67 }, { value: 200 }]);
    expect(sheets[2].data.find(row => row[0] === "Custo mensal")?.[1]).toMatchObject({ value: 1083.33 });
    expect(sheets[2].data.find(row => row[0] === "Espera mensal / horas")?.[1]).toMatchObject({ value: r.wait!.monthlyHours, type: Number });
    const bytes = new Uint8Array(await (await createVehicleExcel(r, options)).arrayBuffer()); expect([...bytes.slice(0, 4)]).toEqual([80, 75, 3, 4]);
  });
  it.each(["estimate", "direct"] as const)("PDF e Excel: combustível %s", async mode => {
    const v = scenario(); v.fuelMode = mode; v.fuelMonthly = 42000; const r = calculateVehicleComparison(v), sheets = vehicleSheets(r, options);
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const bytes = await createVehiclePdf(r, options), text = draw.mock.calls.map(args => args[0]).join(" ");
      expect((await PDFDocument.load(bytes)).getTitle()).toBe("Veículo próprio ou aplicativo?");
      expect(text).toContain("R$ 1.886,67"); expect(text).toContain("R$ 803,34"); expect(text).toContain("Espera mensal: aproximadamente 5,8 horas"); expect(text).toContain("Tempo separado do dinheiro");
      expect(sheets[1].data.some(row => row[0] === "Km/mês")).toBe(mode === "estimate");
      if (mode === "estimate") { expect(text).toContain("800 km/mês / 12 km/L"); expect(text).toContain("R$ 6,30/L"); }
      else { expect(text).not.toContain("km/L"); expect(text).toContain("informado: R$ 420,00 (mensal)"); }
    } finally { draw.mockRestore(); }
  });
  it("relatórios preservam ausência de custos e espera", () => { const v = scenario(); v.wait = v.insurance = null; const sheets = vehicleSheets(calculateVehicleComparison(v), options); expect(sheets[2].data.find(row => row[0] === "Espera por corrida / minutos")?.[1]).toBeNull(); expect(sheets[1].data.find(row => row[0] === "Seguro")?.[3]).toBeNull(); });
});

describe("acabamento da V1", () => {
  it.each([[0, "0 horas"], [1, "1 hora"], [1.5, "1,5 horas"], [2, "2 horas"], [1.04, "1 hora"], [1.06, "1,1 horas"]])("formata %s conforme o valor exibido", (value, text) => expect(formatVehicleHours(value as number)).toBe(text));
  it("preserva o cenário final e o texto público dos relatórios", async () => {
    const v = { ...emptyVehicleComparison(), vehicle: "car", ownership: "owned", app: "car", ipva: 180000, licensing: 27000, insurance: 25000, maintenance: 70000, fuelMonthly: 30000, tolls: 0, parking: 15000, rides: 6, fare: 3000, wait: 10 } as VehicleComparison;
    const r = calculateVehicleComparison(v);
    expect(r.costs.find(c => c.id === "insurance")).toMatchObject({ monthly: 2083, annual: 25000 });
    expect(r.costs.find(c => c.id === "maintenance")).toMatchObject({ monthly: 5833, annual: 70000 });
    expect(r).toMatchObject({ own: 25166, use: 45000, monthly: 70166, annual: 842000, app: { monthly: 78000, annual: 936000 }, delta: { monthly: -7834, annual: -94000 }, wait: { weeklyMinutes: 60, weeklyHours: 1, annualHours: 52 } });
    expect(r.wait!.monthlyHours).toBeCloseTo(52 / 12);
    expect(vehicleDifferenceText(r.delta.monthly)).toContain("o transporte por aplicativo custa R$ 78,34 a mais");
    expect(JSON.stringify(vehicleSheets(r, options))).not.toContain("Diferença absoluta");
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const bytes = await createVehiclePdf(r, options);
      expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
      const text = draw.mock.calls.map(args => args[0]).join(" ");
      expect(text).toContain("60 minutos/semana (1 hora)");
      expect(text).not.toContain("1 horas");
      expect(text).not.toContain("Diferença absoluta");
      expect(text).toContain("depreciação");
    } finally { draw.mockRestore(); }
    const bytes = new Uint8Array(await (await createVehicleExcel(r, options)).arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual([80, 75, 3, 4]);
  });
});

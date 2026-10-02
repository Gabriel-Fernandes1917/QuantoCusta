import { describe, expect, it } from "vitest";
import { calculateCostOfLiving, emptySimulation, toMonthlyCents } from "../src/lib/calculations/cost-of-living";
import { MAX_MONEY_CENTS } from "../src/lib/money";

describe("veículo próprio e periodicidade", () => {
  it.each([[0, 0], [1, 0], [5, 0], [6, 1], [11, 1], [12, 1], [10000, 833], [10002, 834], [240000, 20000], [MAX_MONEY_CENTS, 83333333333]])("converte %i centavos anuais para %i mensais", (annual, monthly) => {
    expect(toMonthlyCents(annual, "annual")).toBe(monthly);
  });
  it("preserva os centavos de valores mensais", () => {
    expect(toMonthlyCents(10002, "monthly")).toBe(10002);
  });
  it("inclui IPVA, seguro e licenciamento anuais em todos os totais", () => {
    const result = calculateCostOfLiving({ ...emptySimulation(), hasVehicle: true, salary: 500000, rent: 100000, vehicleTax: 240000, vehicleInsurance: 300000, vehicleFees: 24000, vehiclePeriods: { vehicleTax: "annual", vehicleInsurance: "annual", vehicleFees: "annual" } });
    expect(result.categories.find(category => category.id === "transport")?.cents).toBe(47000);
    expect(result.monthlyExpenses).toBe(147000);
    expect(result.annualExpenses).toBe(1764000);
    expect(result.cashExpenses).toBe(147000);
    expect(result.balance).toBe(353000);
    expect(result.committedPercentage).toBeCloseTo(29.4);
    expect(result.categories.find(category => category.id === "transport")?.percentage).toBeCloseTo(31.97279);
    expect(result.details.find(item => item.id === "vehicleTax")).toMatchObject({ informedCents: 240000, monthlyCents: 20000, period: "annual" });
  });
  it.each([false, null])("exclui todos os gastos do veículo quando não ativado (%s)", hasVehicle => {
    const result = calculateCostOfLiving({ ...emptySimulation(), hasVehicle, publicTransport: 20000, rideHailing: 10000, fuel: 30000, vehicleLoan: 60000, vehicleInsurance: 50000, maintenance: 10000, vehicleTax: 240000, vehicleFees: 24000, parking: 10000, tolls: 5000 });
    expect(result.monthlyExpenses).toBe(30000);
    expect(result.annualExpenses).toBe(360000);
    expect(result.details.map(item => item.id)).toEqual(["publicTransport", "rideHailing"]);
  });
  it("inclui os oito itens de veículo e os dois meios de transporte", () => {
    const result = calculateCostOfLiving({ ...emptySimulation(), hasVehicle: true, publicTransport: 1, rideHailing: 2, fuel: 3, vehicleLoan: 4, vehicleInsurance: 5, maintenance: 6, vehicleTax: 84, vehicleFees: 96, parking: 9, tolls: 10 });
    expect(result.monthlyExpenses).toBe(55);
    expect(result.annualExpenses).toBe(660);
    expect(result.details).toHaveLength(10);
  });
  it("usa o mensal arredondado como a única base do custo anual", () => {
    const result = calculateCostOfLiving({ ...emptySimulation(), hasVehicle: true, vehicleTax: 10002 });
    expect(result.monthlyExpenses).toBe(834);
    expect(result.annualExpenses).toBe(10008);
    expect(result.details[0].informedCents).toBe(10002);
  });
  it("combina transporte anual e VA/VR sem alterar as regras dos benefícios", () => {
    const result = calculateCostOfLiving({ ...emptySimulation(), hasVehicle: true, salary: 100000, vehicleTax: 240000, groceries: 50000, foodBenefits: 40000, benefitUse: 40000 });
    expect(result.monthlyExpenses).toBe(70000);
    expect(result.cashExpenses).toBe(30000);
    expect(result.balance).toBe(70000);
    expect(result.committedPercentage).toBe(30);
  });
  it("mantém um valor anual preenchido que arredonda para zero no detalhamento", () => {
    const result = calculateCostOfLiving({ ...emptySimulation(), hasVehicle: true, vehicleTax: 1 });
    expect(result.monthlyExpenses).toBe(0);
    expect(result.details[0]).toMatchObject({ informedCents: 1, monthlyCents: 0 });
  });
  it("mantém a decisão de veículo indefinida inicialmente", () => {
    expect(emptySimulation().hasVehicle).toBeNull();
  });
});

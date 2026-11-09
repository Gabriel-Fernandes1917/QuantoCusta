import { describe, expect, it } from "vitest";
import { calculateCostOfLiving, emptySimulation } from "../src/lib/calculations/cost-of-living";
import { decodeSimulation, encodeSimulation } from "../src/lib/simulation-storage";

describe("persistência da simulação", () => {
  it("restaura manutenção mensal de simulações salvas antes do seletor", () => {
    const values = { ...emptySimulation(), hasVehicle: true, maintenance: 12000 };
    const { maintenance, ...oldPeriods } = values.vehiclePeriods;
    void maintenance;
    const restored = decodeSimulation(JSON.stringify({ version: 2, values: { ...values, vehiclePeriods: oldPeriods } }));
    expect(restored.vehiclePeriods.maintenance).toBe("monthly");
    expect(calculateCostOfLiving(restored).monthlyExpenses).toBe(12000);
  });
  it("salva e restaura manutenção anual sem converter o valor original", () => {
    const values = { ...emptySimulation(), hasVehicle: true, maintenance: 120000 };
    values.vehiclePeriods.maintenance = "annual";
    const restored = decodeSimulation(encodeSimulation(values));
    expect(restored).toEqual(values);
    expect(calculateCostOfLiving(restored).monthlyExpenses).toBe(10000);
  });
  it.each(["weekly", null, 1])("rejeita periodicidade de manutenção inválida: %s", maintenance => {
    const values = emptySimulation();
    expect(() => decodeSimulation(JSON.stringify({ version: 2, values: { ...values, vehiclePeriods: { ...values.vehiclePeriods, maintenance } } }))).toThrow();
  });
  it("preserva os centavos ao salvar e restaurar", () => {
    const values = { ...emptySimulation(), salary: 500000, rent: 123456, foodBenefits: 40000, benefitUse: 10000 };
    expect(decodeSimulation(encodeSimulation(values))).toEqual(values);
  });
  it.each(["", "null", "[]", "{}", '{"version":3,"values":{}}', '{"version":1,"values":{}}']) ("rejeita registros incompletos ou versões desconhecidas", text => {
    expect(() => decodeSimulation(text)).toThrow();
  });
  it.each([-1, 1.5, "500", null, 1_000_000_000_001])("rejeita valores corrompidos: %s", salary => {
    expect(() => decodeSimulation(JSON.stringify({ version: 1, values: { ...emptySimulation(), salary } }))).toThrow();
  });
  it("rejeita valores inválidos também ao salvar", () => {
    expect(() => encodeSimulation({ ...emptySimulation(), rent: -1 })).toThrow();
  });
  it("restaura decisão do veículo e valores anuais originais", () => {
    const values = { ...emptySimulation(), hasVehicle: true, vehicleTax: 240000, vehicleInsurance: 300000, vehiclePeriods: { maintenance: "monthly", vehicleTax: "annual", vehicleFees: "annual", vehicleInsurance: "annual" } as const };
    const restored = decodeSimulation(encodeSimulation(values));
    expect(restored).toEqual(values);
    expect(calculateCostOfLiving(restored).monthlyExpenses).toBe(45000);
  });
  it("preserva valores de veículo desativado sem incluí-los no cálculo", () => {
    const restored = decodeSimulation(encodeSimulation({ ...emptySimulation(), hasVehicle: false, vehicleTax: 240000 }));
    expect(restored.vehicleTax).toBe(240000);
    expect(calculateCostOfLiving(restored).monthlyExpenses).toBe(0);
  });
  it("migra dados antigos preservando gastos mensais do veículo", () => {
    const values = { ...emptySimulation(), fuel: 30000, vehicleInsurance: 20000, rent: 100000 };
    const { hasVehicle, vehiclePeriods, vehicleTax, vehicleFees, tolls, ...legacy } = values;
    void [hasVehicle, vehiclePeriods, vehicleTax, vehicleFees, tolls];
    const restored = decodeSimulation(JSON.stringify({ version: 1, values: legacy }));
    expect(restored.hasVehicle).toBe(true);
    expect(restored.vehiclePeriods.vehicleInsurance).toBe("monthly");
    expect(restored.vehicleTax).toBe(0);
    expect(calculateCostOfLiving(restored).monthlyExpenses).toBe(150000);
  });
  it("não inventa uma escolha de veículo para simulações antigas sem esses gastos", () => {
    const restored = decodeSimulation(JSON.stringify({ version: 1, values: emptySimulation() }));
    expect(restored.hasVehicle).toBeNull();
  });
  it.each(["weekly", null, 1])("rejeita periodicidade corrompida: %s", period => {
    expect(() => decodeSimulation(JSON.stringify({ version: 2, values: { ...emptySimulation(), vehiclePeriods: { maintenance: "monthly", vehicleTax: period, vehicleFees: "annual", vehicleInsurance: "monthly" } } }))).toThrow();
  });
});

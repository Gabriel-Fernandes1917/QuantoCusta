import { describe, expect, it } from "vitest";
import { allFields, calculateCostOfLiving, emptyDraft, emptySimulation, expenseCategories } from "../src/lib/calculations/cost-of-living";
import { MAX_MONEY_CENTS, parseMoney } from "../src/lib/money";

describe("custo futuro de morar sozinho", () => {
  it("trata todos os campos vazios como zero", () => {
    const draft = emptyDraft();
    const values = emptySimulation();
    allFields.forEach(field => { values[field.id] = parseMoney(draft[field.id]); });
    const result = calculateCostOfLiving(values);
    expect(result.cashIncome).toBe(0);
    expect(result.monthlyExpenses).toBe(0);
    expect(result.balance).toBe(0);
    expect(result.annualExpenses).toBe(0);
    expect(result.committedPercentage).toBeNull();
    expect(result.categories.every(category => category.cents === 0 && category.percentage === 0)).toBe(true);
  });
  it("calcula renda zero com despesas sem Infinity ou NaN", () => {
    const result = calculateCostOfLiving({ ...emptySimulation(), rent: 150000 });
    expect(result.balance).toBe(-150000);
    expect(result.committedPercentage).toBeNull();
    expect(result.categories[0].percentage).toBe(100);
  });
  it("preserva toda a renda quando as despesas são zero", () => {
    const result = calculateCostOfLiving({ ...emptySimulation(), salary: 500000, extraIncome: 10000, otherIncome: 20000, foodBenefits: 80000 });
    expect(result.cashIncome).toBe(530000);
    expect(result.balance).toBe(530000);
    expect(result.unusedBenefits).toBe(80000);
    expect(result.committedPercentage).toBe(0);
  });
  it("produz totais e distribuição de um cenário completo", () => {
    const result = calculateCostOfLiving({ ...emptySimulation(), salary: 500000, extraIncome: 50000, rent: 180000, condo: 20000, groceries: 60000, dining: 20000, publicTransport: 30000, medicines: 10000, leisure: 40000, installments: 40000 });
    expect(result.cashIncome).toBe(550000);
    expect(result.monthlyExpenses).toBe(400000);
    expect(result.cashExpenses).toBe(400000);
    expect(result.balance).toBe(150000);
    expect(result.annualExpenses).toBe(4800000);
    expect(result.committedPercentage).toBeCloseTo(72.72727);
    expect(result.categories.map(category => category.cents)).toEqual([200000, 80000, 30000, 10000, 40000, 40000]);
    expect(result.categories.map(category => category.percentage)).toEqual([50, 20, 7.5, 2.5, 10, 10]);
  });
  it("soma todos os campos de despesa uma única vez", () => {
    const values = emptySimulation();
    values.hasVehicle = true;
    values.vehiclePeriods = { vehicleInsurance: "monthly", vehicleTax: "monthly", vehicleFees: "monthly" };
    expenseCategories.forEach(category => category.fields.forEach(field => { values[field.id] = 1; }));
    const result = calculateCostOfLiving(values);
    expect(result.monthlyExpenses).toBe(33);
    expect(result.annualExpenses).toBe(396);
    expect(result.categories.map(category => category.cents)).toEqual([7, 3, 10, 3, 6, 4]);
  });
  it("mantém precisão com centavos e frações decimais", () => {
    const result = calculateCostOfLiving({ ...emptySimulation(), salary: parseMoney("0,30"), rent: parseMoney("0,10"), groceries: parseMoney("0,20") });
    expect(result.monthlyExpenses).toBe(30);
    expect(result.balance).toBe(0);
    expect(result.annualExpenses).toBe(360);
    expect(result.committedPercentage).toBe(100);
  });
  it("mantém saldo negativo e percentual acima de 100%", () => {
    const result = calculateCostOfLiving({ ...emptySimulation(), salary: 100000, rent: 150000 });
    expect(result.balance).toBe(-50000);
    expect(result.committedPercentage).toBe(150);
  });
  it("não usa VA/VR automaticamente e não o soma à renda em dinheiro", () => {
    const result = calculateCostOfLiving({ ...emptySimulation(), salary: 200000, foodBenefits: 80000, groceries: 50000, rent: 100000 });
    expect(result.cashIncome).toBe(200000);
    expect(result.appliedBenefits).toBe(0);
    expect(result.balance).toBe(50000);
    expect(result.unusedBenefits).toBe(80000);
  });
  it.each([
    [80000, 60000, 40000, 40000],
    [30000, 60000, 60000, 30000],
    [80000, 20000, 60000, 20000],
    [0, 60000, 60000, 0],
    [80000, 0, 60000, 0],
  ])("limita VA/VR ao disponível e à alimentação (%i, %i, %i)", (foodBenefits, groceries, benefitUse, applied) => {
    const result = calculateCostOfLiving({ ...emptySimulation(), salary: 200000, rent: 100000, foodBenefits, groceries, benefitUse });
    expect(result.appliedBenefits).toBe(applied);
    expect(result.monthlyExpenses).toBe(100000 + groceries);
    expect(result.cashExpenses).toBe(100000 + groceries - applied);
    expect(result.balance).toBe(100000 - groceries + applied);
    expect(result.unusedBenefits).toBe(foodBenefits - applied);
    expect(result.annualExpenses).toBe((100000 + groceries) * 12);
    expect(result.committedPercentage).toBeCloseTo((result.cashExpenses / 200000) * 100);
  });
  it("aplica VA/VR às três despesas alimentares e mantém a distribuição bruta", () => {
    const result = calculateCostOfLiving({ ...emptySimulation(), groceries: 10000, dining: 20000, delivery: 30000, foodBenefits: 90000, benefitUse: 90000 });
    expect(result.appliedBenefits).toBe(60000);
    expect(result.cashExpenses).toBe(0);
    expect(result.balance).toBe(0);
    expect(result.categories[1].percentage).toBe(100);
    expect(result.annualExpenses).toBe(720000);
  });
  it("suporta o maior valor de cada campo sem perder centavos", () => {
    const values = emptySimulation();
    values.hasVehicle = true;
    values.vehiclePeriods = { vehicleInsurance: "monthly", vehicleTax: "monthly", vehicleFees: "monthly" };
    allFields.forEach(field => { values[field.id] = MAX_MONEY_CENTS; });
    const result = calculateCostOfLiving(values);
    expect(result.cashIncome).toBe(3 * MAX_MONEY_CENTS);
    expect(result.monthlyExpenses).toBe(33 * MAX_MONEY_CENTS);
    expect(result.cashExpenses).toBe(32 * MAX_MONEY_CENTS);
    expect(result.annualExpenses).toBe(396 * MAX_MONEY_CENTS);
    expect(result.balance).toBe(-29 * MAX_MONEY_CENTS);
    expect(Number.isSafeInteger(result.annualExpenses)).toBe(true);
  });
  it.each([-1, 1.5, NaN, Infinity, MAX_MONEY_CENTS + 1])("rejeita centavos inválidos: %s", salary => {
    expect(() => calculateCostOfLiving({ ...emptySimulation(), salary })).toThrow();
  });
});

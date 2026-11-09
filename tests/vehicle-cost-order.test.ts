import { describe, expect, it } from "vitest";
import { calculateVehicleComparison, emptyVehicleComparison, type VehicleComparison } from "../src/lib/calculations/vehicle-comparison";
import { vehicleCostsByMonthly } from "../src/lib/vehicle-presentation";

const scenario = (): VehicleComparison => ({
  ...emptyVehicleComparison(), vehicle: "car", ownership: "owned", app: "car",
  ipva: 180000, licensing: 25700, insurance: 25000, insurancePeriod: "monthly",
  maintenance: 75000, maintenancePeriod: "annual", fuelMonthly: 30000,
  parking: 15000, tolls: 0, rides: 6, fare: 3000,
});
const ids = (result: ReturnType<typeof calculateVehicleComparison>, category: "own" | "use") =>
  vehicleCostsByMonthly(result.costs, category).map(cost => cost.id);

describe("ordenação da composição mensal do veículo", () => {
  it("ordena dentro dos grupos pelos equivalentes mensais, preservando os dados calculados", () => {
    const result = calculateVehicleComparison(scenario());
    const before = structuredClone(result);
    expect(ids(result, "own")).toEqual(["insurance", "ipva", "maintenance", "licensing"]);
    expect(ids(result, "use")).toEqual(["fuelMonthly", "parking", "tolls"]);
    expect(vehicleCostsByMonthly(result.costs, "own").map(cost => cost.monthly)).toEqual([25000, 15000, 6250, 2142]);
    for (const category of ["own", "use"] as const) {
      for (const cost of vehicleCostsByMonthly(result.costs, category)) {
        expect(cost).toBe(result.costs.find(original => original.id === cost.id));
        expect(cost.share).toBeCloseTo(cost.monthly / result.monthly * 100);
      }
    }
    expect(result).toEqual(before);
  });

  it("preserva a ordem original nos empates, inclusive após arredondamento mensal", () => {
    const input = scenario();
    Object.assign(input, { insurance: 15000, maintenance: 180000, licensing: 180001, tolls: 30000, parking: 30000 });
    const result = calculateVehicleComparison(input);
    expect(ids(result, "own")).toEqual(["ipva", "licensing", "insurance", "maintenance"]);
    expect(ids(result, "use")).toEqual(["fuelMonthly", "tolls", "parking"]);
  });

  it("mantém zeros explícitos e custos ausentes no final e preserva a ordem quando todos são zero", () => {
    const input = scenario();
    Object.assign(input, { ipva: 0, licensing: null, maintenance: 0, fuelMonthly: 0, parking: 0 });
    let result = calculateVehicleComparison(input);
    expect(ids(result, "own")).toEqual(["insurance", "ipva", "licensing", "maintenance"]);
    expect(ids(result, "use")).toEqual(["fuelMonthly", "tolls", "parking"]);
    input.insurance = 0;
    result = calculateVehicleComparison(input);
    expect(ids(result, "own")).toEqual(["ipva", "licensing", "insurance", "maintenance"]);
    expect(result.monthly).toBe(0);
    expect(result.costs.every(cost => cost.share === null)).toBe(true);
  });

  it("atualiza a ordem ao recalcular valores e periodicidades sem modificar o resultado anterior", () => {
    const input = scenario();
    const first = calculateVehicleComparison(input);
    Object.assign(input, { insurancePeriod: "annual", maintenancePeriod: "monthly", tolls: 50000 });
    const next = calculateVehicleComparison(input);
    expect(ids(next, "own")).toEqual(["maintenance", "ipva", "licensing", "insurance"]);
    expect(ids(next, "use")).toEqual(["tolls", "fuelMonthly", "parking"]);
    expect(ids(first, "own")).toEqual(["insurance", "ipva", "maintenance", "licensing"]);
  });
});

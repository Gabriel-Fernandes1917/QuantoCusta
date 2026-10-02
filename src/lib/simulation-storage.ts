import { allFields, annualVehicleFieldIds, emptySimulation, validateSimulation, vehicleFieldIds, type Simulation } from "./calculations/cost-of-living";

// Mantém a chave existente para restaurar as simulações anteriores sem duplicar dados.
export const SIMULATION_STORAGE_KEY = "quantocusta:cost-of-living:v1";
const newFieldIds = new Set(["vehicleTax", "vehicleFees", "tolls"]);

export function encodeSimulation(values: Simulation): string {
  validateSimulation(values);
  return JSON.stringify({ version: 2, values });
}

export function decodeSimulation(text: string): Simulation {
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== "object" || !("version" in data) || ![1, 2].includes(data.version as number) || !("values" in data) || !data.values || typeof data.values !== "object") {
    throw new Error("Simulação salva inválida.");
  }
  const record = data.values as Record<string, unknown>;
  const values = emptySimulation();
  allFields.forEach(field => {
    if (data.version === 1 && newFieldIds.has(field.id)) return;
    const value = record[field.id];
    if (typeof value !== "number") throw new Error("Simulação salva inválida.");
    values[field.id] = value;
  });
  if (data.version === 1) {
    // Antes todos os valores de veículo eram mensais e entravam no total.
    values.hasVehicle = vehicleFieldIds.some(id => values[id] > 0) ? true : null;
  } else {
    if (record.hasVehicle !== null && typeof record.hasVehicle !== "boolean") throw new Error("Escolha de veículo inválida.");
    values.hasVehicle = record.hasVehicle as boolean | null;
    if (!record.vehiclePeriods || typeof record.vehiclePeriods !== "object") throw new Error("Periodicidade inválida.");
    const periods = record.vehiclePeriods as Record<string, unknown>;
    annualVehicleFieldIds.forEach(id => {
      const period = periods[id];
      if (period !== "monthly" && period !== "annual") throw new Error("Periodicidade inválida.");
      values.vehiclePeriods[id] = period;
    });
  }
  validateSimulation(values);
  return values;
}

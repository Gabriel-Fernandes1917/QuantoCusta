import { validateVehicleShape, type VehicleComparison } from "./calculations/vehicle-comparison";
export const VEHICLE_STORAGE_KEY = "quantocusta:vehicle-comparison:v1";
export function encodeVehicleComparison(values: VehicleComparison) { validateVehicleShape(values); return JSON.stringify({ version: 1, values }); }
export function decodeVehicleComparison(text: string): VehicleComparison {
  const data = JSON.parse(text); if (data?.version !== 1) throw new Error("Simulação salva inválida.");
  validateVehicleShape(data.values); return data.values;
}

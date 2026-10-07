import { validateRentalShape, type RentalComparison } from "./calculations/rental-comparison";
export const RENTAL_STORAGE_KEY = "quantocusta:rental-comparison:v1";
export function encodeRentalComparison(values: RentalComparison) {
  validateRentalShape(values); return JSON.stringify({ version: 1, values });
}
export function decodeRentalComparison(text: string): RentalComparison {
  const data = JSON.parse(text);
  if (data?.version !== 1) throw new Error("Simulação salva inválida.");
  validateRentalShape(data.values); return data.values;
}

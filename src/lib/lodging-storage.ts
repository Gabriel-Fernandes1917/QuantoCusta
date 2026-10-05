import { validateLodgingShape, type LodgingComparison } from "./calculations/lodging-comparison";
export const LODGING_STORAGE_KEY = "quantocusta:lodging-comparison:v1";
export function encodeLodgingComparison(values: LodgingComparison) { validateLodgingShape(values); return JSON.stringify({ version: 1, values }); }
export function decodeLodgingComparison(text: string): LodgingComparison {
  const data = JSON.parse(text); if (data?.version !== 1) throw new Error("Simulação salva inválida.");
  validateLodgingShape(data.values); return data.values;
}

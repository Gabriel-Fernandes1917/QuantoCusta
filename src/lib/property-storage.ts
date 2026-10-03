import { validateComparison, type Comparison } from "./calculations/property-comparison";
export const PROPERTY_STORAGE_KEY = "quantocusta:property-comparison:v1";
export function encodeComparison(values: Comparison) { validateComparison(values); return JSON.stringify({ version: 1, values }); }
export function decodeComparison(text: string): Comparison {
  const data = JSON.parse(text);
  if (data?.version !== 1) throw new Error("Comparação salva inválida.");
  validateComparison(data.values);
  return data.values;
}

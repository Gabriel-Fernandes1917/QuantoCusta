import { validateComparison, type Comparison } from "./calculations/property-comparison";
export const PROPERTY_STORAGE_KEY = "quantocusta:property-comparison:v1";
export function encodeComparison(values: Comparison) { validateComparison(values); return JSON.stringify({ version: 1, values }); }
export function decodeComparison(text: string): Comparison {
  const data = JSON.parse(text);
  if (data?.version !== 1) throw new Error("Comparação salva inválida.");
  // Converte a antiga opção de IPTU único para o padrão anual, sem alterar o valor.
  if (Array.isArray(data.values?.properties)) {
    for (const property of data.values.properties) {
      if (property?.taxPeriod === "once") property.taxPeriod = "annual";
    }
  }
  if (data.values?.impacts && typeof data.values.impacts === "object") {
    for (const [id, impact] of Object.entries(data.values.impacts)) {
      if (id.startsWith("tax:") && impact && typeof impact === "object" && "period" in impact && impact.period === "once") impact.period = "annual";
    }
  }
  validateComparison(data.values);
  return data.values;
}

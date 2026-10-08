import { validateTripPlan, type TripPlan } from "./calculations/trip-cost";
export const TRIP_STORAGE_KEY = "quantocusta:trip-cost:v1";
export function encodeTripPlan(values: TripPlan): string { validateTripPlan(values); return JSON.stringify({ version: 1, values }); }
export function decodeTripPlan(text: string): TripPlan {
  const data = JSON.parse(text);
  if (data?.version !== 1) throw new Error("Simulação de viagem salva inválida.");
  validateTripPlan(data.values);
  return data.values;
}

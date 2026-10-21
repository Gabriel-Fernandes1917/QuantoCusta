import type { VehicleCost } from "./calculations/vehicle-comparison";

export function formatVehicleHours(value: number): string {
  const formatted = value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${formatted} ${formatted === "1" ? "hora" : "horas"}`;
}

export function vehicleCostsByMonthly(costs: readonly VehicleCost[], category: VehicleCost["category"]): VehicleCost[] {
  // Stable sort preserves the original order when monthly equivalents are equal.
  return costs.filter(cost => cost.category === category).sort((a, b) => b.monthly - a.monthly);
}


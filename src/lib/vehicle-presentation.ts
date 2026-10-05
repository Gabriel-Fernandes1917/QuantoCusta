export function formatVehicleHours(value: number): string {
  const formatted = value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${formatted} ${formatted === "1" ? "hora" : "horas"}`;
}

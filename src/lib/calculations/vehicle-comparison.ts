import { assertMoney, formatMoney, percentage } from "../money";

export type Period = "monthly" | "annual";
export const vehicleLabels = { car: "Carro", motorcycle: "Moto" };
export const ownershipLabels = { owned: "Já possuo", financed: "Financiamento", rented: "Aluguel/assinatura" };
export const appLabels = { ...vehicleLabels, both: "Ambos" };
export const numericFields = ["payment", "ipva", "licensing", "insurance", "maintenance", "fuelMonthly", "kilometers", "efficiency", "fuelPrice", "tolls", "parking", "rides", "fare", "wait"] as const;
export type NumericField = typeof numericFields[number];
export const quantityFields: readonly NumericField[] = ["kilometers", "efficiency", "rides", "wait"];
export const fieldLabels: Record<NumericField, string> = {
  payment: "Parcela mensal do financiamento", ipva: "IPVA anual", licensing: "Licenciamento anual", insurance: "Seguro (opcional)", maintenance: "Manutenção", fuelMonthly: "Gasto mensal com combustível", kilometers: "Quantos quilômetros você estima rodar por mês?", efficiency: "Qual o consumo médio do veículo? (km/L)", fuelPrice: "Qual o preço do combustível? (R$/L)", tolls: "Pedágios por mês", parking: "Estacionamento por mês", rides: "Quantas corridas você faria por semana?", fare: "Qual o valor médio de cada corrida?", wait: "Quanto tempo você costuma esperar por uma corrida? (minutos)",
};
export type VehicleComparison = Record<NumericField, number | null> & {
  vehicle: keyof typeof vehicleLabels | null; ownership: keyof typeof ownershipLabels | null;
  app: keyof typeof appLabels | null; fuelMode: "direct" | "estimate";
  insurancePeriod: Period; maintenancePeriod: Period;
};
export function emptyVehicleComparison(): VehicleComparison {
  return { ...Object.fromEntries(numericFields.map(key => [key, null])) as Record<NumericField, null>, vehicle: null, ownership: null, app: null, fuelMode: "direct", insurancePeriod: "annual", maintenancePeriod: "annual" };
}
export function parseVehicleQuantity(text: string): number | null {
  if (!text.trim()) return null;
  if (!/^\d+(?:[.,]\d{1,6})?$/.test(text.trim())) throw new Error("Use um número positivo ou zero, com até seis casas decimais.");
  const value = Number(text.trim().replace(",", ".")); validateQuantity(value); return value;
}
function validateQuantity(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000 || !/^\d+(?:\.\d{1,6})?$/.test(String(value))) throw new Error("Informe um número de 0 a 1 bilhão, com até seis casas decimais.");
}
function scaled(value: number): bigint { validateQuantity(value); const [whole, fraction = ""] = String(value).split("."); return BigInt(whole) * BigInt(1_000_000) + BigInt(fraction.padEnd(6, "0")); }
function roundRatio(numerator: bigint, denominator: bigint): number {
  if (denominator <= BigInt(0)) throw new Error("O consumo médio deve ser maior que zero.");
  const result = Number((numerator * BigInt(2) + denominator) / (denominator * BigInt(2)));
  if (!Number.isSafeInteger(result)) throw new Error("Total fora do intervalo seguro. Reduza os valores informados."); return result;
}
function sum(values: number[]): number { const n = values.reduce((a, b) => a + b, 0); if (!Number.isSafeInteger(n)) throw new Error("Total fora do intervalo seguro."); return n; }
export function annualToMonthly(cents: number) { assertMoney(cents); return roundRatio(BigInt(cents), BigInt(12)); }
export function monthlyToAnnual(cents: number) { if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Custo mensal inválido."); return sum(Array<number>(12).fill(cents)); }
export function estimatedFuel(kilometers: number, efficiency: number, price: number) { assertMoney(price); return roundRatio(scaled(kilometers) * BigInt(price), scaled(efficiency)); }
export function appCosts(rides: number, fare: number) {
  assertMoney(fare); const base = scaled(rides) * BigInt(fare);
  return { weekly: roundRatio(base, BigInt(1_000_000)), monthly: roundRatio(base * BigInt(52), BigInt(12_000_000)), annual: roundRatio(base * BigInt(52), BigInt(1_000_000)) };
}
export function waitingTime(rides: number, minutes: number) {
  validateQuantity(rides); validateQuantity(minutes);
  const weeklyMinutes = rides * minutes;
  return { weeklyMinutes, weeklyHours: weeklyMinutes / 60, monthlyHours: weeklyMinutes / 60 * 52 / 12, annualHours: weeklyMinutes / 60 * 52 };
}
export function activeNumericFields(v: VehicleComparison): NumericField[] {
  return [...(v.ownership && v.ownership !== "owned" ? ["payment" as const] : []), "ipva", "licensing", "insurance", "maintenance", ...(v.fuelMode === "direct" ? ["fuelMonthly" as const] : ["kilometers", "efficiency", "fuelPrice"] as const), "tolls", "parking", "rides", "fare", "wait"];
}
export function validateVehicleShape(v: VehicleComparison) {
  if (!v || typeof v !== "object" || ![null, "car", "motorcycle"].includes(v.vehicle) || ![null, "owned", "financed", "rented"].includes(v.ownership) || ![null, "car", "motorcycle", "both"].includes(v.app) || !["direct", "estimate"].includes(v.fuelMode) || !["monthly", "annual"].includes(v.insurancePeriod) || !["monthly", "annual"].includes(v.maintenancePeriod)) throw new Error("Simulação inválida.");
  numericFields.forEach(key => { if (v[key] === null) return; if (quantityFields.includes(key)) validateQuantity(v[key]!); else assertMoney(v[key]!); });
}
export function vehicleIssues(v: VehicleComparison): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key of ["vehicle", "ownership", "app"] as const) if (v[key] === null) errors[key] = "Selecione uma opção para comparar.";
  const required: NumericField[] = ["rides", "fare", ...(v.ownership && v.ownership !== "owned" ? ["payment" as const] : []), ...(v.fuelMode === "estimate" ? ["kilometers", "efficiency", "fuelPrice"] as const : ["fuelMonthly" as const])];
  required.forEach(key => { if (v[key] === null) errors[key] = "Informe este valor para realizar a comparação. Zero também pode ser informado quando aplicável."; });
  if (v.fuelMode === "estimate" && v.efficiency === 0) errors.efficiency = "O consumo médio deve ser maior que zero.";
  return errors;
}
export type VehicleCost = { id: NumericField; name: string; category: "own" | "use"; period: Period; informed: number | null; monthly: number; annual: number; share: number | null };
export function owningCost(costs: VehicleCost[], period: Period = "monthly") { return sum(costs.filter(c => c.category === "own").map(c => c[period])); }
export function usingCost(costs: VehicleCost[], period: Period = "monthly") { return sum(costs.filter(c => c.category === "use").map(c => c[period])); }
export function totalVehicleCost(costs: VehicleCost[], period: Period = "monthly") { return sum([owningCost(costs, period), usingCost(costs, period)]); }
export function costDifference(vehicle: number, app: number) { if (![vehicle, app].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error("Custos inválidos."); return vehicle - app; }
export function calculateVehicleComparison(v: VehicleComparison) {
  validateVehicleShape(v); if (Object.keys(vehicleIssues(v)).length) throw new Error("Complete os campos indicados para comparar.");
  const fuel = v.fuelMode === "direct" ? v.fuelMonthly! : estimatedFuel(v.kilometers!, v.efficiency!, v.fuelPrice!);
  const costs: VehicleCost[] = [];
  function add(id: NumericField, name: string, category: VehicleCost["category"], period: Period, informed = v[id]) {
    const value = informed ?? 0;
    costs.push({ id, name, category, period, informed, monthly: period === "annual" ? annualToMonthly(value) : value, annual: period === "annual" ? value : monthlyToAnnual(value), share: null });
  }
  if (v.ownership !== "owned") add("payment", v.ownership === "rented" ? "Aluguel/assinatura" : "Financiamento", "own", "monthly");
  add("ipva", "IPVA", "own", "annual"); add("licensing", "Licenciamento", "own", "annual"); add("insurance", "Seguro", "own", v.insurancePeriod); add("maintenance", "Manutenção", "own", v.maintenancePeriod);
  add("fuelMonthly", "Combustível", "use", "monthly", fuel); add("tolls", "Pedágios", "use", "monthly"); add("parking", "Estacionamento", "use", "monthly");
  const monthly = totalVehicleCost(costs), annual = totalVehicleCost(costs, "annual"); costs.forEach(c => { c.share = percentage(c.monthly, monthly); });
  const app = appCosts(v.rides!, v.fare!);
  return { input: { ...v }, costs, fuel, own: owningCost(costs), use: usingCost(costs), monthly, annual, app, delta: { monthly: costDifference(monthly, app.monthly), annual: costDifference(annual, app.annual) }, wait: v.wait === null ? null : waitingTime(v.rides!, v.wait) };
}
export type VehicleResult = ReturnType<typeof calculateVehicleComparison>;
export function vehicleDifferenceText(delta: number) {
  const prefix = "Considerando os valores informados, ";
  return delta === 0 ? `${prefix}os dois cenários possuem o mesmo custo mensal.` : `${prefix}${delta > 0 ? "o veículo próprio" : "o transporte por aplicativo"} custa ${formatMoney(Math.abs(delta))} a mais por mês do que ${delta > 0 ? "o transporte por aplicativo" : "o veículo próprio"}.`;
}
export const vehicleNotes = [
  "Todos os valores são informados pelo usuário. Não utilizamos preços ou médias de mercado.",
  "Custos anuais são divididos por 12 e arredondados ao centavo (metade para cima). O total anual preserva os valores anuais originais e multiplica custos mensais por 12; pode diferir alguns centavos do mensal × 12.",
  "Corridas usam 52 semanas por ano e 52/12 semanas por mês. Os períodos são calculados sem arredondar previamente o custo semanal.",
  "Manutenção é uma estimativa informada: pode incluir revisões, óleo, peças, pneus e outros gastos. Em aluguel/assinatura, informe separadamente apenas custos que não estejam incluídos no contrato.",
  "A comparação não considera depreciação ou valorização do veículo, custo de oportunidade, preço de compra ou revenda. Não simula juros, entrada ou condições de financiamento.",
  "Tempo de espera é somente o intervalo informado entre solicitar a corrida e o veículo chegar. Não inclui trajetos, trânsito ou outros tempos. Não recebe valor monetário.",
  "Custos opcionais vazios significam nenhum custo adicional informado. Valores necessários vazios não são tratados como zero. Espera vazia significa tempo não informado.",
  "Estimativas informativas: a ferramenta não recomenda comprar, vender ou financiar veículo. A decisão permanece com o usuário.",
];

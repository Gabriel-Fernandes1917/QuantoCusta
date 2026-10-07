import { assertMoney, formatMoney, parseMoney, percentage } from "../money";
import { parseLodgingQuantity, formatLodgingQuantity, formatTravelTime } from "./lodging-comparison";
import { estimatedFuel, vehicleLabels } from "./vehicle-comparison";

export { vehicleLabels, formatLodgingQuantity as formatQuantity, formatTravelTime as formatDuration };
export const rentalPriceLabels = { daily: "Valor por diária", total: "Valor total da locação" };
export const fuelModeLabels = { direct: "Informar o valor estimado", distance: "Calcular pela distância" };
export const rideKindLabels = { outward: "Somente ida", round: "Ida e volta" };
export const includedLabels = { protection: "Proteção/seguro", fees: "Taxas da locadora", driver: "Condutor adicional", unlimited: "Quilometragem livre" };
export const additionalLabels = { protection: "Proteção/seguro adicional", fees: "Taxas adicionais da locadora", driver: "Condutor adicional" };
type Amount = number | null;
export type RentalRide = { id: string; name: string; kind: keyof typeof rideKindLabels; count: Amount; outwardFare: Amount; returnFare: Amount; outwardWait: Amount; returnWait: Amount };
export type RentalComparison = {
  days: Amount; people: Amount; vehicle: keyof typeof vehicleLabels | null;
  priceMode: keyof typeof rentalPriceLabels; rentalPrice: Amount; rentalDays: Amount;
  included: Record<keyof typeof includedLabels, boolean>; protection: Amount; fees: Amount; driver: Amount;
  fuelMode: keyof typeof fuelModeLabels; fuelDirect: Amount; kilometers: Amount; efficiency: Amount; fuelPrice: Amount;
  parkingPaid: boolean; parkingMode: "total" | "daily"; parkingPrice: Amount; parkingDays: Amount;
  tollPaid: boolean; tolls: Amount; cleaning: Amount; deposit: Amount;
  extras: { id: string; name: string; price: Amount }[]; rides: RentalRide[];
};
export function emptyRentalRide(id: string): RentalRide {
  return { id, name: "", kind: "outward", count: null, outwardFare: null, returnFare: null, outwardWait: null, returnWait: null };
}
export function emptyRentalComparison(): RentalComparison {
  return { days: null, people: null, vehicle: null, priceMode: "daily", rentalPrice: null, rentalDays: null,
    included: { protection: false, fees: false, driver: false, unlimited: false }, protection: null, fees: null, driver: null,
    fuelMode: "direct", fuelDirect: null, kilometers: null, efficiency: null, fuelPrice: null,
    parkingPaid: false, parkingMode: "total", parkingPrice: null, parkingDays: null, tollPaid: false, tolls: null,
    cleaning: null, deposit: null, extras: [], rides: [] };
}
export type RentalField = { path: string; kind: "money" | "integer" | "quantity"; required?: boolean; positive?: boolean };
const baseFields: RentalField[] = [
  { path: "days", kind: "integer", required: true, positive: true }, { path: "people", kind: "integer", positive: true },
  { path: "rentalPrice", kind: "money", required: true }, { path: "rentalDays", kind: "integer", required: true, positive: true },
  ...["protection", "fees", "driver", "fuelDirect", "fuelPrice", "parkingPrice", "tolls", "cleaning", "deposit"].map(path => ({ path, kind: "money" as const })),
  { path: "kilometers", kind: "quantity", required: true }, { path: "efficiency", kind: "quantity", required: true, positive: true },
  { path: "parkingDays", kind: "integer", required: true, positive: true },
];
export function storedRentalFields(v: RentalComparison): RentalField[] {
  return [...baseFields, ...v.extras.map((_, i) => ({ path: `extras.${i}.price`, kind: "money" as const })),
    ...v.rides.flatMap((_, i) => [
      { path: `rides.${i}.count`, kind: "integer" as const, required: true, positive: true },
      ...["outwardFare", "returnFare"].map(key => ({ path: `rides.${i}.${key}`, kind: "money" as const, required: true })),
      ...["outwardWait", "returnWait"].map(key => ({ path: `rides.${i}.${key}`, kind: "quantity" as const })),
    ])];
}
export function activeRentalFields(v: RentalComparison): RentalField[] {
  return storedRentalFields(v).filter(f => {
    if (f.path === "rentalDays") return v.priceMode === "daily";
    if (f.path in additionalLabels) return !v.included[f.path as keyof typeof additionalLabels];
    if (f.path === "fuelDirect") return v.fuelMode === "direct";
    if (["kilometers", "efficiency", "fuelPrice"].includes(f.path)) return v.fuelMode === "distance";
    if (f.path === "parkingPrice") return v.parkingPaid;
    if (f.path === "parkingDays") return v.parkingPaid && v.parkingMode === "daily";
    if (f.path === "tolls") return v.tollPaid;
    const match = /^rides\.(\d+)\.return/.exec(f.path);
    return !match || v.rides[Number(match[1])].kind === "round";
  }).map(f => ({ ...f, required: f.required || ["fuelDirect", "fuelPrice", "parkingPrice", "tolls"].includes(f.path) }));
}
export function rentalValue(v: RentalComparison, path: string): Amount {
  return path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], v) as Amount;
}
export function setRentalValue(v: RentalComparison, path: string, value: Amount) {
  const keys = path.split("."), last = keys.pop()!;
  const node = keys.reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], v) as Record<string, unknown>; node[last] = value;
}
export function parseRentalField(text: string, kind: RentalField["kind"]): Amount {
  if (!text.trim()) return null;
  return kind === "money" ? parseMoney(text) : parseLodgingQuantity(text, kind === "integer");
}
function checkNumber(n: unknown, kind: RentalField["kind"]) {
  if (n === null) return;
  if (typeof n !== "number") throw new Error("Valor inválido.");
  if (kind === "money") assertMoney(n); else parseLodgingQuantity(String(n), kind === "integer");
}
export function rentalIssues(v: RentalComparison): Record<string, string> {
  const errors: Record<string, string> = {};
  activeRentalFields(v).forEach(f => {
    const value = rentalValue(v, f.path);
    if (value === null) { if (f.required) errors[f.path] = "Informe este valor. Zero também é aceito quando aplicável."; return; }
    try { checkNumber(value, f.kind); } catch (e) { errors[f.path] = (e as Error).message; }
    if (f.positive && value <= 0) errors[f.path] = "Informe um valor maior que zero.";
  });
  if (!v.vehicle) errors.vehicle = "Selecione o tipo de veículo.";
  if (!v.rides.length) errors.rides = "Cadastre ao menos uma corrida para comparar. Um valor explicitamente zero também é aceito.";
  return errors;
}
export function validateRentalShape(v: RentalComparison) {
  function fail(): never { throw new Error("Simulação de veículo alugado inválida."); }
  function object(n: unknown): asserts n is Record<string, unknown> { if (!n || typeof n !== "object" || Array.isArray(n)) fail(); }
  function text(n: unknown) { if (typeof n !== "string" || n.length > 80) fail(); }
  function boolean(n: unknown) { if (typeof n !== "boolean") fail(); }
  function list(n: unknown): asserts n is unknown[] { if (!Array.isArray(n) || n.length > 50) fail(); }
  object(v);
  if (![null, "car", "motorcycle"].includes(v.vehicle) || !Object.hasOwn(rentalPriceLabels, v.priceMode) || !Object.hasOwn(fuelModeLabels, v.fuelMode) || !["total", "daily"].includes(v.parkingMode)) fail();
  object(v.included); Object.keys(includedLabels).forEach(k => boolean(v.included[k as keyof typeof includedLabels]));
  boolean(v.parkingPaid); boolean(v.tollPaid);
  list(v.extras); list(v.rides);
  for (const rows of [v.extras, v.rides]) {
    const ids = new Set<string>(); rows.forEach(row => { object(row); text(row.id); text(row.name); if (!row.id || ids.has(row.id)) fail(); ids.add(row.id); });
  }
  v.rides.forEach(r => { if (!Object.hasOwn(rideKindLabels, r.kind)) fail(); });
  storedRentalFields(v).forEach(f => checkNumber(rentalValue(v, f.path), f.kind));
}
function safe(n: bigint) {
  if (n < BigInt(0) || n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Total fora do intervalo seguro. Reduza os valores informados.");
  return Number(n);
}
export function rentalSum(values: number[]) { return safe(values.reduce((sum, n) => sum + BigInt(n), BigInt(0))); }
export function rentalMultiply(cents: number, count: number) {
  assertMoney(cents); checkNumber(count, "integer"); if (count <= 0) throw new Error("Informe uma quantidade maior que zero.");
  return safe(BigInt(cents) * BigInt(count));
}
export function rentalAverage(total: number, count: number) {
  if (!Number.isSafeInteger(total) || total < 0) throw new Error("Total inválido.");
  checkNumber(count, "integer"); if (count <= 0) throw new Error("Informe uma quantidade maior que zero.");
  return safe((BigInt(total) * BigInt(2) + BigInt(count)) / (BigInt(count) * BigInt(2)));
}
export function calculateRentalRide(ride: RentalRide, index = 0) {
  checkNumber(ride.count, "integer");
  if (ride.count === null || ride.count <= 0 || ride.outwardFare === null || (ride.kind === "round" && ride.returnFare === null)) throw new Error("Complete os valores e a quantidade da corrida.");
  assertMoney(ride.outwardFare); if (ride.kind === "round") assertMoney(ride.returnFare!);
  const unitCost = rentalSum([ride.outwardFare, ride.kind === "round" ? ride.returnFare! : 0]);
  const total = safe(BigInt(unitCost) * BigInt(ride.count));
  const waits = ride.kind === "round" ? [ride.outwardWait, ride.returnWait] : [ride.outwardWait];
  waits.forEach(n => checkNumber(n, "quantity"));
  const known = waits.filter((n): n is number => n !== null);
  const waitMinutes = known.length ? known.reduce((sum, n) => sum + n, 0) * ride.count : null;
  return { ...ride, name: ride.name.trim() || `Corrida ${index + 1}`, unitCost, total, waitMinutes, waitComplete: known.length === waits.length };
}
// Uma ocorrência de ida e volta representa duas corridas reais.
export function rentalRideMetrics(appTotal: number, rides: Pick<RentalRide, "kind" | "count">[]) {
  if (!Number.isSafeInteger(appTotal) || appTotal < 0) throw new Error("Total inválido.");
  const totalRides = rentalSum(rides.map(ride => {
    checkNumber(ride.count, "integer");
    if (ride.count === null || ride.count <= 0 || !Object.hasOwn(rideKindLabels, ride.kind)) throw new Error("Informe o tipo e uma quantidade maior que zero.");
    return ride.count * (ride.kind === "round" ? 2 : 1);
  }));
  // Mantém o arredondamento monetário ao centavo, metade para cima.
  const appPerRide = totalRides === 0 ? null : safe((BigInt(appTotal) * BigInt(2) + BigInt(totalRides)) / (BigInt(totalRides) * BigInt(2)));
  return { totalRides, appPerRide };
}
export function calculateRentalComparison(v: RentalComparison) {
  validateRentalShape(v); if (Object.keys(rentalIssues(v)).length) throw new Error("Complete os campos indicados para comparar.");
  const rental = v.priceMode === "daily" ? rentalMultiply(v.rentalPrice!, v.rentalDays!) : v.rentalPrice!;
  const additionals = Object.entries(additionalLabels).map(([key, label]) => ({ key, label, value: v.included[key as keyof typeof additionalLabels] ? 0 : v[key as keyof typeof additionalLabels] ?? 0 }));
  const fuel = v.fuelMode === "direct" ? v.fuelDirect! : estimatedFuel(v.kilometers!, v.efficiency!, v.fuelPrice!);
  const parking = !v.parkingPaid ? 0 : v.parkingMode === "daily" ? rentalMultiply(v.parkingPrice!, v.parkingDays!) : v.parkingPrice!;
  const extras = v.extras.map((e, i) => ({ ...e, name: e.name.trim() || `Outro custo ${i + 1}`, total: e.price ?? 0 }));
  const categories = [{ key: "rental", label: "Locação", value: rental }, { key: "additionals", label: "Extras da locadora", value: rentalSum(additionals.map(c => c.value)) },
    { key: "fuel", label: "Combustível", value: fuel }, { key: "parking", label: "Estacionamento", value: parking },
    { key: "tolls", label: "Pedágios", value: v.tollPaid ? v.tolls! : 0 }, { key: "cleaning", label: "Limpeza", value: v.cleaning ?? 0 }, { key: "extras", label: "Outros", value: rentalSum(extras.map(e => e.total)) }];
  const vehicleTotal = rentalSum(categories.map(c => c.value));
  const rides = v.rides.map(calculateRentalRide), appTotal = rentalSum(rides.map(r => r.total));
  const knownWaits = rides.filter(r => r.waitMinutes !== null);
  const waitMinutes = knownWaits.length ? knownWaits.reduce((sum, r) => sum + r.waitMinutes!, 0) : null;
  const delta = vehicleTotal - appTotal;
  const rideMetrics = rentalRideMetrics(appTotal, rides);
  return { input: structuredClone(v), rental, additionals, fuel, parking, extras, vehicleTotal, appTotal, delta, difference: Math.abs(delta),
    ...rideMetrics, beyondRental: vehicleTotal - rental,
    vehiclePerDay: rentalAverage(vehicleTotal, v.days!), appPerDay: rentalAverage(appTotal, v.days!),
    vehiclePerPerson: v.people === null ? null : rentalAverage(vehicleTotal, v.people), appPerPerson: v.people === null ? null : rentalAverage(appTotal, v.people),
    deposit: v.deposit, waitMinutes, waitComplete: rides.every(r => r.waitComplete),
    rides: rides.map(r => ({ ...r, share: percentage(r.total, appTotal) })), breakdown: categories.map(c => ({ ...c, share: percentage(c.value, vehicleTotal) })) };
}
export type RentalResult = ReturnType<typeof calculateRentalComparison>;
export function rentalDifferenceText(r: RentalResult) {
  return r.delta === 0 ? "Considerando os valores informados, as duas opções possuem o mesmo custo estimado." : `Considerando os valores informados, ${r.delta < 0 ? "o veículo alugado" : "o transporte por aplicativo"} custa ${formatMoney(r.difference)} a menos durante a viagem.`;
}
export function beyondRentalText(r: RentalResult) {
  return `O valor da locação é ${formatMoney(r.rental)}. Os custos além da locação somam ${formatMoney(r.beyondRental)}; o custo estimado do veículo durante a viagem chega a ${formatMoney(r.vehicleTotal)}.`;
}
export function rentalWaitText(r: Pick<RentalResult, "waitMinutes" | "waitComplete">) {
  if (r.waitMinutes === null) return "Tempo de espera não informado.";
  return `${r.waitComplete ? "Tempo total estimado de espera" : "Espera informada (parcial)"}: ${formatTravelTime(r.waitMinutes)}.`;
}
export const rentalTariffNote = "Os preços das corridas são estimativas. O valor real pode variar conforme demanda, horário, trânsito, chuva, eventos e disponibilidade de motoristas.";
export const rentalNotes = [
  "Todos os valores são informados pelo usuário. Não buscamos preços de locadoras, tarifas de aplicativo ou combustível; não calculamos rotas e não usamos mapas.",
  "Locação usa valor total ou diária × diárias informadas. Dias da viagem, diárias da locação e dias de estacionamento são independentes. Carro e moto usam as mesmas fórmulas.",
  "Itens incluídos na cotação são informativos e não são somados novamente. Extras da locadora são valores totais da locação, sem multiplicação automática pelas diárias.",
  "Combustível usa valor direto ou quilômetros / consumo em km/L × preço por litro. Arredondamento ao centavo, metade para cima, sem arredondar litros. Considere a política de combustível da locadora ao estimar este valor.",
  "Estacionamento usa valor total ou valor por dia × dias. Considere hospedagem e locais visitados. Pedágios, limpeza e outros gastos são estimativas totais da viagem.",
  "Caução ou bloqueio no cartão é exibido separadamente e não entra no custo total: normalmente representa um bloqueio temporário, não uma despesa.",
  "Corridas de somente ida usam valor × quantidade. Ida e volta usam (valor da ida + valor da volta) × quantidade, sem presumir preços iguais. Valores representam o grupo informado, sem multiplicação por pessoas.",
  "Espera usa a soma dos tempos informados por trecho × quantidade. Campos vazios não são zero conhecido. Se faltarem estimativas, a soma é identificada como parcial. Espera não representa duração dos trajetos e não é monetizada.",
  "Custos opcionais vazios não geram gastos adicionais. Campos necessários vazios impedem a comparação; zero explicitamente informado é aceito quando aplicável.",
  "Custo médio por dia = total / dias da viagem. Custo por pessoa = total / pessoas, quando informado. Divisões arredondadas ao centavo, metade para cima.",
  rentalTariffNote,
  "Além do custo, disponibilidade, conforto, flexibilidade e preferência pessoal podem influenciar sua decisão, mas não são avaliados pela ferramenta. Resultados estimativos e informativos, sem recomendação automática de uma opção.",
];

import { assertMoney, formatMoney, percentage } from "../money";

export const mealLabels = { breakfast: "Café da manhã", lunch: "Almoço", dinner: "Jantar" };
export type MealKey = keyof typeof mealLabels;
export const transportLabels = { own: "Carro próprio", rented: "Veículo alugado", app: "Transporte por aplicativo", manual: "Outro / informar custos manualmente" };
export type Transport = keyof typeof transportLabels;
export const tripLabels = { round: "Ida e volta", outward: "Somente ida", return: "Somente volta" };
export type TripKind = keyof typeof tripLabels;
type Amount = number | null;
export type Lodging = {
  name: string; priceMode: "total" | "night"; price: Amount; fees: Amount;
  meals: Record<MealKey, { included: boolean; price: Amount; days: Amount }>;
  parking: { included: boolean; period: "total" | "day"; price: Amount; days: Amount };
};
export type Journey = { distance: Amount; minutes: Amount; fare: Amount; parkingPaid: boolean; parking: Amount; tollPaid: boolean; toll: Amount };
export type TravelPlace = { id: string; name: string; visits: Amount; kind: TripKind; sameParking: boolean; journeys: [Journey, Journey] };
export type LodgingComparison = {
  people: Amount; nights: Amount; transport: Transport | null; efficiency: Amount; fuelPrice: Amount;
  lodgings: [Lodging, Lodging]; places: TravelPlace[]; extras: { id: string; name: string; amounts: [Amount, Amount] }[];
};
export function emptyLodging(): Lodging {
  return { name: "", priceMode: "total", price: null, fees: null, meals: { breakfast: { included: false, price: null, days: null }, lunch: { included: false, price: null, days: null }, dinner: { included: false, price: null, days: null } }, parking: { included: false, period: "total", price: null, days: null } };
}
export function emptyJourney(): Journey { return { distance: null, minutes: null, fare: null, parkingPaid: false, parking: null, tollPaid: false, toll: null }; }
export function emptyTravelPlace(id: string): TravelPlace { return { id, name: "", visits: null, kind: "round", sameParking: true, journeys: [emptyJourney(), emptyJourney()] }; }
export function emptyLodgingComparison(): LodgingComparison { return { people: null, nights: null, transport: null, efficiency: null, fuelPrice: null, lodgings: [emptyLodging(), emptyLodging()], places: [], extras: [] }; }
export function lodgingName(lodging: Lodging, index: number) { return lodging.name.trim() || `Hospedagem ${index === 0 ? "A" : "B"}`; }
export function usesVehicle(mode: Transport | null) { return mode === "own" || mode === "rented"; }

function quantity(n: number, integer = false) {
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000 || (integer ? !Number.isInteger(n) : !/^\d+(?:\.\d{1,6})?$/.test(String(n)))) throw new Error(integer ? "Informe um número inteiro entre 0 e 1 milhão." : "Informe um número entre 0 e 1 milhão, com até seis casas decimais.");
}
export function parseLodgingQuantity(text: string, integer = false): Amount {
  if (!text.trim()) return null;
  if (!/^\d+(?:[.,]\d{1,6})?$/.test(text.trim())) throw new Error("Use um número positivo ou zero, como 10 ou 1,5.");
  const n = Number(text.trim().replace(",", ".")); quantity(n, integer); return n;
}
function safe(n: number) { if (!Number.isSafeInteger(n) || n < 0) throw new Error("Total fora do intervalo seguro. Reduza os valores informados."); return n; }
export function sumLodgingCosts(values: number[]) { return safe(values.reduce((a, b) => a + b, 0)); }
function multiply(cents: number, ...counts: number[]) { assertMoney(cents); counts.forEach(n => quantity(n, true)); return safe(Number(counts.reduce((n, count) => n * BigInt(count), BigInt(cents)))); }
function roundRatio(n: bigint, d: bigint) { if (d <= BigInt(0)) throw new Error("O divisor deve ser maior que zero."); return safe(Number((n * BigInt(2) + d) / (d * BigInt(2)))); }
function scaled(n: number) { quantity(n); const [whole, fraction = ""] = String(n).split("."); return BigInt(whole) * BigInt(1_000_000) + BigInt(fraction.padEnd(6, "0")); }
export function lodgingPrice(price: number, mode: Lodging["priceMode"], nights: number) { quantity(nights, true); if (nights <= 0) throw new Error("Informe ao menos uma noite."); assertMoney(price); return mode === "night" ? multiply(price, nights) : price; }
export function mealCost(price: number, people: number, days: number) { if (people <= 0) throw new Error("Informe ao menos uma pessoa."); return multiply(price, people, days); }
export function lodgingParking(price: number, period: "total" | "day", days: number) { assertMoney(price); return period === "day" ? multiply(price, days) : price; }
export function totalDistance(distance: number, visits: number, kind: TripKind) { quantity(distance); quantity(visits, true); if (visits <= 0) throw new Error("Informe ao menos uma visita."); return distance * (kind === "round" ? 2 : 1) * visits; }
export function travelFuel(distance: number, visits: number, kind: TripKind, efficiency: number, price: number) {
  quantity(visits, true); if (visits <= 0 || efficiency <= 0) throw new Error("Visitas e consumo devem ser maiores que zero."); assertMoney(price);
  return roundRatio(scaled(distance) * BigInt(kind === "round" ? 2 : 1) * BigInt(visits) * BigInt(price), scaled(efficiency));
}
export function perVisitCost(price: number, visits: number) { if (visits <= 0) throw new Error("Informe ao menos uma visita."); return multiply(price, visits); }
export function travelMinutes(minutes: number, visits: number, kind: TripKind) { return totalDistance(minutes, visits, kind); }
export function lodgingPerPerson(total: number, people: number) { safe(total); quantity(people, true); if (people <= 0) throw new Error("Informe ao menos uma pessoa."); return roundRatio(BigInt(total), BigInt(people)); }
export function lodgingDifference(a: number, b: number) { safe(a); safe(b); return a - b; }
export function timeDifference(a: number, b: number) { if (![a, b].every(n => Number.isFinite(n) && n >= 0)) throw new Error("Tempo inválido."); return a - b; }
export function formatTravelTime(minutes: number) { const value = (minutes / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 }); return `${value} ${value === "1" ? "hora" : "horas"}`; }

export type LodgingField = { path: string; kind: "money" | "quantity" | "integer"; required?: boolean; positive?: boolean; max?: number };
export function storedLodgingFields(v: LodgingComparison): LodgingField[] {
  const fields: LodgingField[] = [{ path: "people", kind: "integer" }, { path: "nights", kind: "integer" }, { path: "efficiency", kind: "quantity" }, { path: "fuelPrice", kind: "money" }];
  v.lodgings.forEach((_, i) => {
    ["price", "fees", "parking.price"].forEach(key => fields.push({ path: `lodgings.${i}.${key}`, kind: "money" }));
    fields.push({ path: `lodgings.${i}.parking.days`, kind: "integer" });
    Object.keys(mealLabels).forEach(key => fields.push({ path: `lodgings.${i}.meals.${key}.price`, kind: "money" }, { path: `lodgings.${i}.meals.${key}.days`, kind: "integer" }));
  });
  v.places.forEach((_, i) => { fields.push({ path: `places.${i}.visits`, kind: "integer" }); [0, 1].forEach(s => { ["distance", "minutes"].forEach(key => fields.push({ path: `places.${i}.journeys.${s}.${key}`, kind: "quantity" })); ["fare", "parking", "toll"].forEach(key => fields.push({ path: `places.${i}.journeys.${s}.${key}`, kind: "money" })); }); });
  v.extras.forEach((_, i) => [0, 1].forEach(s => fields.push({ path: `extras.${i}.amounts.${s}`, kind: "money" })));
  return fields;
}
// A lista ativa é compartilhada pela validação e pelo formulário: campos ocultos não participam do cálculo.
export function lodgingFields(v: LodgingComparison): LodgingField[] {
  const fields: LodgingField[] = [{ path: "people", kind: "integer", required: true, positive: true }, { path: "nights", kind: "integer", required: true, positive: true }];
  const vehicle = usesVehicle(v.transport);
  if (vehicle && v.places.length) fields.push({ path: "efficiency", kind: "quantity", required: true, positive: true }, { path: "fuelPrice", kind: "money", required: true });
  v.lodgings.forEach((l, i) => {
    const root = `lodgings.${i}`;
    fields.push({ path: `${root}.price`, kind: "money", required: true }, { path: `${root}.fees`, kind: "money" });
    Object.keys(mealLabels).forEach(key => {
      const m = l.meals[key as MealKey]; if (m.included) return;
      const applicable = m.price !== null || m.days !== null;
      fields.push({ path: `${root}.meals.${key}.price`, kind: "money", required: applicable }, { path: `${root}.meals.${key}.days`, kind: "integer", required: applicable, max: v.nights === null ? undefined : v.nights + 1 });
    });
    if (vehicle && !l.parking.included) {
      fields.push({ path: `${root}.parking.price`, kind: "money" });
      if (l.parking.period === "day") fields.push({ path: `${root}.parking.days`, kind: "integer", required: l.parking.price !== null, max: v.nights === null ? undefined : v.nights + 1 });
    }
  });
  v.places.forEach((p, i) => {
    fields.push({ path: `places.${i}.visits`, kind: "integer", required: true, positive: true });
    p.journeys.forEach((j, s) => {
      const root = `places.${i}.journeys.${s}`;
      fields.push({ path: `${root}.minutes`, kind: "quantity" });
      if (vehicle) {
        fields.push({ path: `${root}.distance`, kind: "quantity", required: true });
        const parking = p.sameParking ? p.journeys[0] : j;
        if (parking.parkingPaid && (!p.sameParking || s === 0)) fields.push({ path: `${root}.parking`, kind: "money", required: true });
        if (j.tollPaid) fields.push({ path: `${root}.toll`, kind: "money", required: true });
      } else if (v.transport) fields.push({ path: `${root}.fare`, kind: "money", required: true });
    });
  });
  v.extras.forEach((_, i) => [0, 1].forEach(s => fields.push({ path: `extras.${i}.amounts.${s}`, kind: "money" })));
  return fields;
}
export function lodgingValue(v: LodgingComparison, path: string): Amount { return path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], v) as Amount; }
export function setLodgingValue(v: LodgingComparison, path: string, value: Amount) { const keys = path.split("."), last = keys.pop()!; const node = keys.reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], v) as Record<string, unknown>; node[last] = value; }
export function lodgingIssues(v: LodgingComparison): Record<string, string> {
  const errors: Record<string, string> = {};
  lodgingFields(v).forEach(f => {
    const value = lodgingValue(v, f.path);
    if (value === null) { if (f.required) errors[f.path] = "Informe este valor. Zero também é aceito quando aplicável."; return; }
    try { if (f.kind === "money") assertMoney(value); else quantity(value, f.kind === "integer"); } catch (e) { errors[f.path] = (e as Error).message; }
    if (f.positive && value <= 0) errors[f.path] = "Informe um valor maior que zero.";
    if (f.max !== undefined && value > f.max) errors[f.path] = `Informe até ${f.max} dias (noites + 1).`;
  });
  if (!v.transport) errors.transport = "Selecione como pretende se deslocar.";
  v.lodgings.forEach((l, i) => { if (usesVehicle(v.transport) && !l.parking.included && l.parking.period === "day" && l.parking.days !== null && l.parking.price === null) errors[`lodgings.${i}.parking.price`] = "Informe o valor por dia ou deixe os dois campos vazios."; });
  return errors;
}
export function validateLodgingShape(v: LodgingComparison) {
  function fail(): never { throw new Error("Simulação de hospedagens inválida."); }
  function obj(value: unknown): asserts value is Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) fail(); }
  function text(value: unknown, max = 80) { if (typeof value !== "string" || value.length > max) fail(); }
  function bool(value: unknown) { if (typeof value !== "boolean") fail(); }
  function num(value: unknown, money = false, integer = false) { if (value === null) return; if (typeof value !== "number") fail(); if (money) assertMoney(value); else quantity(value, integer); }
  function list(value: unknown, max = 50): asserts value is unknown[] { if (!Array.isArray(value) || value.length > max) fail(); }
  obj(v); num(v.people, false, true); num(v.nights, false, true); num(v.efficiency); num(v.fuelPrice, true);
  if (v.transport !== null && !Object.hasOwn(transportLabels, v.transport)) fail();
  list(v.lodgings, 2); if (v.lodgings.length !== 2) fail();
  v.lodgings.forEach(l => {
    obj(l); text(l.name); if (!["total", "night"].includes(l.priceMode)) fail(); num(l.price, true); num(l.fees, true); obj(l.meals);
    Object.keys(mealLabels).forEach(key => { const m = l.meals[key as MealKey]; obj(m); bool(m.included); num(m.price, true); num(m.days, false, true); });
    obj(l.parking); bool(l.parking.included); if (!["total", "day"].includes(l.parking.period)) fail(); num(l.parking.price, true); num(l.parking.days, false, true);
  });
  list(v.places); const ids = new Set<string>();
  v.places.forEach(p => {
    obj(p); text(p.id); if (!p.id || ids.has(p.id)) fail(); ids.add(p.id); text(p.name); num(p.visits, false, true); bool(p.sameParking); if (!Object.hasOwn(tripLabels, p.kind)) fail(); list(p.journeys, 2); if (p.journeys.length !== 2) fail();
    p.journeys.forEach(j => { obj(j); num(j.distance); num(j.minutes); num(j.fare, true); bool(j.parkingPaid); num(j.parking, true); bool(j.tollPaid); num(j.toll, true); });
  });
  list(v.extras); const extraIds = new Set<string>();
  v.extras.forEach(e => { obj(e); text(e.id); if (!e.id || extraIds.has(e.id)) fail(); extraIds.add(e.id); text(e.name); list(e.amounts, 2); if (e.amounts.length !== 2) fail(); e.amounts.forEach(n => num(n, true)); });
}
export function calculateLodgingComparison(v: LodgingComparison) {
  validateLodgingShape(v); if (Object.keys(lodgingIssues(v)).length) throw new Error("Complete os campos indicados para comparar.");
  const vehicle = usesVehicle(v.transport);
  const scenarios = v.lodgings.map((l, index) => {
    const name = lodgingName(l, index), price = lodgingPrice(l.price!, l.priceMode, v.nights!);
    const meals = Object.entries(mealLabels).map(([key, label]) => { const m = l.meals[key as MealKey]; return { key, label, total: m.included || m.price === null ? 0 : mealCost(m.price, v.people!, m.days!) }; });
    const parking = !vehicle || l.parking.included || l.parking.price === null ? 0 : lodgingParking(l.parking.price, l.parking.period, l.parking.days ?? 0);
    const journeys = v.places.map((p, i) => {
      const j = p.journeys[index], park = p.sameParking ? p.journeys[0] : j;
      const fuel = vehicle ? travelFuel(j.distance!, p.visits!, p.kind, v.efficiency!, v.fuelPrice!) : 0;
      const destinationParking = vehicle && park.parkingPaid ? perVisitCost(park.parking!, p.visits!) : 0;
      const toll = vehicle && j.tollPaid ? perVisitCost(j.toll!, p.visits!) : 0;
      const fare = !vehicle ? perVisitCost(j.fare!, p.visits!) : 0;
      return { id: p.id, name: p.name.trim() || `Local ${i + 1}`, visits: p.visits!, kind: p.kind, distance: vehicle ? totalDistance(j.distance!, p.visits!, p.kind) : null, fuel, parking: destinationParking, toll, fare, total: sumLodgingCosts([fuel, destinationParking, toll, fare]), minutes: j.minutes === null ? null : travelMinutes(j.minutes, p.visits!, p.kind) };
    });
    const transport = sumLodgingCosts(journeys.map(j => j.total));
    const extras = v.extras.map((e, i) => ({ name: e.name.trim() || `Outro custo ${i + 1}`, total: e.amounts[index] ?? 0 }));
    const breakdown = [{ key: "price", label: "Hospedagem", value: price }, { key: "fees", label: "Taxas", value: l.fees ?? 0 }, { key: "meals", label: "Refeições adicionais", value: sumLodgingCosts(meals.map(m => m.total)) }, { key: "parking", label: "Estacionamento da hospedagem", value: parking }, { key: "transport", label: "Deslocamentos", value: transport }, { key: "extras", label: "Outros", value: sumLodgingCosts(extras.map(e => e.total)) }];
    const total = sumLodgingCosts(breakdown.map(b => b.value)), additional = sumLodgingCosts(breakdown.slice(1).map(b => b.value));
    const minutes = journeys.length === 0 ? 0 : journeys.every(j => j.minutes !== null) ? journeys.reduce((total, j) => total + j.minutes!, 0) : null;
    return { name, price, meals, parking, journeys, extras, transport, additional, total, perPerson: lodgingPerPerson(total, v.people!), minutes, breakdown: breakdown.map(b => ({ ...b, share: percentage(b.value, total) })) };
  });
  const [a, b] = scenarios;
  const differences = [
    { label: "Preço da hospedagem", a: a.price, b: b.price }, { label: "Taxas", a: v.lodgings[0].fees ?? 0, b: v.lodgings[1].fees ?? 0 },
    ...a.meals.map((m, i) => ({ label: m.label, a: m.total, b: b.meals[i].total })), { label: "Estacionamento da hospedagem", a: a.parking, b: b.parking },
    ...(["fuel", "parking", "toll", "fare"] as const).map(key => ({ label: { fuel: "Combustível", parking: "Estacionamento nos locais", toll: "Pedágios", fare: v.transport === "app" ? "Corridas" : "Deslocamentos manuais" }[key], a: sumLodgingCosts(a.journeys.map(j => j[key])), b: sumLodgingCosts(b.journeys.map(j => j[key])) })),
    ...a.extras.map((e, i) => ({ label: e.name, a: e.total, b: b.extras[i].total })),
  ].filter(d => d.a !== d.b).map(d => ({ ...d, delta: lodgingDifference(d.a, d.b) }));
  return { input: structuredClone(v), scenarios, delta: lodgingDifference(a.total, b.total), priceDelta: lodgingDifference(a.price, b.price), minutesDelta: a.minutes === null || b.minutes === null ? null : timeDifference(a.minutes, b.minutes), differences };
}
export type LodgingResult = ReturnType<typeof calculateLodgingComparison>;
export function lodgingDifferenceText(r: LodgingResult) {
  if (r.delta === 0) return "Considerando os valores informados, as duas hospedagens possuem o mesmo custo total comparável.";
  const [less, more] = r.delta < 0 ? r.scenarios : [...r.scenarios].reverse();
  return `Considerando os valores informados, ${less.name} custa ${formatMoney(Math.abs(r.delta))} a menos no total da viagem do que ${more.name}.`;
}
export function lodgingPriceInsight(r: LodgingResult) {
  if (r.priceDelta === 0) return "As duas opções têm o mesmo preço de hospedagem. Os custos adicionais informados determinam a diferença no total.";
  const cheap = r.priceDelta < 0 ? r.scenarios[0] : r.scenarios[1], other = r.priceDelta < 0 ? r.scenarios[1] : r.scenarios[0];
  if (r.delta === 0) return `${cheap.name} tem o menor preço de hospedagem, mas os custos adicionais informados deixam os totais comparáveis iguais.`;
  if (Math.sign(r.priceDelta) === Math.sign(r.delta)) return `${cheap.name} possui o menor preço de hospedagem e também o menor custo total considerando os valores informados.`;
  return `${cheap.name} custa ${formatMoney(Math.abs(r.priceDelta))} a menos na hospedagem, mas considerando os custos adicionais informados, ${other.name} custa ${formatMoney(Math.abs(r.delta))} a menos no total da viagem.`;
}
export function lodgingTimeText(r: LodgingResult) {
  if (r.minutesDelta === null) return "Informe os tempos de todos os locais nas duas hospedagens para comparar o tempo total.";
  if (r.minutesDelta === 0) return "Os dois cenários têm o mesmo tempo de deslocamento informado.";
  return `Considerando os locais e frequências informados, ${r.scenarios[r.minutesDelta < 0 ? 0 : 1].name} envolve aproximadamente ${formatTravelTime(Math.abs(r.minutesDelta))} a menos de deslocamento durante a viagem.`;
}
export const lodgingNotes = [
  "Todos os preços, distâncias e tempos são informados pelo usuário. Não buscamos hotéis, preços de combustível ou alimentação, não calculamos rotas e não usamos mapas.",
  "O preço total representa a reserva, sem multiplicação por pessoas. Diária × noites calcula o total da hospedagem. Taxas informadas são adicionais ao preço.",
  "Refeições não incluídas usam valor por pessoa por dia × pessoas × dias informados. Refeições incluídas não geram custos adicionais. Compare apenas o que muda; gastos iguais podem ser omitidos.",
  "Dias de refeições e estacionamento diário podem ir até noites + 1, incluindo os dias de chegada e saída. Nenhuma quantidade de dias é presumida.",
  "Ida e volta usa dois trechos; somente ida ou somente volta usa um. Distância e tempo por trecho são multiplicados pelos trechos e visitas. Tarifa, pedágio e estacionamento por visita já representam o tipo de deslocamento escolhido e são multiplicados apenas pelas visitas.",
  "Carro próprio e alugado usam distância total / consumo × preço do combustível. O combustível é arredondado por local ao centavo, metade para cima, sem arredondar litros. Custos fixos do veículo e do aluguel não entram nesta comparação.",
  "Estacionamento da hospedagem é separado dos deslocamentos. Só conta com carro próprio ou alugado, e quando não está incluído. Estacionamento no destino e pedágios só contam com veículo.",
  "Tempo não é monetizado e não inclui espera do aplicativo. Se faltar tempo em algum local, o total e a diferença de tempo não são apresentados como completos. Sem locais cadastrados, os deslocamentos são zero.",
  "Custo por pessoa é uma divisão simples do total pelo número de pessoas informado, arredondada ao centavo. Não presume que todas as despesas sejam compartilhadas igualmente.",
  "Campos necessários vazios impedem a comparação. Custos opcionais vazios significam nenhum custo adicional informado. Zero digitado permanece um valor informado.",
  "Valores estimativos e informativos. A comparação não recomenda uma hospedagem nem avalia qualidade, segurança ou disponibilidade; a decisão permanece com o usuário.",
];

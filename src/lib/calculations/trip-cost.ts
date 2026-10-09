import { assertMoney, formatMoney, formatPercentage, percentage } from "../money";

export const tripCategories = [
  { id: "tickets", label: "Passagens" },
  { id: "lodging", label: "Hospedagem" },
  { id: "food", label: "Alimentação" },
  { id: "transport", label: "Transporte local" },
  { id: "activities", label: "Passeios e atividades" },
  { id: "shopping", label: "Compras e gastos pessoais" },
  { id: "other", label: "Outros gastos" },
] as const;
export const tripPresets: [TripCategory, string[]][] = [
    ["tickets", ["Valor das passagens", "Bagagem adicional", "Taxas adicionais", "Outros custos relacionados"]],
    ["lodging", ["Valor da hospedagem", "Taxas de limpeza", "Taxas de serviço", "Estacionamento da hospedagem", "Outros custos da hospedagem"]],
    ["food", ["Café da manhã", "Almoço", "Jantar", "Lanches", "Outros gastos alimentares"]],
    ["transport", ["Aplicativo de transporte", "Aluguel de veículo", "Combustível", "Estacionamento", "Pedágios", "Transporte público", "Transfer", "Outros deslocamentos"]],
    ["shopping", ["Compras", "Presentes e lembranças", "Gastos pessoais", "Outros"]],
  ];
export type TripCategory = typeof tripCategories[number]["id"];
export type TripItem = { id: string; name: string; category: TripCategory; amount: number | null; mode: "total" | "person" | "night" | "personDay" | "unit"; quantity: number; days: number };
export type TripScenario = { id: string; name: string; days: number; nights: number; people: number; budget: number | null; items: TripItem[]; reserve: { mode: "none" | "fixed" | "percent"; amount: number | null; percent: number | null } };
export type TripPlan = { mode: "single" | "compare"; scenarios: TripScenario[] };
export const tripNotes = [
  "Este total considera somente as despesas preenchidas. Alimentação, transporte e outros gastos podem alterar o custo final. Zero informado é diferente de um campo não preenchido.",
  "Os valores são fornecidos pelo usuário. Não há preços automáticos, integração com companhias aéreas, hotéis ou plataformas de transporte, nem médias de mercado.",
  "A reserva para imprevistos é um valor planejado, não uma despesa que necessariamente acontecerá. Os percentuais das categorias usam somente os gastos estimados, sem a reserva.",
  "Dias, noites e viajantes são independentes por destino. Custo por dia e por pessoa não avalia qualidade, conforto ou preferência pessoal. A ferramenta não recomenda um destino.",
  "Os cálculos e os arquivos são processados no dispositivo. A transferência de resultados de outras ferramentas é manual; nenhum dado de outras simulações é lido.",
  "Valores são calculados em centavos inteiros. Divisões e reserva percentual são arredondadas para o centavo mais próximo, com metade para cima. Percentuais arredondados podem não somar 100%.",
  "Os resultados são estimativas informativas, sem garantia do custo final ou recomendação financeira.",
];
const modes: Record<TripCategory, TripItem["mode"][]> = { tickets: ["total", "person"], lodging: ["total", "night"], food: ["total", "personDay"], transport: ["total", "unit"], activities: ["total", "person"], shopping: ["total"], other: ["total", "unit"] };
function integer(value: number, label: string, min = 0, max = 10_000) { if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label}: informe um número inteiro entre ${min} e ${max}.`); }
function safe(value: bigint): number { if (value < BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("O total ultrapassa o limite seguro. Reduza os valores ou quantidades."); return Number(value); }
function sum(values: number[]) { return safe(values.reduce((total, n) => total + BigInt(n), BigInt(0))); }
function roundedDivide(value: bigint, divisor: bigint) { return safe((value * BigInt(2) + divisor) / (divisor * BigInt(2))); }

export function validateTripPlan(plan: TripPlan): void {
  if (!plan || !["single", "compare"].includes(plan.mode) || !Array.isArray(plan.scenarios) || plan.scenarios.length < 1 || plan.scenarios.length > 4 || (plan.mode === "compare" && plan.scenarios.length < 2)) throw new Error("Informe de um a quatro destinos; a comparação precisa de pelo menos dois.");
  const ids = new Set<string>();
  for (const s of plan.scenarios) {
    if (!s || typeof s.id !== "string" || !s.id || ids.has(s.id) || typeof s.name !== "string" || s.name.length > 100) throw new Error("Destino inválido.");
    ids.add(s.id);
    integer(s.days, "Dias", 1); integer(s.nights, "Noites"); integer(s.people, "Viajantes", 1);
    if (s.budget !== null) assertMoney(s.budget);
    if (!Array.isArray(s.items) || s.items.length > 200) throw new Error("Informe até 200 despesas por destino.");
    const itemIds = new Set<string>();
    for (const item of s.items) {
      if (!item || typeof item.id !== "string" || !item.id || itemIds.has(item.id) || typeof item.name !== "string" || item.name.length > 100 || !modes[item.category]?.includes(item.mode)) throw new Error("Despesa inválida.");
      itemIds.add(item.id);
      if (item.amount !== null) assertMoney(item.amount);
      integer(item.quantity, "Quantidade", 1); integer(item.days, "Dias da refeição");
      if (item.mode === "personDay" && item.days > s.days) throw new Error("Os dias de uma refeição não podem superar a duração da viagem.");
    }
    if (!s.reserve || !["none", "fixed", "percent"].includes(s.reserve.mode)) throw new Error("Reserva inválida.");
    if (s.reserve.amount !== null) assertMoney(s.reserve.amount);
    if (s.reserve.percent !== null && (!Number.isFinite(s.reserve.percent) || s.reserve.percent < 0 || s.reserve.percent > 100 || Math.abs(s.reserve.percent * 100 - Math.round(s.reserve.percent * 100)) > 1e-7)) throw new Error("Informe um percentual de 0 a 100, com até duas casas decimais.");
    if (s.reserve.mode === "fixed" && s.reserve.amount === null) throw new Error("Informe o valor da reserva fixa, inclusive zero se desejar.");
    if (s.reserve.mode === "percent" && s.reserve.percent === null) throw new Error("Informe o percentual da reserva.");
  }
}

export function calculateTrip(plan: TripPlan) {
  validateTripPlan(plan);
  const active = plan.mode === "single" ? plan.scenarios.slice(0, 1) : plan.scenarios;
  const scenarios = active.map(s => {
    const details = s.items.map(item => {
      let factor = BigInt(1);
      if (item.mode === "person") factor = BigInt(s.people) * BigInt(item.category === "activities" ? item.quantity : 1);
      if (item.mode === "total" && item.category === "activities") factor = BigInt(item.quantity);
      if (item.mode === "night") factor = BigInt(s.nights);
      if (item.mode === "personDay") factor = BigInt(s.people) * BigInt(item.days);
      if (item.mode === "unit") factor = BigInt(item.quantity);
      return { ...item, total: item.amount === null ? null : safe(BigInt(item.amount) * factor) };
    });
    const categories = tripCategories.map(category => {
      const items = details.filter(item => item.category === category.id && item.total !== null);
      return { ...category, considered: items.length > 0, total: sum(items.map(item => item.total!)), percentage: 0 as number | null };
    });
    const subtotal = sum(categories.map(c => c.total));
    categories.forEach(c => { c.percentage = c.considered ? percentage(c.total, subtotal) : null; });
    const reserve = s.reserve.mode === "none" ? 0 : s.reserve.mode === "fixed" ? s.reserve.amount! : roundedDivide(BigInt(subtotal) * BigInt(Math.round(s.reserve.percent! * 100)), BigInt(10_000));
    const total = sum([subtotal, reserve]);
    const positive = categories.filter(c => c.total > 0).sort((a,b) => b.total - a.total);
    return { id: s.id, name: s.name.trim() || "Destino sem nome", days: s.days, nights: s.nights, people: s.people, details, categories, subtotal, reserve, total, perPerson: roundedDivide(BigInt(total), BigInt(s.people)), perDay: roundedDivide(BigInt(total), BigInt(s.days)), budget: s.budget, budgetRemaining: s.budget === null ? null : s.budget - total, budgetPercentage: s.budget === null ? null : percentage(total, s.budget), reservePercentage: percentage(reserve, total), largest: positive[0] ?? null, smallest: positive.at(-1) ?? null, missing: categories.filter(c => !c.considered).map(c => c.label) };
  });
  const differentGroups = scenarios.some(s => s.days !== scenarios[0].days || s.people !== scenarios[0].people);
  const differences = scenarios.length === 2 ? { total: scenarios[0].total - scenarios[1].total, perPerson: scenarios[0].perPerson - scenarios[1].perPerson, perDay: scenarios[0].perDay - scenarios[1].perDay, categories: tripCategories.map((c,i) => ({ ...c, delta: scenarios[0].categories[i].considered && scenarios[1].categories[i].considered ? scenarios[0].categories[i].total - scenarios[1].categories[i].total : null })) } : null;
  const unitDifferences = tripPresets.flatMap(([category, labels]) => labels.flatMap((name, index) => {
    const matches = active.flatMap(s => {
      const item = s.items.find(i => i.id === `${s.id}-${category}-${index}` && i.category === category && i.name.trim() === name && i.amount !== null);
      return item ? [{ destination: s.name.trim() || "Destino sem nome", mode: item.mode }] : [];
    });
    return new Set(matches.map(i => i.mode)).size > 1 ? [{ name, matches }] : [];
  }));
  return { unitDifferences, input: plan, scenarios, differentGroups, differences, lowest: Math.min(...scenarios.map(s => s.total)), highest: Math.max(...scenarios.map(s => s.total)) };
}
export type TripResult = ReturnType<typeof calculateTrip>;
export type TripScenarioResult = TripResult["scenarios"][number];
export const differentGroupsNote = "Os cenários possuem durações ou quantidades de viajantes diferentes. Compare também o custo por dia e por pessoa para interpretar os resultados.";

export function tripInsights(s: TripScenarioResult): string[] {
  const notes: string[] = [];
  if (s.largest && s.largest.percentage !== null) notes.push(`${s.largest.label} representa ${formatPercentage(s.largest.percentage)} dos gastos estimados.`);
  if (s.smallest && s.smallest.id !== s.largest?.id) notes.push(`${s.smallest.label} é a menor categoria com gasto positivo informado: ${formatMoney(s.smallest.total)}.`);
  const tickets = s.categories[0], lodging = s.categories[1];
  if (tickets.considered && lodging.considered && s.subtotal > 0) notes.push(`Passagens e hospedagem juntas representam ${formatPercentage((tickets.total + lodging.total) / s.subtotal * 100)} dos gastos estimados.`);
  if (s.reserve > 0) notes.push(`Você reservou ${formatMoney(s.reserve)} para imprevistos, além dos gastos previstos${s.reservePercentage === null ? "" : ` (${formatPercentage(s.reservePercentage)} do total planejado)`}.`);
  if (s.budgetRemaining !== null) notes.push(s.budgetRemaining < 0 ? `Seu total planejado ultrapassa o orçamento informado em ${formatMoney(-s.budgetRemaining)}.` : `Seu orçamento informado supera o total planejado em ${formatMoney(s.budgetRemaining)}.`);
  return notes;
}
export function tripComparisonInsights(r: TripResult): string[] {
  const notes: string[] = [];
  if (r.differentGroups) notes.push(differentGroupsNote);
  if (r.scenarios.length === 2) {
    const [a,b] = r.scenarios;
    if (a.total === b.total) notes.push("Os destinos possuem o mesmo custo total planejado, considerando os valores informados.");
    else { const low = a.total < b.total ? a : b, high = a.total < b.total ? b : a; notes.push(`${low.name} tem um total planejado ${formatMoney(high.total - low.total)} menor que ${high.name}, considerando somente os gastos informados.`); }
    if (a.categories[0].considered && b.categories[0].considered) {
      const low = a.categories[0].total < b.categories[0].total ? a : b, high = low === a ? b : a;
      if (low.categories[0].total < high.categories[0].total && low.total > high.total) notes.push(`Embora a passagem para ${low.name} custe ${formatMoney(high.categories[0].total - low.categories[0].total)} a menos, o total planejado da viagem é ${formatMoney(low.total - high.total)} maior, considerando os gastos informados.`);
    }
  }
  return notes;
}

export const differentUnitsNote = "Atenção: alguns gastos foram calculados em unidades diferentes entre os destinos. Confira os valores antes de comparar os totais.";
export function tripFinancialDifferences(r: TripResult): string[] {
  const first = r.scenarios[0];
  return r.scenarios.slice(1).flatMap(s => ([
    ["Total planejado", "total"], ["Custo por pessoa", "perPerson"], ["Custo médio por dia", "perDay"],
  ] as const).map(([label, key]) => `${label}: ${s.name} ${s[key] === first[key] ? `tem o mesmo valor que ${first.name}` : `tem ${formatMoney(Math.abs(s[key] - first[key]))} ${s[key] > first[key] ? "a mais" : "a menos"} que ${first.name}`}.`));
}

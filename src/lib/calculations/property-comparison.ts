import { assertMoney, formatMoney } from "../money";
import { toMonthlyCents, type Period } from "./cost-of-living";

export const includedItems = [
  { id: "water", label: "Água", group: "Despesa" }, { id: "gas", label: "Gás", group: "Despesa" },
  { id: "electricity", label: "Energia", group: "Despesa" }, { id: "internet", label: "Internet", group: "Despesa" },
  { id: "tax", label: "IPTU", group: "Despesa" }, { id: "garage", label: "Garagem/estacionamento", group: "Despesa" },
  { id: "gym", label: "Academia", group: "Serviço" }, { id: "laundry", label: "Lavanderia", group: "Serviço" },
  { id: "coworking", label: "Coworking", group: "Serviço" },
] as const;
export const transportItems = ["Combustível", "Transporte público", "Aplicativo/táxi", "Estacionamento no destino", "Pedágios", "Outros custos de transporte"];
export const foodItems = ["Almoço fora", "Café da manhã fora", "Lanches", "Delivery", "Outras refeições da rotina"];
export type Cost = { id: string; name: string; cents: number; period: Period };
export type Amenity = { id: string; label: string; group: string };
export type ExpensePeriod = Period | "once";
export const periodLabels: Record<ExpensePeriod, string> = { monthly: "Mensal", annual: "Anual", once: "Único" };
export function defaultImpactPeriod(id: string): ExpensePeriod | null {
  return id.startsWith("custom-") ? null : id === "tax" ? "annual" : "monthly";
}
export function differenceCopy(item: Amenity, included: string, missing: string) {
  const known: Record<string, [string, string]> = {
    water: ["A água", `Você pagaria água separadamente no ${missing}?`],
    gas: ["O gás", `Você pagaria gás separadamente no ${missing}?`],
    electricity: ["A energia", `Você pagaria energia separadamente no ${missing}?`],
    internet: ["A internet", `Você precisaria contratar internet separadamente no ${missing}?`],
    tax: ["O IPTU", `Você pagaria IPTU separadamente no ${missing}?`],
    garage: ["Garagem/estacionamento", `Você precisaria pagar por garagem ou estacionamento residencial no ${missing}?`],
    gym: ["academia", `Você contrataria uma academia separadamente no cenário do ${missing}?`],
    laundry: ["lavanderia", `Você teria algum gasto com lavanderia no cenário do ${missing}?`],
    coworking: ["coworking", `Você contrataria um espaço de trabalho separadamente no cenário do ${missing}?`],
  };
  const copy = known[item.id];
  if (!copy) return { statement: `O ${included} possui “${item.label}”, mas o ${missing} não.`, question: `Você teria algum gasto para contratar ou comprar este item no ${missing}?` };
  const statement = item.id === "garage" ? `O ${included} possui garagem/estacionamento incluído, mas o ${missing} não.` : item.group === "Serviço" ? `O ${included} possui ${copy[0]}, mas o ${missing} não.` : `${copy[0]} está incluíd${item.id === "gas" || item.id === "tax" ? "o" : "a"} no ${included}, mas não no ${missing}.`;
  return { statement, question: copy[1] };
}
export type Property = {
  name: string; kind: "rent" | "loan" | "other"; main: number; condo: number; tax: number; taxPeriod: ExpensePeriod;
  garage: number; garagePeriod?: ExpensePeriod; included: string[]; costs: Cost[]; transport: Cost[]; food: Cost[]; other: Cost[];
  commute: { outward: number; return: number; days: number };
};
// Ausência de period mantém o significado mensal das simulações v1; null exige escolha.
export type Impact = { applies: boolean | null; cents: number; period?: ExpensePeriod | null };
export type Comparison = { properties: [Property, Property]; amenities: Amenity[]; impacts: Record<string, Impact> };
export function emptyProperty(): Property {
  return { name: "", kind: "rent", main: 0, condo: 0, tax: 0, taxPeriod: "annual", garage: 0, included: [], costs: [], transport: [], food: [], other: [], commute: { outward: 0, return: 0, days: 0 } };
}
export function emptyComparison(): Comparison { return { properties: [emptyProperty(), emptyProperty()], amenities: [...includedItems], impacts: {} }; }
export function propertyName(property: Property, index: number) { return property.name.trim() || `Imóvel ${index === 0 ? "A" : "B"}`; }
export function relevantDifferences(input: Comparison) {
  return input.amenities.flatMap(item => {
    const a = input.properties[0].included.includes(item.id), b = input.properties[1].included.includes(item.id);
    return a === b ? [] : [{ ...item, includedIn: a ? 0 : 1, missingIn: a ? 1 : 0 }];
  });
}
export function addCustomAmenity(input: Comparison, id: string, label: string): Comparison {
  const name = label.trim();
  if (!name || name.length > 80 || !id.startsWith("custom-") || input.amenities.length >= 50 || input.amenities.some(a => a.id === id || a.label.trim().toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) return input;
  return { ...input, amenities: [...input.amenities, { id, label: name, group: "Serviço" }] };
}
export function removeCustomAmenity(input: Comparison, id: string): Comparison {
  if (!id.startsWith("custom-")) return input;
  return {
    ...input,
    amenities: input.amenities.filter(a => a.id !== id),
    properties: input.properties.map(p => ({ ...p, included: p.included.filter(item => item !== id) })) as Comparison["properties"],
    impacts: Object.fromEntries(Object.entries(input.impacts).filter(([key]) => key !== `${id}:0` && key !== `${id}:1`)),
  };
}
export function calculateCommute(commute: Property["commute"]) {
  const { outward, return: back, days } = commute;
  if (![outward, back, days].every(Number.isFinite) || outward < 0 || back < 0 || outward > 1440 || back > 1440 || days < 0 || days > 7) throw new Error("Deslocamento inválido: use minutos de 0 a 1440 e dias de 0 a 7.");
  const weekly = (outward + back) * days / 60;
  return { weekly, monthly: weekly * 52 / 12, annual: weekly * 52 };
}
export function validateComparison(input: Comparison) {
  if (!input || !Array.isArray(input.properties) || input.properties.length !== 2 || !Array.isArray(input.amenities) || !input.impacts) throw new Error("Comparação inválida.");
  if (input.amenities.length > 50 || new Set(input.amenities.map(a => a.id)).size !== input.amenities.length) throw new Error("Checklist inválido.");
  input.amenities.forEach(a => { if (typeof a.id !== "string" || typeof a.label !== "string" || typeof a.group !== "string" || a.label.length > 80) throw new Error("Item inválido."); });
  input.properties.forEach(p => {
    if (typeof p.name !== "string" || p.name.length > 80 || !["rent", "loan", "other"].includes(p.kind) || !Array.isArray(p.included) || new Set(p.included).size !== p.included.length || p.included.some(id => !input.amenities.some(a => a.id === id))) throw new Error("Imóvel inválido.");
    [p.main, p.condo, p.tax, p.garage].forEach(assertMoney);
    if (!["monthly", "annual", "once"].includes(p.taxPeriod) || (p.garagePeriod !== undefined && !["monthly", "annual", "once"].includes(p.garagePeriod))) throw new Error("Periodicidade inválida.");
    [p.costs, p.transport, p.food, p.other].forEach(list => {
      if (!Array.isArray(list) || list.length > 50) throw new Error("Lista de custos inválida.");
      list.forEach(c => { if (typeof c.id !== "string" || typeof c.name !== "string" || c.name.length > 80) throw new Error("Custo inválido."); toMonthlyCents(c.cents, c.period); });
    });
    calculateCommute(p.commute);
  });
  Object.values(input.impacts).forEach(i => { if (![true, false, null].includes(i.applies) || (i.period != null && !["monthly", "annual", "once"].includes(i.period))) throw new Error("Impacto inválido."); assertMoney(i.cents); });
}
export type Detail = { category: string; item: string; a: number; b: number; uniqueA: number; uniqueB: number; periodA: ExpensePeriod; periodB: ExpensePeriod; informedA: number; informedB: number };
export function calculateComparison(input: Comparison) {
  validateComparison(input);
  const differences = relevantDifferences(input);
  const details: Detail[] = [];
  function row(category: string, item: string, a: number, b: number, periodA: ExpensePeriod = "monthly", periodB: ExpensePeriod = "monthly") {
    details.push({ category, item, a: periodA === "once" ? 0 : toMonthlyCents(a, periodA), b: periodB === "once" ? 0 : toMonthlyCents(b, periodB), uniqueA: periodA === "once" ? a : 0, uniqueB: periodB === "once" ? b : 0, periodA, periodB, informedA: a, informedB: b });
  }
  const [a, b] = input.properties;
  row("Moradia", "Custo principal", a.main, b.main); row("Moradia", "Condomínio", a.condo, b.condo);
  row("Moradia", "IPTU", a.included.includes("tax") ? 0 : a.tax, b.included.includes("tax") ? 0 : b.tax, a.taxPeriod, b.taxPeriod);
  const categories = { costs: "Moradia", transport: "Transporte", food: "Alimentação relacionada", other: "Outros" };
  for (const key of Object.keys(categories) as (keyof typeof categories)[]) {
    // Itens de mesmo nome são agrupados para comparar; nomes personalizados nunca viram fórmulas na exportação.
    const names = new Set([...a[key], ...b[key]].map(c => c.name.trim() || "Custo personalizado"));
    names.forEach(name => {
      const left = a[key].filter(c => (c.name.trim() || "Custo personalizado") === name), right = b[key].filter(c => (c.name.trim() || "Custo personalizado") === name);
      // Mantém periodicidades e valores originais em linhas individuais quando necessário.
      for (let i = 0; i < Math.max(left.length, right.length); i++) row(categories[key], name, left[i]?.cents ?? 0, right[i]?.cents ?? 0, left[i]?.period ?? "monthly", right[i]?.period ?? "monthly");
    });
  }
  differences.forEach(d => {
    if (d.id === "tax") return; // IPTU compartilha o valor dos custos diretos.
    if (d.id === "garage") {
      // Preserva o valor salvo no formato v1 e conta apenas a diferença ativa.
      const impact = input.impacts[`garage:${d.missingIn}`];
      const cents = input.properties[d.missingIn].garage;
      const period = input.properties[d.missingIn].garagePeriod ?? "monthly";
      if (impact?.applies !== false && (impact?.applies === true || cents > 0)) row("Custos adicionais", "Garagem residencial", d.missingIn === 0 ? cents : 0, d.missingIn === 1 ? cents : 0, period, period);
      return;
    }
    const impact = input.impacts[`${d.id}:${d.missingIn}`];
    if (impact?.applies === true) {
      if (impact.period === null) throw new Error(`Escolha se o gasto com ${d.label} seria mensal, anual ou uma única vez.`);
      const period = impact.period ?? "monthly";
      row("Custos adicionais", d.label, d.missingIn === 0 ? impact.cents : 0, d.missingIn === 1 ? impact.cents : 0, period, period);
    }
  });
  const scenarios = input.properties.map((p, index) => {
    const sum = (category: string) => details.filter(d => d.category === category).reduce((total, d) => total + (index === 0 ? d.a : d.b), 0);
    const direct = sum("Moradia"), additional = sum("Custos adicionais"), transport = sum("Transporte"), food = sum("Alimentação relacionada"), other = sum("Outros");
    const total = direct + additional + transport + food + other;
    const unique = details.reduce((sum, d) => sum + (index === 0 ? d.uniqueA : d.uniqueB), 0);
    if (!Number.isSafeInteger(unique)) throw new Error("Custos únicos fora do intervalo seguro.");
    if (!Number.isSafeInteger(total * 12)) throw new Error("Total anual fora do intervalo seguro.");
    return { name: propertyName(p, index), direct, additional, transport, food, other, total, annual: total * 12, unique, commute: calculateCommute(p.commute), included: input.amenities.filter(i => p.included.includes(i.id)).map(i => i.label), categories: [{ label: "Moradia", cents: direct }, { label: "Custos adicionais", cents: additional }, { label: "Transporte", cents: transport }, { label: "Alimentação relacionada", cents: food }, { label: "Outros", cents: other }] };
  });
  const unanswered = differences.filter(d => d.id !== "tax" && d.id !== "garage" && input.impacts[`${d.id}:${d.missingIn}`]?.applies == null).map(d => d.label);
  const monthly = scenarios[1].total - scenarios[0].total, unique = scenarios[1].unique - scenarios[0].unique;
  const breakEven = unique !== 0 && monthly !== 0 && Math.sign(unique) !== Math.sign(monthly) ? { months: Math.abs(unique) / Math.abs(monthly), initialDifference: Math.abs(unique), monthlySaving: Math.abs(monthly), scenario: unique > 0 ? 1 : 0 } : null;
  return { scenarios, details, differences, unanswered, breakEven, delta: { direct: scenarios[1].direct - scenarios[0].direct, monthly, annual: scenarios[1].annual - scenarios[0].annual, unique, time: scenarios[1].commute.monthly - scenarios[0].commute.monthly } };
}
export type ComparisonResult = ReturnType<typeof calculateComparison>;
export const breakEvenNote = "Este cálculo compara apenas a diferença de custos únicos com a diferença recorrente mensal e considera os valores informados constantes.";
export function breakEvenText(result: ComparisonResult) {
  const value = result.breakEven;
  return value ? `${result.scenarios[value.scenario].name} exige ${formatMoney(value.initialDifference)} a mais inicialmente, mas possui um custo recorrente de ${formatMoney(value.monthlySaving)} a menos por mês.\n\nMantendo os valores informados constantes, essa diferença inicial seria compensada pela economia recorrente em aproximadamente ${value.months.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} meses.` : "";
}
export const comparisonNotes = ["Custos únicos são separados: não têm equivalente mensal e não entram no total anual recorrente nem na distribuição mensal.", breakEvenNote, "Valores anuais ÷ 12, arredondados ao centavo mais próximo (metade para cima). O total anual repete o mês por 12 e pode diferir até R$ 0,06 por item do anual informado.", "Deslocamento: (ida + volta) × dias por semana ÷ 60. São usadas 52 semanas por ano e 52/12 por mês, sem descontar férias ou feriados.", "Tempo não é convertido em dinheiro. Inclua apenas gastos que mudam entre os imóveis; custos comuns omitidos não fazem parte do total.", "IPTU e garagem incluídos não são somados separadamente. Confira se custos personalizados repetem despesas já preenchidas.", "Estimativas informativas baseadas nos seus valores, sem médias de mercado, reajustes, custos de mudança ou recomendação de imóvel."];

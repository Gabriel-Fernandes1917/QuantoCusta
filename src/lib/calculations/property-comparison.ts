import { assertMoney } from "../money";
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
export type Property = {
  name: string; kind: "rent" | "loan" | "other"; main: number; condo: number; tax: number; taxPeriod: Period;
  garage: number; included: string[]; costs: Cost[]; transport: Cost[]; food: Cost[]; other: Cost[];
  commute: { outward: number; return: number; days: number };
};
export type Impact = { applies: boolean | null; cents: number };
export type Comparison = { properties: [Property, Property]; amenities: Amenity[]; impacts: Record<string, Impact> };
export function emptyProperty(): Property {
  return { name: "", kind: "rent", main: 0, condo: 0, tax: 0, taxPeriod: "monthly", garage: 0, included: [], costs: [], transport: [], food: [], other: [], commute: { outward: 0, return: 0, days: 0 } };
}
export function emptyComparison(): Comparison { return { properties: [emptyProperty(), emptyProperty()], amenities: [...includedItems], impacts: {} }; }
export function propertyName(property: Property, index: number) { return property.name.trim() || `Imóvel ${index === 0 ? "A" : "B"}`; }
export function relevantDifferences(input: Comparison) {
  return input.amenities.flatMap(item => {
    const a = input.properties[0].included.includes(item.id), b = input.properties[1].included.includes(item.id);
    return a === b ? [] : [{ ...item, includedIn: a ? 0 : 1, missingIn: a ? 1 : 0 }];
  });
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
    if (typeof p.name !== "string" || p.name.length > 80 || !["rent", "loan", "other"].includes(p.kind) || !Array.isArray(p.included) || p.included.some(id => !input.amenities.some(a => a.id === id))) throw new Error("Imóvel inválido.");
    [p.main, p.condo, p.tax, p.garage].forEach(assertMoney); toMonthlyCents(p.tax, p.taxPeriod);
    [p.costs, p.transport, p.food, p.other].forEach(list => {
      if (!Array.isArray(list) || list.length > 50) throw new Error("Lista de custos inválida.");
      list.forEach(c => { if (typeof c.id !== "string" || typeof c.name !== "string" || c.name.length > 80) throw new Error("Custo inválido."); toMonthlyCents(c.cents, c.period); });
    });
    calculateCommute(p.commute);
  });
  Object.values(input.impacts).forEach(i => { if (![true, false, null].includes(i.applies)) throw new Error("Impacto inválido."); assertMoney(i.cents); });
}
export type Detail = { category: string; item: string; a: number; b: number; periodA: Period; periodB: Period; informedA: number; informedB: number };
export function calculateComparison(input: Comparison) {
  validateComparison(input);
  const differences = relevantDifferences(input);
  const details: Detail[] = [];
  function row(category: string, item: string, a: number, b: number, periodA: Period = "monthly", periodB: Period = "monthly") {
    details.push({ category, item, a: toMonthlyCents(a, periodA), b: toMonthlyCents(b, periodB), periodA, periodB, informedA: a, informedB: b });
  }
  const [a, b] = input.properties;
  row("Moradia", "Custo principal", a.main, b.main); row("Moradia", "Condomínio", a.condo, b.condo);
  row("Moradia", "IPTU", a.included.includes("tax") ? 0 : a.tax, b.included.includes("tax") ? 0 : b.tax, a.taxPeriod, b.taxPeriod);
  row("Moradia", "Garagem residencial", a.included.includes("garage") ? 0 : a.garage, b.included.includes("garage") ? 0 : b.garage);
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
    if (d.id === "tax" || d.id === "garage") return; // Fonte única: campos diretos, também revelados pelo checklist.
    const impact = input.impacts[`${d.id}:${d.missingIn}`];
    if (impact?.applies === true) row("Custos adicionais", d.label, d.missingIn === 0 ? impact.cents : 0, d.missingIn === 1 ? impact.cents : 0);
  });
  const scenarios = input.properties.map((p, index) => {
    const sum = (category: string) => details.filter(d => d.category === category).reduce((total, d) => total + (index === 0 ? d.a : d.b), 0);
    const direct = sum("Moradia"), additional = sum("Custos adicionais"), transport = sum("Transporte"), food = sum("Alimentação relacionada"), other = sum("Outros");
    const total = direct + additional + transport + food + other;
    if (!Number.isSafeInteger(total * 12)) throw new Error("Total anual fora do intervalo seguro.");
    return { name: propertyName(p, index), direct, additional, transport, food, other, total, annual: total * 12, commute: calculateCommute(p.commute), included: input.amenities.filter(i => p.included.includes(i.id)).map(i => i.label), categories: [{ label: "Moradia", cents: direct }, { label: "Custos adicionais", cents: additional }, { label: "Transporte", cents: transport }, { label: "Alimentação relacionada", cents: food }, { label: "Outros", cents: other }] };
  });
  const unanswered = differences.filter(d => d.id !== "tax" && d.id !== "garage" && input.impacts[`${d.id}:${d.missingIn}`]?.applies == null).map(d => d.label);
  return { scenarios, details, differences, unanswered, delta: { direct: scenarios[1].direct - scenarios[0].direct, monthly: scenarios[1].total - scenarios[0].total, annual: scenarios[1].annual - scenarios[0].annual, time: scenarios[1].commute.monthly - scenarios[0].commute.monthly } };
}
export type ComparisonResult = ReturnType<typeof calculateComparison>;
export const comparisonNotes = ["Valores anuais ÷ 12, arredondados ao centavo mais próximo (metade para cima). O total anual repete o mês por 12 e pode diferir até R$ 0,06 por item do anual informado.", "Deslocamento: (ida + volta) × dias por semana ÷ 60. São usadas 52 semanas por ano e 52/12 por mês, sem descontar férias ou feriados.", "Tempo não é convertido em dinheiro. Inclua apenas gastos que mudam entre os imóveis; custos comuns omitidos não fazem parte do total.", "IPTU e garagem incluídos não são somados separadamente. Confira se custos personalizados repetem despesas já preenchidas.", "Estimativas informativas baseadas nos seus valores, sem médias de mercado, reajustes, custos de mudança ou recomendação de imóvel."];

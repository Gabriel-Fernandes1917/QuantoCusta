import { assertMoney, formatMoney, formatPercentage, parseMoney } from "../money";

export const units = ["g", "kg", "ml", "L", "unit"] as const;
export type Unit = typeof units[number];
export const unitLabels: Record<Unit, string> = { g: "g", kg: "kg", ml: "ml", L: "L", unit: "unidade" };
const unitInfo: Record<Unit, { family: string; factor: bigint }> = {
  g: { family: "mass", factor: BigInt(1) }, kg: { family: "mass", factor: BigInt(1000) },
  ml: { family: "volume", factor: BigInt(1) }, L: { family: "volume", factor: BigInt(1000) }, unit: { family: "count", factor: BigInt(1) },
};
export type Ingredient = { id: string; name: string; used: number | null; usedUnit: Unit; price: number | null; bought: number | null; boughtUnit: Unit };
export type Meal = { id: string; name: string; enabled: boolean; frequency: number | null; ingredients: Ingredient[]; outside: number | null };
export type MealRoutine = { meals: Meal[]; preparation: { gas: number; electricity: number; other: number }; time: { shopping: number; cooking: number; cleaning: number; outside: number } };
export function emptyMeal(id: string, name: string): Meal { return { id, name, enabled: false, frequency: null, ingredients: [], outside: null }; }
export function emptyIngredient(id: string): Ingredient { return { id, name: "", used: null, usedUnit: "g", price: null, bought: null, boughtUnit: "g" }; }
export function emptyMealRoutine(): MealRoutine {
  return { meals: ["Café da manhã", "Almoço", "Lanche", "Jantar"].map((name, i) => emptyMeal(`meal-${i}`, name)), preparation: { gas: 0, electricity: 0, other: 0 }, time: { shopping: 0, cooking: 0, cleaning: 0, outside: 0 } };
}
// Quantidades têm até seis casas decimais. A proporção monetária usa inteiros BigInt.
function quantity(value: number): bigint {
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000 || !/^\d+(?:\.\d{1,6})?$/.test(String(value))) throw new Error("Informe uma quantidade de 0 a 1 bilhão, com até seis casas decimais.");
  const [whole, fraction = ""] = String(value).split(".");
  return BigInt(whole) * BigInt(1_000_000) + BigInt(fraction.padEnd(6, "0"));
}
export function parseQuantity(text: string): number {
  const clean = text.trim();
  if (!clean) return 0;
  if (!/^\d+(?:[.,]\d{1,6})?$/.test(clean)) throw new Error("Use uma quantidade positiva, como 200 ou 1,5, com até seis casas decimais.");
  const value = Number(clean.replace(",", ".")); quantity(value); return value;
}
export function parseMealValue(text: string | null | undefined, monetary: boolean, optional = false): number | null {
  if (!text?.trim()) return optional ? 0 : null;
  // parseMoney é compartilhado com as outras calculadoras; sua regra não é alterada.
  return monetary ? parseMoney(text) : parseQuantity(text);
}
function rounded(numerator: bigint, denominator: bigint): number {
  if (denominator <= BigInt(0)) throw new Error("A quantidade comprada deve ser maior que zero.");
  const result = (numerator * BigInt(2) + denominator) / (denominator * BigInt(2));
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Total fora do intervalo seguro. Reduza os valores informados.");
  return Number(result);
}
export function compatibleUnits(a: Unit, b: Unit): boolean { return !!unitInfo[a] && !!unitInfo[b] && unitInfo[a].family === unitInfo[b].family; }
export function convertQuantity(value: number, from: Unit, to: Unit): number {
  if (!compatibleUnits(from, to)) throw new Error("Use unidades compatíveis: massa com massa, volume com volume ou unidades com unidades.");
  return Number(quantity(value) * unitInfo[from].factor) / Number(BigInt(1_000_000) * unitInfo[to].factor);
}
export function ingredientCost(item: Ingredient): number {
  if (item.used == null || item.price == null || item.bought == null) throw new Error(`Complete as quantidades e o preço de ${item.name || "o item"}.`);
  assertMoney(item.price);
  const used = quantity(item.used), bought = quantity(item.bought);
  if (!compatibleUnits(item.usedUnit, item.boughtUnit)) throw new Error(`Confira as unidades de ${item.name || "item"}: elas precisam ser compatíveis.`);
  if (bought === BigInt(0)) throw new Error(`Informe uma quantidade comprada maior que zero para ${item.name || "o item"}.`);
  return rounded(BigInt(item.price) * used * unitInfo[item.usedUnit].factor, bought * unitInfo[item.boughtUnit].factor);
}
function safeSum(values: number[]): number { const total = values.reduce((a, b) => a + b, 0); if (!Number.isSafeInteger(total)) throw new Error("Total fora do intervalo seguro."); return total; }
export function homeMealCost(items: Ingredient[]): number { if (!items.length) throw new Error("Adicione os itens utilizados para calcular o custo em casa."); return safeSum(items.map(ingredientCost)); }
export function outsideMealCost(meal: Meal): number { if (meal.outside == null) throw new Error("Informe quanto custa comprar esta refeição fora para compará-la."); assertMoney(meal.outside); return meal.outside; }
export function frequencyCost(cents: number, frequency: number, period: "weekly" | "monthly" | "annual"): number {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Custo inválido.");
  const count = quantity(frequency); if (frequency > 1000) throw new Error("Informe uma frequência de 0 a 1.000 vezes por semana.");
  return rounded(BigInt(cents) * count * (period === "weekly" ? BigInt(1) : BigInt(52)), BigInt(1_000_000) * (period === "monthly" ? BigInt(12) : BigInt(1)));
}
export function preparationCost(preparation: MealRoutine["preparation"]) { Object.values(preparation).forEach(assertMoney); return safeSum(Object.values(preparation)); }
export function calculateMealTime(time: MealRoutine["time"]) {
  [time.shopping, time.cooking, time.cleaning, time.outside].forEach(value => { quantity(value); if (value > 168) throw new Error("Informe até 168 horas por semana em cada campo de tempo."); });
  const home = time.shopping + time.cooking + time.cleaning;
  if (home > 168) throw new Error("O tempo total em casa não pode exceder 168 horas por semana.");
  const periods = (weekly: number) => ({ weekly, monthly: weekly * 52 / 12, annual: weekly * 52 });
  return { home: periods(home), outside: periods(time.outside), delta: periods(time.outside - home) };
}
export function validateMealRoutine(input: MealRoutine) {
  if (!input || !Array.isArray(input.meals) || input.meals.length > 20 || !input.preparation || !input.time) throw new Error("Rotina inválida.");
  const ids = new Set<string>();
  const name = (value: string) => { if (typeof value !== "string" || value.length > 80) throw new Error("Nome inválido: use até 80 caracteres."); };
  const id = (value: string) => { if (typeof value !== "string" || !value || value.length > 100 || ids.has(value)) throw new Error("Identificador inválido ou repetido."); ids.add(value); };
  input.meals.forEach(meal => {
    id(meal.id); name(meal.name);
    if (typeof meal.enabled !== "boolean" || !Array.isArray(meal.ingredients) || meal.ingredients.length > 50) throw new Error("Refeição inválida.");
    if (meal.frequency != null) { quantity(meal.frequency); if (meal.frequency > 1000) throw new Error("Frequência inválida."); }
    if (meal.outside != null) assertMoney(meal.outside);
    meal.ingredients.forEach(item => { id(item.id); name(item.name); if (item.used != null) quantity(item.used); if (item.bought != null) quantity(item.bought); if (item.price != null) assertMoney(item.price); if (!units.includes(item.usedUnit) || !units.includes(item.boughtUnit)) throw new Error("Unidade inválida."); });
  });
  [input.preparation.gas, input.preparation.electricity, input.preparation.other].forEach(assertMoney);
  calculateMealTime(input.time);
}
export function removeIngredient(input: MealRoutine, mealId: string, itemId: string): MealRoutine { return { ...input, meals: input.meals.map(m => m.id === mealId ? { ...m, ingredients: m.ingredients.filter(i => i.id !== itemId) } : m) }; }
export function removeMeal(input: MealRoutine, id: string): MealRoutine { return { ...input, meals: input.meals.filter(m => m.id !== id) }; }
export function mealIssues(meal: Meal): Record<string, string> {
  const issues: Record<string, string> = {};
  if (meal.frequency == null) issues[`${meal.id}-frequency`] = "Informe a frequência semanal desta refeição.";
  if (meal.outside == null) issues[`${meal.id}-outside`] = "Informe quanto custa comprar esta refeição fora para compará-la.";
  if (!meal.ingredients.length) issues[`${meal.id}-items`] = "Adicione os itens utilizados nesta refeição para calcular o custo em casa.";
  meal.ingredients.forEach(item => {
    if (item.used == null) issues[`${item.id}-used`] = "Informe a quantidade utilizada na refeição.";
    if (item.price == null) issues[`${item.id}-price`] = "Informe o preço pago pela compra.";
    if (item.bought == null || item.bought === 0) issues[`${item.id}-bought`] = "Informe uma quantidade comprada maior que zero.";
    if (!compatibleUnits(item.usedUnit, item.boughtUnit)) issues[`${item.id}-bought-unit`] = "Use uma unidade compatível com a quantidade utilizada.";
  });
  return issues;
}
export function calculateMealRoutine(input: MealRoutine) {
  validateMealRoutine(input);
  const incomplete = input.meals.filter(m => m.enabled).map(m => ({ id: m.id, name: m.name || "Refeição sem nome", issues: mealIssues(m) })).filter(m => Object.keys(m.issues).length);
  const meals = input.meals.filter(m => m.enabled && !incomplete.some(missing => missing.id === m.id)).map((meal, i) => {
    const frequency = meal.frequency!;
    const home = homeMealCost(meal.ingredients), outside = outsideMealCost(meal);
    const costs = (cents: number) => ({ portion: cents, weekly: frequencyCost(cents, frequency, "weekly"), monthly: frequencyCost(cents, frequency, "monthly"), annual: frequencyCost(cents, frequency, "annual") });
    const a = costs(home), b = costs(outside);
    return { id: meal.id, name: meal.name.trim() || `Refeição ${i + 1}`, frequency, home: a, outside: b, delta: { portion: b.portion - a.portion, weekly: b.weekly - a.weekly, monthly: b.monthly - a.monthly, annual: b.annual - a.annual }, ingredients: meal.ingredients.map(item => ({ ...item, used: item.used!, bought: item.bought!, price: item.price!, cost: ingredientCost(item) })) };
  });
  const foodHome = safeSum(meals.map(m => m.home.monthly)), foodOutside = safeSum(meals.map(m => m.outside.monthly));
  const preparation = preparationCost(input.preparation), preparationAnnual = safeSum([preparation * 12]);
  const homeMonthly = safeSum([foodHome, preparation]), outsideMonthly = foodOutside;
  const homeAnnual = safeSum([...meals.map(m => m.home.annual), preparationAnnual]), outsideAnnual = safeSum(meals.map(m => m.outside.annual));
  const distribution = meals.map(m => ({ id: m.id, name: m.name, home: foodHome ? m.home.monthly / foodHome * 100 : null, outside: foodOutside ? m.outside.monthly / foodOutside * 100 : null }));
  const active = meals.filter(m => m.frequency > 0);
  const matching = (value: (m: typeof meals[number]) => number, maximum: boolean) => { if (!active.length) return []; const target = (maximum ? Math.max : Math.min)(...active.map(value)); return active.filter(m => value(m) === target).map(m => m.id); };
  return { meals, incomplete, foodHome, foodOutside, preparation, preparationDetails: { ...input.preparation }, homeMonthly, outsideMonthly, homeAnnual, outsideAnnual, delta: { monthly: outsideMonthly - homeMonthly, annual: outsideAnnual - homeAnnual }, time: calculateMealTime(input.time), timeDetails: { ...input.time }, distribution, insights: { highestHome: foodHome ? matching(m => m.home.monthly, true) : [], largestDifference: matching(m => Math.abs(m.delta.monthly), true), smallestDifference: matching(m => Math.abs(m.delta.monthly), false) } };
}
export type MealResult = ReturnType<typeof calculateMealRoutine>;
export function mealDifferenceText(home: number, outside: number, period = ""): string {
  const delta = outside - home;
  return delta === 0 ? `Os dois cenários possuem o mesmo custo${period ? " mensal" : ""} informado.` : `${delta > 0 ? "Preparar em casa" : "Comprar fora"} custa ${formatMoney(Math.abs(delta))} a menos${period ? ` ${period}` : ""} do que ${delta > 0 ? "comprar fora" : "preparar em casa"}.`;
}
export function mealTimeDifferenceText(homeMonthly: number, outsideMonthly: number): string {
  const delta = outsideMonthly - homeMonthly;
  if (Math.abs(delta) < 1e-9) return "Os dois cenários possuem o mesmo tempo mensal informado.";
  return `${delta > 0 ? "Comprar fora" : "Preparar em casa"} exige ${Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} horas a mais por mês, considerando os tempos informados.`;
}
export function quantityUnitLabel(value: number, unit: Unit): string { return unit === "unit" ? value === 1 ? "unidade" : "unidades" : unitLabels[unit]; }
export function ingredientQuantityText(value: number, unit: Unit, used = false): string {
  const label = quantityUnitLabel(value, unit);
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 6 })} ${label}${used ? unit === "unit" ? value === 1 ? " utilizada" : " utilizadas" : " utilizados" : ""}`;
}
export function ingredientDetailText(item: Ingredient & { cost: number }): string {
  if (item.used == null || item.bought == null || item.price == null) throw new Error("Item incompleto.");
  return `${item.name || "Item sem nome"}: ${ingredientQuantityText(item.used, item.usedUnit, true)}; compra de ${ingredientQuantityText(item.bought, item.boughtUnit)} por ${formatMoney(item.price)}; custo proporcional ${formatMoney(item.cost)}.`;
}
export function mealInsights(result: MealResult): string[] {
  if (result.meals.length === 1) {
    const meal = result.meals[0];
    return [`Diferença entre as opções\n${meal.name}: ${mealDifferenceText(meal.home.monthly, meal.outside.monthly, "por mês").replace(/^./, c => c.toLocaleLowerCase("pt-BR"))}`];
  }
  const names = (ids: string[]) => result.meals.filter(m => ids.includes(m.id)).map(m => m.name).join(", ");
  const insights: string[] = [];
  if (result.insights.highestHome.length) insights.push(`${names(result.insights.highestHome)} ${result.insights.highestHome.length > 1 ? "empatam como as refeições que mais pesam" : "é a refeição que mais pesa"} no custo mensal dos alimentos preparados em casa.`);
  for (const [key, label] of [["largestDifference", "Maior"], ["smallestDifference", "Menor"]] as const) {
    const ids = result.insights[key];
    if (ids.length) insights.push(`${label} diferença entre as opções\n${result.meals.filter(m => ids.includes(m.id)).map(m => `${m.name}: ${mealDifferenceText(m.home.monthly, m.outside.monthly, "por mês").replace(/^./, c => c.toLocaleLowerCase("pt-BR"))}`).join("\n")}`);
  }
  result.distribution.filter(d => d.home !== null && d.home > 0).forEach(d => insights.push(`${d.name} representa ${formatPercentage(d.home!)} do custo mensal dos alimentos preparados em casa.`));
  return insights;
}
export const mealNotes = [
  "A mesma frequência semanal é aplicada aos cenários em casa e fora. São usadas 52 semanas por ano e 52/12 semanas por mês, sem descontar férias ou feriados.",
  "O custo proporcional de cada item é arredondado ao centavo mais próximo, com metade para cima. Custos semanais, mensais e anuais de cada refeição são arredondados separadamente; o anual pode diferir alguns centavos do mensal × 12.",
  "Gás, energia e outros custos de preparo são estimativas mensais adicionais. Entram apenas no total geral em casa, sem divisão entre refeições. Não inclua despesas que existiriam mesmo sem cozinhar.",
  "A distribuição percentual considera somente alimentos/refeições, sem custos adicionais de preparo. Maior e menor diferença comparam o tamanho da diferença mensal e sempre indicam qual cenário custa mais. Empates são apresentados juntos.",
  "Tempo informado é separado do dinheiro e não recebe valor monetário. Custos de preparo e tempo são opcionais. Campos essenciais vazios são não informados; zero digitado é preservado. Refeições incompletas ficam fora da comparação até seus dados serem preenchidos.",
  "O QuantoCusta compara apenas custos e tempos informados. A ferramenta não avalia aspectos nutricionais das refeições.",
  "Estimativas informativas baseadas exclusivamente nos valores informados, sem médias de mercado, receitas ou recomendações financeiras.",
];

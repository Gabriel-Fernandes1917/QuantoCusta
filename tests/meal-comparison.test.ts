import { describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import { calculateMealRoutine, calculateMealTime, compatibleUnits, convertQuantity, emptyIngredient, emptyMeal, emptyMealRoutine, frequencyCost, homeMealCost, ingredientCost, mealDifferenceText, mealInsights, parseQuantity, preparationCost, removeIngredient, removeMeal, type Ingredient, type MealRoutine, type Unit } from "../src/lib/calculations/meal-comparison";
import { decodeMealRoutine, encodeMealRoutine, MEAL_STORAGE_KEY } from "../src/lib/meal-storage";
import { createMealExcel, createMealPdf, mealSheets } from "../src/lib/export/meal-comparison";
import { tools } from "../src/lib/tools";

const ingredient = (name: string, used: number, usedUnit: Unit, price: number, bought: number, boughtUnit: Unit): Ingredient => ({ id: name, name, used, usedUnit, price, bought, boughtUnit });
function simple(home: number, outside: number, frequency = 7) {
  const v = emptyMealRoutine(); Object.assign(v.meals[0], { enabled: true, frequency, outside, ingredients: [ingredient("Item", 1, "unit", home, 1, "unit")] }); return v;
}
export function mealExample(): MealRoutine {
  const v = emptyMealRoutine();
  Object.assign(v.meals[0], { enabled: true, frequency: 7, outside: 2200, ingredients: [ingredient("Mamão", 200, "g", 800, 1, "kg"), ingredient("Ovos", 2, "unit", 1200, 12, "unit"), ingredient("Pão", 2, "unit", 800, 10, "unit"), ingredient("Café", 15, "g", 3500, 500, "g")] });
  Object.assign(v.meals[1], { enabled: true, frequency: 5, outside: 3000, ingredients: [ingredient("Alimentos do almoço", 1, "unit", 2400, 1, "unit")] });
  Object.assign(v.meals[2], { enabled: true, frequency: 5, outside: 2000, ingredients: [ingredient("Alimentos do lanche", 1, "unit", 700, 1, "unit")] });
  Object.assign(v.meals[3], { enabled: true, frequency: 7, outside: 3200, ingredients: [ingredient("Alimentos do jantar", 1, "unit", 1800, 1, "unit")] });
  v.preparation = { gas: 5000, electricity: 2500, other: 0 }; v.time = { shopping: 1, cooking: 4, cleaning: 1, outside: 0 }; return v;
}
describe("unidades e custo proporcional", () => {
  it.each([[1, "kg", "g", 1000], [200, "g", "kg", 0.2], [1, "L", "ml", 1000], [200, "ml", "L", 0.2], [2, "unit", "unit", 2]] as const)("converte %s %s para %s", (n, from, to, expected) => expect(convertQuantity(n, from, to)).toBe(expected));
  it.each([["kg", "L"], ["g", "unit"], ["ml", "kg"]] as const)("impede %s para %s", (a, b) => { expect(compatibleUnits(a, b)).toBe(false); expect(() => convertQuantity(1, a, b)).toThrow(); });
  it.each([["Mamão", 200, "g", 800, 1, "kg", 160], ["Ovos", 2, "unit", 1200, 12, "unit", 200], ["Leite", 200, "ml", 600, 1, "L", 120]] as const)("custo proporcional: %s", (name, used, unit, price, bought, buyUnit, expected) => expect(ingredientCost(ingredient(name, used, unit, price, bought, buyUnit))).toBe(expected));
  it("arredonda metade de centavo para cima, inclusive com quantidade decimal", () => { expect(ingredientCost(ingredient("Item", 0.5, "unit", 1, 1, "unit"))).toBe(1); expect(ingredientCost(ingredient("Item", 0.1, "unit", 29, 0.3, "unit"))).toBe(10); });
  it("compra de quantidade decimal e conversão inversa", () => expect(ingredientCost(ingredient("Item", 0.5, "kg", 1000, 250, "g"))).toBe(2000));
  it("quantidade comprada zero não divide por zero", () => expect(() => ingredientCost(ingredient("Item", 1, "g", 1000, 0, "g"))).toThrow(/maior que zero/));
  it("ingrediente não converte massa em volume", () => expect(() => ingredientCost(ingredient("Item", 200, "g", 800, 1, "L"))).toThrow(/compatíveis/));
  it("linha totalmente vazia exige preenchimento", () => expect(() => ingredientCost(emptyIngredient("blank"))).toThrow(/Complete/));
  it.each([-1, NaN, Infinity, 0.0000001, 1000000001])("rejeita quantidade inválida %s", n => expect(() => convertQuantity(n, "g", "g")).toThrow());
  it.each(["-1", "1,2,3", "1.000,5", "abc"])("rejeita entrada %s", value => expect(() => parseQuantity(value)).toThrow());
  it("campos vazios e vírgula decimal", () => { expect(parseQuantity("")).toBe(0); expect(parseQuantity("1,5")).toBe(1.5); expect(parseQuantity("0,000001")).toBe(0.000001); });
  it("rejeita preço negativo, fracionário e custo fora do inteiro seguro", () => { expect(() => ingredientCost(ingredient("Item", 1, "g", -1, 1, "g"))).toThrow(); expect(() => ingredientCost(ingredient("Item", 1, "g", 1.1, 1, "g"))).toThrow(); expect(() => ingredientCost(ingredient("Item", 1e9, "kg", 1e12, 0.000001, "g"))).toThrow(); });
});
describe("refeições, frequência e rotina", () => {
  it("soma alimentos da refeição e exige ingredientes", () => { expect(homeMealCost(mealExample().meals[0].ingredients)).toBe(625); expect(() => homeMealCost([])).toThrow(/Adicione/); });
  it("remoção de ingrediente atualiza totais e preserva entrada", () => { const v = mealExample(); const next = removeIngredient(v, "meal-0", "Ovos"); expect(homeMealCost(next.meals[0].ingredients)).toBe(425); expect(v.meals[0].ingredients).toHaveLength(4); });
  it("refeição personalizada e remoção sem dados órfãos", () => { const v = simple(500, 1000); v.meals.push({ ...emptyMeal("custom", "Ceia"), enabled: true, frequency: 3, outside: 1200, ingredients: [ingredient("Ceia item", 1, "unit", 300, 1, "unit")] }); expect(calculateMealRoutine(v).meals.at(-1)?.name).toBe("Ceia"); const next = removeMeal(v, "custom"); expect(calculateMealRoutine(next).meals).toHaveLength(1); expect(encodeMealRoutine(next)).not.toContain("Ceia item"); });
  it("somente refeições incluídas entram nos totais", () => { const v = simple(700, 2200); Object.assign(v.meals[1], { outside: 99900, frequency: 7, ingredients: [ingredient("Hidden", 1, "g", 1000, 0, "g")] }); expect(calculateMealRoutine(v).meals).toHaveLength(1); });
  it("frequência de 7: semana, mês 52/12 e ano 52", () => { expect(frequencyCost(700, 7, "weekly")).toBe(4900); expect(frequencyCost(700, 7, "monthly")).toBe(21233); expect(frequencyCost(700, 7, "annual")).toBe(254800); });
  it("frequência zero e fracionária", () => { expect(frequencyCost(700, 0, "monthly")).toBe(0); expect(frequencyCost(100, 0.5, "weekly")).toBe(50); });
  it.each([-1, NaN, 1001])("frequência inválida %s", n => expect(() => frequencyCost(100, n, "monthly")).toThrow());
  it.each([[700, 2200, 1], [2200, 700, -1], [700, 700, 0]])("casa %s, fora %s: direção %s", (home, outside, direction) => { const r = calculateMealRoutine(simple(home, outside)); expect(Math.sign(r.delta.monthly)).toBe(direction); expect(mealDifferenceText(r.homeMonthly, r.outsideMonthly)).toContain(direction === 0 ? "mesmo custo" : "a menos"); });
  it("maior e menor diferença mantêm direção, sem classificar ingredientes", () => {
    const v = emptyMealRoutine(); v.meals = [["Café", 20000, 60000], ["Almoço", 50000, 55000], ["Jantar", 70000, 50000]].map(([name, home, outside], i) => ({ ...emptyMeal(`m-${i}`, name as string), enabled: true, frequency: 1, outside: outside as number, ingredients: [ingredient(`i-${i}`, 1, "unit", home as number, 1, "unit")] }));
    const r = calculateMealRoutine(v); expect(r.insights.largestDifference).toEqual(["m-0"]); expect(r.insights.smallestDifference).toEqual(["m-1"]); expect(r.insights.highestHome).toEqual(["m-2"]);
    expect(mealDifferenceText(r.meals[2].home.monthly, r.meals[2].outside.monthly)).toContain("Comprar fora custa");
    expect(mealInsights(r).join(" ")).not.toMatch(/i-0|ingrediente|troque/i);
    v.meals[2].outside = 0; const next = calculateMealRoutine(v);
    expect(next.insights.largestDifference).toEqual(["m-2"]); expect(mealInsights(next).join(" ")).toContain("comprar fora custa");
  });
  it("empates explícitos e diferença zero", () => { const v = simple(100, 100); v.meals.push({ ...v.meals[0], id: "m2", name: "Ceia", ingredients: [ingredient("Second", 1, "unit", 100, 1, "unit")] }); const r = calculateMealRoutine(v); expect(r.insights.highestHome).toHaveLength(2); expect(r.insights.smallestDifference).toHaveLength(2); expect(mealInsights(r).join(" ")).toContain("empatam"); });
  it("participação percentual por refeição, fora e em casa, sem divisão por zero", () => { const r = calculateMealRoutine(mealExample()); expect(r.distribution.reduce((sum, d) => sum + (d.home ?? 0), 0)).toBeCloseTo(100); expect(r.distribution.reduce((sum, d) => sum + (d.outside ?? 0), 0)).toBeCloseTo(100); const zero = calculateMealRoutine(simple(0, 0)); expect(zero.distribution[0]).toMatchObject({ home: null, outside: null }); });
  it.each(["gas", "electricity", "other"] as const)("%s entra só no total geral", key => { const v = simple(700, 2200); const before = calculateMealRoutine(v); v.preparation[key] = 5000; const r = calculateMealRoutine(v); expect(r.homeMonthly).toBe(before.homeMonthly + 5000); expect(r.homeAnnual).toBe(before.homeAnnual + 60000); expect(r.meals).toEqual(before.meals); expect(r.distribution).toEqual(before.distribution); expect(r.outsideMonthly).toBe(before.outsideMonthly); });
  it("soma gás, energia e outros", () => expect(preparationCost({ gas: 5000, electricity: 2500, other: 1000 })).toBe(8500));
  it("cenário manual completo", () => { const r = calculateMealRoutine(mealExample()); expect(r.meals.map(m => m.home.portion)).toEqual([625, 2400, 700, 1800]); expect(r.meals.map(m => m.home.monthly)).toEqual([18958, 52000, 15167, 54600]); expect(r.foodHome).toBe(140725); expect(r.preparation).toBe(7500); expect(r.homeMonthly).toBe(148225); expect(r.outsideMonthly).toBe(272133); expect(r.homeAnnual).toBe(1778700); expect(r.outsideAnnual).toBe(3265600); expect(r.delta).toEqual({ monthly: 123908, annual: 1486900 }); expect(r.insights.highestHome).toEqual(["meal-3"]); expect(r.insights.largestDifference).toEqual(["meal-0"]); expect(r.insights.smallestDifference).toEqual(["meal-1"]); });
});
describe("tempo e persistência", () => {
  it.each(["shopping", "cooking", "cleaning"] as const)("%s soma ao tempo em casa", key => { const time = emptyMealRoutine().time; time[key] = 1; expect(calculateMealTime(time).home).toEqual({ weekly: 1, monthly: 52 / 12, annual: 52 }); });
  it("tempo fora, diferenças e separação do dinheiro", () => { const v = mealExample(); const before = calculateMealRoutine(v); expect(before.time.home).toEqual({ weekly: 6, monthly: 26, annual: 312 }); v.time.outside = 2; const r = calculateMealRoutine(v); expect(r.time.outside).toEqual({ weekly: 2, monthly: 104 / 12, annual: 104 }); expect(r.time.delta.weekly).toBe(-4); expect(r.homeMonthly).toBe(before.homeMonthly); expect(r.outsideMonthly).toBe(before.outsideMonthly); });
  it("rejeita tempo negativo, mais de 168h e soma semanal impossível", () => { const time = emptyMealRoutine().time; time.shopping = -1; expect(() => calculateMealTime(time)).toThrow(); time.shopping = 169; expect(() => calculateMealTime(time)).toThrow(); time.shopping = 100; time.cooking = 100; expect(() => calculateMealTime(time)).toThrow(); });
  it("restaura dados sem alterar entrada, com chave independente", () => { const v = mealExample(); expect(decodeMealRoutine(encodeMealRoutine(v))).toEqual(v); expect(MEAL_STORAGE_KEY).not.toContain("property"); expect(() => decodeMealRoutine('{"version":3}')).toThrow(); });
  it("rejeita dados incompletos, IDs repetidos, nomes longos, unidades e valores inválidos", () => {
    for (const mutate of [(v: MealRoutine) => { v.time = {} as MealRoutine["time"]; }, (v: MealRoutine) => { v.meals[1].id = v.meals[0].id; }, (v: MealRoutine) => { v.meals[0].name = "a".repeat(81); }, (v: MealRoutine) => { v.meals[0].ingredients[0].usedUnit = "bag" as Unit; }, (v: MealRoutine) => { v.preparation.gas = -1; }]) { const v = mealExample(); mutate(v); expect(() => decodeMealRoutine(JSON.stringify({ version: 1, values: v }))).toThrow(); }
  });
  it("modelo vazio tem quatro refeições sem preços de exemplo", () => { const v = emptyMealRoutine(); expect(v.meals).toHaveLength(4); expect(v.meals.every(m => !m.enabled && !m.outside && !m.frequency && !m.ingredients.length)).toBe(true); expect(calculateMealRoutine(v).homeMonthly).toBe(0); });
  it("nova ferramenta é navegável a partir da Home", () => expect(tools.find(t => t.title === "Comer fora ou cozinhar?")).toMatchObject({ href: "/comer-fora-ou-cozinhar/" }));
});
describe("PDF e Excel de alimentação", () => {
  const options = { brand: { name: "QuantoCusta", domain: "" }, generatedAt: new Date("2026-10-03T12:00:00Z") };
  it("Excel contém quatro abas, centavos convertidos em números e refeições no resumo", async () => { const r = calculateMealRoutine(mealExample()), before = structuredClone(r), sheets = mealSheets(r, options); expect(sheets.map(s => s.sheet)).toEqual(["Resumo", "Refeições", "Detalhamento", "Premissas"]); expect(sheets[0].data.find(row => row[0] === "Total mensal")?.slice(1)).toMatchObject([{ value: 1482.25, type: Number }, { value: 2721.33, type: Number }, { value: 1239.08, type: Number }]); expect(sheets[1].data[1][2]).toMatchObject({ value: 6.25 }); expect(sheets[2].data[1]).toMatchObject(["Café da manhã", "Mamão", { value: 200 }, "g", { value: 8 }, { value: 1 }, "kg", { value: 1.6 }]); expect(sheets[0].data.some(row => row[0] === "Comparação por refeição")).toBe(true); const blob = await createMealExcel(r, options); expect([...new Uint8Array(await blob.arrayBuffer()).slice(0, 4)]).toEqual([80, 75, 3, 4]); expect(r).toEqual(before); });
  it("PDF real contém totais, refeições, detalhamento, tempo e aviso nutricional", async () => {
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try { const r = calculateMealRoutine(mealExample()), before = structuredClone(r), pdf = await PDFDocument.load(await createMealPdf(r, options)); const text = draw.mock.calls.map(args => args[0]).join("\n"); expect(pdf.getTitle()).toBe("Comer fora ou cozinhar?"); expect(text).toContain("R$ 1.482,25"); expect(text).toContain("R$ 2.721,33"); expect(text).toContain("Café da manhã"); expect(text).toContain("Detalhamento dos itens utilizados"); expect(text).toContain("aspectos nutricionais"); expect(text).toContain("26 h"); expect(pdf.getPageCount()).toBeGreaterThan(1); expect(r).toEqual(before); } finally { draw.mockRestore(); }
  });
  it("PDF pagina nomes longos e substitui caracteres não suportados", async () => { const v = simple(100, 200); v.meals[0].name = "Café 🥐"; v.meals[0].ingredients = Array.from({ length: 50 }, (_, n) => ingredient(`${n}${"a".repeat(70)}`, 1, "unit", 100, 1, "unit")); const doc = await PDFDocument.load(await createMealPdf(calculateMealRoutine(v), options)); expect(doc.getPageCount()).toBeGreaterThan(2); });
});

import { describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import { calculateMealRoutine, emptyMeal, emptyMealRoutine, ingredientDetailText, ingredientQuantityText, mealInsights, mealTimeDifferenceText, parseMealValue, type MealRoutine } from "../src/lib/calculations/meal-comparison";
import { decodeMealRoutine, encodeMealRoutine } from "../src/lib/meal-storage";
import { createMealExcel, createMealPdf, mealSheets } from "../src/lib/export/meal-comparison";

function routine(home = 1000, outside: number | null = 2000): MealRoutine {
  const v = emptyMealRoutine();
  Object.assign(v.meals[0], { enabled: true, frequency: 3, outside, ingredients: [{ id: "item", name: "pao integral", used: 1, usedUnit: "unit", price: home, bought: 1, boughtUnit: "unit" }] });
  return v;
}
const options = { brand: { name: "Coyler", domain: "" }, generatedAt: new Date("2026-10-03T12:00:00Z") };
describe("vazio e zero informado", () => {
  it.each(["", " ", null, undefined])("campo essencial %s continua não informado", text => {
    expect(parseMealValue(text, true)).toBeNull(); expect(parseMealValue(text, false)).toBeNull();
  });
  it.each(["0", "0,00"])("zero explícito %s continua zero", text => { expect(parseMealValue(text, true)).toBe(0); expect(parseMealValue(text, false)).toBe(0); });
  it("custos e tempo opcionais vazios continuam sem acréscimo", () => { expect(parseMealValue("", true, true)).toBe(0); expect(parseMealValue(undefined, false, true)).toBe(0); const r = calculateMealRoutine(routine()); expect(r.preparation).toBe(0); expect(r.time.home.monthly).toBe(0); });
  it("preço fora vazio não vira zero nem produz comparação", () => {
    const r = calculateMealRoutine(routine(2000, null));
    expect(r.meals).toEqual([]); expect(r.incomplete[0].issues["meal-0-outside"]).toBe("Informe quanto custa comprar esta refeição fora para compará-la.");
    expect(r.distribution).toEqual([]); expect(mealInsights(r)).toEqual([]);
  });
  it("preço fora explicitamente zero participa da comparação", () => { const r = calculateMealRoutine(routine(2000, 0)); expect(r.meals[0].outside.portion).toBe(0); expect(r.incomplete).toEqual([]); expect(r.delta.monthly).toBe(-26000); });
  it.each(["used", "bought", "price"] as const)("ingrediente sem %s não gera custo incompleto", field => {
    const v = routine(); v.meals[0].ingredients[0][field] = null;
    const r = calculateMealRoutine(v); expect(r.meals).toEqual([]); expect(Object.keys(r.incomplete[0].issues)).toContain(`item-${field}`);
  });
  it("falta de frequência ou ingredientes não presume zero em casa", () => {
    const v = routine(); v.meals[0].frequency = null;
    expect(calculateMealRoutine(v).incomplete[0].issues).toHaveProperty("meal-0-frequency");
    v.meals[0].frequency = 3; v.meals[0].ingredients = [];
    expect(calculateMealRoutine(v).incomplete[0].issues).toHaveProperty("meal-0-items");
  });
  it("outras refeições válidas continuam funcionando sem contaminar totais", () => {
    const v = routine(), before = calculateMealRoutine(v);
    v.meals[1] = { ...emptyMeal("meal-1", "Almoço"), enabled: true, frequency: 5, outside: null, ingredients: [{ ...v.meals[0].ingredients[0], id: "lunch-item", price: 2000 }] };
    const r = calculateMealRoutine(v);
    expect(r.meals).toEqual(before.meals); expect(r.homeMonthly).toBe(before.homeMonthly); expect(r.outsideMonthly).toBe(before.outsideMonthly); expect(r.delta).toEqual(before.delta); expect(r.insights).toEqual(before.insights);
    expect(v.meals[1].ingredients[0].price).toBe(2000);
  });
  it("salvamento mantém null e zero distintos ao restaurar, inclusive ingredientes", () => {
    const v = routine(0, 0); v.meals[0].frequency = 0; v.meals[0].ingredients[0].used = 0;
    v.meals[1].outside = null;
    const text = encodeMealRoutine(v); expect(JSON.parse(text).version).toBe(2);
    expect(decodeMealRoutine(text)).toEqual(v);
  });
  it("registros antigos preservam positivos e pedem confirmação dos zeros ambíguos", () => {
    const v = routine(0, 0), text = JSON.stringify({ version: 1, values: v });
    const loaded = decodeMealRoutine(text);
    expect(loaded.meals[0].outside).toBeNull(); expect(loaded.meals[0].ingredients[0].price).toBeNull();
    expect(loaded.meals[0].frequency).toBe(3); expect(loaded.meals[0].ingredients[0].bought).toBe(1);
    expect(calculateMealRoutine(loaded).meals).toEqual([]);
  });
});
describe("diferença de tempo em linguagem natural", () => {
  it.each([[21.7, 0, "Preparar em casa exige 21,7 horas"], [10, 18.3, "Comprar fora exige 8,3 horas"], [20, 5, "Preparar em casa exige 15 horas"], [5, 20, "Comprar fora exige 15 horas"]])("casa %s, fora %s", (home, outside, expected) => {
    const text = mealTimeDifferenceText(home as number, outside as number);
    expect(text).toBe(`${expected} a mais por mês, considerando os tempos informados.`); expect(text).not.toMatch(/-\d/);
  });
  it.each([0, 10])("tempos iguais: %s", value => expect(mealTimeDifferenceText(value, value)).toBe("Os dois cenários possuem o mesmo tempo mensal informado."));
  it("ruído de ponto flutuante não cria uma diferença inexistente", () => expect(mealTimeDifferenceText(0.1 + 0.2, 0.3)).toBe("Os dois cenários possuem o mesmo tempo mensal informado."));
});
describe("mensagens de maior e menor diferença", () => {
  it.each([[1000, 2000, "preparar em casa custa R$ 130,00 a menos por mês do que comprar fora."], [2500, 2000, "comprar fora custa R$ 65,00 a menos por mês do que preparar em casa."], [2000, 2000, "os dois cenários possuem o mesmo custo mensal informado."]])("casa %s, fora %s", (home, outside, expected) => {
    const texts = mealInsights(calculateMealRoutine(routine(home as number, outside as number)));
    expect(texts).toEqual([`Diferença entre as opções\nCafé da manhã: ${expected}`]);
    expect(texts.join(" ")).not.toContain("diferença mensal em valor");
  });
  it("empate positivo e negativo conserva ambas as direções sem repetir nomes", () => {
    const v = routine(1000, 2000);
    v.meals[1] = { ...v.meals[0], id: "meal-1", name: "Almoço", outside: 0, ingredients: [{ ...v.meals[0].ingredients[0], id: "lunch-item" }] };
    const r = calculateMealRoutine(v); expect(r.insights.largestDifference).toEqual(["meal-0", "meal-1"]);
    const text = mealInsights(r).find(t => t.startsWith("Maior diferença"))!;
    expect(text).toContain("Café da manhã: preparar em casa"); expect(text).toContain("Almoço: comprar fora");
    expect(text.match(/Café da manhã/g)).toHaveLength(1); expect(text.match(/Almoço/g)).toHaveLength(1);
  });
});
describe("gramática e nomes dos ingredientes", () => {
  it.each([[1, "1 unidade utilizada"], [2, "2 unidades utilizadas"]])("utilização de %s unidade(s)", (n, expected) => expect(ingredientQuantityText(n as number, "unit", true)).toBe(expected));
  it.each([[1, "1 unidade"], [7, "7 unidades"], [30, "30 unidades"]])("compra de %s unidade(s)", (n, expected) => expect(ingredientQuantityText(n as number, "unit")).toBe(expected));
  it("massa e volume mantêm unidades técnicas", () => { expect(ingredientQuantityText(150, "g", true)).toBe("150 g utilizados"); expect(ingredientQuantityText(1, "kg")).toBe("1 kg"); expect(ingredientQuantityText(200, "ml", true)).toBe("200 ml utilizados"); expect(ingredientQuantityText(1, "L")).toBe("1 L"); });
  it.each(["mamao", "pao integral"])("nome %s permanece intacto", name => {
    const v = routine(); v.meals[0].ingredients[0].name = name; v.meals[0].ingredients[0].bought = 7;
    const item = calculateMealRoutine(v).meals[0].ingredients[0];
    expect(ingredientDetailText(item)).toContain(`${name}: 1 unidade utilizada; compra de 7 unidades`);
    expect(decodeMealRoutine(encodeMealRoutine(v)).meals[0].ingredients[0].name).toBe(name);
  });
});
describe("relatórios sem comparação de dados ausentes", () => {
  function partial() { const v = routine(); v.meals[1] = { ...emptyMeal("meal-1", "Almoço incompleto"), enabled: true, frequency: 5, outside: null }; v.time.cooking = 5; return calculateMealRoutine(v); }
  it("Excel mantém só refeições completas nos custos e explica a ausência", async () => {
    const r = partial(), sheets = mealSheets(r, options);
    expect(sheets[1].data.some(row => row[0] === "Almoço incompleto")).toBe(false);
    expect(sheets[2].data.some(row => row[0] === "Almoço incompleto")).toBe(false);
    expect(sheets[0].data.find(row => row[0] === "Comparação de tempo")?.[1]).toMatchObject({ value: "Preparar em casa exige 21,7 horas a mais por mês, considerando os tempos informados." });
    expect(sheets[0].data.find(row => row[0] === "Total mensal")?.slice(1)).toMatchObject([{ value: 130, type: Number }, { value: 260, type: Number }, { value: 130, type: Number }]);
    expect(sheets[3].data.find(row => row[0] === "Refeição não comparada")?.[1]).toMatchObject({ value: expect.stringContaining("Almoço incompleto") });
    const blob = await createMealExcel(r, options); expect([...new Uint8Array(await blob.arrayBuffer()).slice(0, 4)]).toEqual([80, 75, 3, 4]);
  });
  it("PDF contém novas mensagens e não imprime refeição ausente com preço zero", async () => {
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const bytes = await createMealPdf(partial(), options), text = draw.mock.calls.map(args => args[0]).join(" ");
      expect(text).toContain("Preparar em casa exige 21,7 horas a mais por mês");
      expect(text).toContain("Diferença entre as opções"); expect(text).not.toMatch(/Maior diferença|Menor diferença|representa 100%|refeição que mais pesa/);
      expect(text).toContain("Café da manhã: preparar em casa custa R$ 130,00 a menos por mês");
      expect(text).toContain("1 unidade utilizada; compra de 1 unidade"); expect(text).not.toContain("-21,7 h");
      expect(text).not.toMatch(/Almoço incompleto:.*R\$ 0,00/);
      expect((await PDFDocument.load(bytes)).getTitle()).toBe("Comer fora ou cozinhar?");
    } finally { draw.mockRestore(); }
  });
  it("sem qualquer refeição completa não exporta totais presumidos", async () => {
    const r = calculateMealRoutine(routine(1000, null));
    await expect(createMealPdf(r, options)).rejects.toThrow(/Complete/);
    await expect(createMealExcel(r, options)).rejects.toThrow(/Complete/);
  });
});

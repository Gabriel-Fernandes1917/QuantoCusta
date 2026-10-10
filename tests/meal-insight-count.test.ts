import { describe, expect, it, vi } from "vitest";
import { PDFDocument, PDFPage } from "pdf-lib";
import { calculateMealRoutine, emptyMealRoutine, mealInsights } from "../src/lib/calculations/meal-comparison";
import { createMealPdf, mealSheets } from "../src/lib/export/meal-comparison";

function routine(count = 1, home = 1000, outside = 2000) {
  const values = emptyMealRoutine();
  values.meals.forEach((meal, index) => {
    if (index < count) Object.assign(meal, { enabled: true, frequency: 3, outside, ingredients: [{ id: `item-${index}`, name: "Ovo", used: 1, usedUnit: "unit", price: home, bought: 1, boughtUnit: "unit" }] });
  });
  return values;
}
const options = { brand: { name: "Coyler", domain: "" }, generatedAt: new Date("2026-10-03T12:00:00Z") };
const ranking = /refeição que mais pesa|refeições que mais pesam|Maior diferença|Menor diferença|representa/;

describe("insights conforme a quantidade efetiva de refeições", () => {
  it.each([
    [1000, 2000, "preparar em casa custa R$ 130,00 a menos por mês do que comprar fora."],
    [2500, 2000, "comprar fora custa R$ 65,00 a menos por mês do que preparar em casa."],
    [2000, 2000, "os dois cenários possuem o mesmo custo mensal informado."],
  ])("uma refeição: casa %s, fora %s", (home, outside, phrase) => {
    const result = calculateMealRoutine(routine(1, home as number, outside as number));
    expect(mealInsights(result)).toEqual([`Diferença entre as opções\nCafé da manhã: ${phrase}`]);
    expect(mealInsights(result).join(" ")).not.toMatch(ranking);
    expect(result.meals[0].home).toEqual({ portion: home, weekly: (home as number) * 3, monthly: (home as number) * 13, annual: (home as number) * 156 });
  });
  it.each([2, 3, 4])("%s refeições preservam rankings e distribuição", count => {
    const result = calculateMealRoutine(routine(count)), text = mealInsights(result).join(" ");
    expect(text).toContain("Maior diferença entre as opções");
    expect(text).toContain("Menor diferença entre as opções");
    expect(text).toContain("mais pesam"); expect(text).toContain("representa");
    expect(result.distribution).toHaveLength(count);
    expect(result.distribution[0].home).toBeCloseTo(100 / count);
    expect(result.homeMonthly).toBe(13000 * count);
  });
  it("vários cards não configurados ou desmarcados não contam", () => {
    const values = routine();
    values.meals[1] = { ...values.meals[0], id: "meal-1", enabled: false, ingredients: [{ ...values.meals[0].ingredients[0], id: "disabled-item" }] };
    const result = calculateMealRoutine(values);
    expect(values.meals).toHaveLength(4); expect(result.meals).toHaveLength(1);
    expect(mealInsights(result)).toHaveLength(1); expect(mealInsights(result).join(" ")).not.toMatch(ranking);
  });
  it("refeição incompleta não conta para ativar os rankings", () => {
    const values = routine(2); values.meals[1].outside = null;
    const result = calculateMealRoutine(values);
    expect(result.incomplete).toHaveLength(1); expect(result.meals).toHaveLength(1);
    expect(mealInsights(result)).toHaveLength(1); expect(mealInsights(result).join(" ")).not.toMatch(ranking);
  });
  it.each([1, 2])("PDF com %s refeição(ões) segue a mesma regra", async count => {
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const bytes = await createMealPdf(calculateMealRoutine(routine(count)), options);
      const text = draw.mock.calls.map(args => args[0]).join(" ");
      expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
      expect(text).toContain("Semanal:"); expect(text).toContain("Mensal:"); expect(text).toContain("Anual:");
      if (count === 1) { expect(text).toContain("Diferença entre as opções"); expect(text).not.toMatch(ranking); }
      else { expect(text).toContain("Maior diferença entre as opções"); expect(text).toContain("Menor diferença entre as opções"); expect(text).toContain("representa 50%"); }
    } finally { draw.mockRestore(); }
  });
  it("Excel simplifica apenas o resumo e preserva os números detalhados", () => {
    const result = calculateMealRoutine(routine()), sheets = mealSheets(result, options);
    const insights = sheets[0].data.filter(row => row[0] === "Comparação por refeição");
    expect(insights).toHaveLength(1); expect(insights[0][1]).toMatchObject({ value: mealInsights(result)[0] });
    expect(sheets[1].data).toHaveLength(2);
    expect(sheets[1].data[1].slice(7, 10)).toMatchObject([{ value: 130 }, { value: 260 }, { value: 130 }]);
    expect(sheets[1].data[1].slice(13)).toMatchObject([{ value: 100 }, { value: 100 }]);
  });
});

import { describe, expect, it } from "vitest";
import { calculateMealRoutine, emptyMeal, emptyMealRoutine, mealIsUsed, mealIssues, mealReportedTimeText, mealSavingsText, removeIngredient, removeMeal } from "../src/lib/calculations/meal-comparison";
import { decodeMealRoutine, encodeMealRoutine } from "../src/lib/meal-storage";

function routine() {
  const values = emptyMealRoutine();
  values.meals = [{ ...emptyMeal("breakfast", "Café"), frequency: 7, outside: 1200, preparationMinutes: 15, ingredients: [{ id: "bread", name: "Pão", used: 2, usedUnit: "unit", price: 1000, bought: 10, boughtUnit: "unit" }] }];
  return values;
}

describe("participação automática, custos compartilhados e preparo", () => {
  it.each([0, 1])("compara somente a refeição preenchida na posição %s", index => {
    const values = emptyMealRoutine();
    values.meals[index] = { ...routine().meals[0], id: values.meals[index].id, name: values.meals[index].name };
    const r = calculateMealRoutine(values);
    expect(r.meals).toHaveLength(1); expect(r.incomplete).toEqual([]);
    expect(r.meals[0].id).toBe(values.meals[index].id);
    values.meals.filter((_, i) => i !== index).forEach(m => {
      expect(mealIsUsed(m)).toBe(false); expect(mealIssues(m)).toEqual({});
    });
  });
  it("nomes e o antigo checkbox não ativam refeições vazias", () => {
    const values = emptyMealRoutine(); values.meals[0].enabled = true;
    values.meals[1].name = "Nome editado";
    const r = calculateMealRoutine(values);
    expect(r.meals).toEqual([]); expect(r.incomplete).toEqual([]);
    expect(r.foodHome).toBe(0); expect(r.foodOutside).toBe(0);
  });
  it("duas refeições completas e uma parcial preservam resultados e dados", () => {
    const values = emptyMealRoutine();
    values.meals[0] = routine().meals[0];
    values.meals[1] = { ...routine().meals[0], id: "lunch", name: "Almoço", ingredients: [{ ...routine().meals[0].ingredients[0], id: "lunch-item" }] };
    values.meals[2].outside = 0;
    const before = structuredClone(values), r = calculateMealRoutine(values);
    expect(r.meals).toHaveLength(2); expect(r.incomplete).toHaveLength(1);
    expect(r.incomplete[0].issues).toHaveProperty("meal-2-frequency");
    expect(r.incomplete[0].issues).not.toHaveProperty("meal-2-outside");
    expect(r.homeMonthly).toBe(calculateMealRoutine(routine()).homeMonthly * 2);
    expect(values).toEqual(before);
    values.meals[2].outside = null;
    expect(calculateMealRoutine(values).incomplete).toEqual([]);
  });
  it("limpar uma refeição devolve ao estado não utilizado", () => {
    const values = routine();
    values.meals[0] = { ...values.meals[0], frequency: null, outside: null, preparationMinutes: null, ingredients: [] };
    expect(mealIsUsed(values.meals[0])).toBe(false);
    const r = calculateMealRoutine(decodeMealRoutine(encodeMealRoutine(values)));
    expect(r.meals).toEqual([]); expect(r.incomplete).toEqual([]);
  });
  it("refeição válida com opcionais zerados e personalizada vazia não exige preenchimento", () => {
    const values = routine(); values.meals[0].preparationMinutes = 0;
    values.meals.push(emptyMeal("custom", "Ceia"));
    expect(calculateMealRoutine(values).incomplete).toEqual([]);
    values.meals[1] = { ...routine().meals[0], id: "custom", name: "Ceia", ingredients: [{ ...routine().meals[0].ingredients[0], id: "custom-item" }] };
    expect(calculateMealRoutine(values).meals).toHaveLength(2);
    expect(calculateMealRoutine(removeMeal(values, "custom")).meals).toHaveLength(1);
  });
  it("preserva o tempo ao remover todos os ingredientes e o reutiliza ao adicionar novamente", () => {
    const values = routine();
    const original = calculateMealRoutine(values);
    const removed = removeIngredient(values, "breakfast", "bread");
    expect(removed.meals[0].preparationMinutes).toBe(15);
    expect(removed.meals[0].outside).toBe(1200);
    expect(removed.meals[0].frequency).toBe(7);
    const hidden = calculateMealRoutine(removed);
    expect(hidden.preparationWeekly).toBe(0);
    expect(hidden.hasPreparationTime).toBe(false);
    const restored = decodeMealRoutine(encodeMealRoutine(removed));
    restored.meals[0].ingredients = [...values.meals[0].ingredients];
    const readded = calculateMealRoutine(restored);
    expect(readded.preparationWeekly).toBe(1.75);
    expect(readded.homeMonthly).toBe(original.homeMonthly);
    expect(readded.outsideMonthly).toBe(original.outsideMonthly);
    expect(readded.meals[0].ingredients).toEqual(original.meals[0].ingredients);
  });
  it("inclui refeição válida sem depender do antigo enabled", () => {
    const r = calculateMealRoutine(routine());
    expect(r.meals).toHaveLength(1);
    expect(r.meals[0].home.portion).toBe(200);
    expect(r.preparationWeekly).toBe(1.75);
    expect(r.time.home.annual).toBe(91);
  });
  it("soma preparo por frequência e água uma vez, inclusive após remover", () => {
    const values = routine();
    values.meals.push({ ...values.meals[0], id: "lunch", frequency: 5, preparationMinutes: 30, ingredients: [{ ...values.meals[0].ingredients[0], id: "lunch-bread" }] });
    values.preparation.water = 1500;
    const r = calculateMealRoutine(values);
    expect(r.preparationWeekly).toBe(4.25);
    expect(r.homeMonthly).toBe(r.foodHome + 1500);
    expect(r.homeAnnual).toBe(r.meals.reduce((sum, m) => sum + m.home.annual, 18000));
    const remaining = calculateMealRoutine(removeMeal(values, "lunch"));
    expect(remaining.preparationWeekly).toBe(1.75);
    expect(remaining.homeMonthly).toBe(remaining.foodHome + 1500);
  });
  it("tempo vazio não inventa preparo e não impede resultado financeiro", () => {
    const values = routine(); values.meals[0].preparationMinutes = null;
    const r = calculateMealRoutine(values);
    expect(r.hasPreparationTime).toBe(false); expect(r.preparationWeekly).toBe(0);
    expect(r.meals[0].home.portion).toBe(200);
    expect(mealReportedTimeText(r)).toContain("não há comparação de tempo");
  });
  it("preserva zero explícito, água e preparo no armazenamento", () => {
    const values = routine(); values.meals[0].preparationMinutes = 0; values.preparation.water = 800;
    const restored = decodeMealRoutine(encodeMealRoutine(values));
    expect(restored).toEqual(values);
    expect(calculateMealRoutine(restored).hasPreparationTime).toBe(true);
  });
  it("ignora preparo de refeição incompleta e soma compras e limpeza", () => {
    const values = routine(); values.meals[0].outside = null;
    values.time.shopping = 1; values.time.cleaning = 0.5;
    const r = calculateMealRoutine(values);
    expect(r.preparationWeekly).toBe(0); expect(r.time.home.weekly).toBe(1.5);
    expect(r.incomplete[0].issues).toHaveProperty("breakfast-outside");
  });
  it("conclusões indicam economia positiva ou empate", () => {
    expect(mealSavingsText(1531, 1200)).toBe("Comprar fora economiza R$ 3,31 por mês em comparação com cozinhar em casa.");
    expect(mealSavingsText(0, 1200, "por ano")).toContain("Cozinhar em casa economiza R$ 12,00 por ano");
    expect(mealSavingsText(0, 0)).toContain("mesmo custo");
  });
  it("rejeita preparo negativo e soma semanal acima de 168 horas", () => {
    const values = routine(); values.meals[0].preparationMinutes = -1;
    expect(() => calculateMealRoutine(values)).toThrow();
    values.meals[0].preparationMinutes = 1500;
    expect(() => calculateMealRoutine(values)).toThrow(/168/);
  });
});

import { validateMealRoutine, type MealRoutine } from "./calculations/meal-comparison";
export const MEAL_STORAGE_KEY = "quantocusta:meal-comparison:v1";
export function encodeMealRoutine(values: MealRoutine) { validateMealRoutine(values); return JSON.stringify({ version: 2, values }); }
export function decodeMealRoutine(text: string): MealRoutine {
  const data = JSON.parse(text);
  if (![1, 2].includes(data?.version)) throw new Error("Rotina salva inválida.");
  validateMealRoutine(data.values);
  const values: MealRoutine = data.values;
  // O formato antigo não distinguia vazio de zero. Zeros essenciais precisam ser confirmados.
  return { ...values, meals: values.meals.map(meal => ({ ...meal,
    frequency: meal.frequency == null || (data.version === 1 && meal.frequency === 0) ? null : meal.frequency,
    outside: meal.outside == null || (data.version === 1 && meal.outside === 0) ? null : meal.outside,
    ingredients: meal.ingredients.map(item => ({ ...item,
      used: item.used == null || (data.version === 1 && item.used === 0) ? null : item.used,
      price: item.price == null || (data.version === 1 && item.price === 0) ? null : item.price,
      bought: item.bought == null || (data.version === 1 && item.bought === 0) ? null : item.bought,
    })),
  })) };
}

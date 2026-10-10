import { moneyInput, parseMoney } from "./money";
import { readTripField, tripPresets, validateTripCount, validateTripPlan, type TripPlan, type TripScenario, type TripItem, type TripCategory } from "./calculations/trip-cost";

export type TripDraftItem = Omit<TripItem, "amount" | "days" | "quantity"> & { amount: string; days: string; quantity: string };
export type TripDraftScenario = Omit<TripScenario, "days" | "nights" | "people" | "budget" | "items" | "reserve"> & { days: string; nights: string; people: string; budget: string; items: TripDraftItem[]; reserve: { mode: TripScenario["reserve"]["mode"]; amount: string; percent: string } };
export type TripDraft = { mode: TripPlan["mode"]; scenarios: TripDraftScenario[] };
export function newTripItem(category: TripCategory, name = "", id = crypto.randomUUID()): TripDraftItem { return { id, category, name, amount: "", mode: "total", days: "1", quantity: "1" }; }
export function newTripScenario(id = crypto.randomUUID(), name = "Destino 1"): TripDraftScenario {
  return { id, name, days: "1", nights: "0", people: "1", budget: "", reserve: { mode: "none", amount: "", percent: "" }, items: tripPresets.flatMap(([category, labels]) => labels.map((label, i) => newTripItem(category, label, `${id}-${category}-${i}`))) };
}
const money = (text: string) => text.trim() ? parseMoney(text) : null;
function count(text: string, label: string, min = 0) { if (!/^\d+$/.test(text.trim())) throw new Error(`${label}: informe um número inteiro.`); const value = Number(text); validateTripCount(value, label, min); return value; }
function inactiveCount(text: string, min: number) { const n = /^\d+$/.test(text.trim()) ? Number(text) : NaN; return Number.isSafeInteger(n) && n >= min && n <= 10_000 ? n : 1; }
function percent(text: string) { if (!text.trim()) return null; if (!/^\d+(?:[,.]\d{1,2})?$/.test(text.trim())) throw new Error("Percentual: use um número de 0 a 100 com até duas casas decimais."); return Number(text.trim().replace(",", ".")); }
export function parseTripDraft(draft: TripDraft, purpose: "calculation" | "storage" = "calculation"): TripPlan {
  // O rascunho original permanece intacto. Salvar valida todos os destinos para não descartar dados nem mudar o formato persistido.
  const applicable = purpose === "calculation" && draft.mode === "single" ? draft.scenarios.slice(0, 1) : draft.scenarios;
  const plan: TripPlan = { mode: draft.mode, scenarios: applicable.map((s, index) => {
    const read = <T>(suffix: string, fn: () => T) => readTripField(s, index, `${s.id}-${suffix}`, fn);
    return { ...s,
      days: read("days", () => count(s.days, "Dias", 1)), nights: read("nights", () => count(s.nights, "Noites")), people: read("people", () => count(s.people, "Viajantes", 1)), budget: read("budget", () => money(s.budget)),
      items: s.items.map(item => {
        const readItem = <T>(suffix: string, fn: () => T) => readTripField(s, index, `${item.id}-${suffix}`, fn, item.name.trim() || "Despesa");
        const amount = readItem("amount", () => money(item.amount));
        return { ...item, amount,
          quantity: amount !== null && (item.mode === "unit" || item.category === "activities") ? readItem("quantity", () => count(item.quantity, "Quantidade", 1)) : inactiveCount(item.quantity, 1),
          days: amount !== null && item.mode === "personDay" ? readItem("days", () => count(item.days, "Dias da refeição")) : inactiveCount(item.days, 0) };
      }),
      reserve: { mode: s.reserve.mode, amount: s.reserve.mode === "fixed" ? read("reserve-amount", () => money(s.reserve.amount)) : null, percent: s.reserve.mode === "percent" ? read("reserve-percent", () => percent(s.reserve.percent)) : null } };
  }) };
  validateTripPlan(plan);
  return plan;
}
export function tripToDraft(plan: TripPlan): TripDraft {
  const text = (n: number | null) => n === null ? "" : moneyInput(n);
  return { mode: plan.mode, scenarios: plan.scenarios.map(s => ({ ...s, days: String(s.days), nights: String(s.nights), people: String(s.people), budget: text(s.budget), items: s.items.map(i => ({ ...i, amount: text(i.amount), quantity: String(i.quantity), days: String(i.days) })), reserve: { ...s.reserve, amount: text(s.reserve.amount), percent: s.reserve.percent === null ? "" : String(s.reserve.percent).replace(".", ",") } })) };
}

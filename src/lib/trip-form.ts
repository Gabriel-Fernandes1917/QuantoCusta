import { moneyInput, parseMoney } from "./money";
import { validateTripPlan, type TripPlan, type TripScenario, type TripItem, type TripCategory } from "./calculations/trip-cost";

export type TripDraftItem = Omit<TripItem, "amount" | "days" | "quantity"> & { amount: string; days: string; quantity: string };
export type TripDraftScenario = Omit<TripScenario, "days" | "nights" | "people" | "budget" | "items" | "reserve"> & { days: string; nights: string; people: string; budget: string; items: TripDraftItem[]; reserve: { mode: TripScenario["reserve"]["mode"]; amount: string; percent: string } };
export type TripDraft = { mode: TripPlan["mode"]; scenarios: TripDraftScenario[] };
export function newTripItem(category: TripCategory, name = "", id = crypto.randomUUID()): TripDraftItem { return { id, category, name, amount: "", mode: "total", days: "1", quantity: "1" }; }
export function newTripScenario(id = crypto.randomUUID(), name = "Destino 1"): TripDraftScenario {
  const presets: [TripCategory, string[]][] = [
    ["tickets", ["Valor das passagens", "Bagagem adicional", "Taxas adicionais", "Outros custos relacionados"]],
    ["lodging", ["Valor da hospedagem", "Taxas de limpeza", "Taxas de serviço", "Estacionamento da hospedagem", "Outros custos da hospedagem"]],
    ["food", ["Café da manhã", "Almoço", "Jantar", "Lanches", "Outros gastos alimentares"]],
    ["transport", ["Aplicativo de transporte", "Aluguel de veículo", "Combustível", "Estacionamento", "Pedágios", "Transporte público", "Transfer", "Outros deslocamentos"]],
    ["shopping", ["Compras", "Presentes e lembranças", "Gastos pessoais", "Outros"]],
  ];
  return { id, name, days: "1", nights: "0", people: "1", budget: "", reserve: { mode: "none", amount: "", percent: "" }, items: presets.flatMap(([category, labels]) => labels.map((label, i) => newTripItem(category, label, `${id}-${category}-${i}`))) };
}
const money = (text: string) => text.trim() ? parseMoney(text) : null;
function count(text: string, label: string) { if (!/^\d+$/.test(text.trim())) throw new Error(`${label}: informe um número inteiro.`); return Number(text); }
function inactiveCount(text: string, min: number) { const n = /^\d+$/.test(text.trim()) ? Number(text) : NaN; return Number.isSafeInteger(n) && n >= min && n <= 10_000 ? n : 1; }
function percent(text: string) { if (!text.trim()) return null; if (!/^\d+(?:[,.]\d{1,2})?$/.test(text.trim())) throw new Error("Percentual: use um número de 0 a 100 com até duas casas decimais."); return Number(text.trim().replace(",", ".")); }
export function parseTripDraft(draft: TripDraft): TripPlan {
  const plan: TripPlan = { mode: draft.mode, scenarios: draft.scenarios.map(s => {
    try {
      return { ...s, days: count(s.days, "Dias"), nights: count(s.nights, "Noites"), people: count(s.people, "Viajantes"), budget: money(s.budget), items: s.items.map(item => {
        try {
          const amount = money(item.amount);
          return { ...item, amount, quantity: amount !== null && (item.mode === "unit" || item.category === "activities") ? count(item.quantity, "Quantidade") : inactiveCount(item.quantity, 1), days: amount !== null && item.mode === "personDay" ? count(item.days, "Dias da refeição") : inactiveCount(item.days, 0) };
        }
        catch (error) { throw new Error(`${item.name || "Despesa"}: ${(error as Error).message}`); }
      }), reserve: { mode: s.reserve.mode, amount: s.reserve.mode === "fixed" ? money(s.reserve.amount) : null, percent: s.reserve.mode === "percent" ? percent(s.reserve.percent) : null } };
    } catch (error) { throw new Error(`${s.name || "Destino"}: ${(error as Error).message}`); }
  }) };
  validateTripPlan(plan);
  return plan;
}
export function tripToDraft(plan: TripPlan): TripDraft {
  const text = (n: number | null) => n === null ? "" : moneyInput(n);
  return { mode: plan.mode, scenarios: plan.scenarios.map(s => ({ ...s, days: String(s.days), nights: String(s.nights), people: String(s.people), budget: text(s.budget), items: s.items.map(i => ({ ...i, amount: text(i.amount), quantity: String(i.quantity), days: String(i.days) })), reserve: { ...s.reserve, amount: text(s.reserve.amount), percent: s.reserve.percent === null ? "" : String(s.reserve.percent).replace(".", ",") } })) };
}

import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { addCustomAmenity, removeCustomAmenity, calculateComparison, calculateCommute, emptyComparison, relevantDifferences, type Comparison, type Cost } from "../src/lib/calculations/property-comparison";
import { decodeComparison, encodeComparison } from "../src/lib/property-storage";
import { comparisonSheets, createComparisonExcel, createComparisonPdf } from "../src/lib/export/property-comparison";
const cost = (name: string, cents: number, period: Cost["period"] = "monthly"): Cost => ({ id: name, name, cents, period });
const run = (edit: (v: Comparison) => void) => { const v = emptyComparison(); edit(v); return calculateComparison(v); };
function example() {
  const v = emptyComparison(), [a, b] = v.properties;
  Object.assign(a, { name: "Perto do trabalho", main: 200000, condo: 35000, tax: 96000, taxPeriod: "annual", included: ["water", "gym", "garage"], transport: [cost("Transporte", 15000)], food: [cost("Almoço", 10000)], commute: { outward: 15, return: 15, days: 5 } });
  Object.assign(b, { name: "Mais afastado", main: 160000, condo: 25000, tax: 84000, taxPeriod: "annual", garage: 15000, transport: [cost("Transporte", 60000)], food: [cost("Almoço", 25000)], commute: { outward: 60, return: 60, days: 5 } });
  v.impacts = { "water:1": { applies: true, cents: 8000 }, "gym:1": { applies: true, cents: 12000 }, "garage:1": { applies: true, cents: 15000 } };
  return v;
}
describe("comparador de imóveis", () => {
  it("garagem usa apenas a diferença ativa e não duplica o impacto salvo", () => {
    const v = emptyComparison();
    v.properties[0].included = ["garage"];
    v.properties[1].garage = 15000;
    v.impacts["garage:1"] = { applies: true, cents: 15000 };
    const r = calculateComparison(v);
    expect(r.scenarios[1]).toMatchObject({ direct: 0, additional: 15000, total: 15000 });
    expect(r.details.filter(d => d.item === "Garagem residencial")).toHaveLength(1);
    v.impacts["garage:1"].applies = false;
    expect(calculateComparison(v).scenarios[1].total).toBe(0);
    v.impacts["garage:1"].applies = true;
    v.properties[1].included = ["garage"];
    expect(calculateComparison(v).scenarios[1].total).toBe(0);
    v.properties[0].included = [];
    v.properties[1].included = [];
    expect(calculateComparison(v).scenarios[1].total).toBe(0);
  });
  it("garagem nova não recebe valor presumido e dados v1 permanecem utilizáveis", () => {
    const v = emptyComparison(); v.properties[0].included = ["garage"];
    expect(calculateComparison(v).scenarios[1].additional).toBe(0);
    v.properties[1].garage = 10000;
    expect(calculateComparison(decodeComparison(encodeComparison(v))).scenarios[1].additional).toBe(10000);
  });
  it("serviço criado aparece para ambos, pergunta pelo impacto e pode ser removido", () => {
    let v = addCustomAmenity(emptyComparison(), "custom-charger", " Carregador para veículo elétrico ");
    expect(v.amenities.at(-1)).toEqual({ id: "custom-charger", label: "Carregador para veículo elétrico", group: "Serviço" });
    for (const index of [0, 1]) {
      v.properties[index].included = ["custom-charger"];
      expect(relevantDifferences(v)).toMatchObject([{ id: "custom-charger", includedIn: index, missingIn: 1 - index }]);
      expect(calculateComparison(v).unanswered).toEqual(["Carregador para veículo elétrico"]);
      expect(calculateComparison(v).scenarios[1 - index].additional).toBe(0);
      v.properties[index].included = [];
    }
    v.properties[0].included = ["custom-charger"];
    v.impacts["custom-charger:1"] = { applies: true, cents: 5000 };
    expect(calculateComparison(v).scenarios[1].additional).toBe(5000);
    v.impacts["custom-charger:1"].applies = false;
    expect(calculateComparison(v).scenarios[1].additional).toBe(0);
    v.impacts["custom-charger:0"] = { applies: true, cents: 3000 };
    v = removeCustomAmenity(v, "custom-charger");
    expect(v.amenities.some(a => a.id === "custom-charger")).toBe(false);
    expect(v.properties.map(p => p.included)).toEqual([[], []]);
    expect(v.impacts).toEqual({});
    expect(relevantDifferences(v)).toEqual([]);
    expect(decodeComparison(encodeComparison(v))).toEqual(v);
    expect(calculateComparison(v).scenarios.map(s => s.total)).toEqual([0, 0]);
  });
  it("não cria serviço vazio nem remove itens padrão", () => {
    const v = emptyComparison();
    expect(addCustomAmenity(v, "custom-empty", "   ")).toBe(v);
    expect(removeCustomAmenity(v, "garage")).toBe(v);
  });
  it("todos os campos zerados e sem deslocamento", () => { const r = calculateComparison(emptyComparison()); expect(r.scenarios.map(s => s.total)).toEqual([0, 0]); expect(r.delta).toEqual({ direct: 0, monthly: 0, annual: 0, unique: 0, time: 0 }); });
  it("apenas aluguel", () => { const r = run(v => { v.properties[0].main = 123456; }); expect(r.scenarios[0].total).toBe(123456); expect(r.scenarios[0].annual).toBe(1481472); });
  it("IPTU mensal", () => expect(run(v => { v.properties[0].tax = 8000; v.properties[0].taxPeriod = "monthly"; }).scenarios[0].direct).toBe(8000));
  it("IPTU anual", () => expect(run(v => { v.properties[0].tax = 96000; v.properties[0].taxPeriod = "annual"; }).scenarios[0].direct).toBe(8000));
  it("custo personalizado anual", () => expect(run(v => { v.properties[0].costs = [cost("Seguro", 120001, "annual")]; }).scenarios[0].direct).toBe(10000));
  it("água incluída em A com custo confirmado em B", () => { const r = run(v => { v.properties[0].included = ["water"]; v.impacts["water:1"] = { applies: true, cents: 8000 }; }); expect(r.scenarios[1].additional).toBe(8000); expect(r.scenarios[0].additional).toBe(0); });
  it.each([null, false, true])("academia só gera custo se confirmado: %s", applies => { const r = run(v => { v.properties[0].included = ["gym"]; v.impacts["gym:1"] = { applies, cents: 12000 }; }); expect(r.scenarios[1].additional).toBe(applies ? 12000 : 0); });
  it("garagem paga entra uma vez; IPTU incluído ignora campo antigo", () => { const r = calculateComparison(example()); expect(r.scenarios[1].direct).toBe(192000); expect(r.scenarios[1].additional).toBe(35000); const s = run(v => { v.properties[0].included = ["tax", "garage"]; v.properties[0].tax = 20000; v.properties[0].garage = 30000; }); expect(s.scenarios[0].direct).toBe(0); });
  it("transporte diferente", () => expect(run(v => { v.properties[0].transport = [cost("Combustível", 15000)]; v.properties[1].transport = [cost("Combustível", 60000)]; }).delta.monthly).toBe(45000));
  it("alimentação diferente", () => expect(run(v => { v.properties[0].food = [cost("Almoço", 10000)]; v.properties[1].food = [cost("Almoço", 25000)]; }).delta.monthly).toBe(15000));
  it("ida, volta e dias: 52 semanas/ano", () => { expect(calculateCommute({ outward: 15, return: 15, days: 5 })).toEqual({ weekly: 2.5, monthly: 2.5 * 52 / 12, annual: 130 }); });
  it("A mais barato diretamente mas mais caro no total", () => { const r = run(v => { v.properties[0].main = 100000; v.properties[1].main = 150000; v.properties[0].transport = [cost("Rotina", 60000)]; }); expect(r.delta.direct).toBe(50000); expect(r.delta.monthly).toBe(-10000); });
  it("B mais barato diretamente e no total", () => { const r = run(v => { v.properties[0].main = 150000; v.properties[1].main = 100000; }); expect(r.delta.direct).toBe(-50000); expect(r.delta.monthly).toBe(-50000); });
  it("totais iguais apesar de custos diferentes", () => expect(run(v => { v.properties[0].main = 10000; v.properties[1].transport = [cost("Rotina", 10000)]; }).delta.monthly).toBe(0));
  it("diferenças de inclusões invertidas e custos antigos ignorados", () => { const v = emptyComparison(); v.properties[1].included = ["water"]; v.impacts["water:0"] = { applies: true, cents: 5000 }; expect(relevantDifferences(v)[0].missingIn).toBe(0); expect(calculateComparison(v).delta.monthly).toBe(-5000); v.properties[0].included = ["water"]; expect(calculateComparison(v).delta.monthly).toBe(0); });
  it("arredonda metade de centavo para cima", () => expect(run(v => { v.properties[0].costs = [cost("Taxa", 6, "annual"), cost("Seguro", 5, "annual")]; }).scenarios[0].direct).toBe(1));
  it("itens personalizados nos custos e no checklist", () => { const r = run(v => { v.amenities.push({ id: "custom-1", label: "Limpeza", group: "Serviço" }); v.properties[1].included = ["custom-1"]; v.impacts["custom-1:0"] = { applies: true, cents: 1000 }; v.properties[0].other = [cost("Serviço local", 500)]; }); expect(r.scenarios[0].total).toBe(1500); });
  it("valida o exemplo completo", () => { const r = calculateComparison(example()); expect(r.scenarios.map(s => s.direct)).toEqual([243000, 192000]); expect(r.scenarios.map(s => s.total)).toEqual([268000, 312000]); expect(r.scenarios.map(s => s.annual)).toEqual([3216000, 3744000]); expect(r.delta.monthly).toBe(44000); expect(r.delta.annual).toBe(528000); expect(r.delta.time).toBe(32.5); });
  it("restaura a persistência versionada sem alterar dados", () => { const v = example(); expect(decodeComparison(encodeComparison(v))).toEqual(v); expect(() => decodeComparison('{"version":2}')).toThrow(); expect(() => decodeComparison('{"version":1,"values":{}}')).toThrow(); });
  it("rejeita dinheiro inválido e tempo fora dos limites", () => { expect(() => run(v => { v.properties[0].main = 1.1; })).toThrow(); expect(() => calculateCommute({ outward: 1, return: 1, days: 8 })).toThrow(); expect(() => calculateCommute({ outward: NaN, return: 1, days: 5 })).toThrow(); });
});
describe("relatórios da comparação", () => {
  const options = { brand: { name: "QuantoCusta", domain: "" }, generatedAt: new Date("2026-10-02T12:00:00Z") };
  it("abas, números reais, valores anuais originais e diferenças", () => { const sheets = comparisonSheets(calculateComparison(example()), options); expect(sheets.map(s => s.sheet)).toEqual(["Resumo", "Comparação detalhada", "Premissas"]); expect(sheets[0].data.find(r => r[0] === "Custo recorrente mensal")?.slice(1)).toMatchObject([{ value: 2680, type: Number }, { value: 3120, type: Number }, { value: 440, type: Number }]); expect(sheets[1].data.find(r => r[1] === "IPTU")?.[4]).toMatchObject({ value: 960 }); });
  it("gera XLSX real", async () => { const blob = await createComparisonExcel(calculateComparison(example()), options); expect([...new Uint8Array(await blob.arrayBuffer()).slice(0, 4)]).toEqual([80, 75, 3, 4]); });
  it("gera PDF paginado e suporta nomes longos e caracteres fora do WinAnsi", async () => { const v = example(); v.properties[0].name = "Casa 🏠"; v.properties[1].costs = Array.from({ length: 50 }, (_, i) => cost(`Despesa ${i} ${"a".repeat(60)}`, 1000, "annual")); const result = calculateComparison(v), before = structuredClone(result); const pdf = await PDFDocument.load(await createComparisonPdf(result, options)); expect(pdf.getTitle()).toBe("Comparação de imóveis"); expect(pdf.getPageCount()).toBeGreaterThan(2); expect(result).toEqual(before); });
});

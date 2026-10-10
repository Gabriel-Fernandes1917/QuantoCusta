import { describe, expect, it, vi } from "vitest";
import { PDFPage, PDFDocument } from "pdf-lib";
import { addCustomAmenity, breakEvenText, calculateComparison, defaultImpactPeriod, differenceCopy, emptyComparison, includedItems, type Comparison, type ExpensePeriod } from "../src/lib/calculations/property-comparison";
import { decodeComparison, encodeComparison } from "../src/lib/property-storage";
import { comparisonSheets, createComparisonExcel, createComparisonPdf } from "../src/lib/export/property-comparison";

function custom(v: Comparison, id: string, label: string, missing: number, cents: number, period: ExpensePeriod | null) {
  const next = addCustomAmenity(v, id, label);
  next.properties[1 - missing].included.push(id);
  next.impacts[`${id}:${missing}`] = { applies: true, cents, period };
  return next;
}
function manualExample() {
  let v = emptyComparison();
  Object.assign(v.properties[0], { main: 200000, condo: 30000, transport: [{ id: "a-transit", name: "Transporte", cents: 20000, period: "monthly" }] });
  Object.assign(v.properties[1], { main: 230000, condo: 30000, included: ["gym"], transport: [{ id: "b-transit", name: "Transporte", cents: 10000, period: "monthly" }] });
  v.impacts["gym:0"] = { applies: true, cents: 15000, period: "monthly" };
  v = custom(v, "custom-furniture", "Móveis", 0, 500000, "once");
  return v;
}

describe("periodicidades e custos únicos", () => {
  it.each(["water", "internet", "gym", "garage"])("%s mensal, nos dois sentidos, sem duplicação", id => {
    for (const missing of [0, 1]) {
      const v = emptyComparison(); v.properties[1 - missing].included = [id];
      v.impacts[`${id}:${missing}`] = { applies: true, cents: 15000, period: "monthly" };
      if (id === "garage") v.properties[missing].garage = 15000;
      const r = calculateComparison(v);
      expect(r.scenarios[missing]).toMatchObject({ direct: 0, additional: 15000, total: 15000, annual: 180000, unique: 0 });
      expect(r.scenarios[1 - missing].total).toBe(0);
      expect(r.details.filter(d => d.category === "Custos adicionais")).toHaveLength(1);
    }
  });
  it("IPTU anual usa a fonte direta, ignorando outro valor de impacto", () => {
    const v = emptyComparison(); v.properties[0].included = ["tax"];
    v.properties[1].tax = 120001;
    v.impacts["tax:1"] = { applies: true, cents: 999999, period: "annual" };
    const r = calculateComparison(v);
    expect(r.scenarios[1]).toMatchObject({ direct: 10000, additional: 0, annual: 120000 });
    expect(r.details.find(d => d.item === "IPTU")).toMatchObject({ informedB: 120001, periodB: "annual" });
  });
  it.each(["monthly", "annual", "once"] as const)("garagem aceita %s sem contabilizar o impacto novamente", period => {
    const v = emptyComparison(); v.properties[0].included = ["garage"];
    Object.assign(v.properties[1], { garage: 120000, garagePeriod: period });
    v.impacts["garage:1"] = { applies: true, cents: 120000, period };
    const r = calculateComparison(v);
    expect(r.scenarios[1].additional).toBe(period === "once" ? 0 : period === "annual" ? 10000 : 120000);
    expect(r.scenarios[1].unique).toBe(period === "once" ? 120000 : 0);
  });
  it("IPTU único não entra no custo direto recorrente", () => {
    const v = emptyComparison(); Object.assign(v.properties[0], { tax: 120000, taxPeriod: "once" });
    expect(calculateComparison(v).scenarios[0]).toMatchObject({ direct: 0, total: 0, annual: 0, unique: 120000 });
  });
  it.each(["monthly", "annual", "once"] as const)("item personalizado %s preserva o valor e separa totais", period => {
    const v = custom(emptyComparison(), "custom-fee", "Taxa", 0, 120006, period);
    const r = calculateComparison(v);
    expect(r.scenarios[0].total).toBe(period === "once" ? 0 : period === "annual" ? 10001 : 120006);
    expect(r.scenarios[0].unique).toBe(period === "once" ? 120006 : 0);
    expect(r.details.find(d => d.item === "Taxa")).toMatchObject({ informedA: 120006, periodA: period });
    expect(decodeComparison(encodeComparison(v))).toEqual(v);
  });
  it.each(["Móveis", "Eletrodomésticos"])("%s de R$5.000 não altera mês, ano ou distribuição", label => {
    const r = calculateComparison(custom(emptyComparison(), "custom-item", label, 0, 500000, "once"));
    expect(r.scenarios[0]).toMatchObject({ total: 0, annual: 0, additional: 0, unique: 500000 });
    expect(r.scenarios[0].categories.every(c => c.cents === 0)).toBe(true);
    expect(r.delta.unique).toBe(-500000);
  });
  it("custos únicos nos dois imóveis e diferença correta", () => {
    const v = custom(custom(emptyComparison(), "custom-furniture", "Móveis", 0, 500000, "once"), "custom-appliances", "Eletrodomésticos", 1, 300000, "once");
    const r = calculateComparison(v);
    expect(r.scenarios.map(s => s.unique)).toEqual([500000, 300000]);
    expect(r.delta).toMatchObject({ unique: -200000, monthly: 0, annual: 0 });
  });
  it.each([0, 1])("ponto de equilíbrio com maior custo inicial e menor recorrente no cenário %s", missing => {
    const v = custom(emptyComparison(), "custom-furniture", "Móveis", missing, 500000, "once");
    v.properties[missing].main = 200000; v.properties[1 - missing].main = 225000;
    const r = calculateComparison(v);
    expect(r.breakEven).toEqual({ months: 20, initialDifference: 500000, monthlySaving: 25000, scenario: missing });
    expect(breakEvenText(r)).toBe(`Imóvel ${missing === 0 ? "A" : "B"} exige R$ 5.000,00 a mais inicialmente, mas possui um custo recorrente de R$ 250,00 a menos por mês.\n\nMantendo os valores informados constantes, essa diferença inicial seria compensada pela economia recorrente em aproximadamente 20 meses.`);
    expect(breakEvenText(r)).not.toMatch(/\bcompensa\b|vale.*pena|melhor opção|mais vantajoso|escolha|recomendamos/);
  });
  it("ponto de equilíbrio fracionário usa a diferença inicial líquida", () => {
    const v = custom(custom(emptyComparison(), "custom-furniture", "Móveis", 0, 500000, "once"), "custom-appliances", "Eletrodomésticos", 1, 100000, "once");
    v.properties[1].main = 30000;
    expect(calculateComparison(v).breakEven?.months).toBeCloseTo(13.333333);
  });
  it("texto do cenário B usa nome personalizado e meses fracionários", () => {
    const v = custom(emptyComparison(), "custom-furniture", "Móveis", 1, 2000000, "once");
    v.properties[0].main = 260000;
    v.properties[1].main = 200000;
    v.properties[1].name = "Apartamento Centro";
    const r = calculateComparison(v);
    expect(r.breakEven?.months).toBeCloseTo(33.333333);
    expect(breakEvenText(r)).toBe("Apartamento Centro exige R$ 20.000,00 a mais inicialmente, mas possui um custo recorrente de R$ 600,00 a menos por mês.\n\nMantendo os valores informados constantes, essa diferença inicial seria compensada pela economia recorrente em aproximadamente 33,3 meses.");
  });
  it.each(["no-unique", "equal-monthly", "higher-monthly", "equal-unique"])("não calcula equilíbrio: %s", situation => {
    let v = emptyComparison();
    if (situation !== "no-unique") v = custom(v, "custom-furniture", "Móveis", 0, 500000, "once");
    if (situation === "higher-monthly") v.properties[0].main = 10000;
    if (situation === "equal-unique") { v = custom(v, "custom-appliances", "Eletrodomésticos", 1, 500000, "once"); v.properties[1].main = 10000; }
    expect(calculateComparison(v).breakEven).toBeNull();
    expect(breakEvenText(calculateComparison(v))).toBe("");
  });
  it("cenário solicitado: R$2.650 e R$2.700 recorrentes, R$5.000 únicos, equilíbrio 100 meses", () => {
    const r = calculateComparison(manualExample());
    expect(r.scenarios.map(s => s.total)).toEqual([265000, 270000]);
    expect(r.scenarios.map(s => s.annual)).toEqual([3180000, 3240000]);
    expect(r.scenarios.map(s => s.unique)).toEqual([500000, 0]);
    expect(r.scenarios[0].categories.reduce((n, c) => n + c.cents, 0)).toBe(265000);
    expect(r.delta).toMatchObject({ direct: 30000, monthly: 5000, annual: 60000, unique: -500000 });
    expect(r.breakEven?.months).toBe(100);
  });
  it("exige escolha para novo item personalizado, mantendo dados mensais antigos", () => {
    const v = custom(emptyComparison(), "custom-furniture", "Móveis", 0, 500000, null);
    expect(() => calculateComparison(v)).toThrow(/Escolha/);
    v.impacts["custom-furniture:0"].applies = false;
    expect(calculateComparison(v).scenarios[0].total).toBe(0);
    delete v.impacts["custom-furniture:0"].period;
    v.impacts["custom-furniture:0"].applies = true;
    expect(calculateComparison(decodeComparison(encodeComparison(v))).scenarios[0].total).toBe(500000);
  });
  it("valores padrão, perguntas contextuais e nomes em ambos os sentidos", () => {
    expect(defaultImpactPeriod("tax")).toBe("annual");
    expect(defaultImpactPeriod("custom-furniture")).toBeNull();
    for (const item of includedItems) {
      if (item.id !== "tax") expect(defaultImpactPeriod(item.id)).toBe("monthly");
      for (const [included, missing] of [["Casa A", "Casa B"], ["Casa B", "Casa A"]]) {
        const copy = differenceCopy(item, included, missing);
        expect(copy.statement).toContain(included); expect(copy.statement).toContain(missing);
        expect(copy.question).toContain(missing);
        expect(copy.question).not.toMatch(/impacto financeiro|Essa diferença/);
      }
    }
    expect(differenceCopy(includedItems[3], "A", "B").question).toContain("contratar internet");
    expect(differenceCopy({ id: "custom-furniture", label: "Móveis", group: "Serviço" }, "A", "B").question).toContain("contratar ou comprar este item");
  });
  it("não cria serviço duplicado por nome nem aceita inclusões repetidas", () => {
    const v = addCustomAmenity(emptyComparison(), "custom-furniture", "Móveis");
    expect(addCustomAmenity(v, "custom-copy", " móveis ")).toBe(v);
    expect(addCustomAmenity(v, "custom-gym", "Academia")).toBe(v);
    v.properties[0].included = ["custom-furniture", "custom-furniture"];
    expect(() => calculateComparison(v)).toThrow();
  });
  it("rejeita periodicidade inválida e ignora gastos cuja diferença deixou de existir", () => {
    const v = custom(emptyComparison(), "custom-furniture", "Móveis", 0, 500000, "once");
    v.properties[0].included.push("custom-furniture");
    expect(calculateComparison(v).scenarios[0].unique).toBe(0);
    const invalid = JSON.parse(encodeComparison(v)); invalid.values.impacts["custom-furniture:0"].period = "weekly";
    expect(() => decodeComparison(JSON.stringify(invalid))).toThrow();
  });
});

describe("relatórios com periodicidades", () => {
  const options = { brand: { name: "Coyler", domain: "" }, generatedAt: new Date("2026-10-03T12:00:00Z") };
  function reportExample() {
    const v = custom(manualExample(), "custom-fee", "Taxa", 1, 120001, "annual");
    return calculateComparison(v);
  }
  it("Excel separa valores anuais, mensais e únicos, com equivalente mensal vazio para único", async () => {
    const result = reportExample(), sheets = comparisonSheets(result, options);
    const furniture = sheets[1].data.find(r => r[1] === "Móveis")!;
    expect(furniture.slice(2, 4)).toEqual(["Único", "Único"]);
    expect(furniture[4]).toMatchObject({ value: 5000 });
    expect(furniture.slice(6, 9)).toEqual([null, null, null]);
    expect(furniture[9]).toMatchObject({ value: 5000 });
    const fee = sheets[1].data.find(r => r[1] === "Taxa")!;
    expect(fee.slice(2, 4)).toEqual(["Anual", "Anual"]);
    expect(fee[5]).toMatchObject({ value: 1200.01 });
    expect(fee[7]).toMatchObject({ value: 100 });
    expect(fee[12]).toMatchObject({ value: 1200.01 });
    expect(sheets[1].data.find(r => r[1] === "Academia")?.[2]).toBe("Mensal");
    expect(sheets[0].data.find(r => r[0] === "Custos únicos")?.[1]).toMatchObject({ value: 5000 });
    expect(sheets[0].data.find(r => r[0] === "Ponto de equilíbrio (meses)")?.[1]).toMatchObject({ value: result.breakEven?.months });
    expect(sheets[0].data.find(r => r[0] === "Comparação matemática")?.[1]).toMatchObject({ value: breakEvenText(result) });
    expect(sheets[2].data.some(r => r[0] === "Planilha editável")).toBe(true);
    const blob = await createComparisonExcel(result, options);
    expect([...new Uint8Array(await blob.arrayBuffer()).slice(0, 4)]).toEqual([80, 75, 3, 4]);
  });
  it("PDF desenha periodicidades, custos separados e equilíbrio no documento real", async () => {
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const result = reportExample(), before = structuredClone(result);
      const bytes = await createComparisonPdf(result, options);
      const text = draw.mock.calls.map(args => args[0]).join("\n");
      expect(text).toContain("(Único)"); expect(text).toContain("(Anual)"); expect(text).toContain("(Mensal)");
      expect(text).toContain("Custos únicos"); expect(text).toContain("R$ 5.000,00");
      expect(text).toContain("Ponto de equilíbrio matemático");
      expect(text).toContain("Imóvel A exige R$ 5.000,00 a mais inicialmente");
      expect(text).toContain("a menos por mês.");
      expect(text).toContain("compensada pela economia recorrente");
      expect(text).toContain("Diferença recorrente mensal");
      expect(text).not.toContain("R$ 60.000,00");
      expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
      expect(result).toEqual(before);
    } finally { draw.mockRestore(); }
  });
});

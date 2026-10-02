import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { allFields, calculateCostOfLiving, emptySimulation } from "../src/lib/calculations/cost-of-living";
import { createPlanningPdf } from "../src/lib/export/pdf";
import { createPlanningExcel, planningSheets } from "../src/lib/export/excel";
import { reportDate, reportFilename, reportFooter, reportNotes } from "../src/lib/export/report";

const options = { brand: { name: "QuantoCusta", domain: "quantocusta.example" }, generatedAt: new Date("2026-10-02T01:30:00Z") };

describe("relatórios do resultado calculado", () => {
  it("usa a data de Brasília e um domínio configurável", () => {
    expect(reportDate(options.generatedAt)).toBe("01/10/2026, 22:30");
    expect(reportFilename(options.generatedAt, "pdf")).toBe("quantocusta-planejamento-2026-10-01.pdf");
    expect(reportFilename(options.generatedAt, "xlsx")).toBe("quantocusta-planejamento-2026-10-01.xlsx");
    expect(reportFooter(options.brand)).toBe("Planejamento criado com QuantoCusta — quantocusta.example");
    expect(reportFooter({ name: "QuantoCusta", domain: "" })).toBe("Planejamento criado com QuantoCusta");
  });
  it("exporta duas abas, dados numéricos, moeda e periodicidade original", () => {
    const result = calculateCostOfLiving({ ...emptySimulation(), hasVehicle: true, salary: 100000, rent: 150000, vehicleTax: 240000 });
    const sheets = planningSheets(result, options);
    expect(sheets.map(sheet => sheet.sheet)).toEqual(["Resumo", "Detalhamento"]);
    const balance = sheets[0].data.find(row => row[0] === "Saldo mensal");
    expect(balance?.[1]).toMatchObject({ value: -700, type: Number, format: expect.stringContaining("R$") });
    const tax = sheets[1].data.find(row => row[1] === "IPVA");
    expect(tax?.slice(0, 3)).toEqual(["Transporte", "IPVA", "Anual"]);
    expect(tax?.[3]).toMatchObject({ value: 2400, type: Number });
    expect(tax?.[4]).toMatchObject({ value: 200, type: Number });
    expect(sheets[1].data).toHaveLength(4); // Cabeçalho, renda e duas despesas.
    expect(sheets[0].columns?.every(column => column.width && column.width > 20)).toBe(true);
  });
  it("não recalcula os resultados durante a exportação", () => {
    const result = { ...calculateCostOfLiving(emptySimulation()), balance: 12345, annualExpenses: 67890 };
    const summary = planningSheets(result, options)[0].data;
    expect(summary.find(row => row[0] === "Saldo mensal")?.[1]).toMatchObject({ value: 123.45 });
    expect(summary.find(row => row[0] === "Custo anual estimado")?.[1]).toMatchObject({ value: 678.9 });
  });
  it("mantém VA/VR separado e formata percentuais como números do Excel", () => {
    const result = calculateCostOfLiving({ ...emptySimulation(), salary: 100000, groceries: 50000, foodBenefits: 20000, benefitUse: 20000 });
    const summary = planningSheets(result, options)[0].data;
    expect(summary.find(row => row[0] === "VA/VR")?.[1]).toMatchObject({ value: 200 });
    expect(summary.find(row => row[0] === "Percentual da renda comprometida")?.[1]).toMatchObject({ value: 0.3, format: "0.0%" });
    expect(reportNotes(result).join(" ")).toContain("VA/VR aplicado em alimentação: R$ 200,00");
  });
  it("não exporta linhas de veículo desativado ou despesas zeradas", () => {
    const result = calculateCostOfLiving({ ...emptySimulation(), hasVehicle: false, fuel: 100000, publicTransport: 10000 });
    const rows = planningSheets(result, options)[1].data;
    expect(rows).toHaveLength(2);
    expect(rows[1][1]).toBe("Transporte público");
  });
  it("representa renda zero sem fórmula inválida de percentual", () => {
    const summary = planningSheets(calculateCostOfLiving(emptySimulation()), options)[0].data;
    expect(summary.find(row => row[0] === "Percentual da renda comprometida")?.[1]).toBe("Não calculável (renda zero)");
  });
  it("gera um XLSX real (arquivo ZIP) mesmo sem gastos", async () => {
    const blob = await createPlanningExcel(calculateCostOfLiving(emptySimulation()), options);
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual([80, 75, 3, 4]);
  });
  it("gera PDF válido com metadados e português", async () => {
    const result = calculateCostOfLiving({ ...emptySimulation(), salary: 100000, healthPlan: 150000 });
    const bytes = await createPlanningPdf(result, options);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toBe("Meu planejamento de custo de vida");
    expect(pdf.getAuthor()).toBe("QuantoCusta");
    expect(pdf.getCreationDate()).toEqual(options.generatedAt);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
  it("pagina o PDF completo e mantém o resultado intacto", async () => {
    const values = { ...emptySimulation(), hasVehicle: true };
    allFields.forEach(field => { values[field.id] = 123456; });
    const result = calculateCostOfLiving(values);
    const original = structuredClone(result);
    const pdf = await PDFDocument.load(await createPlanningPdf(result, options));
    expect(pdf.getPageCount()).toBeGreaterThan(2);
    expect(pdf.getPages().every(page => Math.round(page.getWidth()) === 595 && Math.round(page.getHeight()) === 842)).toBe(true);
    expect(result).toEqual(original);
  });
});

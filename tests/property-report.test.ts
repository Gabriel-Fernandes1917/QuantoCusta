import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PropertySummary, PropertyExpenseDetails, PropertyUniqueExpenses } from "../src/components/property-comparison-report";
import { calculateComparison, emptyComparison } from "../src/lib/calculations/property-comparison";

function example(a = 100000, b = 120000) {
  const input = emptyComparison();
  Object.assign(input.properties[0], { name: "Centro", main: a });
  Object.assign(input.properties[1], { name: "Jardins", main: b });
  return input;
}

describe("relatório de imóveis em linguagem natural", () => {
  it.each([[100000, 120000, "Centro"], [120000, 100000, "Jardins"], [0, 20000, "Centro"]])("explica economia nos dois sentidos (%i, %i)", (a, b, name) => {
    const result = calculateComparison(example(a, b));
    const before = structuredClone(result);
    const html = renderToStaticMarkup(createElement(PropertySummary, { result }));
    expect(html).toContain(`${name} tem o menor custo mensal`);
    expect(html).toContain("200,00");
    expect(html).toContain("2.400,00");
    expect(html).not.toContain("B − A");
    expect(result).toEqual(before);
  });
  it("mostra empate sem declarar vencedor e trata ausência de despesas", () => {
    const result = calculateComparison(example(0, 0));
    expect(renderToStaticMarkup(createElement(PropertySummary, { result }))).toContain("mesmo custo mensal");
    expect(renderToStaticMarkup(createElement(PropertyExpenseDetails, { result }))).toContain("Nenhuma despesa foi informada");
  });
  it.each([0, 1])("identifica maior tempo de deslocamento no imóvel %i", index => {
    const input = example();
    input.properties[index].commute = { outward: 30, return: 30, days: 3 };
    const result = calculateComparison(input);
    const html = renderToStaticMarkup(createElement(PropertySummary, { result }));
    expect(html).toContain(`${input.properties[index].name} exige 13 horas a mais`);
  });
  it("separa pagamentos únicos e anuais sem repetir o valor mensal informado", () => {
    const input = example();
    input.properties[0].tax = 120000;
    input.properties[1].included = ["gym"];
    input.impacts["gym:0"] = { applies: true, cents: 50000, period: "once" };
    const result = calculateComparison(input);
    const html = renderToStaticMarkup(createElement(PropertyExpenseDetails, { result }));
    expect(html).toContain("Valor anual informado");
    expect(html).toContain("Despesa única");
    expect(html).toContain("Fora do custo mensal");
    expect(html).toContain("Não há diferença mensal nesta despesa");
    expect(html).not.toContain("Valor mensal informado");
    expect(html).toContain('aria-hidden="true"');
    const unique = renderToStaticMarkup(createElement(PropertyUniqueExpenses, { result }));
    expect(unique).toContain("Jardins exige");
    expect(unique).toContain("500,00");
    expect(result.scenarios[0].unique).toBe(50000);
    expect(result.scenarios[0].total).toBe(110000);
  });
});

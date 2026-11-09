import React from "react";
import type { ComparisonResult } from "../lib/calculations/property-comparison";
import { formatMoney } from "../lib/money";

type Props = { result: ComparisonResult };
const hours = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function savingText(a: string, b: string, delta: number, once = false) {
  if (delta === 0) return once ? "As despesas únicas são iguais nas duas opções." : "Não há diferença mensal nesta despesa.";
  const cheaper = delta > 0 ? a : b;
  const other = delta > 0 ? b : a;
  return once
    ? `${cheaper} exige ${formatMoney(Math.abs(delta))} a menos em despesas únicas que ${other}.`
    : `${cheaper} custa ${formatMoney(Math.abs(delta))} a menos por mês que ${other} nesta despesa.`;
}

export function PropertySummary({ result }: Props) {
  const [a, b] = result.scenarios;
  const cheaper = result.delta.monthly > 0 ? a : b;
  const other = result.delta.monthly > 0 ? b : a;
  const slower = result.delta.time > 0 ? b : a;
  const faster = result.delta.time > 0 ? a : b;
  return <section className="property-report-summary" aria-label="Resumo da comparação">
    <h3>{result.delta.monthly === 0 ? "As duas opções têm o mesmo custo mensal" : `${cheaper.name} tem o menor custo mensal`}</h3>
    {result.delta.monthly === 0
      ? <p>Com os valores informados, não há economia mensal ou anual entre {a.name} e {b.name}.</p>
      : <><p>Ao escolher {cheaper.name} em vez de {other.name}, a economia seria de:</p><dl className="property-report-savings"><div><dt>Por mês</dt><dd>{formatMoney(Math.abs(result.delta.monthly))}</dd></div><div><dt>Por ano</dt><dd>{formatMoney(Math.abs(result.delta.annual))}</dd></div></dl></>}
    <p>{result.delta.time === 0 ? "As duas opções exigem o mesmo tempo de deslocamento por mês." : `${slower.name} exige ${hours(Math.abs(result.delta.time))} horas a mais de deslocamento por mês que ${faster.name}.`}</p>
    <p className="field-hint">O menor custo não define, sozinho, a melhor escolha. Considere também o deslocamento e o que importa na sua rotina. A comparação usa apenas as despesas informadas.</p>
    {result.unanswered.length > 0 && <p className="field-hint">Há diferenças ainda sem resposta. Elas não entraram nos custos: {result.unanswered.join(", ")}.</p>}
  </section>;
}

export function PropertyUniqueExpenses({ result }: Props) {
  return <section className="comparison-detail"><h3>Despesas únicas</h3><p className="field-hint">Despesas pagas apenas uma vez, não incluídas no custo mensal.</p><div className="property-columns">{result.scenarios.map((s, i) => <article className="scenario-card" key={i}><h4>{s.name}</h4><p className="result-total">{formatMoney(s.unique)}</p></article>)}</div><p className="property-report-conclusion">{savingText(result.scenarios[0].name, result.scenarios[1].name, result.delta.unique, true)}</p></section>;
}

export function PropertyExpenseDetails({ result }: Props) {
  const [a, b] = result.scenarios;
  const details = result.details.filter(d => d.informedA || d.informedB);
  return <section className="comparison-detail"><h3>De onde vem a diferença?</h3><p className="field-hint">Compare o equivalente mensal de cada despesa. Valores anuais são divididos por 12; despesas únicas aparecem separadamente.</p>
    {!details.length && <p className="field-hint">Nenhuma despesa foi informada para comparar.</p>}
    {details.map((d, i) => {
      const max = Math.max(d.a, d.b);
      return <article className="detail-card" key={i}><h4>{d.item}</h4><span>{d.category}</span>
        <dl className="property-report-amounts">{[a, b].map((s, index) => {
          const monthly = index === 0 ? d.a : d.b;
          const informed = index === 0 ? d.informedA : d.informedB;
          const period = index === 0 ? d.periodA : d.periodB;
          return <div key={index}><dt>{s.name}</dt><dd>{formatMoney(monthly)}<span className="field-hint"> /mês</span></dd>
            {period === "annual" && informed > 0 && <dd className="field-hint">Valor anual informado: {formatMoney(informed)}</dd>}
            {period === "once" && <dd className="field-hint">Despesa única: {formatMoney(informed)}. Fora do custo mensal.</dd>}
            {max > 0 && d.a !== d.b && <dd className="distribution-track" aria-hidden="true"><div style={{ width: `${monthly / max * 100}%` }} /></dd>}
          </div>;
        })}</dl>
        <p className="property-report-conclusion">{savingText(a.name, b.name, d.b - d.a)}</p>
        {(d.uniqueA > 0 || d.uniqueB > 0) && <p className="field-hint">{savingText(a.name, b.name, d.uniqueB - d.uniqueA, true)}</p>}
      </article>;
    })}
  </section>;
}

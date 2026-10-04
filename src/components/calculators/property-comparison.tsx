"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { breakEvenNote, breakEvenText, defaultImpactPeriod, differenceCopy, periodLabels, type ExpensePeriod, addCustomAmenity, removeCustomAmenity, calculateComparison, comparisonNotes, emptyComparison, foodItems, propertyName, relevantDifferences, transportItems, type Comparison, type ComparisonResult, type Cost, type Property } from "@/lib/calculations/property-comparison";
import { formatMoney, moneyInput, parseMoney } from "@/lib/money";
import { decodeComparison, encodeComparison, PROPERTY_STORAGE_KEY } from "@/lib/property-storage";
import { MoneyInput } from "../money-input";
import { ExportComparison } from "../export-comparison";
import type { ReportBrand } from "@/lib/export/report";

export function PropertyComparisonCalculator({ reportBrand }: { reportBrand: ReportBrand }) {
  const [values, setValues] = useState<Comparison>(emptyComparison);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [serviceForm, setServiceForm] = useState<number | null>(null);
  const [serviceName, setServiceName] = useState("");
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // Restauração opcional do armazenamento externo, sem salvamento automático.
    setReady(true);
    try { const saved = localStorage.getItem(PROPERTY_STORAGE_KEY); if (saved) { setValues(decodeComparison(saved)); setNotice("Comparação salva carregada. Edite e compare novamente."); } }
    catch { setNotice("Não foi possível carregar a comparação salva. Você pode preencher normalmente ou limpar os dados."); }
  }, []);
  function change(next: Comparison) { setValues(next); setResult(null); setNotice(""); }
  function updateProperty(index: number, patch: Partial<Property>) {
    // Os atalhos do checklist editam os mesmos campos diretos. Sincroniza os rascunhos dos dois controles.
    if (patch.tax !== undefined || patch.garage !== undefined) {
      const active = document.activeElement?.id;
      const ids = [patch.tax !== undefined ? `tax-${index}` : "", patch.tax !== undefined ? `tax-check-${index}` : "", patch.garage !== undefined ? `garage-${index}` : "", patch.garage !== undefined ? `garage-check-${index}` : ""].filter(id => id && id !== active);
      setDraft(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => !ids.includes(id))));
      setErrors(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => !ids.includes(id))));
    }
    change({ ...values, properties: values.properties.map((p, i) => i === index ? { ...p, ...patch } : p) as Comparison["properties"] });
  }
  function money(id: string, label: string, cents: number, onValue: (value: number) => void, hint?: string) {
    return <MoneyInput id={id} label={label} hint={hint} value={draft[id] ?? (cents ? moneyInput(cents) : "")} error={errors[id]} onChange={text => {
      setDraft(previous => ({ ...previous, [id]: text }));
      try { const value = parseMoney(text); setErrors(previous => ({ ...previous, [id]: "" })); if (value !== cents) onValue(value); }
      catch (error) { setErrors(previous => ({ ...previous, [id]: (error as Error).message })); setResult(null); }
    }} />;
  }
  function period(id: string, value: ExpensePeriod, onValue: (value: ExpensePeriod) => void, allowOnce = false) {
    return <div className="period-control"><label htmlFor={`${id}-period`}>Periodicidade</label><select id={`${id}-period`} value={value} onChange={e => onValue(e.target.value as ExpensePeriod)}><option value="monthly">Mensal</option><option value="annual">Anual</option>{allowOnce && <option value="once">Uma única vez</option>}</select></div>;
  }
  function list(index: number, key: "costs" | "transport" | "food" | "other", suggestions?: string[]) {
    const p = values.properties[index];
    const update = (id: string, patch: Partial<Cost>) => updateProperty(index, { [key]: p[key].map(c => c.id === id ? { ...c, ...patch } : c) });
    return <div className="custom-costs">{p[key].map(c => <div className="custom-cost" key={c.id}>
      <label htmlFor={c.id + "-name"}>Nome do custo</label>{suggestions ? <select id={c.id + "-name"} value={c.name} onChange={e => update(c.id, { name: e.target.value })}>{suggestions.map(s => <option key={s}>{s}</option>)}</select> : <input id={c.id + "-name"} maxLength={80} value={c.name} onChange={e => update(c.id, { name: e.target.value })} />}
      {key === "costs" && period(c.id, c.period, value => update(c.id, { period: value as Cost["period"] }))}
      {money(c.id, "Valor" + (c.period === "annual" ? " anual" : " mensal"), c.cents, value => update(c.id, { cents: value }))}
      <button className="text-link" type="button" aria-label={`Remover ${c.name || "custo"} de ${propertyName(p, index)}`} onClick={() => { updateProperty(index, { [key]: p[key].filter(item => item.id !== c.id) }); setErrors(previous => ({ ...previous, [c.id]: "" })); }}>Remover custo</button>
    </div>)}<button type="button" className="secondary-button" disabled={p[key].length >= 50} onClick={() => updateProperty(index, { [key]: [...p[key], { id: crypto.randomUUID(), name: suggestions?.[0] ?? "", cents: 0, period: "monthly" }] })}>+ {key === "costs" ? "Adicionar outro custo do imóvel" : key === "other" ? "Adicionar outro impacto" : "Adicionar gasto"}</button></div>;
  }
  function validate() {
    const invalid = Object.keys(errors).find(id => errors[id] && document.getElementById(id));
    if (invalid) { const input = document.getElementById(invalid); let parent = input?.parentElement; while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; } input?.focus(); setNotice("Confira os campos indicados."); return null; }
    try { return calculateComparison(values); } catch (error) { setNotice((error as Error).message); return null; }
  }
  function submit(e: FormEvent) { e.preventDefault(); const computed = validate(); if (computed) { setResult(computed); requestAnimationFrame(() => resultRef.current?.focus()); } }
  const differences = relevantDifferences(values);
  return <div className="comparison-area"><form onSubmit={submit} noValidate>
    <div className="form-intro"><h2>Dois imóveis, a sua rotina</h2><p>Comece pela moradia. Abra as outras seções conforme precisar. Campos vazios contam como zero; inclua apenas os gastos que mudam entre as opções.</p></div>
    <div className="property-columns">{values.properties.map((p, index) => <section className="property-form" key={index} aria-labelledby={`property-${index}`}>
      <h2 id={`property-${index}`}>Imóvel {index === 0 ? "A" : "B"}</h2>
      <div className="plain-field"><label htmlFor={`name-${index}`}>Nome opcional</label><input id={`name-${index}`} maxLength={80} placeholder={index === 0 ? "Ex.: Centro" : "Ex.: Mais afastado"} value={p.name} onChange={e => updateProperty(index, { name: e.target.value })} /></div>
      <details className="expense-section" open><summary><h3>Custos diretos da moradia</h3><span className="section-chevron" aria-hidden="true">+</span></summary><div className="section-body">
        <div className="plain-field"><label htmlFor={`kind-${index}`}>Custo principal</label><select id={`kind-${index}`} value={p.kind} onChange={e => updateProperty(index, { kind: e.target.value as Property["kind"] })}><option value="rent">Aluguel</option><option value="loan">Parcela/financiamento</option><option value="other">Outro custo mensal</option></select></div>
        <div className="money-grid">{money(`main-${index}`, p.kind === "rent" ? "Aluguel mensal" : p.kind === "loan" ? "Parcela mensal" : "Custo principal mensal", p.main, main => updateProperty(index, { main }))}{money(`condo-${index}`, "Condomínio mensal", p.condo, condo => updateProperty(index, { condo }))}
          {p.included.includes("tax") ? <p className="field-hint">IPTU incluído: não será somado separadamente.</p> : <div>{period(`tax-${index}`, p.taxPeriod, taxPeriod => updateProperty(index, { taxPeriod }), true)}{money(`tax-${index}`, `IPTU (${periodLabels[p.taxPeriod]})`, p.tax, tax => updateProperty(index, { tax }))}</div>}
        </div>
        {list(index, "costs")}
      </div></details>
      <details className="expense-section"><summary><h3>O que já está incluído?</h3><span className="section-chevron" aria-hidden="true">+</span></summary><div className="section-body"><p className="section-note">Marque o que faz parte do preço. Serviços disponíveis só representam economia se você os usaria para substituir um gasto.</p>
        {["Despesa", "Serviço"].map(group => <fieldset className="included-group" key={group}><legend>{group === "Despesa" ? "Despesas incluídas" : "Estrutura e serviços disponíveis"}</legend>{values.amenities.filter(a => a.group === group).map(a => <label key={a.id}><input type="checkbox" checked={p.included.includes(a.id)} onChange={e => updateProperty(index, { included: e.target.checked ? [...p.included, a.id] : p.included.filter(id => id !== a.id) })} />{a.label}</label>)}</fieldset>)}
        {values.amenities.filter(a => a.id.startsWith("custom-")).map(a => <button key={a.id} type="button" className="text-link" aria-label={`Remover ${a.label}`} onClick={() => {
          change(removeCustomAmenity(values, a.id));
          const ids = [`impact-${a.id}:0`, `impact-${a.id}:1`];
          setDraft(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => !ids.includes(id))));
          setErrors(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => !ids.includes(id))));
        }}>Remover {a.label}</button>)}
        {serviceForm === index ? <div className="plain-field">
          <label htmlFor="custom-service-name">Qual serviço ou benefício?</label>
          <input id="custom-service-name" maxLength={80} value={serviceName} autoFocus onChange={e => setServiceName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("add-custom-service")?.click(); } }} />
          <button id="add-custom-service" type="button" className="secondary-button" disabled={!serviceName.trim() || values.amenities.length >= 50} onClick={() => {
            const next = addCustomAmenity(values, `custom-${crypto.randomUUID()}`, serviceName);
            if (next === values) { setNotice("Esse item j\u00e1 est\u00e1 na lista. Marque em qual im\u00f3vel ele est\u00e1 inclu\u00eddo."); return; }
            change(next);
            setServiceName(""); setServiceForm(null);
          }}>Adicionar</button>
          <button type="button" className="text-link" onClick={() => { setServiceName(""); setServiceForm(null); }}>Cancelar</button>
        </div> : <button type="button" className="secondary-button" disabled={values.amenities.length >= 50} onClick={() => { setServiceName(""); setServiceForm(index); }}>+ Adicionar serviço ou benefício não listado</button>}
      </div></details>
      <details className="expense-section"><summary><h3>Como a localização muda sua rotina?</h3><span className="section-chevron" aria-hidden="true">+</span></summary><div className="section-body"><p className="section-note">Informe os custos de cada cenário que variam com a localização. Evite repetir garagem residencial no estacionamento do destino.</p>
        <details><summary>Transporte</summary>{list(index, "transport", transportItems)}</details><details><summary>Alimentação relacionada à rotina</summary><p className="field-hint">Somente gastos provocados pela rotina, sem repetir todo seu orçamento alimentar.</p>{list(index, "food", foodItems)}</details><details><summary>Outros impactos</summary>{list(index, "other")}</details>
      </div></details>
      <details className="expense-section"><summary><h3>Tempo de deslocamento</h3><span className="section-chevron" aria-hidden="true">+</span></summary><div className="section-body"><p className="section-note">Dinheiro e tempo aparecem separados. Use 0 dias quando não houver deslocamento.</p>{([ ["outward", "Minutos na ida", 1440], ["return", "Minutos na volta", 1440], ["days", "Dias por semana", 7] ] as const).map(([key, label, max]) => <div className="plain-field" key={key}><label htmlFor={`${key}-${index}`}>{label}</label><input id={`${key}-${index}`} type="number" min={0} max={max} step="any" value={p.commute[key] || ""} onChange={e => updateProperty(index, { commute: { ...p.commute, [key]: e.target.value === "" ? 0 : Number(e.target.value) } })} /></div>)}</div></details>
    </section>)}</div>
    <section className="checklist-panel"><h2>Diferenças que podem virar gastos</h2><p className="section-note">Nenhum preço é presumido. Se não houver impacto financeiro, marque Não. Não repita valores já informados.</p>{!differences.length && <p className="field-hint">Marque os itens incluídos para identificar diferenças entre os imóveis.</p>}
      {differences.map(d => {
        const id = `${d.id}:${d.missingIn}`, impact = values.impacts[id] ?? { applies: null, cents: 0, period: defaultImpactPeriod(d.id) }, missing = values.properties[d.missingIn];
        const shared = d.id === "tax" || d.id === "garage";
        const cents = shared ? d.id === "tax" ? missing.tax : missing.garage : impact.cents;
        const applies = shared && cents > 0 && impact.applies !== false ? true : impact.applies;
        const selectedPeriod = d.id === "tax" ? missing.taxPeriod : d.id === "garage" ? missing.garagePeriod ?? "monthly" : impact.period === undefined ? "monthly" : impact.period;
        const copy = differenceCopy(d, propertyName(values.properties[d.includedIn], d.includedIn), propertyName(missing, d.missingIn));
        const updateImpact = (patch: Partial<typeof impact>) => change({ ...values, impacts: { ...values.impacts, [id]: { ...impact, ...patch } } });
        return <div className="impact-card" key={id}><p>{copy.statement}</p>
          {d.id === "tax" && <p className="field-hint">Este é o mesmo valor dos custos diretos: entra uma única vez.</p>}
          <fieldset className="vehicle-choice"><legend>{copy.question}</legend><div>{[true, false].map(choice => <label key={String(choice)}><input type="radio" name={id} checked={applies === choice} onChange={() => {
            if (!choice) {
              const ids = [`impact-${id}`, `${d.id}-${d.missingIn}`, `${d.id}-check-${d.missingIn}`];
              setDraft(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !ids.includes(key))));
              setErrors(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !ids.includes(key))));
            }
            const properties = values.properties.map((p, i) => i === d.missingIn && shared && !choice ? { ...p, ...(d.id === "tax" ? { tax: 0 } : { garage: 0 }) } : p) as Comparison["properties"];
            change({ ...values, properties, impacts: { ...values.impacts, [id]: { ...impact, applies: choice } } });
          }} />{choice ? "Sim" : "Não"}</label>)}</div></fieldset>
          {applies === true && <>
            {money(shared ? `${d.id}-check-${d.missingIn}` : `impact-${id}`, "Quanto você estima gastar?", cents, value => shared ? updateProperty(d.missingIn, d.id === "tax" ? { tax: value } : { garage: value }) : updateImpact({ cents: value }))}
            <div className="period-control"><label htmlFor={`impact-period-${id}`}>Esse gasto seria:</label><select id={`impact-period-${id}`} value={selectedPeriod ?? ""} required onChange={e => {
              const period = e.target.value as ExpensePeriod;
              if (shared) updateProperty(d.missingIn, d.id === "tax" ? { taxPeriod: period } : { garagePeriod: period });
              else updateImpact({ period });
            }}><option value="" disabled>Selecione</option><option value="monthly">Mensal</option><option value="annual">Anual</option><option value="once">Uma única vez</option></select></div>
            {selectedPeriod === null && <p className="field-hint">Escolha quando esse gasto acontece para comparar.</p>}
          </>}
        </div>;
      })}
    </section>
    <div className="calculator-actions"><button className="button" disabled={!ready} type="submit">Comparar imóveis ↗</button></div>
    <div className="storage-panel"><p><strong>Seus dados ficam somente neste navegador.</strong> Salvar é opcional; alterações precisam ser salvas novamente.</p><div className="storage-actions"><button type="button" disabled={!ready} onClick={() => { if (!validate()) return; try { localStorage.setItem(PROPERTY_STORAGE_KEY, encodeComparison(values)); setNotice("Comparação salva somente neste navegador."); } catch { setNotice("Não foi possível salvar. Seus campos foram mantidos."); } }}>Salvar simulação</button><button type="button" disabled={!ready} onClick={() => { let removed = true; try { localStorage.removeItem(PROPERTY_STORAGE_KEY); } catch { removed = false; } setValues(emptyComparison()); setServiceForm(null); setServiceName(""); setDraft({}); setErrors({}); setResult(null); setNotice(removed ? "Campos e comparação salva limpos." : "Campos limpos. Não foi possível apagar o armazenamento; limpe os dados do site no navegador."); }}>Limpar meus dados</button></div></div><p role="status" className="calculator-notice">{notice}</p><noscript>Ative JavaScript para calcular no seu dispositivo.</noscript>
  </form>
  {result && <section className="calculator-results comparison-results" tabIndex={-1} ref={resultRef} aria-labelledby="comparison-title"><p className="eyebrow">Preço não é necessariamente custo</p><h2 id="comparison-title">O custo de cada escolha</h2>
    <div className="property-columns">{result.scenarios.map((s, i) => <article className="scenario-card" key={i}><p className="eyebrow">Imóvel {i === 0 ? "A" : "B"}</p><h3>{s.name}</h3><p className="result-total">{formatMoney(s.total)}</p><p className="field-hint">por mês, em custos recorrentes</p><dl>{[["Custo direto", s.direct], ["Custos recorrentes adicionais", s.additional], ["Transporte", s.transport], ["Alimentação relacionada", s.food], ["Outros impactos", s.other], ["Custo recorrente anual", s.annual]].map(([label, cents]) => <div className="comparison-pair" key={label}><dt>{label}</dt><dd>{formatMoney(cents as number)}</dd></div>)}</dl><p className="field-hint">Deslocamento: {hours(s.commute.weekly)} h/semana · {hours(s.commute.monthly)} h/mês · {hours(s.commute.annual)} h/ano.</p><p className="field-hint">Incluído/disponível: {s.included.join(", ") || "Nenhum item marcado"}.</p>{s.direct < s.total && <p className="field-hint">Há {formatMoney(s.total - s.direct)} mensais além dos custos diretos da moradia.</p>}</article>)}</div>
    <div className="result-explanation"><p>Diferença recorrente mensal (B − A): <strong>{formatMoney(result.delta.monthly)}</strong>.</p><p>{differenceText(result.scenarios[1].name, result.scenarios[0].name, result.delta.direct, "custo direto")}</p><p>{differenceText(result.scenarios[1].name, result.scenarios[0].name, result.delta.monthly, "custo total recorrente")}</p><p>Diferença recorrente anual (B − A): <strong>{formatMoney(result.delta.annual)}</strong>. {result.delta.time === 0 ? "Os tempos mensais de deslocamento são iguais." : `${result.scenarios[1].name} envolve ${hours(Math.abs(result.delta.time))} horas ${result.delta.time > 0 ? "a mais" : "a menos"} de deslocamento por mês que ${result.scenarios[0].name}.`}</p></div>
    <section className="comparison-detail"><h3>Custos únicos decorrentes da escolha</h3><div className="property-columns">{result.scenarios.map((s, i) => <article className="scenario-card" key={i}><h4>{s.name}</h4><p className="result-total">{formatMoney(s.unique)}</p><p className="field-hint">Uma única vez; separado dos custos recorrentes.</p></article>)}</div><p>Diferença de custos únicos (B − A): <strong>{formatMoney(result.delta.unique)}</strong>.</p></section>
    {result.breakEven && <section className="result-explanation"><h3>Ponto de equilíbrio matemático</h3>{breakEvenText(result).split("\n\n").map(paragraph => <p key={paragraph}>{paragraph}</p>)}<p className="field-hint">{breakEvenNote}</p></section>}
    <section className="comparison-detail"><h3>Por que os custos são diferentes?</h3><p className="field-hint">Diferença = B − A. Valores recorrentes são equivalentes mensais; custos únicos aparecem separadamente.</p>{result.details.filter(d => d.informedA || d.informedB).map((d, i) => <div className="detail-card" key={i}><strong>{d.item}</strong><span>{d.category}</span><p className="field-hint">Informado: A {formatMoney(d.informedA)} ({periodLabels[d.periodA]}); B {formatMoney(d.informedB)} ({periodLabels[d.periodB]}).</p>{(d.periodA !== "once" || d.periodB !== "once") && <><div>Recorrente mensal: A {d.periodA === "once" ? "—" : formatMoney(d.a)} · B {d.periodB === "once" ? "—" : formatMoney(d.b)}</div><div>Diferença recorrente mensal: {formatMoney(d.b - d.a)}</div></>}{(d.periodA === "once" || d.periodB === "once") && <><div>Custos únicos: A {formatMoney(d.uniqueA)} · B {formatMoney(d.uniqueB)}</div><div>Diferença de custos únicos: {formatMoney(d.uniqueB - d.uniqueA)}</div></>}</div>)}</section>
    <section className="expense-breakdown"><h3>Composição dos custos recorrentes</h3><p className="field-hint">Percentuais do custo mensal recorrente. Custos únicos ficam fora desta distribuição.</p><div className="property-columns">{result.scenarios.map((s, i) => <div key={i}><h4>{s.name}</h4><ul>{s.categories.map(c => <li key={c.label}><div className="distribution-label"><span>{c.label}</span><strong>{s.total ? hours(c.cents / s.total * 100) : "0"}%</strong></div><div className="distribution-track" aria-hidden="true"><div style={{ width: `${s.total ? c.cents / s.total * 100 : 0}%` }} /></div><p>{formatMoney(c.cents)}/mês</p></li>)}</ul></div>)}</div></section>
    <details><summary>Premissas e limites da comparação</summary>{comparisonNotes.map(note => <p className="field-hint" key={note}>{note}</p>)}{result.unanswered.length > 0 && <p className="field-hint">Há diferenças sem resposta. Elas não receberam custos adicionais.</p>}</details>
    <ExportComparison result={result} brand={reportBrand} />
  </section>}
  </div>;
}
function hours(value: number) { return value.toLocaleString("pt-BR", { maximumFractionDigits: 1 }); }
function differenceText(b: string, a: string, delta: number, kind: string) { return delta === 0 ? `${a} e ${b} têm o mesmo ${kind}.` : `O ${kind} de ${b} é ${formatMoney(Math.abs(delta))} ${delta > 0 ? "maior" : "menor"} por mês que o de ${a}.`; }

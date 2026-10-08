"use client";

import { useEffect, useRef, useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { ExportTrip } from "@/components/export-trip";
import { calculateTrip, tripCategories, tripInsights, tripComparisonInsights, tripNotes, type TripCategory, type TripItem, type TripResult } from "@/lib/calculations/trip-cost";
import { newTripScenario, newTripItem, parseTripDraft, tripToDraft, type TripDraft, type TripDraftScenario, type TripDraftItem } from "@/lib/trip-form";
import { decodeTripPlan, encodeTripPlan, TRIP_STORAGE_KEY } from "@/lib/trip-storage";
import { formatMoney, formatPercentage } from "@/lib/money";
import type { ReportBrand } from "@/lib/export/report";

const modeLabels: Record<TripItem["mode"], string> = { total: "Valor total", person: "Valor por pessoa", night: "Valor por diária/noite", personDay: "Valor por pessoa por dia", unit: "Quantidade × valor unitário" };
function itemModes(category: TripCategory): TripItem["mode"][] {
  if (category === "tickets" || category === "activities") return ["total", "person"];
  if (category === "lodging") return ["total", "night"];
  if (category === "food") return ["total", "personDay"];
  if (category === "transport" || category === "other") return ["total", "unit"];
  return ["total"];
}
function CountField({ id, label, value, onChange, min = 0, max = 10_000 }: { id: string; label: string; value: string; onChange: (value: string) => void; min?: number; max?: number }) {
  return <div className="plain-field"><label htmlFor={id}>{label}</label><input id={id} type="number" min={min} max={max} step="1" inputMode="numeric" value={value} onChange={e => onChange(e.target.value)} /></div>;
}
export function TripCostCalculator({ reportBrand }: { reportBrand: ReportBrand }) {
  const [draft, setDraft] = useState<TripDraft>({ mode: "single", scenarios: [newTripScenario("destination-1")] });
  const [active, setActive] = useState(0), [result, setResult] = useState<TripResult | null>(null), [notice, setNotice] = useState(""), [error, setError] = useState("");
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // Restaura o armazenamento externo após a hidratação, como nas outras ferramentas.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { const saved = localStorage.getItem(TRIP_STORAGE_KEY); if (saved) { setDraft(tripToDraft(decodeTripPlan(saved))); setNotice("Simulação salva carregada deste navegador."); } }
    catch { setNotice("Não foi possível carregar a simulação. Você pode preencher novamente ou limpar os dados desta ferramenta."); }
  }, []);
  const s = draft.scenarios[active];
  function change(next: TripDraft) { setDraft(next); setResult(null); setError(""); setNotice(""); }
  function update(patch: Partial<TripDraftScenario>) { change({ ...draft, scenarios: draft.scenarios.map((v,i) => i === active ? { ...v, ...patch } : v) }); }
  function updateItem(id: string, patch: Partial<TripDraftItem>) { update({ items: s.items.map(i => i.id === id ? { ...i, ...patch } : i) }); }
  function switchMode(mode: TripDraft["mode"]) {
    setActive(0); change({ ...draft, mode, scenarios: mode === "compare" && draft.scenarios.length < 2 ? [...draft.scenarios, newTripScenario(undefined, "Destino 2")] : draft.scenarios });
  }
  function calculate() {
    try { setResult(calculateTrip(parseTripDraft(draft))); setError(""); requestAnimationFrame(() => resultRef.current?.focus()); }
    catch (e) { setError((e as Error).message); setResult(null); }
  }
  function save() {
    try { localStorage.setItem(TRIP_STORAGE_KEY, encodeTripPlan(parseTripDraft(draft))); setNotice("Simulação salva somente neste navegador. Novas alterações precisam ser salvas novamente."); setError(""); }
    catch (e) { setNotice(`Não foi possível salvar. ${(e as Error).message}`); }
  }
  function clear() {
    change({ mode: "single", scenarios: [newTripScenario("destination-1")] }); setActive(0);
    try { localStorage.removeItem(TRIP_STORAGE_KEY); setNotice("Campos e simulação salva desta ferramenta foram limpos."); }
    catch { setNotice("Campos limpos. Não foi possível remover os dados salvos; use as configurações do navegador."); }
  }
  return <div className="trip-calculator">
    <fieldset className="vehicle-choice"><legend>O que você quer planejar?</legend><div>{(["single", "compare"] as const).map(mode => <label key={mode}><input type="radio" name="trip-mode" checked={draft.mode === mode} onChange={() => switchMode(mode)} />{mode === "single" ? "Uma viagem" : "Comparar destinos"}</label>)}</div></fieldset>
    {draft.mode === "compare" && <div className="trip-destinations"><div role="group" aria-label="Escolha o destino para preencher">{draft.scenarios.map((v,i) => <button className="secondary-button" type="button" key={v.id} aria-pressed={active === i} onClick={() => { setActive(i); setError(""); }}>{v.name.trim() || `Destino ${i+1}`}</button>)}</div>{draft.scenarios.length < 4 && <button className="secondary-button" type="button" onClick={() => { change({ ...draft, scenarios: [...draft.scenarios, newTripScenario(undefined, `Destino ${draft.scenarios.length+1}`)] }); setActive(draft.scenarios.length); }}>Adicionar destino</button>}</div>}
    <form onSubmit={e => { e.preventDefault(); calculate(); }} noValidate>
      <section className="trip-general" aria-labelledby="trip-general-title"><div className="trip-scenario-heading"><h2 id="trip-general-title">{s.name.trim() || `Destino ${active+1}`}</h2>{draft.mode === "compare" && draft.scenarios.length > 2 && <button type="button" className="text-link" onClick={() => { change({ ...draft, scenarios: draft.scenarios.filter((_,i) => i !== active) }); setActive(0); }}>Remover este destino</button>}</div>
        <div className="money-grid"><div className="plain-field"><label htmlFor={`${s.id}-name`}>Nome do destino</label><input id={`${s.id}-name`} maxLength={100} value={s.name} onChange={e => update({ name: e.target.value })} /></div><CountField id={`${s.id}-days`} label="Quantidade de dias" min={1} value={s.days} onChange={days => update({ days, items: s.items.map(i => i.category === "food" && i.days === s.days ? { ...i, days } : i) })} /><CountField id={`${s.id}-nights`} label="Quantidade de noites" value={s.nights} onChange={nights => update({ nights })} /><CountField id={`${s.id}-people`} label="Número de viajantes" min={1} value={s.people} onChange={people => update({ people })} /><MoneyInput id={`${s.id}-budget`} label="Orçamento disponível (opcional)" hint="Referência para comparar com o total planejado; não é uma despesa." value={s.budget} onChange={budget => update({ budget })} /></div>
        <p className="field-hint">Dias e noites são independentes. Valores em branco não são considerados; informe 0 quando souber que não haverá aquele gasto.</p>
      </section>
      {tripCategories.map(category => <details className="expense-section" key={`${s.id}-${category.id}`}><summary><h3>{category.label}</h3><span>{s.items.filter(i => i.category === category.id && i.amount.trim()).length} valores preenchidos</span><span className="section-chevron" aria-hidden="true">+</span></summary><div className="section-body">
        {category.id === "tickets" && <p className="section-note">Inclua ida e volta conforme seu roteiro, por pessoa ou para todos os viajantes. Pode ser passagem aérea, rodoviária ou outro meio.</p>}
        {category.id === "lodging" && <p className="section-note">Considere café da manhã e serviços incluídos. Registre taxas somente se estiverem fora do preço informado, para evitar dupla contagem.</p>}
        {category.id === "food" && <p className="section-note">No valor diário, ajuste quantos dias a refeição será paga. Não registre novamente refeições já incluídas na hospedagem.</p>}
        {category.id === "transport" && <p className="section-note">Se você já comparou veículo alugado e aplicativo em outra ferramenta do QuantoCusta, pode utilizar aqui o total estimado da alternativa que pretende considerar. A transferência é manual; evite somar novamente despesas incluídas nesse total. <a className="text-link" href="/veiculo-alugado-ou-aplicativo/" target="_blank" rel="noopener noreferrer">Comparar alternativas →</a></p>}
        {category.id === "other" && <p className="section-note">Use para documentação, seguro-viagem, taxas e serviços adicionais. Registre cada despesa em apenas uma categoria.</p>}
        {s.items.filter(i => i.category === category.id).map(item => <details className="trip-item" key={item.id}><summary>{item.name.trim() || "Nova despesa"}<span>{item.amount.trim() ? `R$ ${item.amount}` : "Não informado"}</span></summary><div className="trip-item-body"><div className="plain-field"><label htmlFor={`${item.id}-name`}>{category.id === "activities" ? "Nome do passeio" : "Nome da despesa"}</label><input id={`${item.id}-name`} maxLength={100} value={item.name} onChange={e => updateItem(item.id, { name: e.target.value })} /></div><div className="money-grid"><MoneyInput id={`${item.id}-amount`} label="Valor" value={item.amount} onChange={amount => updateItem(item.id, { amount })} />{itemModes(category.id).length > 1 && <div className="plain-field"><label htmlFor={`${item.id}-mode`}>Como calcular este valor?</label><select id={`${item.id}-mode`} value={item.mode} onChange={e => updateItem(item.id, { mode: e.target.value as TripItem["mode"] })}>{itemModes(category.id).map(mode => <option key={mode} value={mode}>{modeLabels[mode]}</option>)}</select></div>}{(item.mode === "unit" || category.id === "activities") && <CountField id={`${item.id}-quantity`} label={category.id === "activities" ? "Quantidade de ocorrências" : "Quantidade"} min={1} value={item.quantity} onChange={quantity => updateItem(item.id, { quantity })} />}{item.mode === "personDay" && <CountField id={`${item.id}-days`} label="Dias em que esta refeição será paga" max={Number(s.days) || 10_000} value={item.days} onChange={days => updateItem(item.id, { days })} />}</div><button className="text-link" type="button" onClick={() => update({ items: s.items.filter(i => i.id !== item.id) })}>Remover despesa</button></div></details>)}
        {s.items.length < 200 && <button type="button" className="secondary-button" onClick={() => update({ items: [...s.items, { ...newTripItem(category.id, category.id === "activities" ? "Novo passeio" : "Outra despesa"), days: s.days }] })}>{category.id === "activities" ? "Adicionar passeio" : "Adicionar despesa"}</button>}
      </div></details>)}
      <details className="expense-section"><summary><h3>Reserva para imprevistos</h3><span className="section-chevron" aria-hidden="true">+</span></summary><div className="section-body"><div className="plain-field"><label htmlFor={`${s.id}-reserve-mode`}>Quer reservar um valor para imprevistos?</label><select id={`${s.id}-reserve-mode`} value={s.reserve.mode} onChange={e => update({ reserve: { ...s.reserve, mode: e.target.value as TripDraftScenario["reserve"]["mode"] } })}><option value="none">Não adicionar reserva</option><option value="fixed">Valor fixo</option><option value="percent">Percentual dos gastos estimados</option></select></div>{s.reserve.mode === "fixed" && <MoneyInput id={`${s.id}-reserve-amount`} label="Valor reservado" value={s.reserve.amount} onChange={amount => update({ reserve: { ...s.reserve, amount } })} />}{s.reserve.mode === "percent" && <div className="plain-field"><label htmlFor={`${s.id}-reserve-percent`}>Percentual dos gastos estimados (%)</label><input id={`${s.id}-reserve-percent`} inputMode="decimal" value={s.reserve.percent} onChange={e => update({ reserve: { ...s.reserve, percent: e.target.value } })} /></div>}<p className="field-hint">A reserva não é um gasto confirmado. O percentual é aplicado sobre o subtotal, antes da própria reserva.</p></div></details>
      {error && <p className="field-error" role="alert">{error}</p>}
      <button type="submit" className="button">{draft.mode === "single" ? "Calcular custo da viagem" : "Comparar destinos"}</button>
    </form>
    <section className="storage-panel" aria-label="Salvamento local"><p><strong>Seus dados ficam salvos somente neste navegador.</strong> Salve para continuar depois. Esta ferramenta usa seu próprio armazenamento.</p><div className="storage-actions"><button type="button" onClick={save}>Salvar simulação</button><button type="button" onClick={clear}>Limpar dados</button></div><p role="status">{notice}</p></section>
    {result && <section className="calculator-results trip-results" tabIndex={-1} ref={resultRef} aria-labelledby="trip-result-title"><p className="eyebrow">Seus números, suas escolhas</p><h2 id="trip-result-title">{result.scenarios.length === 1 ? "O custo estimado da sua viagem" : "Compare o custo dos destinos"}</h2><p className="section-note">Este total considera somente as despesas preenchidas. Alimentação, transporte e outros gastos podem alterar o custo final.</p>
      {tripComparisonInsights(result).map(note => <p className="trip-insight" key={note}>{note}</p>)}
      {result.scenarios.length > 2 && <p className="trip-insight">Menor total planejado: {formatMoney(result.lowest)} ({result.scenarios.filter(s => s.total === result.lowest).map(s=>s.name).join(", ")}). Maior: {formatMoney(result.highest)} ({result.scenarios.filter(s => s.total === result.highest).map(s=>s.name).join(", ")}). Estes valores consideram apenas os gastos informados.</p>}
      <div className="trip-summary-grid">{result.scenarios.map(s => <article className="scenario-card" key={s.id}><h3>{s.name}</h3><p className="field-hint">{s.days} dias · {s.nights} noites · {s.people} viajantes</p><dl>{[["Gastos estimados",s.subtotal],["Reserva para imprevistos",s.reserve],["Total planejado",s.total],["Custo por pessoa",s.perPerson],["Custo médio por dia",s.perDay]].map(([label,value])=><div className="comparison-pair" key={label}><dt>{label}</dt><dd>{formatMoney(value as number)}</dd></div>)}{s.budget !== null && <><div className="comparison-pair"><dt>Orçamento informado</dt><dd>{formatMoney(s.budget)}</dd></div><div className="comparison-pair"><dt>{s.budgetRemaining! < 0 ? "Excedente projetado" : "Valor restante projetado"}</dt><dd>{formatMoney(Math.abs(s.budgetRemaining!))}</dd></div><div className="comparison-pair"><dt>Orçamento comprometido</dt><dd>{s.budgetPercentage === null ? "Não calculável (orçamento zero)" : formatPercentage(s.budgetPercentage)}</dd></div></>}</dl>
        <p className="field-hint">Maior categoria: {s.largest ? `${s.largest.label} (${formatMoney(s.largest.total)})` : "nenhum gasto positivo informado"}.</p>
        {s.missing.length > 0 && <p className="field-hint">Categorias não consideradas: {s.missing.join(", ")}.</p>}
        <details className="trip-composition"><summary>Composição dos gastos e detalhes</summary><h4>Composição dos gastos estimados (sem reserva)</h4>{s.categories.map(c => <div className="trip-category-bar" key={c.id}><div className="distribution-label"><span>{c.label}</span><strong>{c.considered ? `${formatMoney(c.total)}${c.percentage === null ? "" : ` · ${formatPercentage(c.percentage)}`}` : "Não considerado"}</strong></div>{c.considered && <div className="distribution-track"><div style={{width:`${c.percentage ?? 0}%`}} /></div>}</div>)}<h4>Despesas preenchidas</h4>{s.details.filter(i=>i.total!==null).map(i=><p className="field-hint" key={i.id}>{i.name.trim() || "Despesa sem nome"}: {formatMoney(i.amount!)} · {modeLabels[i.mode]}{i.mode === "personDay" ? ` · ${i.days} dias` : i.mode === "unit" || i.category === "activities" ? ` · ${i.quantity} ocorrências` : ""} → {formatMoney(i.total!)}</p>)}</details>
        <h4 className="trip-insights-title">O que mais pesa na sua viagem?</h4>{tripInsights(s).map(note=><p className="trip-insight" key={note}>{note}</p>)}
      </article>)}</div>
      {result.differences && <section className="trip-differences"><h3>Diferenças entre os dois destinos</h3><p className="field-hint">Diferença absoluta entre {result.scenarios[0].name} e {result.scenarios[1].name}.</p>{[["Total planejado", result.differences.total], ["Custo por pessoa",result.differences.perPerson],["Custo médio por dia",result.differences.perDay]].map(([label,value])=><p className="comparison-pair" key={label}>{label}<strong>{formatMoney(Math.abs(value as number))}</strong></p>)}</section>}
      {result.scenarios.length > 1 && <section className="trip-differences"><h3>Onde estão as maiores diferenças?</h3><div className="trip-category-comparison" role="table" aria-label="Comparação por categoria"><div className="trip-category-row trip-category-header" role="row" style={{"--destinations":result.scenarios.length} as React.CSSProperties}><strong role="columnheader">Categoria</strong>{result.scenarios.map(s=><strong key={s.id} role="columnheader">{s.name}</strong>)}</div>{tripCategories.map((c,i)=><div className="trip-category-row" role="row" key={c.id} style={{"--destinations":result.scenarios.length} as React.CSSProperties}><strong role="rowheader">{c.label}</strong>{result.scenarios.map(s=><span role="cell" key={s.id}><span className="trip-mobile-label">{s.name}: </span>{s.categories[i].considered ? formatMoney(s.categories[i].total) : "Não considerado"}</span>)}{result.differences && <p className="field-hint trip-category-delta">{result.differences.categories[i].delta === null ? "Faltam valores para comparar esta categoria." : `Diferença: ${formatMoney(Math.abs(result.differences.categories[i].delta!))}.`}</p>}</div>)}</div></section>}
      <ExportTrip result={result} brand={reportBrand} />
      <details className="trip-composition"><summary>Premissas e limitações</summary>{tripNotes.map(note=><p className="field-hint" key={note}>{note}</p>)}</details>
    </section>}
  </div>;
}

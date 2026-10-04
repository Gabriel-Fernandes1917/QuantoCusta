"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { calculateMealRoutine, compatibleUnits, emptyIngredient, emptyMeal, emptyMealRoutine, ingredientDetailText, mealTimeDifferenceText, mealDifferenceText, mealInsights, mealNotes, parseMealValue, removeIngredient, removeMeal, unitLabels, units, type Ingredient, type Meal, type MealResult, type MealRoutine, type Unit } from "@/lib/calculations/meal-comparison";
import { decodeMealRoutine, encodeMealRoutine, MEAL_STORAGE_KEY } from "@/lib/meal-storage";
import { formatMoney, formatPercentage, moneyInput } from "@/lib/money";
import { MoneyInput } from "../money-input";
import { ExportMeals } from "../export-meals";
import type { ReportBrand } from "@/lib/export/report";

const hours = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
export function MealComparisonCalculator({ reportBrand }: { reportBrand: ReportBrand }) {
  const [values, setValues] = useState<MealRoutine>(emptyMealRoutine);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<MealResult | null>(null);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [newMeal, setNewMeal] = useState<string | null>(null);
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // Restauração local opcional, sem escrita automática.
    setReady(true);
    try { const saved = localStorage.getItem(MEAL_STORAGE_KEY); if (saved) { setValues(decodeMealRoutine(saved)); setNotice("Sua rotina salva foi carregada. Edite e compare novamente."); } }
    catch { setNotice("Não foi possível carregar a rotina salva. Você pode preencher normalmente ou limpar os dados."); }
  }, []);
  function change(next: MealRoutine) { setValues(next); setResult(null); setNotice(""); }
  function updateMeal(id: string, patch: Partial<Meal>) { change({ ...values, meals: values.meals.map(m => m.id === id ? { ...m, ...patch } : m) }); }
  function updateItem(meal: Meal, id: string, patch: Partial<Ingredient>) { updateMeal(meal.id, { ingredients: meal.ingredients.map(item => item.id === id ? { ...item, ...patch } : item) }); }
  function forget(ids: string[]) {
    const keep = ([key]: [string, string]) => !ids.some(id => key.startsWith(`${id}-`));
    setDraft(previous => Object.fromEntries(Object.entries(previous).filter(keep)));
    setErrors(previous => Object.fromEntries(Object.entries(previous).filter(keep)));
  }
  function valueChange(id: string, text: string, current: number | null, update: (n: number | null) => void, monetary: boolean, optional: boolean) {
    setDraft(previous => ({ ...previous, [id]: text }));
    try { const n = parseMealValue(text, monetary, optional); setErrors(previous => ({ ...previous, [id]: "" })); if (n !== current) update(n); }
    catch (error) { setErrors(previous => ({ ...previous, [id]: (error as Error).message })); setResult(null); }
  }
  function money(id: string, label: string, cents: number | null, update: (n: number | null) => void, optional = false) {
    return <MoneyInput id={id} label={label} value={draft[id] ?? (cents == null || (optional && cents === 0) ? "" : moneyInput(cents))} error={errors[id]} onChange={text => valueChange(id, text, cents, update, true, optional)} />;
  }
  function number(id: string, label: string, n: number | null, update: (n: number | null) => void, hint?: string, optional = false) {
    return <div className="plain-field"><label htmlFor={id}>{label}</label><input id={id} type="text" inputMode="decimal" maxLength={24} value={draft[id] ?? (n == null || (optional && n === 0) ? "" : String(n).replace(".", ","))} placeholder="0" aria-invalid={Boolean(errors[id])} aria-describedby={errors[id] ? `${id}-error` : hint ? `${id}-hint` : undefined} onChange={e => valueChange(id, e.target.value, n, update, false, optional)} />{hint && <p id={`${id}-hint`} className="field-hint">{hint}</p>}{errors[id] && <p id={`${id}-error`} className="field-error">{errors[id]}</p>}</div>;
  }
  function unit(id: string, label: string, value: Unit, options: readonly Unit[], update: (value: Unit) => void) {
    return <div className="plain-field"><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={e => update(e.target.value as Unit)}>{options.map(u => <option key={u} value={u}>{unitLabels[u]}</option>)}</select></div>;
  }
  function focusInvalid(id: string) {
    const element = document.getElementById(id); let parent = element?.parentElement;
    while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
    element?.focus();
  }
  function validate(): MealResult | null {
    for (const [id, text] of Object.entries(draft)) {
      if (!document.getElementById(id)) continue;
      try { parseMealValue(text, !id.startsWith("time-") && (id.endsWith("-price") || id.endsWith("-outside") || id.startsWith("preparation-")), /^(preparation|time)-/.test(id)); }
      catch { focusInvalid(id); setNotice("Confira os campos indicados."); return null; }
    }
    if (!values.meals.some(m => m.enabled)) { setNotice("Abra uma refeição e marque para incluí-la na comparação."); document.querySelector<HTMLDetailsElement>(".meal-section")?.setAttribute("open", ""); return null; }
    try {
      const next = calculateMealRoutine(values);
      const issues = Object.assign({}, ...next.incomplete.map(m => m.issues)) as Record<string, string>;
      setErrors(issues);
      if (next.incomplete.length) { setNotice("Complete os campos indicados. As refeições incompletas ficam fora da comparação; seus dados foram mantidos."); focusInvalid(Object.keys(issues)[0]); }
      else setNotice("");
      return next.meals.length ? next : null;
    } catch (error) { setNotice((error as Error).message); return null; }
  }
  function submit(e: FormEvent) { e.preventDefault(); const next = validate(); setResult(next); if (next && !next.incomplete.length) requestAnimationFrame(() => resultRef.current?.focus()); }
  function save() {
    for (const [id, text] of Object.entries(draft)) {
      if (!document.getElementById(id)) continue;
      try { parseMealValue(text, !id.startsWith("time-") && (id.endsWith("-price") || id.endsWith("-outside") || id.startsWith("preparation-")), /^(preparation|time)-/.test(id)); }
      catch { focusInvalid(id); setNotice("Confira os campos indicados antes de salvar."); return; }
    }
    try { localStorage.setItem(MEAL_STORAGE_KEY, encodeMealRoutine(values)); setNotice("Rotina salva somente neste navegador."); }
    catch { setNotice("Não foi possível salvar. Seus campos foram mantidos."); }
  }
  return <div className="comparison-area meal-calculator"><form onSubmit={submit} noValidate>
    <div className="form-intro"><h2>Monte sua rotina de alimentação</h2><p>Abra e inclua apenas as refeições que quer comparar. Use a mesma frequência nos dois cenários e os preços da sua rotina. Preencha os valores necessários das refeições que deseja comparar.</p></div>
    {values.meals.map(meal => <details className="expense-section meal-section" key={meal.id}>
      <summary><h3>{meal.name || "Refeição personalizada"}</h3><span>{meal.enabled ? "Incluída na comparação" : "Não configurada"}</span><span className="section-chevron" aria-hidden="true">+</span></summary>
      <div className="section-body"><fieldset className="included-group"><label><input type="checkbox" checked={meal.enabled} onChange={e => updateMeal(meal.id, { enabled: e.target.checked })} />Incluir esta refeição na comparação</label></fieldset>
        {meal.enabled && <>
          <div className="plain-field"><label htmlFor={`${meal.id}-name`}>Nome da refeição</label><input id={`${meal.id}-name`} maxLength={80} value={meal.name} onChange={e => updateMeal(meal.id, { name: e.target.value })} /></div>
          {number(`${meal.id}-frequency`, "Quantas vezes por semana você costuma fazer esta refeição?", meal.frequency, frequency => updateMeal(meal.id, { frequency }), "Ex.: 7 vezes por semana. Essa frequência será usada em casa e fora.")}
          <h4>Preparando em casa</h4><p className="section-note">Adicione o que utiliza em uma refeição. Informe o preço da compra e quanto veio nela para calcular a parte utilizada.</p>
          {meal.ingredients.map(item => <details className="expense-section meal-ingredient" key={item.id} open>
            <summary><h3>{item.name || "Novo item"}</h3><span className="section-chevron" aria-hidden="true">+</span></summary><div className="section-body">
              <div className="plain-field"><label htmlFor={`${item.id}-name`}>Nome do item</label><input id={`${item.id}-name`} maxLength={80} value={item.name} onChange={e => updateItem(meal, item.id, { name: e.target.value })} /></div>
              <div className="money-grid">{number(`${item.id}-used`, "Quantidade utilizada na refeição", item.used, used => updateItem(meal, item.id, { used }))}{unit(`${item.id}-used-unit`, "Unidade utilizada", item.usedUnit, units, usedUnit => updateItem(meal, item.id, { usedUnit, boughtUnit: compatibleUnits(usedUnit, item.boughtUnit) ? item.boughtUnit : usedUnit }))}
                {money(`${item.id}-price`, "Preço pago pela compra", item.price, price => updateItem(meal, item.id, { price }))}{number(`${item.id}-bought`, "Quantidade contida na compra", item.bought, bought => updateItem(meal, item.id, { bought }))}{unit(`${item.id}-bought-unit`, "Unidade da compra", item.boughtUnit, units.filter(u => compatibleUnits(u, item.usedUnit)), boughtUnit => updateItem(meal, item.id, { boughtUnit }))}</div>
              <button type="button" className="text-link meal-remove" aria-label={`Remover ${item.name || "item"} de ${meal.name}`} onClick={() => { change(removeIngredient(values, meal.id, item.id)); forget([item.id]); }}>Remover item</button>
            </div></details>)}
          <button id={`${meal.id}-items`} aria-describedby={errors[`${meal.id}-items`] ? `${meal.id}-items-error` : undefined} type="button" className="secondary-button" disabled={meal.ingredients.length >= 50} onClick={() => { const id = crypto.randomUUID(); updateMeal(meal.id, { ingredients: [...meal.ingredients, emptyIngredient(id)] }); requestAnimationFrame(() => document.getElementById(`${id}-name`)?.focus()); }}>+ Adicionar item</button>{errors[`${meal.id}-items`] && <p id={`${meal.id}-items-error`} className="field-error">{errors[`${meal.id}-items`]}</p>}
          <h4 className="meal-outside-title">Comprando fora</h4>{money(`${meal.id}-outside`, "Quanto custa, em média, comprar essa refeição fora?", meal.outside, outside => updateMeal(meal.id, { outside }))}<p className="field-hint">Valor por refeição, informado por você.</p>
        </>}
        <button type="button" className="text-link meal-remove" aria-label={`Remover refeição ${meal.name}`} onClick={() => { change(removeMeal(values, meal.id)); forget([meal.id, ...meal.ingredients.map(i => i.id)]); }}>Remover refeição</button>
      </div></details>)}
    {newMeal === null ? <button type="button" className="secondary-button" disabled={values.meals.length >= 20} onClick={() => setNewMeal("")}>+ Adicionar outra refeição</button> : <div className="plain-field meal-new"><label htmlFor="new-meal-name">Qual refeição?</label><input id="new-meal-name" maxLength={80} value={newMeal} autoFocus onChange={e => setNewMeal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("add-meal")?.click(); } }} /><button id="add-meal" type="button" className="secondary-button" disabled={!newMeal.trim() || values.meals.length >= 20} onClick={() => { change({ ...values, meals: [...values.meals, { ...emptyMeal(crypto.randomUUID(), newMeal.trim()), enabled: true }] }); setNewMeal(null); }}>Adicionar</button><button type="button" className="text-link meal-remove" onClick={() => setNewMeal(null)}>Cancelar</button></div>}
    <details className="expense-section meal-optional"><summary><h3>Custos de preparo</h3><span>Opcional</span><span className="section-chevron" aria-hidden="true">+</span></summary><div className="section-body"><p className="section-note">Se quiser, informe gastos adicionais relacionados ao preparo das refeições. Não é necessário incluir despesas que existiriam mesmo sem cozinhar.</p><div className="money-grid">{([["gas", "Gás relacionado ao preparo / mês"], ["electricity", "Energia adicional relacionada ao preparo / mês"], ["other", "Outros custos de preparo / mês"]] as const).map(([key, label]) => <div key={key}>{money(`preparation-${key}`, label, values.preparation[key], n => change({ ...values, preparation: { ...values.preparation, [key]: n ?? 0 } }), true)}</div>)}</div><p className="field-hint">Esses custos entram somente no total da rotina em casa, sem divisão entre refeições.</p></div></details>
    <details className="expense-section"><summary><h3>Tempo envolvido</h3><span>Opcional</span><span className="section-chevron" aria-hidden="true">+</span></summary><div className="section-body"><p className="section-note">Informe horas por semana. Tempo e dinheiro ficam separados; não é preciso preencher.</p><div className="money-grid">{([["shopping", "Comprando alimentos — horas/semana"], ["cooking", "Preparando refeições — horas/semana"], ["cleaning", "Limpeza/louça adicional — horas/semana"], ["outside", "Comprar/comer fora — horas/semana"]] as const).map(([key, label]) => <div key={key}>{number(`time-${key}`, label, values.time[key], n => change({ ...values, time: { ...values.time, [key]: n ?? 0 } }), key === "outside" ? "Se relevante, inclua deslocamento, espera, fila ou retirada." : "Ex.: 1,5 para uma hora e meia.", true)}</div>)}</div></div></details>
    <div className="calculator-actions"><button className="button" type="submit" disabled={!ready}>Comparar minha rotina ↗</button></div>
    <div className="storage-panel"><p><strong>Seus dados ficam somente neste navegador.</strong> Salvar é opcional. Alterações precisam ser salvas novamente; os valores não são enviados para servidores.</p><div className="storage-actions"><button type="button" disabled={!ready} onClick={save}>Salvar simulação</button><button type="button" disabled={!ready} onClick={() => { let removed = true; try { localStorage.removeItem(MEAL_STORAGE_KEY); } catch { removed = false; } setValues(emptyMealRoutine()); setDraft({}); setErrors({}); setResult(null); setNewMeal(null); setNotice(removed ? "Campos e rotina salva limpos." : "Campos limpos. Não foi possível apagar o armazenamento; limpe os dados do site no navegador."); }}>Limpar meus dados</button></div></div><p className="calculator-notice" role="status">{notice}</p><noscript>Ative JavaScript para calcular no seu dispositivo.</noscript>
  </form>
  {result && <section className="calculator-results meal-results" ref={resultRef} tabIndex={-1} aria-labelledby="meal-result-title"><p className="eyebrow">Seus valores, sua rotina</p><h2 id="meal-result-title">Sua rotina de alimentação</h2>{result.incomplete.length > 0 && <p className="field-error">Comparação somente das refeições completas. Fora dos totais: {result.incomplete.map(m => m.name).join(", ")}. Os custos de preparo informados continuam incluídos no total geral.</p>}
    <div className="property-columns">{([["Preparando em casa", result.foodHome, result.preparation, result.homeMonthly, result.homeAnnual], ["Comprando fora", result.foodOutside, null, result.outsideMonthly, result.outsideAnnual]] as const).map(([title, food, prep, monthly, annual]) => <article className="scenario-card" key={title}><h3>{title}</h3><p className="result-total">{formatMoney(monthly)}</p><p className="field-hint">por mês, nos valores informados</p><dl><Pair label="Alimentos/refeições" value={formatMoney(food)} /><Pair label="Custos de preparo informados" value={prep === null ? "—" : formatMoney(prep)} /><Pair label="Total anual" value={formatMoney(annual)} /></dl></article>)}</div>
    <div className="result-explanation"><p>Considerando os valores informados: {mealDifferenceText(result.homeMonthly, result.outsideMonthly, "por mês")}</p><p>Diferença mensal (fora − casa): <strong>{formatMoney(result.delta.monthly)}</strong>. Diferença anual: <strong>{formatMoney(result.delta.annual)}</strong>.</p></div>
    <section className="comparison-detail"><h3>Comparação por refeição</h3><p className="field-hint">Alimentos somente, sem distribuir os custos de preparo. Diferença = fora − casa.</p>{result.meals.map(m => <article className="detail-card" key={m.id}><h4>{m.name}</h4><p>{m.frequency.toLocaleString("pt-BR", { maximumFractionDigits: 6 })} vezes por semana</p><dl>{([ ["Por refeição", m.home.portion, m.outside.portion, m.delta.portion], ["Por semana", m.home.weekly, m.outside.weekly, m.delta.weekly], ["Por mês", m.home.monthly, m.outside.monthly, m.delta.monthly], ["Por ano", m.home.annual, m.outside.annual, m.delta.annual] ] as const).map(([period, a, b, delta]) => <div className="meal-period" key={period}><dt>{period}</dt><dd>Em casa: {formatMoney(a)}<br />Fora: {formatMoney(b)}<br />Diferença: {formatMoney(delta)}</dd></div>)}</dl><p>{mealDifferenceText(m.home.monthly, m.outside.monthly, "no mês")}</p></article>)}</section>
    <section className="comparison-detail">{result.meals.length >= 2 && <h3>O que muda entre as refeições?</h3>}{mealInsights(result).map(text => <p className="field-hint" key={text}>{text.split("\n").map((line, index) => <span key={line}>{index > 0 && <br />}{index === 0 && text.includes("\n") ? <strong>{line}</strong> : line}</span>)}</p>)}</section>
    {result.meals.length >= 2 && <section className="expense-breakdown"><h3>Distribuição mensal por refeição</h3><p className="field-hint">Somente alimentos/refeições. Custos de preparo aparecem no total geral.</p><div className="property-columns">{(["home", "outside"] as const).map(key => <div key={key}><h4>{key === "home" ? "Em casa" : "Comprando fora"}</h4><ul>{result.distribution.map(d => <li key={d.id}><div className="distribution-label"><span>{d.name}</span><strong>{d[key] === null ? "—" : formatPercentage(d[key])}</strong></div><div className="distribution-track" aria-hidden="true"><div style={{ width: `${d[key] ?? 0}%` }} /></div></li>)}</ul>{(key === "home" ? result.foodHome : result.foodOutside) === 0 && <p className="field-hint">Total zero: não há participação percentual calculável.</p>}</div>)}</div></section>}
    <details className="expense-section"><summary><h3>De onde saiu o custo de cada refeição?</h3><span className="section-chevron" aria-hidden="true">+</span></summary><div className="section-body">{result.meals.map(m => <div className="detail-card" key={m.id}><h4>{m.name}: {formatMoney(m.home.portion)} por refeição em casa</h4>{!m.ingredients.length && <p>Nenhum item informado.</p>}{m.ingredients.map(i => <p key={i.id}>{ingredientDetailText(i)}</p>)}</div>)}</div></details>
    <section className="comparison-detail"><h3>Tempo informado, separado do dinheiro</h3><div className="property-columns">{(["home", "outside"] as const).map(key => <article className="scenario-card" key={key}><h4>{key === "home" ? "Preparar em casa" : "Comprar fora"}</h4><p>{hours(result.time[key].monthly)} horas/mês informadas</p><p className="field-hint">{hours(result.time[key].weekly)} h/semana · {hours(result.time[key].annual)} h/ano</p></article>)}</div><p className="field-hint">{mealTimeDifferenceText(result.time.home.monthly, result.time.outside.monthly)} Campos opcionais de tempo vazios representam ausência de horas informadas.</p></section>
    <details className="expense-section"><summary><h3>Premissas e limites</h3><span className="section-chevron" aria-hidden="true">+</span></summary><div className="section-body">{mealNotes.map(note => <p className="field-hint" key={note}>{note}</p>)}</div></details>
    <p className="field-hint">O QuantoCusta compara apenas custos e tempos informados. A ferramenta não avalia aspectos nutricionais das refeições.</p>
    <ExportMeals result={result} brand={reportBrand} />
  </section>}
  </div>;
}
function Pair({ label, value }: { label: string; value: string }) { return <div className="comparison-pair"><dt>{label}</dt><dd>{value}</dd></div>; }

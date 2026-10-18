"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { calculateMealRoutine, compatibleUnits, emptyIngredient, emptyMeal, emptyMealRoutine, ingredientDetailText, mealSavingsText, mealReportedTimeText, mealIsUsed, mealIssues, mealInsights, mealNotes, parseMealValue, removeIngredient, removeMeal, unitLabels, units, type Ingredient, type Meal, type MealResult, type MealRoutine, type Unit } from "@/lib/calculations/meal-comparison";
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
    try { const saved = localStorage.getItem(MEAL_STORAGE_KEY); if (saved) { setValues(decodeMealRoutine(saved)); setNotice("Sua rotina salva foi carregada. As refeições completas participam automaticamente. Informe o tempo de preparo em cada refeição; os antigos tempos gerais de preparo e de comer fora não entram mais no relatório. Edite e compare novamente."); } }
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
  function number(id: string, label: string, n: number | null, update: (n: number | null) => void, hint?: string, optional = false, suffix?: string) {
    const input = <input id={id} type="text" inputMode="decimal" maxLength={24} value={draft[id] ?? (n == null || (optional && n === 0) ? "" : String(n).replace(".", ","))} placeholder="0" aria-invalid={Boolean(errors[id])} aria-describedby={[hint ? `${id}-hint` : "", errors[id] ? `${id}-error` : "", suffix ? `${id}-unit` : ""].filter(Boolean).join(" ") || undefined} onChange={e => valueChange(id, e.target.value, n, update, false, optional)} />;
    return <div className="plain-field"><label htmlFor={id}>{label}</label>{suffix ? <div className="meal-duration-control">{input}<span id={`${id}-unit`}>{suffix}</span></div> : input}{hint && <p id={`${id}-hint`} className="field-hint">{hint}</p>}{errors[id] && <p id={`${id}-error`} className="field-error">{errors[id]}</p>}</div>;
  }
  function unit(id: string, label: string, value: Unit, options: readonly Unit[], update: (value: Unit) => void) {
    return <div className="plain-field"><label htmlFor={id}>{label}</label><select id={id} value={value} onChange={e => update(e.target.value as Unit)}>{options.map(u => <option key={u} value={u}>{unitLabels[u]}</option>)}</select></div>;
  }
  function purchasedQuantity(meal: Meal, item: Ingredient) {
    const id = `${item.id}-bought`, unitId = `${item.id}-bought-unit`;
    return <div className="money-field meal-purchased-quantity">
      <label htmlFor={id}>Quantidade comprada</label>
      <div className="money-control money-control-with-period">
        <input id={id} type="text" inputMode="decimal" maxLength={24} placeholder="0" value={draft[id] ?? (item.bought == null ? "" : String(item.bought).replace(".", ","))} aria-invalid={Boolean(errors[id])} aria-describedby={errors[id] ? `${id}-error` : undefined} onChange={e => valueChange(id, e.target.value, item.bought, bought => updateItem(meal, item.id, { bought }), false, false)} />
        <select className="money-period-select" id={unitId} aria-label="Unidade da quantidade comprada" value={item.boughtUnit} aria-invalid={Boolean(errors[unitId])} aria-describedby={errors[unitId] ? `${unitId}-error` : undefined} onChange={e => updateItem(meal, item.id, { boughtUnit: e.target.value as Unit })}>
          {units.filter(u => compatibleUnits(u, item.usedUnit)).map(u => <option key={u} value={u}>{unitLabels[u]}</option>)}
        </select>
      </div>
      {errors[id] && <p id={`${id}-error`} className="field-error">{errors[id]}</p>}
      {errors[unitId] && <p id={`${unitId}-error`} className="field-error">{errors[unitId]}</p>}
    </div>;
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
    if (!values.meals.length) { setNotice("Preencha pelo menos uma refeição para começar a comparação."); document.querySelector<HTMLDetailsElement>(".meal-section")?.setAttribute("open", ""); return null; }
    try {
      const next = calculateMealRoutine(values);
      const issues = Object.assign({}, ...next.incomplete.map(m => m.issues)) as Record<string, string>;
      setErrors(issues);
      if (next.incomplete.length) { setNotice("Complete os campos indicados. As refeições incompletas ficam fora da comparação; seus dados foram mantidos."); focusInvalid(Object.keys(issues)[0]); }
      else setNotice(next.meals.length ? "" : "Preencha pelo menos uma refeição para começar a comparação.");
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
    <div className="form-intro"><h2>Monte sua rotina de alimentação</h2><p>Adicione suas refeições, informe quanto custa prepará-las em casa e quanto pagaria para comer fora. O Coyler compara os gastos e mostra qual opção é mais econômica.</p></div>
    {values.meals.map(meal => <details className="expense-section meal-section" key={meal.id}>
      <summary><h3>{meal.name || "Refeição personalizada"}</h3><span>{!mealIsUsed(meal) ? "Opcional" : Object.keys(mealIssues(meal)).length ? "Campos pendentes" : "Pronta para comparar"}</span><span className="section-chevron" aria-hidden="true">+</span></summary>
      <div className="section-body"><div className="plain-field"><label htmlFor={`${meal.id}-name`}>Nome da refeição</label><input id={`${meal.id}-name`} maxLength={80} value={meal.name} onChange={e => updateMeal(meal.id, { name: e.target.value })} /></div>
          {number(`${meal.id}-frequency`, "Quantas vezes por semana você costuma fazer esta refeição?", meal.frequency, frequency => updateMeal(meal.id, { frequency }), "Ex.: 7 vezes por semana. Essa frequência será usada em casa e fora.")}
          <h4>Preparando em casa</h4><p className="section-note">Informe os ingredientes usados em uma única refeição, o preço total de cada compra e a quantidade que veio nela. O Coyler calcula apenas o custo da parte utilizada. No preparo em lote, divida as quantidades utilizadas pelo número de porções produzidas.</p>
          {meal.ingredients.map(item => <details className="expense-section meal-ingredient" key={item.id} open>
            <summary><h3>{item.name || "Novo item"}</h3><span className="section-chevron" aria-hidden="true">+</span></summary><div className="section-body">
              <div className="plain-field"><label htmlFor={`${item.id}-name`}>Nome do item</label><input id={`${item.id}-name`} maxLength={80} value={item.name} onChange={e => updateItem(meal, item.id, { name: e.target.value })} /></div>
              <div className="money-grid">{number(`${item.id}-used`, "Quantidade utilizada na refeição", item.used, used => updateItem(meal, item.id, { used }))}{unit(`${item.id}-used-unit`, "Unidade utilizada", item.usedUnit, units, usedUnit => updateItem(meal, item.id, { usedUnit, boughtUnit: compatibleUnits(usedUnit, item.boughtUnit) ? item.boughtUnit : usedUnit }))}
                {money(`${item.id}-price`, "Preço pago pela compra", item.price, price => updateItem(meal, item.id, { price }))}{purchasedQuantity(meal, item)}</div>
              <button type="button" className="text-link meal-remove" aria-label={`Remover ${item.name || "item"} de ${meal.name}`} onClick={() => { change(removeIngredient(values, meal.id, item.id)); forget([item.id]); }}>Remover item</button>
            </div></details>)}
          <button id={`${meal.id}-items`} aria-describedby={errors[`${meal.id}-items`] ? `${meal.id}-items-error` : undefined} type="button" className="secondary-button" disabled={meal.ingredients.length >= 50} onClick={() => { const id = crypto.randomUUID(); updateMeal(meal.id, { ingredients: [...meal.ingredients, emptyIngredient(id)] }); requestAnimationFrame(() => document.getElementById(`${id}-name`)?.focus()); }}>+ Adicionar item</button>{errors[`${meal.id}-items`] && <p id={`${meal.id}-items-error`} className="field-error">{errors[`${meal.id}-items`]}</p>}
          {meal.ingredients.length > 0 && <div className="meal-duration">{number(`${meal.id}-minutes`, "Quanto tempo leva para preparar esta refeição?", meal.preparationMinutes ?? null, preparationMinutes => updateMeal(meal.id, { preparationMinutes }), "Opcional. Se preparar várias porções de uma vez, informe o tempo médio por porção.", false, "minutos")}</div>}
          <h4 className="meal-outside-title">Comprando fora</h4>{money(`${meal.id}-outside`, "Quanto custa, em média, comprar essa refeição fora?", meal.outside, outside => updateMeal(meal.id, { outside }))}<p className="field-hint">Valor por refeição, informado por você.</p>
        <button type="button" className="text-link meal-remove" aria-label={`Remover refeição ${meal.name}`} onClick={() => { change(removeMeal(values, meal.id)); forget([meal.id, ...meal.ingredients.map(i => i.id)]); }}>Remover refeição</button>
      </div></details>)}
    {newMeal === null ? <button type="button" className="secondary-button" disabled={values.meals.length >= 20} onClick={() => setNewMeal("")}>+ Adicionar outra refeição</button> : <div className="plain-field meal-new"><label htmlFor="new-meal-name">Qual refeição?</label><input id="new-meal-name" maxLength={80} value={newMeal} autoFocus onChange={e => setNewMeal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("add-meal")?.click(); } }} /><button id="add-meal" type="button" className="secondary-button" disabled={!newMeal.trim() || values.meals.length >= 20} onClick={() => { change({ ...values, meals: [...values.meals, { ...emptyMeal(crypto.randomUUID(), newMeal.trim()), enabled: true }] }); setNewMeal(null); }}>Adicionar</button><button type="button" className="text-link meal-remove" onClick={() => setNewMeal(null)}>Cancelar</button></div>}
    <details className="expense-section meal-optional"><summary><h3>Custos de preparo</h3><span>Opcional</span><span className="section-chevron" aria-hidden="true">+</span></summary><div className="section-body"><p className="section-note">Se quiser, informe gastos adicionais relacionados ao preparo das refeições. Não é necessário incluir despesas que existiriam mesmo sem cozinhar.</p><div className="money-grid">{([["gas", "Gás relacionado ao preparo / mês"], ["electricity", "Energia elétrica adicional — R$/mês"], ["water", "Água adicional — R$/mês"], ["other", "Outros custos de preparo / mês"]] as const).map(([key, label]) => <div key={key}>{money(`preparation-${key}`, label, values.preparation[key] ?? 0, n => change({ ...values, preparation: { ...values.preparation, [key]: n ?? 0 } }), true)}</div>)}</div><p className="field-hint">Esses custos entram somente no total da rotina em casa, sem divisão entre refeições.</p></div></details>
    <details className="expense-section"><summary><h3>Tempo envolvido</h3><span>Opcional</span><span className="section-chevron" aria-hidden="true">+</span></summary><div className="section-body"><p className="section-note">Se quiser, informe quanto tempo você gasta por semana comprando ingredientes e limpando a cozinha após preparar suas refeições.</p><div className="money-grid">{([["shopping", "Comprando ingredientes (horas/semana)"], ["cleaning", "Limpando a cozinha (horas/semana)"]] as const).map(([key, label]) => <div key={key}>{number(`time-${key}`, label, values.time[key], n => change({ ...values, time: { ...values.time, [key]: n ?? 0 } }), "Ex.: 1,5 para uma hora e meia.", true)}</div>)}</div></div></details>
    <div className="calculator-actions"><button className="button" type="submit" disabled={!ready}>Comparar minha rotina ↗</button></div>
    <div className="storage-panel"><p><strong>Seus dados ficam somente neste navegador.</strong> Salvar é opcional. Alterações precisam ser salvas novamente; os valores não são enviados para servidores.</p><div className="storage-actions"><button type="button" disabled={!ready} onClick={save}>Salvar simulação</button><button type="button" disabled={!ready} onClick={() => { let removed = true; try { localStorage.removeItem(MEAL_STORAGE_KEY); } catch { removed = false; } setValues(emptyMealRoutine()); setDraft({}); setErrors({}); setResult(null); setNewMeal(null); setNotice(removed ? "Campos e rotina salva limpos." : "Campos limpos. Não foi possível apagar o armazenamento; limpe os dados do site no navegador."); }}>Limpar meus dados</button></div></div><p className="calculator-notice" role="status">{notice}</p><noscript>Ative JavaScript para calcular no seu dispositivo.</noscript>
  </form>
  {result && <section className="calculator-results meal-results" ref={resultRef} tabIndex={-1} aria-labelledby="meal-result-title"><p className="eyebrow">Seus valores, sua rotina</p><h2 id="meal-result-title">Sua rotina de alimentação</h2>{result.incomplete.length > 0 && <p className="field-error">Comparação somente das refeições completas. Fora dos totais: {result.incomplete.map(m => m.name).join(", ")}. Os custos de preparo informados continuam incluídos no total geral.</p>}
    <div className="property-columns">{([["Preparando em casa", result.foodHome, result.preparation, result.homeMonthly, result.homeAnnual], ["Comprando fora", result.foodOutside, null, result.outsideMonthly, result.outsideAnnual]] as const).map(([title, food, prep, monthly, annual]) => <article className="scenario-card" key={title}><h3>{title}</h3><p className="result-total">{formatMoney(monthly)}</p><p className="field-hint">por mês, nos valores informados</p><dl><Pair label="Alimentos/refeições" value={formatMoney(food)} /><Pair label="Custos de preparo informados" value={prep === null ? "—" : formatMoney(prep)} /><Pair label="Total anual" value={formatMoney(annual)} /></dl></article>)}</div>
    <div className="result-explanation"><p>Considerando os valores informados: {mealSavingsText(result.homeMonthly, result.outsideMonthly, "por mês")}</p><p>{mealSavingsText(result.homeAnnual, result.outsideAnnual, "por ano")}</p></div>
    <section className="comparison-detail"><h3>Comparação por refeição</h3><p className="field-hint">Alimentos somente, sem distribuir os custos de preparo.</p>{result.meals.map(m => <article className="detail-card" key={m.id}><h4>{m.name}</h4><p>{m.frequency.toLocaleString("pt-BR", { maximumFractionDigits: 6 })} vezes por semana</p><dl>{([ ["Por refeição", m.home.portion, m.outside.portion, m.delta.portion], ["Por semana", m.home.weekly, m.outside.weekly, m.delta.weekly], ["Por mês", m.home.monthly, m.outside.monthly, m.delta.monthly], ["Por ano", m.home.annual, m.outside.annual, m.delta.annual] ] as const).map(([period, a, b]) => <div className="meal-period" key={period}><dt>{period}</dt><dd>Em casa: {formatMoney(a)}<br />Fora: {formatMoney(b)}</dd></div>)}</dl><p>{mealSavingsText(m.home.monthly, m.outside.monthly, "por mês")}</p></article>)}</section>
    <section className="comparison-detail">{result.meals.length >= 2 && <h3>O que muda entre as refeições?</h3>}{mealInsights(result).map(text => <p className="field-hint" key={text}>{text.split("\n").map((line, index) => <span key={line}>{index > 0 && <br />}{index === 0 && text.includes("\n") ? <strong>{line}</strong> : line}</span>)}</p>)}</section>
    {result.meals.length >= 2 && <section className="expense-breakdown"><h3>Distribuição mensal por refeição</h3><p className="field-hint">Somente alimentos/refeições. Custos de preparo aparecem no total geral.</p><div className="property-columns">{(["home", "outside"] as const).map(key => <div key={key}><h4>{key === "home" ? "Em casa" : "Comprando fora"}</h4><ul>{result.distribution.map(d => <li key={d.id}><div className="distribution-label"><span>{d.name}</span><strong>{d[key] === null ? "—" : formatPercentage(d[key])}</strong></div><div className="distribution-track" aria-hidden="true"><div style={{ width: `${d[key] ?? 0}%` }} /></div></li>)}</ul>{(key === "home" ? result.foodHome : result.foodOutside) === 0 && <p className="field-hint">Total zero: não há participação percentual calculável.</p>}</div>)}</div></section>}
    <details className="expense-section"><summary><h3>De onde saiu o custo de cada refeição?</h3><span className="section-chevron" aria-hidden="true">+</span></summary><div className="section-body">{result.meals.map(m => <div className="detail-card" key={m.id}><h4>{m.name}: {formatMoney(m.home.portion)} por refeição em casa</h4>{!m.ingredients.length && <p>Nenhum item informado.</p>}{m.ingredients.map(i => <p key={i.id}>{ingredientDetailText(i)}</p>)}</div>)}</div></details>
    <section className="comparison-detail"><h3>Tempo informado, separado do dinheiro</h3>{result.hasPreparationTime ? <p>Preparo das refeições: {hours(result.preparationWeekly)} h/semana · {hours(result.preparationWeekly * 52 / 12)} h/mês · {hours(result.preparationWeekly * 52)} h/ano.</p> : <p>Tempo de preparo não informado.</p>}<p>{mealReportedTimeText(result)}</p><p className="field-hint">Comprando alimentos: {hours(result.timeDetails.shopping)} h/semana. Limpeza adicional: {hours(result.timeDetails.cleaning)} h/semana. Nenhum tempo é convertido em dinheiro.</p></section>
    <details className="expense-section"><summary><h3>Premissas e limites</h3><span className="section-chevron" aria-hidden="true">+</span></summary><div className="section-body">{mealNotes.map(note => <p className="field-hint" key={note}>{note}</p>)}</div></details>
    <p className="field-hint">O Coyler compara apenas custos e tempos informados. A ferramenta não avalia aspectos nutricionais das refeições.</p>
    <ExportMeals result={result} brand={reportBrand} />
  </section>}
  </div>;
}
function Pair({ label, value }: { label: string; value: string }) { return <div className="comparison-pair"><dt>{label}</dt><dd>{value}</dd></div>; }

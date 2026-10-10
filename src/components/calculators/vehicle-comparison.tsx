"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { activeNumericFields, appLabels, calculateVehicleComparison, emptyVehicleComparison, fieldLabels, numericFields, ownershipLabels, parseVehicleQuantity, quantityFields, vehicleDifferenceText, vehicleIssues, vehicleLabels, vehicleNotes, type NumericField, type VehicleComparison, type VehicleResult } from "@/lib/calculations/vehicle-comparison";
import { decodeVehicleComparison, encodeVehicleComparison, VEHICLE_STORAGE_KEY } from "@/lib/vehicle-storage";
import { formatMoney, formatPercentage, moneyInput, parseMoney } from "@/lib/money";
import type { ReportBrand } from "@/lib/export/report";
import { MoneyInput } from "../money-input";
import { ExportVehicle } from "../export-vehicle";

import { formatVehicleHours } from "@/lib/vehicle-presentation";

const decimal = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
type Choices = Pick<VehicleComparison, "vehicle" | "ownership" | "app" | "fuelMode" | "insurancePeriod" | "maintenancePeriod">;
const emptyDraft = () => Object.fromEntries(numericFields.map(key => [key, ""])) as Record<NumericField, string>;
export function VehicleComparisonCalculator({ reportBrand }: { reportBrand: ReportBrand }) {
  const [choices, setChoices] = useState<Choices>(emptyVehicleComparison);
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<VehicleResult | null>(null);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => {
    setReady(true);
    try {
      const saved = localStorage.getItem(VEHICLE_STORAGE_KEY);
      if (saved) {
        const values = decodeVehicleComparison(saved); setChoices(values);
        setDraft(Object.fromEntries(numericFields.map(key => [key, values[key] === null ? "" : quantityFields.includes(key) ? String(values[key]).replace(".", ",") : moneyInput(values[key]!)])) as Record<NumericField, string>);
        setNotice("Sua simulação salva foi carregada. Edite e compare novamente.");
      }
    } catch { setNotice("Não foi possível carregar os dados salvos. Você pode preencher normalmente ou limpar os dados."); }
  }, []);
  function choose<K extends keyof Choices>(key: K, value: Choices[K]) { setChoices(v => ({ ...v, [key]: value })); setErrors({}); setNotice(""); setResult(null); }
  function update(key: NumericField, text: string) {
    setDraft(v => ({ ...v, [key]: text })); setErrors(v => ({ ...v, [key]: "" })); setNotice("");
    try {
      const parse = (value: string) => quantityFields.includes(key) ? parseVehicleQuantity(value) : value.trim() ? parseMoney(value) : null;
      if (parse(draft[key]) !== parse(text)) setResult(null);
    } catch { setResult(null); }
  }
  function focusInvalid(key: string) {
    const element = document.getElementById(key); let parent = element?.parentElement;
    while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; } element?.focus();
  }
  function parse(requireComplete: boolean): VehicleComparison | null {
    const values: VehicleComparison = { ...emptyVehicleComparison(), ...choices }, found: Record<string, string> = {};
    const active = activeNumericFields(values);
    for (const key of numericFields) {
      try { values[key] = quantityFields.includes(key) ? parseVehicleQuantity(draft[key]) : draft[key].trim() ? parseMoney(draft[key]) : null; }
      catch (error) { if (active.includes(key)) found[key] = (error as Error).message; }
    }
    if (requireComplete) {
      const issues = vehicleIssues(values);
      for (const [key, message] of Object.entries(issues)) if (!found[key]) found[key] = message;
    }
    setErrors(found);
    if (Object.keys(found).length) { setNotice("Confira os campos indicados. Seus valores foram mantidos."); focusInvalid(Object.keys(found)[0]); return null; }
    return values;
  }
  function submit(event: FormEvent) {
    event.preventDefault(); const values = parse(true); setResult(null); if (!values) return;
    try { setResult(calculateVehicleComparison(values)); setNotice(""); requestAnimationFrame(() => resultRef.current?.focus()); }
    catch (error) { setNotice((error as Error).message); }
  }
  function save() {
    const values = parse(false); if (!values) return;
    try { localStorage.setItem(VEHICLE_STORAGE_KEY, encodeVehicleComparison(values)); setNotice("Simulação salva somente neste navegador."); }
    catch { setNotice("Não foi possível salvar. Seus valores foram mantidos."); }
  }
  function clear() {
    let removed = true;
    try { localStorage.removeItem(VEHICLE_STORAGE_KEY); }
    catch { removed = false; }
    setChoices(emptyVehicleComparison()); setDraft(emptyDraft()); setErrors({}); setResult(null);
    setNotice(removed ? "Os dados desta ferramenta foram limpos." : "Campos e resultados limpos. Não foi possível remover a cópia salva no navegador; limpe os dados do site nas configurações do navegador.");
  }
  function field(key: NumericField, label = fieldLabels[key], hint?: string) {
    if (!quantityFields.includes(key)) return <MoneyInput id={key} label={label} value={draft[key]} onChange={text => update(key, text)} error={errors[key]} hint={hint} />;
    return <div className="plain-field"><label htmlFor={key}>{label}</label><input id={key} type="text" inputMode="decimal" autoComplete="off" maxLength={24} placeholder="0" value={draft[key]} onChange={e => update(key, e.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={[hint ? `${key}-hint` : "", errors[key] ? `${key}-error` : ""].filter(Boolean).join(" ") || undefined} />{hint && <p className="field-hint" id={`${key}-hint`}>{hint}</p>}{errors[key] && <p className="field-error" id={`${key}-error`}>{errors[key]}</p>}</div>;
  }
  function select<K extends keyof Choices>(key: K, label: ReactNode, options: Record<string, string>) {
    return <div className="plain-field"><label htmlFor={key}>{label}</label><select id={key} value={choices[key] ?? ""} onChange={e => choose(key, e.target.value as Choices[K])} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : undefined}>{choices[key] === null && <option value="">Selecione</option>}{Object.entries(options).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select>{errors[key] && <p className="field-error" id={`${key}-error`}>{errors[key]}</p>}</div>;
  }
  function periodicCost(key: "insurance" | "maintenance", hint?: string) {
    return <div className="vehicle-periodic-cost"><div className="vehicle-periodic-row"><div><MoneyInput id={key} label={fieldLabels[key]} value={draft[key]} onChange={text => update(key, text)} error={errors[key]} /></div>{select(`${key}Period`, <>Periodicidade<span className="sr-only"> {key === "insurance" ? "do seguro" : "da manutenção"}</span></>, { monthly: "Mensal", annual: "Anual" })}</div>{hint && <p className="field-hint">{hint}</p>}</div>;
  }
  return <div className="comparison-area vehicle-calculator"><form noValidate onSubmit={submit}>
    <div className="form-intro"><h2>Compare sua mobilidade</h2><p>Compare os custos de ter e usar um carro ou moto com o que você gastaria usando transporte por aplicativo. Abra as seções para preencher os valores da sua rotina.</p><p className="field-hint">Custos opcionais podem ficar vazios. Informe os valores necessários de combustível e corridas; zero digitado também é aceito quando aplicável.</p></div>
    <Section title="Seu veículo" initialOpen><div className="money-grid">{select("vehicle", "Qual veículo você quer avaliar?", vehicleLabels)}{select("ownership", "Como você teria esse veículo?", ownershipLabels)}{choices.ownership !== null && choices.ownership !== "owned" && field("payment", choices.ownership === "rented" ? "Valor mensal do aluguel/assinatura" : fieldLabels.payment)}</div>{choices.ownership === "rented" && <p className="field-hint">Nos próximos campos, informe separadamente apenas custos que não estejam incluídos no aluguel/assinatura.</p>}</Section>
    <Section title="Custos de possuir"><p className="field-hint">Mesmo quando você já possui o veículo, IPVA, licenciamento, seguro e manutenção continuam contando quando informados.</p><div className="money-grid">{field("ipva")}{field("licensing")}{periodicCost("insurance")}{periodicCost("maintenance", "Você pode considerar em manutenção revisões, óleo, peças, pneus e outros gastos de manutenção do veículo.")}</div></Section>
    <Section title="Custos de usar">{select("fuelMode", "Como você quer informar o gasto com combustível?", { direct: "Já sei quanto gasto por mês", estimate: "Quero estimar pelo meu uso" })}<div className="money-grid">{choices.fuelMode === "direct" ? field("fuelMonthly") : <>{field("kilometers", fieldLabels.kilometers, "Quilômetros por mês (km).")}{field("efficiency")}{field("fuelPrice")}</>}{field("tolls", fieldLabels.tolls, "Opcional: nenhum custo adicional informado se ficar vazio.")}{field("parking")}</div></Section>
    <Section title="Transporte por aplicativo"><div className="money-grid">{select("app", "Qual tipo de transporte por aplicativo você costuma usar?", appLabels)}{field("rides")}{field("fare")}{field("wait", fieldLabels.wait, "Opcional. Considere aproximadamente o tempo entre solicitar a corrida e o veículo chegar.")}</div><p className="field-hint">Cada corrida representa um trecho. Ida e volta contam como duas corridas. Todos os preços são informados por você, seja carro, moto ou ambos.</p></Section>
    <div className="calculator-actions"><button type="submit" className="button" disabled={!ready}>Comparar minha mobilidade ↗</button></div><div className="storage-panel"><p>Seus dados ficam salvos somente neste navegador quando você escolhe salvar.</p><div className="storage-actions"><button type="button" disabled={!ready} onClick={save}>Salvar simulação</button><button type="button" disabled={!ready} onClick={clear}>Limpar meus dados</button></div></div><p className="calculator-notice" role="status">{notice}</p>
  </form>
  {result && <section className="calculator-results vehicle-results" ref={resultRef} tabIndex={-1} aria-labelledby="vehicle-result-title"><p className="eyebrow">Sua mobilidade, em números</p><h2 id="vehicle-result-title">Os custos da sua rotina</h2><p className="field-hint">{vehicleLabels[result.input.vehicle!]} · {ownershipLabels[result.input.ownership!]} · Aplicativo: {appLabels[result.input.app!]}</p>
    <div className="property-columns"><article className="scenario-card"><h3>Veículo próprio</h3><p className="result-total">{formatMoney(result.monthly)}</p><p className="field-hint">por mês, nos valores informados</p><dl><Pair label="Custo de possuir / mês" value={formatMoney(result.own)} /><Pair label="Custo de usar / mês" value={formatMoney(result.use)} /><Pair label="Total anual" value={formatMoney(result.annual)} /></dl></article><article className="scenario-card"><h3>Transporte por aplicativo</h3><p className="result-total">{formatMoney(result.app.monthly)}</p><p className="field-hint">por mês, nos valores informados</p><dl><Pair label="Corridas / semana" value={decimal(result.input.rides!)} /><Pair label="Valor médio por corrida" value={formatMoney(result.input.fare!)} /><Pair label="Custo semanal" value={formatMoney(result.app.weekly)} /><Pair label="Total anual" value={formatMoney(result.app.annual)} /></dl></article></div>
    <div className="result-explanation"><p>{vehicleDifferenceText(result.delta.monthly)}</p><p>Diferença: <strong>{formatMoney(Math.abs(result.delta.monthly))}/mês</strong> · <strong>{formatMoney(Math.abs(result.delta.annual))}/ano</strong>.</p><p className="field-hint">Os custos anuais preservam os valores originais; o arredondamento mensal pode gerar pequenas diferenças em mensal × 12.</p></div>
    <aside className="vehicle-comparison-note"><h3>Sobre esta comparação</h3><p className="field-hint">Os valores representam os custos informados de possuir e usar o veículo. A comparação não considera depreciação, preço de compra, revenda ou custo de oportunidade.</p></aside>
    <section className="expense-breakdown"><h3>Composição do custo mensal do veículo</h3><div className="property-columns">{(["own", "use"] as const).map(category => <div key={category}><h4>{category === "own" ? "Custo de possuir" : "Custo de usar"}</h4><ul>{result.costs.filter(c => c.category === category).map(c => <li key={c.id}><div className="distribution-label"><span>{c.name}</span><strong>{formatMoney(c.monthly)}{c.share !== null && c.monthly > 0 ? ` · ${formatPercentage(c.share)}` : ""}</strong></div>{c.share !== null && c.monthly > 0 && <div className="distribution-track" aria-hidden="true"><div style={{ width: `${c.share}%` }} /></div>}<p className="field-hint">{c.informed === null ? "Nenhum custo adicional informado." : `Equivalente anual: ${formatMoney(c.annual)}.`}</p></li>)}</ul></div>)}</div>{result.monthly === 0 && <p className="field-hint">Total zero: não há participação percentual calculável.</p>}</section>
    {result.input.fuelMode === "estimate" && <p className="field-hint">Combustível estimado: {decimal(result.input.kilometers!)} km/mês ÷ {decimal(result.input.efficiency!)} km/L × {formatMoney(result.input.fuelPrice!)}/L = {formatMoney(result.fuel)}/mês.</p>}
    <section className="comparison-detail"><h3>Tempo de espera informado</h3><p>Transporte por aplicativo</p>{result.wait === null ? <p className="field-hint">Tempo de espera não informado.</p> : <><p>{decimal(result.input.wait!)} minutos por corrida</p><p className="result-total">≈ {formatVehicleHours(result.wait.monthlyHours)}/mês</p><p>≈ {formatVehicleHours(result.wait.annualHours)}/ano · {formatVehicleHours(result.wait.weeklyHours)}/semana</p><p className="field-hint">Com a frequência e o tempo de espera informados, você esperaria aproximadamente {formatVehicleHours(result.wait.monthlyHours)} por mês pelo transporte por aplicativo.</p></>}<p className="field-hint">Somente a espera entre solicitar a corrida e o veículo chegar. Tempo não é convertido em dinheiro.</p></section>
    <Section title="Premissas e limites">{vehicleNotes.map(note => <p className="field-hint" key={note}>{note}</p>)}</Section><ExportVehicle result={result} brand={reportBrand} />
  </section>}</div>;
}
function Section({ title, children, initialOpen = false }: { title: string; children: ReactNode; initialOpen?: boolean }) { return <details className="expense-section" open={initialOpen || undefined}><summary><h3>{title}</h3><span className="section-chevron" aria-hidden="true">+</span></summary><div className="section-body">{children}</div></details>; }
function Pair({ label, value }: { label: string; value: string }) { return <div className="comparison-pair"><dt>{label}</dt><dd>{value}</dd></div>; }

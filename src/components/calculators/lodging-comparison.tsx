"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { calculateLodgingComparison, emptyLodgingComparison, emptyTravelPlace, formatLodgingQuantity, formatTravelTime, lodgingDifferenceText, lodgingFields, lodgingIssues, lodgingName, lodgingNotes, lodgingPriceInsight, lodgingTimeText, lodgingValue, mealLabels, parseLodgingQuantity, setLodgingValue, storedLodgingFields, transportLabels, tripLabels, usesVehicle, type LodgingComparison, type LodgingResult, type MealKey } from "@/lib/calculations/lodging-comparison";
import { decodeLodgingComparison, encodeLodgingComparison, LODGING_STORAGE_KEY } from "@/lib/lodging-storage";
import { formatMoney, formatPercentage, moneyInput, parseMoney } from "@/lib/money";
import type { ReportBrand } from "@/lib/export/report";
import { MoneyInput } from "../money-input";
import { ExportLodging } from "../export-lodging";

export function LodgingComparisonCalculator({ reportBrand }: { reportBrand: ReportBrand }) {
  const [values, setValues] = useState(emptyLodgingComparison);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<LodgingResult | null>(null);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => {
    setReady(true);
    try { const saved = localStorage.getItem(LODGING_STORAGE_KEY); if (saved) { setValues(decodeLodgingComparison(saved)); setNotice("Sua simulação salva foi carregada. Edite e compare novamente."); } }
    catch { setNotice("Não foi possível carregar os dados salvos. Você pode preencher normalmente ou limpar os dados."); }
  }, []);
  function change(mutate: (next: LodgingComparison) => void) {
    setValues(previous => { const next = structuredClone(previous); mutate(next); return next; });
    setResult(null); setErrors({}); setNotice("");
  }
  function update(path: string, text: string) {
    setDraft(d => ({ ...d, [path]: text })); setErrors(e => ({ ...e, [path]: "" })); setNotice("");
    const field = storedLodgingFields(values).find(f => f.path === path);
    try {
      const parse = (value: string) => !value.trim() ? null : field?.kind === "money" ? parseMoney(value) : parseLodgingQuantity(value, field?.kind === "integer");
      if (parse(inputValue(path, field?.kind === "money")) !== parse(text)) setResult(null);
    } catch { setResult(null); }
  }
  function inputValue(path: string, money = false) { const n = lodgingValue(values, path); return draft[path] ?? (n === null ? "" : money ? moneyInput(n) : String(n).replace(".", ",")); }
  function focusInvalid(path: string) {
    const el = document.getElementById(path); let parent = el?.parentElement;
    while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
    el?.focus();
  }
  function parse(complete: boolean) {
    const next = structuredClone(values), found: Record<string, string> = {};
    const active = new Set(lodgingFields(values).map(f => f.path));
    const stored = storedLodgingFields(values);
    // Preserva os valores válidos de campos temporariamente ocultos.
    for (const [path, text] of Object.entries(draft)) {
      try {
        const field = stored.find(f => f.path === path);
        if (field) setLodgingValue(next, path, !text.trim() ? null : field.kind === "money" ? parseMoney(text) : parseLodgingQuantity(text, field.kind === "integer"));
      } catch (e) { if (active.has(path)) found[path] = (e as Error).message; }
    }
    if (complete) for (const [path, message] of Object.entries(lodgingIssues(next))) if (!found[path]) found[path] = message;
    setErrors(found);
    if (Object.keys(found).length) { setNotice("Confira os campos indicados. Seus valores foram mantidos."); focusInvalid(Object.keys(found)[0]); return null; }
    return next;
  }
  function submit(e: FormEvent) {
    e.preventDefault(); const next = parse(true); if (!next) return;
    try { setResult(calculateLodgingComparison(next)); setNotice(""); requestAnimationFrame(() => resultRef.current?.focus()); }
    catch (e) { setNotice((e as Error).message); }
  }
  function save() {
    const next = parse(false); if (!next) return;
    try { localStorage.setItem(LODGING_STORAGE_KEY, encodeLodgingComparison(next)); setNotice("Simulação salva somente neste navegador."); }
    catch { setNotice("Não foi possível salvar. Seus valores foram mantidos."); }
  }
  function clear() {
    let removed = true;
    try { localStorage.removeItem(LODGING_STORAGE_KEY); }
    catch { removed = false; }
    setValues(emptyLodgingComparison()); setDraft({}); setErrors({}); setResult(null);
    setNotice(removed ? "Os dados desta ferramenta foram limpos." : "Campos e resultados limpos. Não foi possível remover a cópia salva no navegador; limpe os dados do site nas configurações do navegador.");
  }
  function field(path: string, label: string, money = false, hint?: string) {
    if (money) return <MoneyInput id={path} label={label} value={inputValue(path, true)} onChange={text => update(path, text)} error={errors[path]} hint={hint} />;
    return <div className="plain-field"><label htmlFor={path}>{label}</label><input id={path} type="text" inputMode="decimal" autoComplete="off" maxLength={24} placeholder="0" value={inputValue(path)} onChange={e => update(path, e.target.value)} aria-invalid={Boolean(errors[path])} aria-describedby={[hint ? `${path}-hint` : "", errors[path] ? `${path}-error` : ""].filter(Boolean).join(" ") || undefined} />{hint && <p className="field-hint" id={`${path}-hint`}>{hint}</p>}{errors[path] && <p className="field-error" id={`${path}-error`}>{errors[path]}</p>}</div>;
  }
  function select(id: string, label: string, value: string | null, options: Record<string, string>, onChange: (text: string) => void) {
    return <div className="plain-field"><label htmlFor={id}>{label}</label><select id={id} value={value ?? ""} onChange={e => onChange(e.target.value)} aria-invalid={Boolean(errors[id])} aria-describedby={errors[id] ? `${id}-error` : undefined}>{value === null && <option value="">Selecione</option>}{Object.entries(options).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{errors[id] && <p className="field-error" id={`${id}-error`}>{errors[id]}</p>}</div>;
  }
  function nameField(id: string, label: string, value: string, onChange: (text: string) => void, placeholder?: string) { return <div className="plain-field"><label htmlFor={id}>{label}</label><input id={id} maxLength={80} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></div>; }
  function check(id: string, label: string, checked: boolean, onChange: (checked: boolean) => void) { return <label key={id} htmlFor={id}><input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />{label}</label>; }
  function removeRow(type: "places" | "extras", index: number) {
    // Reindexa os rascunhos quando uma linha é removida.
    setDraft(previous => Object.fromEntries(Object.entries(previous).flatMap(([path, text]) => {
      const parts = path.split("."); if (parts[0] !== type) return [[path, text]];
      const row = Number(parts[1]); if (row === index) return []; if (row > index) parts[1] = String(row - 1); return [[parts.join("."), text]];
    })));
    change(v => { v[type].splice(index, 1); });
  }
  function previewValues() {
    const next = structuredClone(values);
    for (const [path, text] of Object.entries(draft)) {
      const f = storedLodgingFields(values).find(f => f.path === path);
      try { if (f) setLodgingValue(next, path, !text.trim() ? null : f.kind === "money" ? parseMoney(text) : parseLodgingQuantity(text, f.kind === "integer")); }
      catch { if (f) setLodgingValue(next, path, null); }
    }
    return next;
  }
  const preview = previewValues();
  const vehicle = usesVehicle(values.transport);
  return <div className="comparison-area lodging-calculator"><form noValidate onSubmit={submit}>
    <div className="form-intro"><h2>Duas hospedagens, a mesma viagem</h2><p>Compare o que muda com a hospedagem. Comece pela viagem e pelas reservas; abra as outras seções conforme precisar. Todos os preços e estimativas são informados por você.</p></div>
    <Section title="Sua viagem" initialOpen><div className="money-grid">{field("people", "Quantas pessoas estão sendo consideradas?", false, "Número inteiro de pessoas, maior que zero.")}{field("nights", "Quantas noites?", false, "Número inteiro de noites, maior que zero.")}</div></Section>
    <div className="property-columns">{values.lodgings.map((l, i) => <Section key={i} title={`Hospedagem ${i === 0 ? "A" : "B"}`} initialOpen>
      {nameField(`lodging-name-${i}`, "Nome opcional", l.name, text => change(v => { v.lodgings[i].name = text; }), i === 0 ? "Ex.: Hotel Centro" : "Ex.: Hotel Praia")}
      {select(`price-mode-${i}`, "Como você quer informar o preço?", l.priceMode, { total: "Valor total da estadia", night: "Valor por diária" }, text => change(v => { v.lodgings[i].priceMode = text as typeof l.priceMode; }))}
      {field(`lodgings.${i}.price`, l.priceMode === "total" ? "Valor total da hospedagem" : "Valor da diária", true, "Informe o valor da reserva para o grupo, conforme a cotação. Não é o preço por pessoa.")}
      {field(`lodgings.${i}.fees`, "Taxas adicionais da hospedagem (opcional)", true, "Use este campo para taxas obrigatórias que não estejam incluídas no valor informado da hospedagem.")}
      <fieldset className="included-group lodging-included"><legend>O que está incluído?</legend>{Object.entries(mealLabels).map(([key, label]) => check(`included-${i}-${key}`, label, l.meals[key as MealKey].included, checked => change(v => { v.lodgings[i].meals[key as MealKey].included = checked; })))}{check(`included-${i}-parking`, "Estacionamento incluído", l.parking.included, checked => change(v => { v.lodgings[i].parking.included = checked; }))}</fieldset>
    </Section>)}</div>
    <Section title="Alimentação adicional"><p className="section-note">Informe apenas os gastos que mudam com a hospedagem. Se o gasto for igual nas duas opções, você pode deixá-lo de fora. Dias e valores ficam vazios até você informar; refeições incluídas não são somadas.</p>
      {Object.entries(mealLabels).map(([key, label]) => <div className="lodging-meal" key={key}><h4>{label}</h4><div className="property-columns">{values.lodgings.map((l, i) => <div key={i}><h5>{lodgingName(l, i)}</h5>{l.meals[key as MealKey].included ? <p className="field-hint">Incluído na hospedagem.</p> : <>{field(`lodgings.${i}.meals.${key}.price`, "Valor estimado por pessoa por dia", true)}{field(`lodgings.${i}.meals.${key}.days`, "Em quantos dias da viagem esse gasto ocorreria?", false, "Preencha valor e dias juntos, ou deixe ambos vazios. Até o número de noites + 1.")}</>}</div>)}</div></div>)}
    </Section>
    <Section title="Deslocamentos durante a viagem" initialOpen>
      {select("transport", "Como você pretende se deslocar entre a hospedagem e os locais da viagem?", values.transport, transportLabels, text => change(v => { v.transport = text as LodgingComparison["transport"]; }))}
      {vehicle && <><p className="section-note">Compare somente o impacto da localização. Aluguel do veículo, seguro, IPVA, manutenção e depreciação não entram aqui.</p><div className="money-grid">{field("efficiency", "Consumo médio do veículo (km/L)", false, "Obrigatório quando houver locais cadastrados.")}{field("fuelPrice", "Preço do combustível (R$/L)", true, "Obrigatório quando houver locais cadastrados; zero informado é aceito.")}</div></>}
    </Section>
    {vehicle && <Section title="Estacionamento da hospedagem"><div className="property-columns">{values.lodgings.map((l, i) => <div key={i}><h4>{lodgingName(l, i)}</h4>{l.parking.included ? <p className="field-hint">Estacionamento incluído: nenhum custo adicional.</p> : <>{select(`parking-period-${i}`, "Como informar o estacionamento?", l.parking.period, { total: "Valor total da estadia", day: "Por dia" }, text => change(v => { v.lodgings[i].parking.period = text as typeof l.parking.period; }))}{field(`lodgings.${i}.parking.price`, "Estacionamento da hospedagem (opcional)", true)}{l.parking.period === "day" && field(`lodgings.${i}.parking.days`, "Em quantos dias?", false, "Informe os dias em que pagaria estacionamento, até noites + 1.")}</>}</div>)}</div></Section>}
    <Section title="Locais da viagem"><p className="section-note">Cadastre os mesmos locais para as duas hospedagens. Uma visita representa o deslocamento completo escolhido. Você pode usar somente ida ou volta para aeroporto, rodoviária e outros locais.</p>
      {values.places.map((p, i) => <PlaceCard key={p.id} id={p.id} title={p.name.trim() || `Local ${i + 1}`} frequency={preview.places[i].visits === null ? "Visitas não informadas" : formatLodgingQuantity(preview.places[i].visits!, "visita")} kind={tripLabels[p.kind]} summary={preview.lodgings.map((l, index) => {
        const j = preview.places[i].journeys[index];
        let cost: number | null = null;
        try {
          const single = structuredClone(preview);
          single.people = single.nights = 1; single.lodgings.forEach(l => { l.price = 0; l.fees = null; l.parking.included = true; Object.values(l.meals).forEach(m => { m.included = true; }); }); single.extras = []; single.places = [single.places[i]];
          cost = calculateLodgingComparison(single).scenarios[index].transport;
        } catch { /* Resumo parcial: nunca apresenta custo incompleto como zero. */ }
        return <div key={index}><strong>{lodgingName(l, index)}</strong><p>{vehicle && (j.distance === null ? "Distância não informada · " : `${j.distance.toLocaleString("pt-BR")} km por trecho · `)}{j.minutes === null ? "Tempo não informado" : `${formatTravelTime(j.minutes)} por trecho`}{cost !== null && ` · ${formatMoney(cost)} na viagem`}</p></div>;
      })}>
        {nameField(`place-name-${i}`, "Nome do local", p.name, text => change(v => { v.places[i].name = text; }), "Ex.: Centro histórico")}
        <div className="money-grid">{field(`places.${i}.visits`, "Quantas vezes você pretende fazer esse deslocamento durante a viagem?", false, "Número de visitas completas, maior que zero.")}{select(`trip-kind-${i}`, "Tipo de deslocamento", p.kind, tripLabels, text => change(v => { v.places[i].kind = text as typeof p.kind; }))}</div>
        {vehicle && <fieldset className="included-group">{check(`same-parking-${i}`, "Mesmo valor de estacionamento para as duas hospedagens", p.sameParking, checked => change(v => { v.places[i].sameParking = checked; }))}</fieldset>}
        <div className="property-columns">{p.journeys.map((j, s) => <div key={s}><h4>{lodgingName(values.lodgings[s], s)}</h4>
          {vehicle ? field(`places.${i}.journeys.${s}.distance`, "Distância até este local (km por trecho)", false, p.kind === "round" ? "Informe um trecho. A ferramenta considera ida e volta por visita." : "Informe somente o trecho escolhido por visita.") : values.transport && field(`places.${i}.journeys.${s}.fare`, values.transport === "app" ? `Valor estimado ${p.kind === "round" ? "de ida e volta" : p.kind === "outward" ? "da ida" : "da volta"} por visita` : "Custo estimado de deslocamento por visita", true, "Valor para todo o grupo e para o tipo de deslocamento escolhido, sem multiplicar por pessoas.")}
          {field(`places.${i}.journeys.${s}.minutes`, p.kind === "return" ? "Tempo de volta (minutos)" : "Tempo de ida (minutos)", false, "Opcional, por trecho. Não inclui espera do aplicativo e não é convertido em dinheiro.")}
          {vehicle && <>
            {(!p.sameParking || s === 0) ? <>{select(`paid-parking-${i}-${s}`, "Você espera pagar estacionamento neste local?", j.parkingPaid ? "yes" : "no", { no: "Não", yes: "Sim" }, text => change(v => { v.places[i].journeys[s].parkingPaid = text === "yes"; }))}{j.parkingPaid && field(`places.${i}.journeys.${s}.parking`, "Valor do estacionamento por visita", true, p.sameParking ? "O mesmo valor será usado nas duas hospedagens." : undefined)}</> : <p className="field-hint">Estacionamento: mesmo valor informado para {lodgingName(values.lodgings[0], 0)}.</p>}
            {select(`paid-toll-${i}-${s}`, "Existe pedágio nesse deslocamento?", j.tollPaid ? "yes" : "no", { no: "Não", yes: "Sim" }, text => change(v => { v.places[i].journeys[s].tollPaid = text === "yes"; }))}
            {j.tollPaid && field(`places.${i}.journeys.${s}.toll`, "Pedágio para a visita completa", true, "Inclua todos os trechos escolhidos. O valor é multiplicado apenas pela quantidade de visitas.")}
          </>}
        </div>)}</div><button type="button" className="text-link lodging-remove" onClick={() => removeRow("places", i)} aria-label={`Remover ${p.name || `local ${i + 1}`}`}>Remover local</button>
      </PlaceCard>)}
      <button type="button" className="secondary-button" disabled={!ready || values.places.length >= 50} onClick={() => { const id = crypto.randomUUID(); change(v => { v.places.push(emptyTravelPlace(id)); }); requestAnimationFrame(() => { const card = document.getElementById(`place-${id}`); card?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }); document.getElementById(`place-toggle-${id}`)?.focus({ preventScroll: true }); }); }}>+ Adicionar local</button>
      {values.places.length === 0 && <p className="field-hint">Sem locais cadastrados, nenhum custo ou tempo de deslocamento será somado.</p>}
    </Section>
    <Section title="Outros custos"><p className="section-note">Somente custos que mudam com a hospedagem. Informe o valor total da viagem, sem repetir despesas já preenchidas.</p>{values.extras.map((e, i) => <div className="custom-cost" key={e.id}>
      {nameField(`extra-name-${i}`, "Nome do custo", e.name, text => change(v => { v.extras[i].name = text; }))}<div className="property-columns">{values.lodgings.map((l, s) => <div key={s}>{field(`extras.${i}.amounts.${s}`, `${lodgingName(l, s)} — valor total da viagem`, true)}</div>)}</div><button type="button" className="text-link" aria-label={`Remover ${e.name || `custo ${i + 1}`}`} onClick={() => removeRow("extras", i)}>Remover custo</button>
    </div>)}<button type="button" className="secondary-button" disabled={!ready || values.extras.length >= 50} onClick={() => change(v => { v.extras.push({ id: crypto.randomUUID(), name: "", amounts: [null, null] }); })}>+ Adicionar outro custo</button></Section>
    <div className="calculator-actions"><button className="button" type="submit" disabled={!ready}>Comparar hospedagens ↗</button></div><div className="storage-panel"><p>Seus dados ficam salvos somente neste navegador quando você escolhe salvar.</p><div className="storage-actions"><button type="button" disabled={!ready} onClick={save}>Salvar simulação</button><button type="button" disabled={!ready} onClick={clear}>Limpar meus dados</button></div></div><p role="status" className="calculator-notice">{notice}</p>
  </form>
  {result && <section className="calculator-results comparison-results lodging-results" ref={resultRef} tabIndex={-1} aria-labelledby="lodging-result-title"><p className="eyebrow">Preço não é necessariamente custo</p><h2 id="lodging-result-title">O custo comparável da sua escolha</h2><p className="field-hint">{formatLodgingQuantity(result.input.people!, "pessoa")} · {formatLodgingQuantity(result.input.nights!, "noite")} · {transportLabels[result.input.transport!]}</p>
    <div className="property-columns">{result.scenarios.map((s, i) => <article className="scenario-card" key={i}><h3>{s.name}</h3><dl><Pair label="Total da hospedagem / preço da reserva" value={formatMoney(s.price)} /><Pair label="Custos adicionais" value={formatMoney(s.additional)} />{s.breakdown.slice(1).map(b => <Pair key={b.key} label={b.label} value={formatMoney(b.value)} />)}</dl><h4>Custo total comparável</h4><p className="result-total">{formatMoney(s.total)}</p><dl><Pair label="Custo comparável por pessoa" value={formatMoney(s.perPerson)} /></dl><p className="field-hint">Divisão simples do total pelo número de pessoas informado.</p></article>)}</div>
    <div className="result-explanation"><p>{lodgingDifferenceText(result)}</p><p>Diferença: <strong>{formatMoney(Math.abs(result.delta))}</strong> no total da viagem.</p></div><section className="comparison-detail"><h3>Impacto dos custos adicionais</h3><p>{lodgingPriceInsight(result)}</p></section>
    <section className="comparison-detail"><h3>Tempo de deslocamento</h3><div className="property-columns">{result.scenarios.map((s, i) => <div className="detail-card" key={i}><h4>{s.name}</h4><p>{s.minutes === null ? "Tempo total incompleto: faltam estimativas de locais." : `${formatTravelTime(s.minutes)} durante a viagem`}</p></div>)}</div><p>{lodgingTimeText(result)}</p>{result.minutesDelta !== null && <p>Diferença: {formatTravelTime(Math.abs(result.minutesDelta))}</p>}<p className="field-hint">Tempo apresentado separadamente, sem valor monetário.</p></section>
    <Section title="Por que os custos são diferentes?">{result.differences.length === 0 ? <p>Os custos informados são iguais em todas as categorias.</p> : result.differences.map((d, i) => <div className="detail-card" key={i}><h4>{d.label}</h4><p>{result.scenarios[0].name}: {formatMoney(d.a)} · {result.scenarios[1].name}: {formatMoney(d.b)}</p><p>{result.scenarios[d.delta > 0 ? 0 : 1].name} acrescenta {formatMoney(Math.abs(d.delta))} nesta comparação.</p></div>)}</Section>
    <Section title="Composição do custo"><div className="property-columns">{result.scenarios.map((s, i) => <div key={i}><h4>{s.name}</h4>{s.total === 0 ? <p className="field-hint">Total zero: não há participação percentual calculável.</p> : s.breakdown.filter(b => b.value > 0).map(b => <div className="detail-card" key={b.key}><div className="distribution-label"><span>{b.label}</span><strong>{formatMoney(b.value)} · {formatPercentage(b.share!)}</strong></div><div className="distribution-track" aria-hidden="true"><div style={{ width: `${b.share}%` }} /></div></div>)}</div>)}</div></Section>
    <Section title="Deslocamentos por local">{result.input.places.length === 0 ? <p className="field-hint">Nenhum local cadastrado.</p> : result.input.places.map((p, i) => <Section key={p.id} title={`${p.name.trim() || `Local ${i + 1}`} · ${formatLodgingQuantity(p.visits!, "visita")} · ${tripLabels[p.kind]}`}><div className="property-columns">{result.scenarios.map((s, index) => { const j = s.journeys[i]; return <div key={index}><h4>{s.name}</h4><dl>{j.distance !== null && <><Pair label="Distância total" value={`${j.distance.toLocaleString("pt-BR")} km`} /><Pair label="Combustível" value={formatMoney(j.fuel)} /><Pair label="Estacionamento no destino" value={formatMoney(j.parking)} /><Pair label="Pedágio" value={formatMoney(j.toll)} /></>}{j.distance === null && <Pair label={result.input.transport === "app" ? "Corridas" : "Custo manual"} value={formatMoney(j.fare)} />}<Pair label="Total de deslocamentos" value={formatMoney(j.total)} /><Pair label="Tempo" value={j.minutes === null ? "Não informado" : formatTravelTime(j.minutes)} /></dl></div>; })}</div></Section>)}</Section>
    <Section title="Premissas e limites">{lodgingNotes.map(note => <p className="field-hint" key={note}>{note}</p>)}</Section><ExportLodging result={result} brand={reportBrand} />
  </section>}</div>;
}
function Section({ title, children, initialOpen = false }: { title: string; children: ReactNode; initialOpen?: boolean }) { return <details className="expense-section" open={initialOpen || undefined}><summary><h3>{title}</h3><span className="section-chevron" aria-hidden="true">+</span></summary><div className="section-body">{children}</div></details>; }
function Pair({ label, value }: { label: string; value: string }) { return <div className="comparison-pair"><dt>{label}</dt><dd>{value}</dd></div>; }

function PlaceCard({ id, title, frequency, kind, summary, children }: { id: string; title: string; frequency: string; kind: string; summary: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const ref = useRef<HTMLDetailsElement>(null);
  return <div className="lodging-place-wrap"><details id={`place-${id}`} ref={ref} className="expense-section lodging-place" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary id={`place-toggle-${id}`} aria-expanded={open} aria-controls={`place-fields-${id}`} aria-label={`${open ? "Recolher" : "Editar"} ${title}`}><h3>{title}</h3><span>{frequency} · {kind}</span><span>{open ? "Recolher" : "Editar"}</span><span className="section-chevron" aria-hidden="true">+</span></summary>

    <div id={`place-fields-${id}`} className="section-body">{children}</div>
  </details>{!open && <div className="lodging-place-summary">{summary}</div>}</div>;
}

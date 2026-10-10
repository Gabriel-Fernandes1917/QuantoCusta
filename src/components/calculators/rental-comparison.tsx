"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { activeRentalFields, additionalLabels, beyondRentalText, calculateRentalComparison, calculateRentalRide, emptyRentalComparison, emptyRentalRide, formatDuration, formatQuantity, fuelModeLabels, includedLabels, parseRentalField, rentalDifferenceText, rentalIssues, rentalNotes, rentalPriceLabels, rentalTariffNote, rentalValue, rentalWaitText, rideKindLabels, setRentalValue, storedRentalFields, vehicleLabels, type RentalComparison, type RentalResult } from "@/lib/calculations/rental-comparison";
import { decodeRentalComparison, encodeRentalComparison, RENTAL_STORAGE_KEY } from "@/lib/rental-storage";
import { formatMoney, formatPercentage, moneyInput, parseMoney } from "@/lib/money";
import type { ReportBrand } from "@/lib/export/report";
import { MoneyInput } from "../money-input";
import { ExportRental } from "../export-rental";

const decimal = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
export function RentalComparisonCalculator({ reportBrand }: { reportBrand: ReportBrand }) {
  const [values, setValues] = useState(emptyRentalComparison);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<RentalResult | null>(null);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => {
    setReady(true);
    try { const saved = localStorage.getItem(RENTAL_STORAGE_KEY); if (saved) { setValues(decodeRentalComparison(saved)); setNotice("Sua simulação salva foi carregada. Edite e compare novamente."); } }
    catch { setNotice("Não foi possível carregar os dados salvos. Você pode preencher normalmente ou limpar os dados."); }
  }, []);
  const fields = storedRentalFields(values);
  function change(mutate: (next: RentalComparison) => void) {
    setValues(previous => { const next = structuredClone(previous); mutate(next); return next; });
    setErrors({}); setNotice(""); setResult(null);
  }
  function inputValue(path: string, money = false) {
    const n = rentalValue(values, path); return draft[path] ?? (n === null ? "" : money ? moneyInput(n) : String(n).replace(".", ","));
  }
  function parseField(path: string, text: string) {
    const field = fields.find(f => f.path === path)!;
    return !text.trim() ? null : field.kind === "money" ? parseMoney(text) : parseRentalField(text, field.kind);
  }
  function update(path: string, text: string) {
    setDraft(d => ({ ...d, [path]: text })); setErrors(e => ({ ...e, [path]: "" })); setNotice("");
    try { if (parseField(path, inputValue(path, fields.find(f => f.path === path)?.kind === "money")) !== parseField(path, text)) setResult(null); }
    catch { setResult(null); }
  }
  function readDraft() {
    const next = structuredClone(values), found: Record<string, string> = {};
    const active = new Set(activeRentalFields(values).map(f => f.path));
    for (const [path, text] of Object.entries(draft)) {
      if (!fields.some(f => f.path === path)) continue;
      try { setRentalValue(next, path, parseField(path, text)); }
      catch (e) { if (active.has(path)) found[path] = (e as Error).message; }
    }
    return { next, found };
  }
  function focusInvalid(path: string) {
    const el = document.getElementById(path); let parent = el?.parentElement;
    while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
    el?.focus();
  }
  function parse(complete: boolean) {
    const { next, found } = readDraft();
    if (complete) for (const [path, message] of Object.entries(rentalIssues(next))) if (!found[path]) found[path] = message;
    setErrors(found);
    if (Object.keys(found).length) { setNotice("Confira os campos indicados. Seus valores foram mantidos."); focusInvalid(Object.keys(found)[0]); return null; }
    return next;
  }
  function submit(e: FormEvent) {
    e.preventDefault(); const next = parse(true); if (!next) return;
    try { setResult(calculateRentalComparison(next)); setNotice(""); requestAnimationFrame(() => resultRef.current?.focus()); }
    catch (e) { setNotice((e as Error).message); }
  }
  function save() {
    const next = parse(false); if (!next) return;
    try { localStorage.setItem(RENTAL_STORAGE_KEY, encodeRentalComparison(next)); setNotice("Simulação salva somente neste navegador."); }
    catch { setNotice("Não foi possível salvar. Seus valores foram mantidos."); }
  }
  function clear() {
    let removed = true;
    try { localStorage.removeItem(RENTAL_STORAGE_KEY); }
    catch { removed = false; }
    setValues(emptyRentalComparison()); setDraft({}); setErrors({}); setResult(null);
    setNotice(removed ? "Os dados desta ferramenta foram limpos." : "Campos e resultados limpos. Não foi possível remover a cópia salva no navegador; limpe os dados do site nas configurações do navegador.");
  }
  function removeRow(type: "rides" | "extras", index: number) {
    setDraft(previous => Object.fromEntries(Object.entries(previous).flatMap(([path, text]) => {
      const parts = path.split("."); if (parts[0] !== type) return [[path, text]];
      const row = Number(parts[1]); if (row === index) return []; if (row > index) parts[1] = String(row - 1); return [[parts.join("."), text]];
    })));
    change(v => { v[type].splice(index, 1); });
    requestAnimationFrame(() => document.getElementById(type === "rides" ? "rides" : "add-rental-extra")?.focus());
  }
  function addRide() {
    const id = crypto.randomUUID(); change(v => { v.rides.push(emptyRentalRide(id)); });
    requestAnimationFrame(() => {
      document.getElementById(`ride-card-${id}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
      document.getElementById(`ride-toggle-${id}`)?.focus({ preventScroll: true });
    });
  }
  function field(path: string, label: string, hint?: string) {
    const money = fields.find(f => f.path === path)?.kind === "money";
    if (money) return <MoneyInput id={path} label={label} value={inputValue(path, true)} onChange={text => update(path, text)} error={errors[path]} hint={hint} />;
    return <div className="plain-field"><label htmlFor={path}>{label}</label><input id={path} type="text" inputMode={fields.find(f => f.path === path)?.kind === "integer" ? "numeric" : "decimal"} autoComplete="off" maxLength={24} placeholder="0" value={inputValue(path)} onChange={e => update(path, e.target.value)} aria-invalid={Boolean(errors[path])} aria-describedby={[hint ? `${path}-hint` : "", errors[path] ? `${path}-error` : ""].filter(Boolean).join(" ") || undefined} />{hint && <p className="field-hint" id={`${path}-hint`}>{hint}</p>}{errors[path] && <p className="field-error" id={`${path}-error`}>{errors[path]}</p>}</div>;
  }
  function select(id: string, label: string, value: string | null, options: Record<string, string>, onChange: (text: string) => void) {
    return <div className="plain-field"><label htmlFor={id}>{label}</label><select id={id} value={value ?? ""} onChange={e => onChange(e.target.value)} aria-invalid={Boolean(errors[id])} aria-describedby={errors[id] ? `${id}-error` : undefined}>{value === null && <option value="">Selecione</option>}{Object.entries(options).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select>{errors[id] && <p className="field-error" id={`${id}-error`}>{errors[id]}</p>}</div>;
  }
  function nameField(id: string, label: string, value: string, onChange: (text: string) => void) {
    return <div className="plain-field"><label htmlFor={id}>{label}</label><input id={id} maxLength={80} value={value} onChange={e => onChange(e.target.value)} /></div>;
  }
  const preview = readDraft();
  return <div className="comparison-area rental-calculator"><form noValidate onSubmit={submit}>
    <div className="form-intro"><h2>Compare a mobilidade da sua viagem</h2><p>Informe a cotação da locação, os gastos do veículo e as corridas que imagina fazer. Os valores representam sua viagem e o grupo inteiro.</p><p className="field-hint">Custos opcionais podem ficar vazios. Nos campos necessários, informe um valor; zero também é aceito quando aplicável.</p></div>
    <RentalSection title="Sua viagem" initialOpen><div className="money-grid">{field("days", "Quantos dias da viagem você está considerando?", "Dias da viagem, não noites. Não definem automaticamente as diárias do veículo.")}{field("people", "Quantas pessoas estão viajando? (opcional)", "Usado apenas para dividir o custo total, sem multiplicar as despesas.")}</div></RentalSection>
    <RentalSection title="Veículo alugado" initialOpen><div className="money-grid">{select("vehicle", "Tipo de veículo", values.vehicle, vehicleLabels, text => change(v => { v.vehicle = text as RentalComparison["vehicle"]; }))}{select("priceMode", "Como você quer informar o valor do aluguel?", values.priceMode, rentalPriceLabels, text => change(v => { v.priceMode = text as RentalComparison["priceMode"]; }))}{field("rentalPrice", values.priceMode === "daily" ? "Valor da diária" : "Valor total da locação", "Use a cotação que você recebeu, incluindo os serviços já contratados.")}{values.priceMode === "daily" && field("rentalDays", "Quantidade de diárias", "Informe as diárias da locação; elas podem ser diferentes dos dias da viagem.")}</div>
      <fieldset className="included-group"><legend>O que já está incluído no valor informado?</legend>{Object.entries(includedLabels).map(([key, label]) => <label key={key} htmlFor={`included-${key}`}><input id={`included-${key}`} type="checkbox" checked={values.included[key as keyof typeof includedLabels]} onChange={e => change(v => { v.included[key as keyof typeof includedLabels] = e.target.checked; })} />{label}</label>)}</fieldset><p className="field-hint">Checklist informativo, sem preços automáticos. Itens incluídos não são somados novamente.</p>
    </RentalSection>
    <RentalSection title="Extras da locadora"><p className="section-note">Informe somente valores totais que ainda não estejam incluídos na cotação. Não são multiplicados pelas diárias.</p><div className="money-grid">{Object.entries(additionalLabels).map(([key, label]) => values.included[key as keyof typeof additionalLabels] ? <p className="field-hint" key={key}>{includedLabels[key as keyof typeof additionalLabels]}: incluído na cotação.</p> : <div key={key}>{field(key, `${label} (opcional)`)}</div>)}</div></RentalSection>
    <RentalSection title="Combustível" initialOpen>{select("fuelMode", "Como você quer informar o gasto com combustível?", values.fuelMode, fuelModeLabels, text => change(v => { v.fuelMode = text as RentalComparison["fuelMode"]; }))}<div className="money-grid">{values.fuelMode === "direct" ? field("fuelDirect", "Gasto estimado com combustível") : <>{field("kilometers", "Quantos quilômetros você estima rodar durante a viagem?", "Distância total em km.")}{field("efficiency", "Consumo médio do veículo", "Em km/L, maior que zero.")}{field("fuelPrice", "Preço do combustível", "Preço por litro (R$/L).")}</>}</div><p className="section-note">Considere a política de combustível da locadora ao estimar este valor. Algumas locações exigem a devolução com o mesmo nível de combustível da retirada.</p></RentalSection>
    <RentalSection title="Estacionamento">{select("parkingPaid", "Você espera ter gastos com estacionamento?", values.parkingPaid ? "yes" : "no", { no: "Não", yes: "Sim" }, text => change(v => { v.parkingPaid = text === "yes"; }))}{values.parkingPaid && <>{select("parkingMode", "Como você quer informar?", values.parkingMode, { total: "Valor total estimado", daily: "Valor por dia" }, text => change(v => { v.parkingMode = text as RentalComparison["parkingMode"]; }))}<div className="money-grid">{field("parkingPrice", values.parkingMode === "total" ? "Valor total estimado de estacionamento" : "Valor médio por dia")}{values.parkingMode === "daily" && field("parkingDays", "Em quantos dias?")}</div></>}<p className="section-note">Considere estacionamento na hospedagem e nos locais que pretende visitar.</p></RentalSection>
    <RentalSection title="Pedágios">{select("tollPaid", "Você espera pagar pedágios?", values.tollPaid ? "yes" : "no", { no: "Não", yes: "Sim" }, text => change(v => { v.tollPaid = text === "yes"; }))}{values.tollPaid && field("tolls", "Valor total estimado de pedágios")}</RentalSection>
    <RentalSection title="Limpeza e outros custos">{field("cleaning", "Limpeza ou lavagem antes da devolução (opcional)", "Use se você espera ter esse gasto antes de devolver o veículo.")}{values.extras.map((e, i) => <div className="custom-cost" key={e.id}>{nameField(`extra-name-${i}`, "Nome do custo", e.name, text => change(v => { v.extras[i].name = text; }))}{field(`extras.${i}.price`, "Valor total do custo (opcional)")}<button type="button" className="text-link rental-remove" aria-label={`Remover ${e.name || `custo ${i + 1}`}`} onClick={() => removeRow("extras", i)}>Remover custo</button></div>)}<button type="button" id="add-rental-extra" className="secondary-button" disabled={!ready || values.extras.length >= 50} onClick={() => change(v => { v.extras.push({ id: crypto.randomUUID(), name: "", price: null }); })}>+ Adicionar outro custo</button></RentalSection>
    <RentalSection title="Caução / bloqueio no cartão">{field("deposit", "Caução / bloqueio previsto no cartão (opcional)", "Esse valor não entra no custo total porque normalmente representa um bloqueio temporário, não uma despesa. Ele é exibido separadamente para ajudar no planejamento.")}</RentalSection>
    <RentalSection title="Transporte por aplicativo" initialOpen><aside className="rental-tip"><h4>Como estimar?</h4><p>Você pode abrir seu aplicativo de transporte e simular origem e destino para ter uma referência de preço, sem solicitar a corrida.</p><p>Quando possível, faça a simulação em um horário semelhante ao que pretende realizar o deslocamento.</p></aside><p className="section-note">{rentalTariffNote}</p>
      {values.rides.map((r, i) => {
        let summary: ReactNode = <p>Complete os valores e a quantidade para ver o total.</p>;
        try { if (!Object.keys(preview.found).some(path => path.startsWith(`rides.${i}.`))) {
          const ride = calculateRentalRide(preview.next.rides[i], i);
          summary = <><p>{formatQuantity(ride.count!, "vez", "vezes")} · {rideKindLabels[ride.kind]}</p><p>{ride.kind === "round" ? "Ida" : "Corrida"}: {formatMoney(ride.outwardFare!)}{ride.kind === "round" && ` · Volta: ${formatMoney(ride.returnFare!)}`}</p><p><strong>Total: {formatMoney(ride.total)}</strong></p><p>{rentalWaitText(ride)}</p></>;
        } } catch { /* Mantém o resumo incompleto enquanto o card está sendo preenchido. */ }
        return <RideCard key={r.id} id={r.id} title={r.name.trim() || `Corrida ${i + 1}`} summary={summary}>
          {nameField(`ride-name-${i}`, "Nome do deslocamento", r.name, text => change(v => { v.rides[i].name = text; }))}
          <div className="money-grid">{select(`ride-kind-${i}`, "Tipo", r.kind, rideKindLabels, text => change(v => { v.rides[i].kind = text as typeof r.kind; }))}{field(`rides.${i}.count`, "Quantas vezes esse deslocamento deve acontecer?", "Para ida e volta, cada ocorrência inclui os dois trechos.")}{field(`rides.${i}.outwardFare`, r.kind === "round" ? "Valor estimado da ida" : "Valor estimado da corrida")}{r.kind === "round" && field(`rides.${i}.returnFare`, "Valor estimado da volta")}{field(`rides.${i}.outwardWait`, r.kind === "round" ? "Espera estimada na ida (minutos)" : "Tempo estimado de espera (minutos)", "Opcional. Se você tiver uma ideia de quanto costuma esperar até conseguir um motorista.")}{r.kind === "round" && field(`rides.${i}.returnWait`, "Espera estimada na volta (minutos)", "Opcional. Vazio significa tempo não informado.")}</div><button type="button" className="text-link rental-remove" aria-label={`Remover ${r.name || `corrida ${i + 1}`}`} onClick={() => removeRow("rides", i)}>Remover corrida</button>
        </RideCard>;
      })}
      <button type="button" id="rides" className="secondary-button" aria-describedby={errors.rides ? "rides-error" : undefined} disabled={!ready || values.rides.length >= 50} onClick={addRide}>+ Adicionar corrida</button>{errors.rides && <p className="field-error" id="rides-error">{errors.rides}</p>}{values.rides.length === 0 && <p className="field-hint">Cadastre as corridas previstas para comparar as duas estratégias. Não há corridas ou preços preenchidos automaticamente.</p>}
    </RentalSection>
    <div className="calculator-actions"><button className="button" type="submit" disabled={!ready}>Comparar mobilidade na viagem ↗</button></div><div className="storage-panel"><p>Seus dados ficam salvos somente neste navegador quando você escolhe salvar.</p><div className="storage-actions"><button type="button" disabled={!ready} onClick={save}>Salvar simulação</button><button type="button" disabled={!ready} onClick={clear}>Limpar meus dados</button></div></div><p role="status" className="calculator-notice">{notice}</p>
  </form>
  {result && <section className="calculator-results comparison-results rental-results" ref={resultRef} tabIndex={-1} aria-labelledby="rental-result-title"><p className="eyebrow">Preço não é necessariamente custo</p><h2 id="rental-result-title">O custo da sua mobilidade na viagem</h2><p className="field-hint">{formatQuantity(result.input.days!, "dia")}{result.input.people !== null && ` · ${formatQuantity(result.input.people, "pessoa")}`} · {vehicleLabels[result.input.vehicle!]}</p>
    <div className="property-columns"><article className="scenario-card"><h3>Veículo alugado</h3><dl>{result.breakdown.map(c => <Pair key={c.key} label={c.label} value={formatMoney(c.value)} />)}</dl><h4>Custo total</h4><p className="result-total">{formatMoney(result.vehicleTotal)}</p><dl><Pair label="Custo médio por dia" value={formatMoney(result.vehiclePerDay)} />{result.vehiclePerPerson !== null && <Pair label="Custo por pessoa" value={formatMoney(result.vehiclePerPerson)} />}</dl>{result.deposit !== null && <aside className="rental-deposit"><h4>Caução / limite temporariamente comprometido</h4><p>{formatMoney(result.deposit)}</p><p className="field-hint">Não incluído no custo total.</p></aside>}</article><article className="scenario-card"><h3>Transporte por aplicativo</h3><dl><Pair label="Corridas" value={formatMoney(result.appTotal)} /></dl><h4>Custo total</h4><p className="result-total">{formatMoney(result.appTotal)}</p><dl><Pair label="Quantidade estimada de corridas" value={formatQuantity(result.totalRides, "corrida")} /><Pair label="Custo médio por corrida" value={result.appPerRide === null ? "Não calculável: nenhuma corrida." : formatMoney(result.appPerRide)} /><Pair label="Custo médio por dia" value={formatMoney(result.appPerDay)} />{result.appPerPerson !== null && <Pair label="Custo por pessoa" value={formatMoney(result.appPerPerson)} />}</dl><p className="section-note">{rentalTariffNote}</p></article></div>
    {result.input.people !== null && <p className="field-hint">Divisão simples do custo total pelo número de pessoas informado.</p>}
    <div className="result-explanation"><p>{rentalDifferenceText(result)}</p><p>Diferença: <strong>{formatMoney(result.difference)}</strong> durante a viagem.</p></div>
    <section className="comparison-detail"><h3>Além da locação</h3><p>{beyondRentalText(result)}</p></section>
    <section className="comparison-detail"><h3>Tempo de espera por aplicativo</h3><p>{rentalWaitText(result)}</p>{result.waitMinutes !== null && !result.waitComplete && <p className="field-hint">Soma somente os tempos preenchidos. Faltam estimativas de espera para alguns trechos.</p>}<p className="field-hint">Esse tempo é baseado apenas nas estimativas informadas e não representa o tempo das viagens. Não é convertido em dinheiro.</p></section>
    <RentalSection title="Detalhamento do veículo"><p>{vehicleLabels[result.input.vehicle!]} · {rentalPriceLabels[result.input.priceMode]}</p><p>{result.input.priceMode === "daily" ? `${formatMoney(result.input.rentalPrice!)} × ${formatQuantity(result.input.rentalDays!, "diária")} = ${formatMoney(result.rental)}` : `Locação: ${formatMoney(result.rental)}`}</p><h4>Itens incluídos na cotação</h4><p>{Object.entries(includedLabels).filter(([key]) => result.input.included[key as keyof typeof includedLabels]).map(([, label]) => label).join(" · ") || "Nenhum item marcado como incluído."}</p><dl>{result.additionals.map(c => <Pair key={c.key} label={c.label} value={formatMoney(c.value)} />)}</dl><h4>{fuelModeLabels[result.input.fuelMode]}</h4>{result.input.fuelMode === "distance" && <dl><Pair label="Distância estimada" value={`${decimal(result.input.kilometers!)} km`} /><Pair label="Consumo informado" value={`${decimal(result.input.efficiency!)} km/L`} /><Pair label="Preço do combustível" value={`${formatMoney(result.input.fuelPrice!)}/L`} /></dl>}<p>Combustível estimado: {formatMoney(result.fuel)}</p>{result.input.parkingPaid && <p>Estacionamento: {formatMoney(result.input.parkingPrice!)}{result.input.parkingMode === "daily" && ` × ${formatQuantity(result.input.parkingDays!, "dia")}`} = {formatMoney(result.parking)}</p>}{result.extras.map(e => <p key={e.id}>{e.name}: {formatMoney(e.total)}</p>)}</RentalSection>
    <RentalSection title="Composição do custo do veículo"><ul className="rental-distribution">{[...result.breakdown].sort((a, b) => b.value - a.value).filter(c => c.value > 0).map(c => <li key={c.key}><div className="distribution-label"><span>{c.label}</span><strong>{formatMoney(c.value)} · {formatPercentage(c.share!)}</strong></div><div className="distribution-track" aria-hidden="true"><div style={{ width: `${c.share}%` }} /></div></li>)}</ul>{result.vehicleTotal === 0 && <p className="field-hint">Total zero: não há participação percentual calculável.</p>}</RentalSection>
    <RentalSection title="Corridas que mais pesam"><ul className="rental-distribution">{[...result.rides].sort((a, b) => b.total - a.total).map(r => <li key={r.id}><div className="distribution-label"><span>{r.name}</span><strong>{formatMoney(r.total)}{r.share !== null && ` · ${formatPercentage(r.share)}`}</strong></div></li>)}</ul>{result.appTotal === 0 && <p className="field-hint">Total zero: não há participação percentual calculável.</p>}</RentalSection>
    <RentalSection title="Corridas informadas">{result.rides.map(r => <article className="detail-card" key={r.id}><h4>{r.name}</h4><p>{formatQuantity(r.count!, "vez", "vezes")} · {rideKindLabels[r.kind]}</p><dl><Pair label={r.kind === "round" ? "Ida" : "Valor da corrida"} value={formatMoney(r.outwardFare!)} />{r.kind === "round" && <Pair label="Volta" value={formatMoney(r.returnFare!)} />}<Pair label="Custo por ocorrência" value={formatMoney(r.unitCost)} /><Pair label="Total" value={formatMoney(r.total)} /><Pair label={r.kind === "round" ? "Espera na ida" : "Espera por corrida"} value={r.outwardWait === null ? "Não informada" : formatDuration(r.outwardWait)} />{r.kind === "round" && <Pair label="Espera na volta" value={r.returnWait === null ? "Não informada" : formatDuration(r.returnWait)} />}</dl><p>{rentalWaitText(r)}</p></article>)}</RentalSection>
    <RentalSection title="Premissas e limites">{rentalNotes.map(note => <p className="field-hint" key={note}>{note}</p>)}</RentalSection><ExportRental result={result} brand={reportBrand} />
  </section>}</div>;
}
function RentalSection({ title, children, initialOpen = false }: { title: string; children: ReactNode; initialOpen?: boolean }) {
  return <details className="expense-section" open={initialOpen || undefined}><summary><h3>{title}</h3><span className="section-chevron" aria-hidden="true">+</span></summary><div className="section-body">{children}</div></details>;
}
function RideCard({ id, title, summary, children }: { id: string; title: string; summary: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return <details id={`ride-card-${id}`} className="expense-section rental-ride" open={open} onToggle={e => setOpen(e.currentTarget.open)}><summary id={`ride-toggle-${id}`} aria-expanded={open} aria-controls={`ride-fields-${id}`} aria-label={`${open ? "Recolher" : "Editar"} ${title}`}><div className="rental-ride-heading"><h4>{title}</h4><span>{open ? "Recolher" : "Editar"}</span><span className="section-chevron" aria-hidden="true">+</span></div>{!open && <div className="rental-ride-summary">{summary}</div>}</summary><div id={`ride-fields-${id}`} className="section-body">{children}</div></details>;
}
function Pair({ label, value }: { label: string; value: string }) {
  return <div className="comparison-pair"><dt>{label}</dt><dd>{value}</dd></div>;
}

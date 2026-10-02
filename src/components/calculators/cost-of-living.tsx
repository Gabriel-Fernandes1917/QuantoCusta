"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { allFields, benefitUseField, calculateCostOfLiving, defaultVehiclePeriods, emptyDraft, emptySimulation, expenseCategories, fieldMonthlyCents, incomeFields, isVehicleField, type CostOfLivingResult, type Draft, type FieldId, type Simulation, type VehiclePeriods } from "@/lib/calculations/cost-of-living";
import { formatMoney, formatPercentage, moneyInput, parseMoney } from "@/lib/money";
import { decodeSimulation, encodeSimulation, SIMULATION_STORAGE_KEY } from "@/lib/simulation-storage";
import { MoneyInput } from "@/components/money-input";
import { ResultCard } from "@/components/result-card";
import { ExpenseBreakdown } from "@/components/expense-breakdown";
import { TransportFields } from "@/components/calculators/transport-fields";
import { ExportPlanning } from "@/components/export-planning";
import type { ReportBrand } from "@/lib/export/report";

export function CostOfLivingCalculator({ reportBrand }: { reportBrand: ReportBrand }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<Partial<Record<FieldId, string>>>({});
  const [result, setResult] = useState<CostOfLivingResult | null>(null);
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [hasVehicle, setHasVehicle] = useState<boolean | null>(null);
  const [vehiclePeriods, setVehiclePeriods] = useState<VehiclePeriods>(defaultVehiclePeriods);
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Sincronização inicial com um sistema externo (localStorage), sem escrita automática.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
    try {
      const saved = window.localStorage.getItem(SIMULATION_STORAGE_KEY);
      if (saved) {
        const values = decodeSimulation(saved);
        setDraft(Object.fromEntries(allFields.map(field => [field.id, values[field.id] ? moneyInput(values[field.id]) : ""])) as Draft);
        setHasVehicle(values.hasVehicle);
        setVehiclePeriods(values.vehiclePeriods);
        setNotice("Sua simulação salva foi carregada. Você pode editar e calcular novamente.");
      }
    } catch {
      setNotice("Não foi possível carregar os dados salvos. Você pode calcular normalmente e tentar limpar os dados.");
    }
  }, []);

  function update(id: FieldId, value: string) {
    if (draft[id] === value) return;
    // Não invalida o resultado quando só muda a formatação no blur.
    let sameValue = false;
    try { sameValue = parseMoney(draft[id]) === parseMoney(value); } catch { /* Entrada ainda incompleta. */ }
    setDraft(previous => ({ ...previous, [id]: value }));
    setErrors(previous => ({ ...previous, [id]: undefined }));
    if (!sameValue) setResult(null);
    setNotice("");
  }

  function validate(): Simulation | null {
    const values = emptySimulation();
    values.hasVehicle = hasVehicle;
    values.vehiclePeriods = vehiclePeriods;
    const found: Partial<Record<FieldId, string>> = {};
    for (const field of allFields) {
      try { values[field.id] = parseMoney(draft[field.id]); }
      catch (error) {
        if (!(isVehicleField(field.id) && hasVehicle !== true)) found[field.id] = error instanceof Error ? error.message : "Confira este valor.";
      }
    }
    setErrors(found);
    const firstInvalid = allFields.find(field => found[field.id]);
    if (firstInvalid) {
      setResult(null);
      setNotice("Confira os campos indicados antes de continuar.");
      const input = document.getElementById(firstInvalid.id);
      const section = input?.closest("details");
      if (section) section.open = true;
      input?.focus();
      return null;
    }
    return values;
  }

  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = validate();
    if (!values) return;
    setResult(calculateCostOfLiving(values));
    setNotice("");
    // Aguarda o React inserir o resultado antes de mover o foco.
    requestAnimationFrame(() => resultRef.current?.focus());
  }

  function save() {
    const values = validate();
    if (!values) return;
    try {
      window.localStorage.setItem(SIMULATION_STORAGE_KEY, encodeSimulation(values));
      setNotice("Simulação salva somente neste navegador. Alterações futuras precisam ser salvas novamente.");
    } catch {
      setNotice("Não foi possível salvar neste navegador. Seus cálculos continuam disponíveis, mas não foram salvos.");
    }
  }

  function clear() {
    let removed = true;
    try { window.localStorage.removeItem(SIMULATION_STORAGE_KEY); } catch { removed = false; }
    setDraft(emptyDraft());
    setErrors({});
    setResult(null);
    setHasVehicle(null);
    setVehiclePeriods(defaultVehiclePeriods());
    setNotice(removed ? "Os campos e os dados salvos desta calculadora foram limpos." : "Os campos foram limpos, mas não foi possível apagar o armazenamento do navegador. Limpe os dados do site nas configurações do navegador.");
  }

  function input(field: { id: FieldId; label: string; hint?: string }) {
    return <MoneyInput key={field.id} {...field} value={draft[field.id]} error={errors[field.id]} onChange={value => update(field.id, value)} />;
  }

  function subtotal(fields: readonly { id: FieldId }[]) {
    try {
      const values = { ...emptySimulation(), hasVehicle, vehiclePeriods };
      return formatMoney(fields.reduce((sum, field) => {
        if (isVehicleField(field.id) && hasVehicle !== true) return sum;
        values[field.id] = parseMoney(draft[field.id]);
        return sum + fieldMonthlyCents(values, field.id);
      }, 0));
    }
    catch { return "Confira os valores"; }
  }

  return (
    <div className="calculator-area">
      <form ref={formRef} onSubmit={calculate} noValidate className="calculator-form">
        <div className="form-intro"><h2>Monte seu mês</h2><p>Abra uma seção por vez e preencha o que fizer parte da sua vida. Campos vazios contam como zero.</p></div>
        <details className="expense-section" open>
          <summary><h3>Renda</h3><span>Dinheiro + benefícios</span><span className="section-chevron" aria-hidden="true">+</span></summary>
          <div className="section-body"><p className="section-note">Informe os valores que você espera receber por mês, já depois dos descontos.</p><div className="money-grid">{incomeFields.map(input)}</div></div>
        </details>
        {expenseCategories.map(category => (
          <details className="expense-section" key={category.id}>
            <summary><h3>{category.label}</h3><span>{subtotal(category.fields)}</span><span className="section-chevron" aria-hidden="true">+</span></summary>
            <div className="section-body"><p className="section-note">{category.hint}</p>{category.id === "transport" ? <TransportFields draft={draft} errors={errors} hasVehicle={hasVehicle} periods={vehiclePeriods} onChange={update} onVehicleChange={value => { setHasVehicle(value); setResult(null); setNotice(""); }} onPeriodsChange={value => { setVehiclePeriods(value); setResult(null); setNotice(""); }} /> : <div className="money-grid">{category.fields.map(input)}{category.id === "food" && input(benefitUseField)}</div>}</div>
          </details>
        ))}
        <div className="calculator-actions"><button className="button" type="submit" disabled={!ready}>Calcular meu custo de vida <span aria-hidden="true">↗</span></button></div>
        <noscript><p className="field-error">Ative o JavaScript no navegador para usar a calculadora. Os cálculos são feitos no seu dispositivo.</p></noscript>
        <div className="storage-panel"><p><strong>Seus valores ficam salvos somente neste navegador.</strong><br />Salvar é opcional. Os dados não são enviados para servidores.</p><div className="storage-actions"><button type="button" onClick={save} disabled={!ready}>Salvar simulação</button><button type="button" onClick={clear} disabled={!ready}>Limpar meus dados</button></div></div>
        <p className="calculator-notice" role="status">{notice}</p>
      </form>

      {result && <section ref={resultRef} tabIndex={-1} className="calculator-results" aria-labelledby="result-title">
        <p className="eyebrow">Seu cenário, em números</p><h2 id="result-title">Custo mensal estimado para morar sozinho</h2>
        <p className="result-total">{formatMoney(result.monthlyExpenses)}</p><p className="field-hint">Total de despesas informadas, incluindo pagamentos com benefícios alimentares.</p>
        <dl className="results-grid">
          <ResultCard label="Renda mensal em dinheiro" value={formatMoney(result.cashIncome)} />
          <ResultCard label="Benefícios alimentares (VA/VR)" value={formatMoney(result.foodBenefits)} hint="Separados da renda em dinheiro." />
          <ResultCard label="Despesas mensais" value={formatMoney(result.monthlyExpenses)} />
          <ResultCard label="Despesas pagas em dinheiro" value={formatMoney(result.cashExpenses)} />
          <ResultCard label="Saldo mensal em dinheiro" value={formatMoney(result.balance)} />
          <ResultCard label="Custo anual estimado" value={formatMoney(result.annualExpenses)} hint="Despesas mensais × 12. Não inclui mudança ou reajustes." />
          <ResultCard label="Renda em dinheiro comprometida" value={result.committedPercentage === null ? "Não calculável" : formatPercentage(result.committedPercentage)} hint={result.committedPercentage === null ? "Informe uma renda maior que zero para calcular o percentual." : "Despesas pagas em dinheiro ÷ renda em dinheiro."} />
        </dl>
        <div className="result-explanation">
          <p>{result.balance >= 0 ? `Depois das despesas informadas, restariam ${formatMoney(result.balance)} por mês em dinheiro.` : `As despesas pagas em dinheiro superam sua renda em ${formatMoney(-result.balance)} por mês.`}</p>
          <p>VA/VR usado em alimentação: <strong>{formatMoney(result.appliedBenefits)}</strong>. Benefício não utilizado: <strong>{formatMoney(result.unusedBenefits)}</strong>. Esse restante não foi somado ao saldo em dinheiro.</p>
          {result.appliedBenefits < result.requestedBenefits && <p>O uso informado de VA/VR foi limitado ao menor valor entre o benefício disponível e o gasto de alimentação.</p>}
          {result.monthlyExpenses === 0 && <p>{result.details.length ? "As despesas informadas equivalem a R$ 0,00 por mês após o arredondamento. A distribuição está zerada." : "Nenhuma despesa foi informada. A distribuição está zerada."}</p>}
          {result.details.some(item => item.period === "annual") && <p>Valores anuais foram divididos por 12 e arredondados para centavos. O custo anual estimado repete esse mês 12 vezes e pode diferir em alguns centavos dos valores anuais originais.</p>}
        </div>
        <ExpenseBreakdown categories={result.categories} />
        <button type="button" className="secondary-button" onClick={() => {
          const salary = document.getElementById("salary");
          const section = salary?.closest("details");
          if (section) section.open = true;
          formRef.current?.scrollIntoView({ block: "start" });
          salary?.focus();
        }}>Editar valores e recalcular</button>
        <ExportPlanning result={result} brand={reportBrand} />
      </section>}
    </div>
  );
}

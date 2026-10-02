import { expenseCategories, isAnnualVehicleField, isVehicleField, toMonthlyCents, type Draft, type FieldId, type VehiclePeriods } from "@/lib/calculations/cost-of-living";
import { formatMoney, parseMoney } from "@/lib/money";
import { MoneyInput } from "@/components/money-input";

type Props = {
  draft: Draft;
  errors: Partial<Record<FieldId, string>>;
  hasVehicle: boolean | null;
  periods: VehiclePeriods;
  onChange: (id: FieldId, value: string) => void;
  onVehicleChange: (value: boolean) => void;
  onPeriodsChange: (value: VehiclePeriods) => void;
};

const fields = expenseCategories.find(category => category.id === "transport")!.fields;

export function TransportFields({ draft, errors, hasVehicle, periods, onChange, onVehicleChange, onPeriodsChange }: Props) {
  function fieldInput(field: typeof fields[number]) {
    const annualId = isAnnualVehicleField(field.id) ? field.id : null;
    let equivalent = "";
    if (annualId && periods[annualId] === "annual") {
      try { equivalent = `Equivalente no planejamento: ${formatMoney(toMonthlyCents(parseMoney(draft[field.id]), "annual"))}/mês.`; }
      catch { equivalent = "Confira o valor para ver o equivalente mensal."; }
    }
    return <div key={field.id} className="vehicle-field">
      {annualId && <div className="period-control"><label htmlFor={`${field.id}-period`}>{field.label}: periodicidade</label><select id={`${field.id}-period`} value={periods[annualId]} onChange={event => onPeriodsChange({ ...periods, [annualId]: event.target.value })}><option value="monthly">Mensal</option><option value="annual">Anual</option></select></div>}
      <MoneyInput id={field.id} label={`${field.label}${annualId ? periods[annualId] === "annual" ? " — valor anual" : " — valor mensal" : ""}`} value={draft[field.id]} error={errors[field.id]} hint={equivalent || undefined} onChange={value => onChange(field.id, value)} />
    </div>;
  }

  return <div className="transport-fields">
    <fieldset className="vehicle-choice"><legend>Você tem ou pretende ter veículo próprio?</legend><div>
      <label><input type="radio" name="hasVehicle" value="yes" checked={hasVehicle === true} onChange={() => onVehicleChange(true)} /> Sim</label>
      <label><input type="radio" name="hasVehicle" value="no" checked={hasVehicle === false} onChange={() => onVehicleChange(false)} /> Não</label>
    </div><p className="field-hint">Pode ser um carro ou uma moto que você já tem ou pretende ter. Escolha uma opção para ajustar os campos.</p></fieldset>
    <div className="money-grid">{fields.filter(field => !isVehicleField(field.id)).map(fieldInput)}</div>
    {hasVehicle === true && <section className="vehicle-subsection" aria-labelledby="vehicle-title"><h4 id="vehicle-title">Veículo próprio</h4><p className="section-note">Seguro, IPVA e licenciamento podem ser informados por ano. O equivalente mensal é arredondado para o centavo mais próximo.</p><div className="money-grid">{fields.filter(field => isVehicleField(field.id)).map(fieldInput)}</div></section>}
    {hasVehicle === false && <p className="field-hint">Os gastos de veículo próprio ficam fora do cálculo. Se você voltar a selecionar “Sim”, os valores digitados serão mantidos.</p>}
  </div>;
}

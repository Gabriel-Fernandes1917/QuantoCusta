import { moneyInput, parseMoney } from "@/lib/money";

type MoneyInputProps = {
  id: string;
  label: string;
  hint?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

export function MoneyInput({ id, label, hint, value, error, onChange }: MoneyInputProps) {
  return (
    <div className="money-field">
      <label htmlFor={id}>{label}<span className="sr-only"> (em reais)</span></label>
      <div className="money-control">
        <span aria-hidden="true">R$</span>
        <input id={id} type="text" inputMode="decimal" autoComplete="off" maxLength={32} value={value} placeholder="0,00" aria-invalid={Boolean(error)} aria-describedby={[hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}
          onChange={event => onChange(event.target.value)}
          onBlur={() => {
            if (!value.trim()) return;
            try { onChange(moneyInput(parseMoney(value))); } catch { /* A validação exibe o erro ao calcular ou salvar. */ }
          }} />
      </div>
      {hint && <p id={`${id}-hint`} className="field-hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="field-error">{error}</p>}
    </div>
  );
}

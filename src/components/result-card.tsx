export function ResultCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="result-card"><dt>{label}</dt><dd>{value}{hint && <p className="field-hint">{hint}</p>}</dd></div>;
}

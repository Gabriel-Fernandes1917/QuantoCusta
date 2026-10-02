import type { CostOfLivingResult } from "@/lib/calculations/cost-of-living";
import { formatMoney, formatPercentage } from "@/lib/money";

export function ExpenseBreakdown({ categories }: { categories: CostOfLivingResult["categories"] }) {
  return (
    <section className="expense-breakdown" aria-labelledby="distribution-title">
      <h3 id="distribution-title">Para onde vai cada parte</h3>
      <p className="field-hint">Distribuição do total de despesas, incluindo o que for pago com VA/VR.</p>
      <ul>
        {categories.map(category => (
          <li key={category.id}>
            <div className="distribution-label"><span>{category.label}</span><strong>{formatPercentage(category.percentage)}</strong></div>
            <div className="distribution-track" aria-hidden="true"><div style={{ width: `${category.percentage}%` }} /></div>
            <p>{formatMoney(category.cents)} por mês</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

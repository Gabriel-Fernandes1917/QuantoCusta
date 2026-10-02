import { assertMoney, percentage } from "../money";

export const incomeFields = [
  { id: "salary", label: "Salário líquido" },
  { id: "extraIncome", label: "Renda extra" },
  { id: "otherIncome", label: "Outras rendas" },
  { id: "foodBenefits", label: "Vale-alimentação / vale-refeição", hint: "Benefício alimentar: não é dinheiro livre para outras despesas." },
] as const;

export const vehicleFieldIds = ["fuel", "vehicleLoan", "vehicleInsurance", "maintenance", "vehicleTax", "vehicleFees", "parking", "tolls"] as const;
export const annualVehicleFieldIds = ["vehicleInsurance", "vehicleTax", "vehicleFees"] as const;
export type AnnualVehicleFieldId = typeof annualVehicleFieldIds[number];
export type Period = "monthly" | "annual";
export type VehiclePeriods = Record<AnnualVehicleFieldId, Period>;

export function defaultVehiclePeriods(): VehiclePeriods {
  return { vehicleInsurance: "monthly", vehicleTax: "annual", vehicleFees: "annual" };
}

export const expenseCategories = [
  { id: "housing", label: "Moradia", hint: "Informe os valores mensais. Para IPTU anual, use o equivalente por mês.", fields: [
    { id: "rent", label: "Aluguel" }, { id: "condo", label: "Condomínio" }, { id: "propertyTax", label: "IPTU mensal" }, { id: "electricity", label: "Energia" }, { id: "water", label: "Água" }, { id: "gas", label: "Gás" }, { id: "internet", label: "Internet" },
  ] },
  { id: "food", label: "Alimentação", hint: "Informe o gasto total, incluindo a parte que pretende pagar com VA/VR.", fields: [
    { id: "groceries", label: "Supermercado" }, { id: "dining", label: "Refeições fora" }, { id: "delivery", label: "Delivery" },
  ] },
  { id: "transport", label: "Transporte", hint: "Considere seu transporte atual ou o que pretende usar ao morar sozinho, incluindo carro ou moto se fizer parte do plano.", fields: [
    { id: "publicTransport", label: "Transporte público" }, { id: "rideHailing", label: "Aplicativos de transporte" }, { id: "fuel", label: "Combustível" }, { id: "vehicleLoan", label: "Financiamento do veículo" }, { id: "vehicleInsurance", label: "Seguro" }, { id: "maintenance", label: "Manutenção" }, { id: "vehicleTax", label: "IPVA" }, { id: "vehicleFees", label: "Licenciamento / taxas" }, { id: "parking", label: "Estacionamento" }, { id: "tolls", label: "Pedágios recorrentes" },
  ] },
  { id: "health", label: "Saúde", hint: "Inclua os gastos de saúde que você espera ter no mês.", fields: [
    { id: "healthPlan", label: "Plano de saúde" }, { id: "medicines", label: "Medicamentos" }, { id: "appointments", label: "Consultas" },
  ] },
  { id: "personal", label: "Vida pessoal", hint: "Inclua as atividades e os serviços que fazem parte da sua rotina.", fields: [
    { id: "gym", label: "Academia" }, { id: "leisure", label: "Lazer" }, { id: "streaming", label: "Streaming" }, { id: "subscriptions", label: "Assinaturas" }, { id: "clothes", label: "Roupas" }, { id: "personalCare", label: "Cuidados pessoais" },
  ] },
  { id: "financial", label: "Compromissos financeiros", hint: "Inclua apenas valores que não foram contados em outras categorias. Evite somar a fatura do cartão às compras já informadas.", fields: [
    { id: "installments", label: "Parcelas" }, { id: "loans", label: "Empréstimos" }, { id: "creditCard", label: "Cartão / compromissos recorrentes" }, { id: "otherExpenses", label: "Outros gastos" },
  ] },
] as const;

export const benefitUseField = { id: "benefitUse", label: "Quanto do VA/VR pretende usar em alimentação?", hint: "Informe somente o que poderá pagar com o benefício. O uso será limitado ao VA/VR disponível e ao gasto de alimentação." } as const;
export const allFields = [...incomeFields, ...expenseCategories.flatMap(category => [...category.fields]), benefitUseField];
export type FieldId = typeof allFields[number]["id"];
export type Simulation = Record<FieldId, number> & { hasVehicle: boolean | null; vehiclePeriods: VehiclePeriods };
export type Draft = Record<FieldId, string>;

export function emptySimulation(): Simulation {
  return { ...Object.fromEntries(allFields.map(field => [field.id, 0])), hasVehicle: null, vehiclePeriods: defaultVehiclePeriods() } as Simulation;
}

export function emptyDraft(): Draft {
  return Object.fromEntries(allFields.map(field => [field.id, ""])) as Draft;
}

export function validateSimulation(input: Simulation): void {
  allFields.forEach(field => assertMoney(input[field.id]));
  if (input.hasVehicle !== null && typeof input.hasVehicle !== "boolean") throw new Error("Escolha de veículo inválida.");
  annualVehicleFieldIds.forEach(id => {
    if (!input.vehiclePeriods || !["monthly", "annual"].includes(input.vehiclePeriods[id])) throw new Error("Periodicidade inválida.");
  });
}

export function toMonthlyCents(cents: number, period: Period): number {
  assertMoney(cents);
  if (period !== "annual" && period !== "monthly") throw new Error("Periodicidade inválida.");
  // Divisão inteira, com metade do centavo arredondada para cima.
  return period === "annual" ? Math.floor((cents + 6) / 12) : cents;
}

export function isVehicleField(id: FieldId): boolean {
  return (vehicleFieldIds as readonly string[]).includes(id);
}

export function isAnnualVehicleField(id: FieldId): id is AnnualVehicleFieldId {
  return (annualVehicleFieldIds as readonly string[]).includes(id);
}

export function fieldMonthlyCents(input: Simulation, id: FieldId): number {
  if (isVehicleField(id) && input.hasVehicle !== true) return 0;
  return toMonthlyCents(input[id], isAnnualVehicleField(id) ? input.vehiclePeriods[id] : "monthly");
}

export function calculateCostOfLiving(input: Simulation) {
  validateSimulation(input);
  const cashIncome = input.salary + input.extraIncome + input.otherIncome;
  const details = expenseCategories.flatMap(category => category.fields.map(field => ({
    categoryId: category.id,
    category: category.label,
    id: field.id,
    label: field.label,
    period: isAnnualVehicleField(field.id) ? input.vehiclePeriods[field.id] : "monthly" as Period,
    informedCents: input[field.id],
    monthlyCents: fieldMonthlyCents(input, field.id),
  })).filter(item => item.informedCents > 0 && (!isVehicleField(item.id) || input.hasVehicle === true)));
  const categories = expenseCategories.map(category => ({
    id: category.id,
    label: category.label,
    cents: details.filter(item => item.categoryId === category.id).reduce((sum, item) => sum + item.monthlyCents, 0),
  }));
  const monthlyExpenses = categories.reduce((sum, category) => sum + category.cents, 0);
  const foodExpenses = categories.find(category => category.id === "food")!.cents;
  const appliedBenefits = Math.min(input.benefitUse, input.foodBenefits, foodExpenses);
  const cashExpenses = monthlyExpenses - appliedBenefits;
  const annualExpenses = monthlyExpenses * 12;
  if (!Number.isSafeInteger(annualExpenses)) throw new Error("Total anual fora do intervalo seguro.");
  return {
    details,
    incomeDetails: incomeFields.filter(field => input[field.id] > 0).map(field => ({ label: field.label, cents: input[field.id] })),
    hasVehicle: input.hasVehicle,
    cashIncome,
    foodBenefits: input.foodBenefits,
    requestedBenefits: input.benefitUse,
    appliedBenefits,
    unusedBenefits: input.foodBenefits - appliedBenefits,
    monthlyExpenses,
    cashExpenses,
    balance: cashIncome - cashExpenses,
    annualExpenses,
    committedPercentage: percentage(cashExpenses, cashIncome),
    categories: categories.map(category => ({ ...category, percentage: percentage(category.cents, monthlyExpenses) ?? 0 })),
  };
}

export type CostOfLivingResult = ReturnType<typeof calculateCostOfLiving>;

export type IncomeType = "salary" | "additional";

export type IncomeSource = {
  id: string;
  partnerId: string;
  type: IncomeType;
  name: string;
  amount: number;
  month: string; // YYYY-MM
};

export type ExpenseItem = {
  id: string;
  category: string;
  subcategory: string;
  amount: number;
  month: string; // YYYY-MM
  dueDate?: string; // YYYY-MM-DD
  isRecurring?: boolean;
  isPaid?: boolean;
};

export type BudgetCategoryLimit = {
  category: string;
  limit: number;
};

export type SavingsGoal = {
  id: string;
  goalType: "Savings" | "Investment" | "Retirement" | "Emergency";
  title: string;
  targetAmount: number;
  currentAmount: number;
  taxFreeLimit: number;
  isRecurring: boolean;
  recurringAmount: number;
  recurrence: "Weekly" | "Monthly" | "Quarterly";
};

export type Household = {
  id: string;
  name: string;
  currency: "ZAR";
  joinCode: string;
  memberIds: string[];
};

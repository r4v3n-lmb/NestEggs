import type { BudgetCategoryLimit, ExpenseItem, IncomeSource, SavingsGoal } from "../types";
import { currentMonth } from "../lib/format";

const month = currentMonth();

export const mockIncomes: IncomeSource[] = [
  { id: "inc-1", partnerId: "p1", type: "salary", name: "Primary Salary", amount: 42000, month },
  { id: "inc-2", partnerId: "p2", type: "salary", name: "Partner Salary", amount: 36500, month },
  { id: "inc-3", partnerId: "p1", type: "additional", name: "Freelance", amount: 3200, month }
];

export const mockExpenses: ExpenseItem[] = [
  { id: "e-1", category: "Housing", subcategory: "Rent", amount: 18500, month, isRecurring: true, isPaid: true, dueDate: `${month}-01` },
  { id: "e-2", category: "Transport", subcategory: "Fuel", amount: 3400, month, isPaid: true },
  { id: "e-3", category: "Transport", subcategory: "Insurance", amount: 1900, month, isRecurring: true, isPaid: true, dueDate: `${month}-05` },
  { id: "e-4", category: "Groceries", subcategory: "Checkers", amount: 1800, month, isPaid: true },
  { id: "e-5", category: "Groceries", subcategory: "Woolworths", amount: 1250, month, isPaid: true },
  { id: "e-6", category: "Groceries", subcategory: "Makro", amount: 2200, month, isPaid: false }
];

export const mockBudgetLimits: BudgetCategoryLimit[] = [
  { category: "Housing", limit: 19000 },
  { category: "Transport", limit: 7000 },
  { category: "Groceries", limit: 6500 },
  { category: "Lifestyle", limit: 5000 }
];

export const mockGoals: SavingsGoal[] = [
  {
    id: "g-1",
    goalType: "Savings",
    title: "Tax-Free Savings",
    targetAmount: 36000,
    currentAmount: 18300,
    taxFreeLimit: 36000,
    isRecurring: true,
    recurringAmount: 2500,
    recurrence: "Monthly"
  },
  {
    id: "g-2",
    goalType: "Investment",
    title: "Investment Portfolio",
    targetAmount: 120000,
    currentAmount: 27500,
    taxFreeLimit: 120000,
    isRecurring: true,
    recurringAmount: 3500,
    recurrence: "Monthly"
  }
];

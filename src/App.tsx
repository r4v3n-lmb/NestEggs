import { useEffect, useMemo, useState } from "react";
import type { BudgetCategoryLimit, ExpenseItem, IncomeSource, SavingsGoal } from "./types";
import { mockBudgetLimits, mockExpenses, mockGoals, mockIncomes } from "./data/mock";
import { authApi } from "./firebase";
import { currentMonth, money, toPercent } from "./lib/format";
import { useOfflineQueue } from "./hooks/useOfflineQueue";

type TabId = "dashboard" | "expenses" | "bills" | "goals";

type NavItem = {
  id: TabId;
  label: string;
};

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "expenses", label: "Expenses" },
  { id: "bills", label: "Bills" },
  { id: "goals", label: "Goals" }
];

type QuestTaskId =
  | "visit_dashboard"
  | "visit_expenses"
  | "adjust_food_budget"
  | "visit_bills"
  | "mark_bill_paid"
  | "visit_goals"
  | "add_contribution"
  | "open_history";

type QuestTask = {
  id: QuestTaskId;
  label: string;
  points: number;
};

const questTasks: QuestTask[] = [
  { id: "visit_dashboard", label: "Visit Dashboard", points: 10 },
  { id: "visit_expenses", label: "Visit Expenses", points: 10 },
  { id: "adjust_food_budget", label: "Adjust Food Budget", points: 15 },
  { id: "visit_bills", label: "Visit Bills", points: 10 },
  { id: "mark_bill_paid", label: "Mark one bill as paid", points: 20 },
  { id: "visit_goals", label: "Visit Goals", points: 10 },
  { id: "add_contribution", label: "Add a contribution", points: 25 },
  { id: "open_history", label: "Open contribution history", points: 10 }
];

const QUEST_PROGRESS_KEY = "nesteggs_nav_quest_progress_v1";
const QUEST_OPEN_KEY = "nesteggs_nav_quest_open_v1";
const APP_VERSION = "v0.1.1";
const APP_LOGO_FILE = "20260409_0931_NestEggs App Logo_simple_compose_01knrjcdhpexntcsmjxq2w4n97.png";
const APP_LOGO_SRC = `${import.meta.env.BASE_URL}${encodeURIComponent(APP_LOGO_FILE)}`;

type FoodStoreDraft = {
  id: string;
  name: string;
  amount: string;
};

type HouseholdBill = {
  id: string;
  title: string;
  category: string;
  dueDate: string;
  amount: number;
  owner: "You" | "Bronwen Anderson";
  isPaid: boolean;
  paidBy?: string;
};

type ContributionRecord = {
  id: string;
  createdAt: string;
  amount: number;
  contributionType: "Savings" | "Investment" | "Retirement" | "Emergency";
};

type ExpenseDraft = {
  id?: string;
  category: string;
  subcategory: string;
  amount: string;
  month: string;
  dueDate: string;
  isRecurring: boolean;
  isPaid: boolean;
};

type IncomeDraft = {
  id: string;
  name: string;
  type: IncomeSource["type"];
  amount: string;
};

type BillDraft = {
  id?: string;
  title: string;
  category: string;
  dueDate: string;
  amount: string;
  owner: HouseholdBill["owner"];
  isPaid: boolean;
};

const monthKey = currentMonth();

const initialBills: HouseholdBill[] = [
  {
    id: "bill-1",
    title: "Insurance Premium",
    category: "Insurance",
    dueDate: `${monthKey}-05`,
    amount: 1900,
    owner: "You",
    isPaid: false
  },
  {
    id: "bill-2",
    title: "Netflix Subscription",
    category: "Entertainment",
    dueDate: `${monthKey}-10`,
    amount: 199,
    owner: "Bronwen Anderson",
    isPaid: true,
    paidBy: "Bronwen Anderson"
  },
  {
    id: "bill-3",
    title: "Gym Plan",
    category: "Health",
    dueDate: `${monthKey}-14`,
    amount: 850,
    owner: "You",
    isPaid: false
  },
  {
    id: "bill-4",
    title: "Phone Contract",
    category: "Utilities",
    dueDate: `${monthKey}-18`,
    amount: 560,
    owner: "Bronwen Anderson",
    isPaid: false
  }
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authStatus, setAuthStatus] = useState<string>("Sign in to continue.");

  const [incomes, setIncomes] = useState<IncomeSource[]>(mockIncomes);
  const [expenses, setExpenses] = useState<ExpenseItem[]>(mockExpenses);
  const [goals, setGoals] = useState<SavingsGoal[]>(mockGoals);
  const [budgetLimits, setBudgetLimits] = useState<BudgetCategoryLimit[]>(mockBudgetLimits);
  const [bills, setBills] = useState<HouseholdBill[]>(initialBills);

  const [alertThreshold, setAlertThreshold] = useState(80);
  const [showGoalHistory, setShowGoalHistory] = useState(false);
  const [actionMessage, setActionMessage] = useState<string>("");
  const [actionHistory, setActionHistory] = useState<string[]>([]);
  const [contributionHistory, setContributionHistory] = useState<ContributionRecord[]>([]);
  const [foodBudgetModalOpen, setFoodBudgetModalOpen] = useState(false);
  const [foodBudgetDraft, setFoodBudgetDraft] = useState("");
  const [foodStoresDraft, setFoodStoresDraft] = useState<FoodStoreDraft[]>([]);
  const [expensesModalOpen, setExpensesModalOpen] = useState(false);
  const [expenseMode, setExpenseMode] = useState<"view" | "edit" | "create">("view");
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>({
    category: "",
    subcategory: "",
    amount: "",
    month: currentMonth(),
    dueDate: "",
    isRecurring: false,
    isPaid: false
  });
  const [fundsModalOpen, setFundsModalOpen] = useState(false);
  const [fundsDraft, setFundsDraft] = useState<IncomeDraft[]>([]);
  const [contributionModalOpen, setContributionModalOpen] = useState(false);
  const [contributionAmountDraft, setContributionAmountDraft] = useState("");
  const [contributionTypeDraft, setContributionTypeDraft] =
    useState<ContributionRecord["contributionType"]>("Savings");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [billsModalOpen, setBillsModalOpen] = useState(false);
  const [billMode, setBillMode] = useState<"view" | "edit" | "create">("view");
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [billDraft, setBillDraft] = useState<BillDraft>({
    title: "",
    category: "",
    dueDate: `${currentMonth()}-15`,
    amount: "",
    owner: "You",
    isPaid: false
  });
  const [questOpen, setQuestOpen] = useState<boolean>(() => {
    const raw = localStorage.getItem(QUEST_OPEN_KEY);
    return raw ? raw === "true" : true;
  });
  const [questProgress, setQuestProgress] = useState<Record<QuestTaskId, boolean>>(() => {
    const base = Object.fromEntries(questTasks.map((task) => [task.id, false])) as Record<QuestTaskId, boolean>;
    const raw = localStorage.getItem(QUEST_PROGRESS_KEY);
    if (!raw) return base;
    try {
      const saved = JSON.parse(raw) as Partial<Record<QuestTaskId, boolean>>;
      return { ...base, ...saved };
    } catch {
      return base;
    }
  });

  const { isOnline, pendingCount } = useOfflineQueue();

  const markQuest = (taskId: QuestTaskId) => {
    setQuestProgress((prev) => {
      if (prev[taskId]) return prev;
      return { ...prev, [taskId]: true };
    });
  };

  const addHistory = (message: string) => {
    setActionMessage(message);
    const time = new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    setActionHistory((prev) => [`${time} - ${message}`, ...prev].slice(0, 8));
  };

  const runAuth = async (type: "signin" | "signup" | "google" | "apple") => {
    try {
      if (type === "signin") await authApi.signIn(email, password);
      if (type === "signup") await authApi.signUp(email, password);
      if (type === "google") await authApi.signInGoogle();
      if (type === "apple") await authApi.signInApple();

      setAuthStatus("Authentication successful.");
      setIsAuthenticated(true);
      addHistory("Signed in successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed.";
      setAuthStatus(message);
    }
  };

  const enterDemoMode = () => {
    setAuthStatus("Demo mode enabled.");
    setIsAuthenticated(true);
    addHistory("Entered demo mode without Firebase authentication.");
  };

  const totals = useMemo(() => {
    const incomeTotal = incomes.reduce((sum, item) => sum + item.amount, 0);
    const expenseTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
    const cashflow = incomeTotal - expenseTotal;
    const savingsRate = incomeTotal > 0 ? Math.max(0, cashflow) / incomeTotal : 0;

    const debtPayments = expenses
      .filter((item) => item.category.toLowerCase() === "debt" || item.subcategory.toLowerCase().includes("payment"))
      .reduce((sum, item) => sum + item.amount, 0);
    const debtRatio = incomeTotal > 0 ? debtPayments / incomeTotal : 0;

    const limitsTotal = budgetLimits.reduce((sum, item) => sum + item.limit, 0);
    const budgetVariance = limitsTotal - expenseTotal;

    return { incomeTotal, expenseTotal, cashflow, savingsRate, debtRatio, budgetVariance };
  }, [budgetLimits, expenses, incomes]);

  const categorySpend = useMemo(() => {
    return budgetLimits.map((limit) => {
      const spent = expenses
        .filter((expense) => expense.category === limit.category)
        .reduce((sum, expense) => sum + expense.amount, 0);
      const ratio = limit.limit > 0 ? spent / limit.limit : 0;
      return { ...limit, spent, ratio };
    });
  }, [budgetLimits, expenses]);

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const expense of expenses) {
      map.set(expense.category, (map.get(expense.category) ?? 0) + expense.amount);
    }

    return [...map.entries()]
      .map(([category, amount]) => ({
        category,
        amount,
        share: totals.expenseTotal > 0 ? amount / totals.expenseTotal : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, totals.expenseTotal]);

  const notifications = useMemo(() => {
    const now = new Date();
    const byBudget = categorySpend
      .filter((row) => row.ratio * 100 >= alertThreshold)
      .map((row) => `${row.category} is at ${Math.round(row.ratio * 100)}% of budget.`);

    const overdueBills = bills
      .filter((bill) => !bill.isPaid)
      .filter((bill) => {
        const dueDate = new Date(bill.dueDate);
        const diff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return diff >= 0;
      })
      .map((bill) => `${bill.title} (${bill.owner}) is overdue.`);

    return [...byBudget, ...overdueBills];
  }, [alertThreshold, bills, categorySpend]);

  const monthLabel = new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric" }).format(new Date());
  const primaryGoal = goals[0];
  const goalProgress = primaryGoal ? Math.min(100, Math.round((primaryGoal.currentAmount / primaryGoal.targetAmount) * 100)) : 0;

  const donutGradient = useMemo(() => {
    if (expenseByCategory.length === 0) return "conic-gradient(#e0e3e3 0deg, #e0e3e3 360deg)";

    const palette = ["#00464a", "#1b6d24", "#6b2c00", "#006064", "#9d3f00"];
    let current = 0;
    const segments = expenseByCategory.map((item, index) => {
      const start = current;
      const end = current + item.share * 360;
      current = end;
      return `${palette[index % palette.length]} ${start}deg ${end}deg`;
    });

    return `conic-gradient(${segments.join(", ")})`;
  }, [expenseByCategory]);

  const cashflowSeries = useMemo(() => {
    const maxValue = Math.max(totals.incomeTotal, totals.expenseTotal, 1);
    return [
      {
        id: "income",
        label: "Income",
        amount: totals.incomeTotal,
        percent: Math.round((totals.incomeTotal / maxValue) * 100)
      },
      {
        id: "expenses",
        label: "Expenses",
        amount: totals.expenseTotal,
        percent: Math.round((totals.expenseTotal / maxValue) * 100)
      }
    ];
  }, [totals.expenseTotal, totals.incomeTotal]);

  const billStatus = useMemo(() => {
    const paid = bills.filter((bill) => bill.isPaid).length;
    const open = Math.max(0, bills.length - paid);
    const total = Math.max(1, bills.length);
    const paidShare = paid / total;
    const gradient = `conic-gradient(#1b6d24 0deg ${Math.round(paidShare * 360)}deg, #e0e3e3 ${Math.round(
      paidShare * 360
    )}deg 360deg)`;
    return { paid, open, total, paidShare, gradient };
  }, [bills]);

  const goalProgressSeries = useMemo(
    () =>
      goals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        progress: Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)),
        currentAmount: goal.currentAmount,
        targetAmount: goal.targetAmount
      })),
    [goals]
  );

  const questScore = useMemo(
    () => questTasks.reduce((sum, task) => sum + (questProgress[task.id] ? task.points : 0), 0),
    [questProgress]
  );
  const questMaxScore = useMemo(() => questTasks.reduce((sum, task) => sum + task.points, 0), []);
  const questCompletedCount = useMemo(
    () => questTasks.filter((task) => questProgress[task.id]).length,
    [questProgress]
  );
  const questDone = questCompletedCount === questTasks.length;
  const questPercent = Math.round((questCompletedCount / questTasks.length) * 100);
  const questBadge = questScore >= 90 ? "Household Captain" : questScore >= 40 ? "Planner" : "Navigator";

  useEffect(() => {
    localStorage.setItem(QUEST_PROGRESS_KEY, JSON.stringify(questProgress));
  }, [questProgress]);

  useEffect(() => {
    localStorage.setItem(QUEST_OPEN_KEY, String(questOpen));
  }, [questOpen]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeTab === "dashboard") markQuest("visit_dashboard");
    if (activeTab === "expenses") markQuest("visit_expenses");
    if (activeTab === "bills") markQuest("visit_bills");
    if (activeTab === "goals") markQuest("visit_goals");
  }, [activeTab, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [activeTab, isAuthenticated]);

  useEffect(() => {
    if (questDone) {
      addHistory("Navigation Quest completed. You unlocked Household Captain.");
      setActionMessage("Navigation Quest complete. You are ready to drive the full app.");
      setQuestOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questDone]);

  const openFundsModal = () => {
    setFundsDraft(
      incomes.map((income) => ({
        id: income.id,
        name: income.name,
        type: income.type,
        amount: String(income.amount)
      }))
    );
    setFundsModalOpen(true);
  };

  const openExpensesModal = () => {
    setExpenseMode("view");
    setSelectedExpenseId((prev) => prev ?? expenses[0]?.id ?? null);
    setExpensesModalOpen(true);
  };

  const saveFundsModal = () => {
    const rows = fundsDraft
      .map((row) => ({
        id: row.id,
        name: row.name.trim(),
        type: row.type,
        amount: Number(row.amount)
      }))
      .filter((row) => row.name.length > 0 && Number.isFinite(row.amount) && row.amount > 0);

    if (rows.length === 0) {
      addHistory("Funds update failed: add at least one valid income row.");
      return;
    }

    const month = currentMonth();
    const nextIncomes: IncomeSource[] = rows.map((row, idx) => ({
      id: row.id || `inc-${Date.now()}-${idx}`,
      partnerId: idx % 2 === 0 ? "p1" : "p2",
      type: row.type,
      name: row.name,
      amount: Math.round(row.amount),
      month
    }));

    setIncomes(nextIncomes);
    setFundsModalOpen(false);
    addHistory("Updated income streams successfully.");
  };

  const openFoodBudgetModal = () => {
    const groceriesLimit = budgetLimits.find((limit) => limit.category === "Groceries")?.limit ?? 0;
    const groceries = expenses.filter((expense) => expense.category === "Groceries");
    setFoodBudgetDraft(String(groceriesLimit));
    setFoodStoresDraft(
      groceries.map((store) => ({
        id: store.id,
        name: store.subcategory,
        amount: String(store.amount)
      }))
    );
    setFoodBudgetModalOpen(true);
  };

  const saveFoodBudgetModal = () => {
    const newLimit = Number(foodBudgetDraft);
    if (!Number.isFinite(newLimit) || newLimit <= 0) {
      addHistory("Food budget update failed: provide a valid budget amount.");
      return;
    }

    const stores = foodStoresDraft
      .map((store) => ({ name: store.name.trim(), amount: Number(store.amount) }))
      .filter((store) => store.name.length > 0 && Number.isFinite(store.amount) && store.amount > 0);

    if (stores.length === 0) {
      addHistory("Food budget update failed: add at least one store with an amount.");
      return;
    }

    setBudgetLimits((prev) =>
      prev.map((limit) => (limit.category === "Groceries" ? { ...limit, limit: Math.round(newLimit) } : limit))
    );

    setExpenses((prev) => {
      const month = prev[0]?.month ?? currentMonth();
      const nonGroceries = prev.filter((expense) => expense.category !== "Groceries");
      const updatedGroceries: ExpenseItem[] = stores.map((store, idx) => ({
        id: `grocery-${Date.now()}-${idx}`,
        category: "Groceries",
        subcategory: store.name,
        amount: Math.round(store.amount),
        month,
        isPaid: false
      }));
      return [...nonGroceries, ...updatedGroceries];
    });

    setFoodBudgetModalOpen(false);
    markQuest("adjust_food_budget");
    addHistory(`Updated food budget and ${stores.length} grocery store entries.`);
  };

  const openContributionModal = () => {
    setContributionAmountDraft("");
    setContributionTypeDraft("Savings");
    setContributionModalOpen(true);
  };

  const openBillsModal = () => {
    setBillMode("view");
    setSelectedBillId((prev) => prev ?? bills[0]?.id ?? null);
    setBillsModalOpen(true);
  };

  const saveContributionModal = () => {
    const amount = Number(contributionAmountDraft);
    if (!Number.isFinite(amount) || amount <= 0) {
      addHistory("Contribution failed: enter a valid amount.");
      return;
    }

    setGoals((prev) =>
      prev.map((goal, idx) =>
        idx === 0
          ? {
              ...goal,
              currentAmount: Math.min(goal.currentAmount + Math.round(amount), goal.targetAmount)
            }
          : goal
      )
    );

    setContributionHistory((prev) => [
      {
        id: `contrib-${Date.now()}`,
        createdAt: new Intl.DateTimeFormat("en-ZA", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        }).format(new Date()),
        amount: Math.round(amount),
        contributionType: contributionTypeDraft
      },
      ...prev
    ]);

    setContributionModalOpen(false);
    markQuest("add_contribution");
    addHistory(`Added ${money(amount)} as ${contributionTypeDraft.toLowerCase()} contribution.`);
  };

  const handleViewHistory = () => {
    setShowGoalHistory((prev) => {
      const next = !prev;
      if (next) markQuest("open_history");
      addHistory(next ? "Opened contribution history." : "Collapsed contribution history.");
      return next;
    });
  };

  const handleMarkBillPaid = (billId: string) => {
    setBills((prev) => prev.map((bill) => (bill.id === billId ? { ...bill, isPaid: true, paidBy: "You" } : bill)));
    markQuest("mark_bill_paid");
    addHistory("Marked bill as paid.");
  };

  const startCreateExpense = () => {
    setExpenseMode("create");
    setSelectedExpenseId(null);
    setExpenseDraft({
      category: "",
      subcategory: "",
      amount: "",
      month: currentMonth(),
      dueDate: "",
      isRecurring: false,
      isPaid: false
    });
  };

  const startViewExpense = (expenseId: string) => {
    setExpenseMode("view");
    setSelectedExpenseId(expenseId);
  };

  const startEditExpense = (expense: ExpenseItem) => {
    setExpenseMode("edit");
    setSelectedExpenseId(expense.id);
    setExpenseDraft({
      id: expense.id,
      category: expense.category,
      subcategory: expense.subcategory,
      amount: String(expense.amount),
      month: expense.month,
      dueDate: expense.dueDate ?? "",
      isRecurring: Boolean(expense.isRecurring),
      isPaid: Boolean(expense.isPaid)
    });
  };

  const saveExpenseDraft = () => {
    const amount = Number(expenseDraft.amount);
    if (!expenseDraft.category.trim() || !expenseDraft.subcategory.trim() || !Number.isFinite(amount) || amount <= 0) {
      addHistory("Expense save failed: complete category, subcategory, and valid amount.");
      return;
    }

    const base: ExpenseItem = {
      id: expenseDraft.id ?? `exp-${Date.now()}`,
      category: expenseDraft.category.trim(),
      subcategory: expenseDraft.subcategory.trim(),
      amount: Math.round(amount),
      month: expenseDraft.month || currentMonth(),
      isRecurring: expenseDraft.isRecurring,
      isPaid: expenseDraft.isPaid
    };

    const nextExpense = expenseDraft.dueDate.trim() ? { ...base, dueDate: expenseDraft.dueDate.trim() } : base;

    if (expenseMode === "edit" && expenseDraft.id) {
      setExpenses((prev) => prev.map((expense) => (expense.id === expenseDraft.id ? nextExpense : expense)));
      addHistory(`Updated expense: ${nextExpense.category} - ${nextExpense.subcategory}.`);
    } else {
      setExpenses((prev) => [...prev, nextExpense]);
      addHistory(`Added expense: ${nextExpense.category} - ${nextExpense.subcategory}.`);
    }

    setExpenseMode("view");
    setSelectedExpenseId(nextExpense.id);
  };

  const deleteExpense = (expenseId: string) => {
    const target = expenses.find((expense) => expense.id === expenseId);
    if (!target) return;
    const ok = window.confirm(`Delete expense ${target.category} - ${target.subcategory}?`);
    if (!ok) return;
    const remaining = expenses.filter((expense) => expense.id !== expenseId);
    setExpenses(remaining);
    if (selectedExpenseId === expenseId) setSelectedExpenseId(remaining[0]?.id ?? null);
    addHistory(`Deleted expense: ${target.category} - ${target.subcategory}.`);
  };

  const startCreateBill = () => {
    setBillMode("create");
    setSelectedBillId(null);
    setBillDraft({
      title: "",
      category: "",
      dueDate: `${currentMonth()}-15`,
      amount: "",
      owner: "You",
      isPaid: false
    });
  };

  const startViewBill = (billId: string) => {
    setBillMode("view");
    setSelectedBillId(billId);
  };

  const startEditBill = (bill: HouseholdBill) => {
    setBillMode("edit");
    setSelectedBillId(bill.id);
    setBillDraft({
      id: bill.id,
      title: bill.title,
      category: bill.category,
      dueDate: bill.dueDate,
      amount: String(bill.amount),
      owner: bill.owner,
      isPaid: bill.isPaid
    });
  };

  const saveBillDraft = () => {
    const amount = Number(billDraft.amount);
    if (!billDraft.title.trim() || !billDraft.category.trim() || !billDraft.dueDate.trim() || !Number.isFinite(amount) || amount <= 0) {
      addHistory("Bill save failed: complete title, category, due date, and valid amount.");
      return;
    }

    const base: HouseholdBill = {
      id: billDraft.id ?? `bill-${Date.now()}`,
      title: billDraft.title.trim(),
      category: billDraft.category.trim(),
      dueDate: billDraft.dueDate.trim(),
      amount: Math.round(amount),
      owner: billDraft.owner,
      isPaid: billDraft.isPaid
    };

    if (billMode === "edit" && billDraft.id) {
      setBills((prev) => prev.map((bill) => (bill.id === billDraft.id ? base : bill)));
      addHistory(`Updated bill: ${base.title}.`);
    } else {
      setBills((prev) => [...prev, base]);
      addHistory(`Added bill: ${base.title}.`);
    }

    setBillMode("view");
    setSelectedBillId(base.id);
  };

  const deleteBill = (billId: string) => {
    const target = bills.find((bill) => bill.id === billId);
    if (!target) return;
    const ok = window.confirm(`Delete bill ${target.title}?`);
    if (!ok) return;
    const remaining = bills.filter((bill) => bill.id !== billId);
    setBills(remaining);
    if (selectedBillId === billId) setSelectedBillId(remaining[0]?.id ?? null);
    addHistory(`Deleted bill: ${target.title}.`);
  };

  const handleQuickAddSelection = (selection: "income" | "expense" | "bill" | "savings") => {
    setQuickAddOpen(false);
    if (selection === "income") {
      setActiveTab("dashboard");
      openFundsModal();
      addHistory("Quick add: opened Income Manager.");
      return;
    }
    if (selection === "expense") {
      setActiveTab("expenses");
      openExpensesModal();
      startCreateExpense();
      addHistory("Quick add: opened Expense form.");
      return;
    }
    if (selection === "bill") {
      setActiveTab("bills");
      openBillsModal();
      startCreateBill();
      addHistory("Quick add: opened Bill form.");
      return;
    }
    setActiveTab("goals");
    openContributionModal();
    addHistory("Quick add: opened Savings/Investment contribution.");
  };

  const handleFab = () => {
    setQuickAddOpen(true);
  };

  const routeQuestTask = (taskId: QuestTaskId) => {
    if (taskId === "visit_dashboard") setActiveTab("dashboard");
    if (taskId === "visit_expenses") setActiveTab("expenses");
    if (taskId === "visit_bills") setActiveTab("bills");
    if (taskId === "visit_goals") setActiveTab("goals");

    if (taskId === "adjust_food_budget") {
      setActiveTab("expenses");
      openFoodBudgetModal();
    }

    if (taskId === "mark_bill_paid") {
      setActiveTab("bills");
    }

    if (taskId === "add_contribution") {
      setActiveTab("goals");
      openContributionModal();
    }

    if (taskId === "open_history") {
      setActiveTab("goals");
      setShowGoalHistory(true);
      markQuest("open_history");
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="auth-mask-root">
        <section className="auth-mask-card">
          <img className="auth-logo" src={APP_LOGO_SRC} alt="NestEggs logo" />
          <p className="eyebrow">NestEggs</p>
          <h1 className="brand-title">Welcome Back</h1>
          <p className="version-chip">{APP_VERSION}</p>
          <p className="muted">Authenticate before opening your household dashboard.</p>

          <div className="auth-grid">
            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <label>
              Password
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="********"
              />
            </label>
            <div className="button-row">
              <button className="btn btn-primary" type="button" onClick={() => void runAuth("signin")}>Sign In</button>
              <button className="btn btn-secondary" type="button" onClick={() => void runAuth("signup")}>Create Account</button>
              <button className="btn btn-ghost" type="button" onClick={() => void runAuth("google")}>Google</button>
              <button className="btn btn-ghost" type="button" onClick={() => void runAuth("apple")}>Apple</button>
            </div>
            <button className="btn btn-primary" type="button" onClick={enterDemoMode}>Continue in Demo Mode</button>
            <p className="muted">{authStatus}</p>
          </div>
        </section>
      </main>
    );
  }

  const renderDashboard = () => (
    <>
      <section className="editorial-head">
        <h2>Morning, Bronwen Anderson.</h2>
        <p>Shared household planning for {monthLabel}. Built for connected decisions and clear priorities.</p>
        <div className="status-strip">
          <span className={`status-pill ${isOnline ? "ok" : "warn"}`}>{isOnline ? "Online sync" : "Offline mode"}</span>
          <span className="status-pill neutral">{pendingCount} pending actions</span>
        </div>
      </section>

      <section className="kpi-bento" aria-label="Core financial metrics">
        <article className="kpi-card">
          <p className="kpi-label">Cashflow</p>
          <p className={`kpi-value ${totals.cashflow >= 0 ? "good" : "warn"}`}>{money(totals.cashflow)}</p>
        </article>
        <article className="kpi-card hero">
          <p className="kpi-label">Savings Rate</p>
          <p className="kpi-value">{toPercent(totals.savingsRate)}</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Debt Ratio</p>
          <p className={`kpi-value ${totals.debtRatio > 0.3 ? "warn" : "good"}`}>{toPercent(totals.debtRatio)}</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Budget Variance</p>
          <p className={`kpi-value ${totals.budgetVariance >= 0 ? "good" : "warn"}`}>{money(totals.budgetVariance)}</p>
        </article>
      </section>

      <section className="editorial-grid">
        <div className="left-column">
          <article className="panel balance-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Total Shared Balance</p>
                <h3>{money(totals.incomeTotal - totals.expenseTotal)}</h3>
              </div>
            </div>
            <div className="income-track-grid">
              {incomes.map((income, idx) => {
                const width = Math.max(8, Math.min(100, Math.round((income.amount / totals.incomeTotal) * 100)));
                return (
                  <article key={income.id} className={`income-tile ${idx % 2 === 1 ? "offset" : ""}`}>
                    <p>{income.name}</p>
                    <strong>{money(income.amount)}</strong>
                    <div className="meter" aria-hidden>
                      <span style={{ width: `${width}%` }} />
                    </div>
                  </article>
                );
              })}
            </div>
          </article>

          {primaryGoal ? (
            <article className="panel goal-panel">
              <div className="goal-head">
                <div>
                  <p className="eyebrow">Primary Goal</p>
                  <h4>{primaryGoal.title}</h4>
                </div>
                <p className="goal-amount">{money(primaryGoal.currentAmount)} / {money(primaryGoal.targetAmount)}</p>
              </div>
              <div className="goal-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={goalProgress}>
                <span style={{ width: `${goalProgress}%` }} />
              </div>
              <p className="goal-foot">{goalProgress}% complete. Annual tax-free limit: {money(primaryGoal.taxFreeLimit)}.</p>
            </article>
          ) : null}
        </div>

        <aside className="right-column">
          <article className="panel budget-panel">
            <div className="panel-head compact">
              <div>
                <h4>Category Budgets</h4>
                <p>Monthly category limits with threshold alerts.</p>
              </div>
              <label className="threshold-input">
                Alert %
                <input
                  type="number"
                  min={50}
                  max={100}
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="stack-list">
              {categorySpend.map((row) => {
                const safeRatio = Math.max(0, row.ratio);
                const meterWidth = Math.max(4, Math.min(100, Math.round(safeRatio * 100)));
                return (
                  <article key={row.category} className="list-card">
                    <div className="line-item">
                      <strong>{row.category}</strong>
                      <span className={safeRatio > 1 ? "warn-text" : "ok-text"}>{Math.round(safeRatio * 100)}%</span>
                    </div>
                    <p>{money(row.spent)} of {money(row.limit)}</p>
                    <div className="meter" aria-hidden>
                      <span style={{ width: `${meterWidth}%` }} className={safeRatio > 1 ? "warn-meter" : ""} />
                    </div>
                  </article>
                );
              })}
            </div>
          </article>

          <article className="panel activity-panel">
            <div className="panel-head compact">
              <div>
                <h4>Shared Spending</h4>
                <p>Latest household transactions.</p>
              </div>
            </div>
            <div className="stack-list">
              {expenses.map((expense) => (
                <article key={expense.id} className="list-card activity-item">
                  <div>
                    <strong>{expense.subcategory}</strong>
                    <p>{expense.category} · {expense.isRecurring ? "Recurring" : "Variable"}</p>
                  </div>
                  <p className="amount-out">-{money(expense.amount)}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="panel alerts-panel">
            <div className="panel-head compact">
              <div>
                <h4>Bills + Alerts</h4>
                <p>Threshold and overdue highlights.</p>
              </div>
            </div>
            <div className="stack-list">
              {notifications.length > 0 ? (
                notifications.map((note) => (
                  <article key={note} className="list-card alert-item">
                    <p>{note}</p>
                  </article>
                ))
              ) : (
                <p className="muted">No active alerts.</p>
              )}
            </div>
          </article>

          <article className="panel viz-panel">
            <div className="panel-head compact">
              <div>
                <h4>Cashflow Split</h4>
                <p>Income versus expense volume this month.</p>
              </div>
            </div>
            <div className="cashflow-bars" role="img" aria-label="Cashflow comparison chart">
              {cashflowSeries.map((item) => (
                <article key={item.id} className="cashflow-bar-card">
                  <p>{item.label}</p>
                  <div className="cashflow-track" aria-hidden>
                    <span className={item.id === "income" ? "income" : "expense"} style={{ height: `${item.percent}%` }} />
                  </div>
                  <strong>{money(item.amount)}</strong>
                </article>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </>
  );

  const renderExpenses = () => (
    <section className="view-stack">
      <section className="editorial-head">
        <h2>Expenses</h2>
        <p>Shared spending breakdown for {monthLabel}. Use + to add or manage entries.</p>
      </section>

      <section className="expenses-layout">
        <article className="panel expense-overview">
          <div className="donut-row">
            <div className="donut-shell" style={{ background: donutGradient }}>
              <div className="donut-core">
                <p>Total</p>
                <strong>{money(totals.expenseTotal)}</strong>
              </div>
            </div>
            <div className="legend-list">
              {expenseByCategory.map((item) => (
                <article key={item.category} className="legend-item">
                  <div className="line-item">
                    <strong>{item.category}</strong>
                    <span>{money(item.amount)}</span>
                  </div>
                  <div className="meter" aria-hidden>
                    <span style={{ width: `${Math.round(item.share * 100)}%` }} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </article>

        <article className="panel expense-highlight">
          <h4>Food Breakdown</h4>
          {expenses
            .filter((expense) => expense.category === "Groceries")
            .map((expense) => (
              <div key={expense.id} className="line-item highlight-line">
                <span>{expense.subcategory}</span>
                <strong>{money(expense.amount)}</strong>
              </div>
            ))}
          <button className="btn btn-primary" type="button" onClick={openFoodBudgetModal}>Adjust Food Budget</button>
        </article>
      </section>

      <article className="panel">
        <div className="panel-head compact">
          <div>
            <h4>Recent Activity</h4>
            <p>Latest outgoing transactions.</p>
          </div>
        </div>
        <div className="activity-grid-3">
          {expenses.map((expense) => (
            <article key={expense.id} className="list-card">
              <strong>{expense.subcategory}</strong>
              <p>{expense.category}</p>
              <p className="amount-out">-{money(expense.amount)}</p>
            </article>
          ))}
        </div>
      </article>
    </section>
  );

  const renderBills = () => (
    <section className="view-stack">
      <section className="editorial-head">
        <h2>Bills & Alerts</h2>
        <p>Individual and shared bills with visibility of who paid. Use + to add or manage bills.</p>
      </section>

      <section className="bills-layout">
        <article className="panel priority-panel">
          <h4>Priority Attention</h4>
          <div className="stack-list">
            {notifications.length > 0 ? (
              notifications.map((note) => (
                <article key={note} className="list-card alert-item">
                  <p>{note}</p>
                </article>
              ))
            ) : (
              <article className="list-card neutral-item">
                <p>No critical alerts right now.</p>
              </article>
            )}
          </div>
          <div className="bill-visual-panel">
            <div className="bill-status-donut" style={{ background: billStatus.gradient }}>
              <div className="bill-status-core">
                <strong>{Math.round(billStatus.paidShare * 100)}%</strong>
                <p>Paid</p>
              </div>
            </div>
            <div className="bill-status-meta">
              <p><strong>{billStatus.paid}</strong> paid bills</p>
              <p><strong>{billStatus.open}</strong> open bills</p>
              <p>{billStatus.total} total tracked</p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-head compact">
            <div>
              <h4>Upcoming Schedule</h4>
              <p>Household bill ownership and payment status.</p>
            </div>
          </div>
          <div className="stack-list">
            {bills.map((bill) => (
              <article key={bill.id} className={`list-card bill-item ${bill.isPaid ? "paid" : "upcoming"}`}>
                <div>
                  <strong>{bill.title}</strong>
                  <p>{bill.category} · Due {bill.dueDate}</p>
                  <p className="bill-owner">Owner: {bill.owner}</p>
                </div>
                <div className="bill-right">
                  <p>{money(bill.amount)}</p>
                  {bill.isPaid ? (
                    <span>Paid by {bill.paidBy ?? bill.owner}</span>
                  ) : (
                    <button className="btn btn-secondary btn-inline" type="button" onClick={() => handleMarkBillPaid(bill.id)}>
                      Mark Paid
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>
    </section>
  );

  const renderGoals = () => (
    <section className="view-stack">
      <section className="editorial-head">
        <h2>Shared Goals</h2>
        <p>Track progress against long-term household targets.</p>
      </section>

      <section className="goal-layout">
        <article className="panel goal-snapshot-panel">
          <div className="panel-head compact">
            <div>
              <h4>Goals Snapshot</h4>
              <p>Progress distribution across all active goals.</p>
            </div>
          </div>
          <div className="goal-snapshot-list">
            {goalProgressSeries.map((goal) => (
              <article key={goal.id} className="list-card">
                <div className="line-item">
                  <strong>{goal.title}</strong>
                  <span className="ok-text">{goal.progress}%</span>
                </div>
                <div className="meter" aria-hidden>
                  <span style={{ width: `${goal.progress}%` }} />
                </div>
                <p>{money(goal.currentAmount)} / {money(goal.targetAmount)}</p>
              </article>
            ))}
          </div>
        </article>

        {goals.map((goal, idx) => {
          const progress = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
          return (
            <article key={goal.id} className="panel goal-card-large">
              <div className="goal-head">
                <div>
                  <p className="eyebrow">Savings Goal</p>
                  <h4>{goal.title}</h4>
                </div>
                <p className="goal-amount">{money(goal.currentAmount)} / {money(goal.targetAmount)}</p>
              </div>
              <div className="goal-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <p className="goal-foot">{progress}% complete</p>
              {idx === 0 ? (
                <div className="button-row">
                  <button className="btn btn-primary" type="button" onClick={openContributionModal}>Add Contribution</button>
                  <button className="btn btn-secondary" type="button" onClick={handleViewHistory}>View History</button>
                </div>
              ) : null}
            </article>
          );
        })}

        <article className="panel">
          <div className="panel-head compact">
            <div>
              <h4>{showGoalHistory ? "Contribution History" : "Recent Contributions"}</h4>
              <p>{showGoalHistory ? "Logged contribution records" : "Latest income inflows towards goals."}</p>
            </div>
          </div>
          <div className="stack-list">
            {showGoalHistory ? (
              contributionHistory.length > 0 ? (
                contributionHistory.map((item) => (
                  <article key={item.id} className="list-card activity-item">
                    <div>
                      <strong>{item.contributionType}</strong>
                      <p>{item.createdAt}</p>
                    </div>
                    <p className="amount-in">+{money(item.amount)}</p>
                  </article>
                ))
              ) : (
                <article className="list-card neutral-item">
                  <p>No contribution history yet. Add a contribution to start.</p>
                </article>
              )
            ) : (
              incomes.map((income) => (
                  <article key={income.id} className="list-card activity-item">
                    <div>
                      <strong>{income.name}</strong>
                      <p>{income.type}</p>
                    </div>
                    <p className="amount-in">+{money(income.amount)}</p>
                  </article>
                ))
            )}
          </div>
        </article>
      </section>
    </section>
  );

  const renderQuestGuide = () => (
    <aside className={`quest-card ${questDone ? "complete" : ""}`}>
      <div className="quest-head">
        <div>
          <p className="eyebrow">Welcome Quest</p>
          <h3>Learn The Navigation</h3>
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => setQuestOpen(false)}>
          Minimize
        </button>
      </div>
      <p className="muted">
        Score: {questScore}/{questMaxScore} · Badge: {questBadge}
      </p>
      <div className="quest-progress">
        <span style={{ width: `${questPercent}%` }} />
      </div>
      <p className="muted">{questCompletedCount} of {questTasks.length} tasks completed.</p>
      <div className="quest-list">
        {questTasks.map((task) => (
          <button
            key={task.id}
            type="button"
            className={`quest-task ${questProgress[task.id] ? "done" : ""}`}
            onClick={() => routeQuestTask(task.id)}
          >
            <p>{task.label}</p>
            <strong>+{task.points}</strong>
          </button>
        ))}
      </div>
    </aside>
  );

  return (
    <div className="ledger-root">
      <header className="topbar">
        <div className="brand-row">
          <img className="brand-logo" src={APP_LOGO_SRC} alt="NestEggs logo" />
          <div className="avatar-stack" aria-hidden>
            <span className="avatar-chip">RL</span>
            <span className="avatar-chip partner">BA</span>
          </div>
          <div>
            <p className="eyebrow">NestEggs</p>
            <h1 className="brand-title">Our Ledger</h1>
            <p className="version-chip">{APP_VERSION}</p>
          </div>
        </div>
        <nav className="desktop-nav" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-link ${activeTab === item.id ? "active" : ""}`}
              type="button"
              onClick={() => setActiveTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="ledger-main">
        {!questDone && !questOpen ? (
          <button className="btn btn-secondary quest-reopen" type="button" onClick={() => setQuestOpen(true)}>
            Open Navigation Quest
          </button>
        ) : null}
        {!questDone && questOpen ? renderQuestGuide() : null}
        {actionMessage ? <p className="action-banner">{actionMessage}</p> : null}
        {activeTab === "dashboard" ? renderDashboard() : null}
        {activeTab === "expenses" ? renderExpenses() : null}
        {activeTab === "bills" ? renderBills() : null}
        {activeTab === "goals" ? renderGoals() : null}
      </main>

      <nav className="bottom-nav" aria-label="Mobile primary navigation">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-tab ${activeTab === item.id ? "active" : ""}`}
            type="button"
            onClick={() => setActiveTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <button className="fab" type="button" aria-label="Add transaction" onClick={handleFab}>+</button>

      {quickAddOpen ? (
        <div className="modal-backdrop sheet-backdrop" role="dialog" aria-modal="true" aria-label="Quick add">
          <section className="modal-card quick-sheet">
            <div className="sheet-handle" aria-hidden />
            <div className="panel-head compact quick-sheet-head">
              <div>
                <h4>Quick Add</h4>
                <p>Update your shared ledger.</p>
              </div>
              <button className="quick-close" type="button" aria-label="Close quick add" onClick={() => setQuickAddOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="quick-add-grid" role="list" aria-label="Quick add actions">
              <button className="quick-add-option tone-income" type="button" onClick={() => handleQuickAddSelection("income")}>
                <div className="quick-add-icon income">
                  <span className="material-symbols-outlined">trending_up</span>
                </div>
                <div>
                  <strong>Add Income</strong>
                  <span className="quick-add-meta">Deposit funds</span>
                </div>
              </button>
              <button className="quick-add-option tone-expense" type="button" onClick={() => handleQuickAddSelection("expense")}>
                <div className="quick-add-icon expense">
                  <span className="material-symbols-outlined">receipt_long</span>
                </div>
                <div>
                  <strong>Log Expense</strong>
                  <span className="quick-add-meta">Recent spend</span>
                </div>
              </button>
              <button className="quick-add-option tone-bill" type="button" onClick={() => handleQuickAddSelection("bill")}>
                <div className="quick-add-icon bill">
                  <span className="material-symbols-outlined">calendar_month</span>
                </div>
                <div>
                  <strong>Schedule Bill</strong>
                  <span className="quick-add-meta">Future dues</span>
                </div>
              </button>
              <button className="quick-add-option tone-goal" type="button" onClick={() => handleQuickAddSelection("savings")}>
                <div className="quick-add-icon goal">
                  <span className="material-symbols-outlined">ads_click</span>
                </div>
                <div>
                  <strong>New Goal</strong>
                  <span className="quick-add-meta">Growth target</span>
                </div>
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {billsModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Manage bills">
          <section className="modal-card">
            <div className="panel-head compact">
              <div>
                <h4>Bills Manager</h4>
                <p>View, edit, delete, and add bills.</p>
              </div>
            </div>

            <div className="expense-modal-layout">
              <div className="store-list">
                {bills.map((bill) => (
                  <article key={bill.id} className={`list-card ${selectedBillId === bill.id ? "selected-item" : ""}`}>
                    <div className="line-item">
                      <strong>{bill.title}</strong>
                      <span>{money(bill.amount)}</span>
                    </div>
                    <p>{bill.category} · Due {bill.dueDate} · Owner: {bill.owner}</p>
                    <div className="button-row">
                      <button className="btn btn-secondary" type="button" onClick={() => startViewBill(bill.id)}>View</button>
                      <button className="btn btn-primary" type="button" onClick={() => startEditBill(bill)}>Edit</button>
                      <button className="btn btn-ghost" type="button" onClick={() => deleteBill(bill.id)}>Delete</button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="modal-grid">
                {billMode === "view" ? (
                  selectedBillId ? (
                    (() => {
                      const selected = bills.find((bill) => bill.id === selectedBillId);
                      if (!selected) return <p className="muted">Select a bill to view details.</p>;
                      return (
                        <article className="list-card">
                          <div className="line-item">
                            <strong>{selected.title}</strong>
                            <span>{money(selected.amount)}</span>
                          </div>
                          <p>Category: {selected.category}</p>
                          <p>Due Date: {selected.dueDate}</p>
                          <p>Owner: {selected.owner}</p>
                          <p>Paid: {selected.isPaid ? `Yes${selected.paidBy ? ` · by ${selected.paidBy}` : ""}` : "No"}</p>
                        </article>
                      );
                    })()
                  ) : (
                    <p className="muted">Pick a bill from the list, or create a new one.</p>
                  )
                ) : (
                  <>
                    <label>
                      Bill Title
                      <input
                        value={billDraft.title}
                        onChange={(e) => setBillDraft((prev) => ({ ...prev, title: e.target.value }))}
                        placeholder="Internet Subscription"
                      />
                    </label>
                    <label>
                      Category
                      <input
                        value={billDraft.category}
                        onChange={(e) => setBillDraft((prev) => ({ ...prev, category: e.target.value }))}
                        placeholder="Utilities"
                      />
                    </label>
                    <label>
                      Amount
                      <input
                        type="number"
                        min={1}
                        value={billDraft.amount}
                        onChange={(e) => setBillDraft((prev) => ({ ...prev, amount: e.target.value }))}
                        placeholder="599"
                      />
                    </label>
                    <label>
                      Due Date (YYYY-MM-DD)
                      <input
                        value={billDraft.dueDate}
                        onChange={(e) => setBillDraft((prev) => ({ ...prev, dueDate: e.target.value }))}
                        placeholder={`${currentMonth()}-20`}
                      />
                    </label>
                    <label>
                      Owner
                      <select
                        value={billDraft.owner}
                        onChange={(e) =>
                          setBillDraft((prev) => ({ ...prev, owner: e.target.value as HouseholdBill["owner"] }))
                        }
                      >
                        <option value="You">You</option>
                        <option value="Bronwen Anderson">Bronwen Anderson</option>
                      </select>
                    </label>
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={billDraft.isPaid}
                        onChange={(e) => setBillDraft((prev) => ({ ...prev, isPaid: e.target.checked }))}
                      />
                      Mark as already paid
                    </label>
                    <button className="btn btn-primary" type="button" onClick={saveBillDraft}>
                      {billMode === "edit" ? "Save Bill" : "Add Bill"}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="button-row">
              <button className="btn btn-secondary" type="button" onClick={startCreateBill}>Add New Bill</button>
              <button className="btn btn-ghost" type="button" onClick={() => setBillsModalOpen(false)}>Close</button>
            </div>
          </section>
        </div>
      ) : null}

      {expensesModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Manage expenses">
          <section className="modal-card">
            <div className="panel-head compact">
              <div>
                <h4>Expenses Manager</h4>
                <p>View, edit, delete, and add expenses across all categories.</p>
              </div>
            </div>

            <div className="expense-modal-layout">
              <div className="store-list">
                {expenses.map((expense) => (
                  <article key={expense.id} className={`list-card ${selectedExpenseId === expense.id ? "selected-item" : ""}`}>
                    <div className="line-item">
                      <strong>{expense.category} - {expense.subcategory}</strong>
                      <span>{money(expense.amount)}</span>
                    </div>
                    <p>{expense.month}{expense.dueDate ? ` · due ${expense.dueDate}` : ""}</p>
                    <div className="button-row">
                      <button className="btn btn-secondary" type="button" onClick={() => startViewExpense(expense.id)}>View</button>
                      <button className="btn btn-primary" type="button" onClick={() => startEditExpense(expense)}>Edit</button>
                      <button className="btn btn-ghost" type="button" onClick={() => deleteExpense(expense.id)}>Delete</button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="modal-grid">
                {expenseMode === "view" ? (
                  selectedExpenseId ? (
                    (() => {
                      const selected = expenses.find((expense) => expense.id === selectedExpenseId);
                      if (!selected) return <p className="muted">Select an expense to view details.</p>;
                      return (
                        <article className="list-card">
                          <div className="line-item">
                            <strong>{selected.category} - {selected.subcategory}</strong>
                            <span>{money(selected.amount)}</span>
                          </div>
                          <p>Month: {selected.month}</p>
                          <p>Recurring: {selected.isRecurring ? "Yes" : "No"}</p>
                          <p>Paid: {selected.isPaid ? "Yes" : "No"}</p>
                          <p>Due Date: {selected.dueDate ?? "None"}</p>
                        </article>
                      );
                    })()
                  ) : (
                    <p className="muted">Pick an expense from the list, or create a new one.</p>
                  )
                ) : (
                  <>
                    <label>
                      Category
                      <input
                        value={expenseDraft.category}
                        onChange={(e) => setExpenseDraft((prev) => ({ ...prev, category: e.target.value }))}
                        placeholder="Housing"
                      />
                    </label>
                    <label>
                      Subcategory
                      <input
                        value={expenseDraft.subcategory}
                        onChange={(e) => setExpenseDraft((prev) => ({ ...prev, subcategory: e.target.value }))}
                        placeholder="Rent"
                      />
                    </label>
                    <label>
                      Amount
                      <input
                        type="number"
                        min={1}
                        value={expenseDraft.amount}
                        onChange={(e) => setExpenseDraft((prev) => ({ ...prev, amount: e.target.value }))}
                        placeholder="18500"
                      />
                    </label>
                    <label>
                      Month (YYYY-MM)
                      <input
                        value={expenseDraft.month}
                        onChange={(e) => setExpenseDraft((prev) => ({ ...prev, month: e.target.value }))}
                        placeholder={currentMonth()}
                      />
                    </label>
                    <label>
                      Due Date (optional, YYYY-MM-DD)
                      <input
                        value={expenseDraft.dueDate}
                        onChange={(e) => setExpenseDraft((prev) => ({ ...prev, dueDate: e.target.value }))}
                        placeholder={`${currentMonth()}-15`}
                      />
                    </label>
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={expenseDraft.isRecurring}
                        onChange={(e) => setExpenseDraft((prev) => ({ ...prev, isRecurring: e.target.checked }))}
                      />
                      Recurring Expense
                    </label>
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={expenseDraft.isPaid}
                        onChange={(e) => setExpenseDraft((prev) => ({ ...prev, isPaid: e.target.checked }))}
                      />
                      Already Paid
                    </label>
                    <button className="btn btn-primary" type="button" onClick={saveExpenseDraft}>
                      {expenseMode === "edit" ? "Save Expense" : "Add Expense"}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="button-row">
              <button className="btn btn-secondary" type="button" onClick={startCreateExpense}>Add New Expense</button>
              <button className="btn btn-ghost" type="button" onClick={() => setExpensesModalOpen(false)}>Close</button>
            </div>
          </section>
        </div>
      ) : null}

      {fundsModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Manage funds">
          <section className="modal-card">
            <div className="panel-head compact">
              <div>
                <h4>Manage Funds</h4>
                <p>Add, edit, and remove income streams.</p>
              </div>
            </div>

            <div className="modal-grid">
              <div className="store-list">
                {fundsDraft.map((fund) => (
                  <div key={fund.id} className="store-row funds-row">
                    <input
                      value={fund.name}
                      onChange={(e) =>
                        setFundsDraft((prev) =>
                          prev.map((entry) => (entry.id === fund.id ? { ...entry, name: e.target.value } : entry))
                        )
                      }
                      placeholder="Income name"
                    />
                    <select
                      value={fund.type}
                      onChange={(e) =>
                        setFundsDraft((prev) =>
                          prev.map((entry) =>
                            entry.id === fund.id ? { ...entry, type: e.target.value as IncomeSource["type"] } : entry
                          )
                        )
                      }
                    >
                      <option value="salary">Salary</option>
                      <option value="additional">Additional</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={fund.amount}
                      onChange={(e) =>
                        setFundsDraft((prev) =>
                          prev.map((entry) => (entry.id === fund.id ? { ...entry, amount: e.target.value } : entry))
                        )
                      }
                      placeholder="Amount"
                    />
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => {
                        const ok = window.confirm(`Remove ${fund.name || "this income stream"}?`);
                        if (!ok) return;
                        setFundsDraft((prev) => prev.filter((entry) => entry.id !== fund.id));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <button
                className="btn btn-secondary"
                type="button"
                onClick={() =>
                  setFundsDraft((prev) => [
                    ...prev,
                    { id: `fund-${Date.now()}`, name: "", type: "additional", amount: "" }
                  ])
                }
              >
                Add Income Stream
              </button>
            </div>

            <div className="button-row">
              <button className="btn btn-primary" type="button" onClick={saveFundsModal}>Save Funds</button>
              <button className="btn btn-ghost" type="button" onClick={() => setFundsModalOpen(false)}>Cancel</button>
            </div>
          </section>
        </div>
      ) : null}

      {foodBudgetModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit food budget">
          <section className="modal-card">
            <div className="panel-head compact">
              <div>
                <h4>Edit Food Budget</h4>
                <p>Update monthly groceries budget and store breakdown.</p>
              </div>
            </div>

            <div className="modal-grid">
              <label>
                Monthly Food Budget
                <input
                  type="number"
                  min={1}
                  value={foodBudgetDraft}
                  onChange={(e) => setFoodBudgetDraft(e.target.value)}
                  placeholder="6500"
                />
              </label>

              <div className="store-list">
                {foodStoresDraft.map((store) => (
                  <div key={store.id} className="store-row">
                    <input
                      value={store.name}
                      onChange={(e) =>
                        setFoodStoresDraft((prev) =>
                          prev.map((entry) => (entry.id === store.id ? { ...entry, name: e.target.value } : entry))
                        )
                      }
                      placeholder="Store name"
                    />
                    <input
                      type="number"
                      min={1}
                      value={store.amount}
                      onChange={(e) =>
                        setFoodStoresDraft((prev) =>
                          prev.map((entry) => (entry.id === store.id ? { ...entry, amount: e.target.value } : entry))
                        )
                      }
                      placeholder="Amount"
                    />
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => {
                        const ok = window.confirm(`Remove ${store.name || "this store"} from food breakdown?`);
                        if (!ok) return;
                        setFoodStoresDraft((prev) => prev.filter((entry) => entry.id !== store.id));
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <button
                className="btn btn-secondary"
                type="button"
                onClick={() =>
                  setFoodStoresDraft((prev) => [
                    ...prev,
                    { id: `store-${Date.now()}`, name: "", amount: "" }
                  ])
                }
              >
                Add Store
              </button>
            </div>

            <div className="button-row">
              <button className="btn btn-primary" type="button" onClick={saveFoodBudgetModal}>Save Changes</button>
              <button className="btn btn-ghost" type="button" onClick={() => setFoodBudgetModalOpen(false)}>Cancel</button>
            </div>
          </section>
        </div>
      ) : null}

      {contributionModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Add contribution">
          <section className="modal-card">
            <div className="panel-head compact">
              <div>
                <h4>Add Contribution</h4>
                <p>Capture amount and contribution type.</p>
              </div>
            </div>

            <div className="modal-grid">
              <label>
                Amount
                <input
                  type="number"
                  min={1}
                  value={contributionAmountDraft}
                  onChange={(e) => setContributionAmountDraft(e.target.value)}
                  placeholder="500"
                />
              </label>

              <label>
                Contribution Type
                <select
                  value={contributionTypeDraft}
                  onChange={(e) => setContributionTypeDraft(e.target.value as ContributionRecord["contributionType"])}
                >
                  <option value="Savings">Savings</option>
                  <option value="Investment">Investment</option>
                  <option value="Retirement">Retirement</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </label>
            </div>

            <div className="button-row">
              <button className="btn btn-primary" type="button" onClick={saveContributionModal}>Add</button>
              <button className="btn btn-ghost" type="button" onClick={() => setContributionModalOpen(false)}>Cancel</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

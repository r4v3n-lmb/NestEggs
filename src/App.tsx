import { useMemo, useState } from "react";
import type { BudgetCategoryLimit, ExpenseItem, IncomeSource, SavingsGoal } from "./types";
import { mockBudgetLimits, mockExpenses, mockGoals, mockIncomes } from "./data/mock";
import { authApi } from "./firebase";
import { money, toPercent } from "./lib/format";
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

  const [alertThreshold, setAlertThreshold] = useState(80);
  const [showGoalHistory, setShowGoalHistory] = useState(false);
  const [actionMessage, setActionMessage] = useState<string>("");
  const [actionHistory, setActionHistory] = useState<string[]>([]);

  const { isOnline, pendingCount } = useOfflineQueue();

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

  const recurringBills = useMemo(
    () => expenses.filter((expense) => expense.isRecurring).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")),
    [expenses]
  );

  const notifications = useMemo(() => {
    const now = new Date();
    const byBudget = categorySpend
      .filter((row) => row.ratio * 100 >= alertThreshold)
      .map((row) => `${row.category} is at ${Math.round(row.ratio * 100)}% of budget.`);

    const overdueBills = expenses
      .filter((expense) => expense.isRecurring && !expense.isPaid && expense.dueDate)
      .filter((expense) => {
        const dueDate = new Date(expense.dueDate as string);
        const diff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return diff >= 2;
      })
      .map((expense) => `${expense.subcategory} is overdue by 2+ days.`);

    return [...byBudget, ...overdueBills];
  }, [alertThreshold, categorySpend, expenses]);

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

  const handleAddFunds = () => {
    setIncomes((prev) => prev.map((income, idx) => (idx === 0 ? { ...income, amount: income.amount + 500 } : income)));
    addHistory("Added R500.00 to Primary Salary.");
  };

  const handleAdjustFoodBudget = () => {
    setBudgetLimits((prev) => prev.map((limit) => (limit.category === "Groceries" ? { ...limit, limit: limit.limit + 250 } : limit)));
    addHistory("Raised Groceries budget by R250.00.");
  };

  const handleAddContribution = () => {
    setGoals((prev) =>
      prev.map((goal, idx) =>
        idx === 0
          ? {
              ...goal,
              currentAmount: Math.min(goal.currentAmount + 500, goal.targetAmount)
            }
          : goal
      )
    );
    addHistory("Added R500.00 contribution to primary goal.");
  };

  const handleViewHistory = () => {
    setShowGoalHistory((prev) => !prev);
    addHistory(showGoalHistory ? "Collapsed contribution history." : "Opened contribution history.");
  };

  const handleMarkBillPaid = (billId: string) => {
    setExpenses((prev) => prev.map((bill) => (bill.id === billId ? { ...bill, isPaid: true } : bill)));
    addHistory("Marked recurring bill as paid.");
  };

  const handleFab = () => {
    setActiveTab("expenses");
    addHistory("Quick add opened the Expenses section.");
  };

  if (!isAuthenticated) {
    return (
      <main className="auth-mask-root">
        <section className="auth-mask-card">
          <p className="eyebrow">NestEggs</p>
          <h1 className="brand-title">Welcome Back</h1>
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
              <button className="btn btn-primary" type="button" onClick={handleAddFunds}>Add Funds</button>
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
        </aside>
      </section>
    </>
  );

  const renderExpenses = () => (
    <section className="view-stack">
      <section className="editorial-head">
        <h2>Expenses</h2>
        <p>Shared spending breakdown for {monthLabel}.</p>
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
          <button className="btn btn-primary" type="button" onClick={handleAdjustFoodBudget}>Adjust Food Budget</button>
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
        <p>Recurring commitments and priority attention items.</p>
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
        </article>

        <article className="panel">
          <div className="panel-head compact">
            <div>
              <h4>Upcoming Schedule</h4>
              <p>Recurring bills and payment status.</p>
            </div>
          </div>
          <div className="stack-list">
            {recurringBills.map((bill) => (
              <article key={bill.id} className={`list-card bill-item ${bill.isPaid ? "paid" : "upcoming"}`}>
                <div>
                  <strong>{bill.subcategory}</strong>
                  <p>{bill.category} · {bill.dueDate ?? "No due date"}</p>
                </div>
                <div className="bill-right">
                  <p>{money(bill.amount)}</p>
                  {bill.isPaid ? (
                    <span>Paid</span>
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
                  <button className="btn btn-primary" type="button" onClick={handleAddContribution}>Add Contribution</button>
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
              <p>{showGoalHistory ? "Your latest in-app actions" : "Latest income inflows towards goals."}</p>
            </div>
          </div>
          <div className="stack-list">
            {showGoalHistory
              ? actionHistory.map((item) => (
                  <article key={item} className="list-card">
                    <p>{item}</p>
                  </article>
                ))
              : incomes.map((income) => (
                  <article key={income.id} className="list-card activity-item">
                    <div>
                      <strong>{income.name}</strong>
                      <p>{income.type}</p>
                    </div>
                    <p className="amount-in">+{money(income.amount)}</p>
                  </article>
                ))}
          </div>
        </article>
      </section>
    </section>
  );

  return (
    <div className="ledger-root">
      <header className="topbar">
        <div className="brand-row">
          <div className="avatar-stack" aria-hidden>
            <span className="avatar-chip">RL</span>
            <span className="avatar-chip partner">BA</span>
          </div>
          <div>
            <p className="eyebrow">NestEggs</p>
            <h1 className="brand-title">Our Ledger</h1>
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
    </div>
  );
}

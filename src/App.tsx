import { useMemo, useState } from "react";
import KpiCard from "./components/KpiCard";
import SectionCard from "./components/SectionCard";
import { mockBudgetLimits, mockExpenses, mockGoals, mockIncomes } from "./data/mock";
import { authApi } from "./firebase";
import { money, toPercent } from "./lib/format";
import { useOfflineQueue } from "./hooks/useOfflineQueue";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [alertThreshold, setAlertThreshold] = useState(80);
  const [status, setStatus] = useState<string>("Not connected to Firebase auth yet.");
  const { isOnline, pendingCount } = useOfflineQueue();

  const totals = useMemo(() => {
    const incomeTotal = mockIncomes.reduce((sum, item) => sum + item.amount, 0);
    const expenseTotal = mockExpenses.reduce((sum, item) => sum + item.amount, 0);
    const cashflow = incomeTotal - expenseTotal;
    const savingsRate = incomeTotal > 0 ? Math.max(0, cashflow) / incomeTotal : 0;

    const debtPayments = mockExpenses
      .filter((item) => item.category.toLowerCase() === "debt" || item.subcategory.toLowerCase().includes("payment"))
      .reduce((sum, item) => sum + item.amount, 0);
    const debtRatio = incomeTotal > 0 ? debtPayments / incomeTotal : 0;

    const limitsTotal = mockBudgetLimits.reduce((sum, item) => sum + item.limit, 0);
    const budgetVariance = limitsTotal - expenseTotal;

    return { incomeTotal, expenseTotal, cashflow, savingsRate, debtRatio, budgetVariance };
  }, []);

  const categorySpend = useMemo(() => {
    return mockBudgetLimits.map((limit) => {
      const spent = mockExpenses
        .filter((expense) => expense.category === limit.category)
        .reduce((sum, expense) => sum + expense.amount, 0);
      const ratio = limit.limit > 0 ? spent / limit.limit : 0;
      return { ...limit, spent, ratio };
    });
  }, []);

  const notifications = useMemo(() => {
    const now = new Date();
    const byBudget = categorySpend
      .filter((row) => row.ratio * 100 >= alertThreshold)
      .map((row) => `${row.category} is at ${Math.round(row.ratio * 100)}% of budget.`);

    const overdueBills = mockExpenses
      .filter((expense) => expense.isRecurring && !expense.isPaid && expense.dueDate)
      .filter((expense) => {
        const dueDate = new Date(expense.dueDate as string);
        const diff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return diff >= 2;
      })
      .map((expense) => `${expense.subcategory} is overdue by 2+ days.`);

    return [...byBudget, ...overdueBills];
  }, [alertThreshold, categorySpend]);

  const runAuth = async (type: "signin" | "signup" | "google" | "apple") => {
    try {
      if (type === "signin") await authApi.signIn(email, password);
      if (type === "signup") await authApi.signUp(email, password);
      if (type === "google") await authApi.signInGoogle();
      if (type === "apple") await authApi.signInApple();
      setStatus("Auth request completed. Next step is join code household linking.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Auth error";
      setStatus(`Auth failed: ${message}`);
    }
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">NestEggs</p>
          <h1>Couples Budget Command Center</h1>
          <p className="subhead">ZAR only, monthly category caps, shared household with join code.</p>
        </div>
        <div className="status-panel">
          <p>{isOnline ? "Online" : "Offline mode"}</p>
          <p>{pendingCount} pending sync actions</p>
        </div>
      </header>

      <section className="kpi-grid">
        <KpiCard label="Cashflow" value={money(totals.cashflow)} tone={totals.cashflow >= 0 ? "good" : "warn"} />
        <KpiCard label="Savings/Investment Rate" value={toPercent(totals.savingsRate)} />
        <KpiCard label="Debt Ratio" value={toPercent(totals.debtRatio)} tone={totals.debtRatio > 0.3 ? "warn" : "default"} />
        <KpiCard
          label="Budget Variance"
          value={money(totals.budgetVariance)}
          tone={totals.budgetVariance >= 0 ? "good" : "warn"}
        />
      </section>

      <section className="content-grid">
        <SectionCard title="Auth + Household" subtitle="Email/Password, Google, Apple, Phone setup hooks">
          <div className="form-grid">
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
              <button onClick={() => void runAuth("signin")}>Sign In</button>
              <button onClick={() => void runAuth("signup")}>Create Account</button>
              <button onClick={() => void runAuth("google")}>Google</button>
              <button onClick={() => void runAuth("apple")}>Apple</button>
            </div>
            <div id="phone-recaptcha" />
            <label>
              Household Join Code
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="ABC123" />
            </label>
            <button disabled={!joinCode.trim()}>Join Household</button>
            <p className="muted">Phone auth is scaffolded in Firebase module; UI verification step will be added next.</p>
            <p className="muted">{status}</p>
          </div>
        </SectionCard>

        <SectionCard
          title="Category Budgets"
          subtitle="Monthly limits with threshold notifications"
          right={
            <label className="inline-label">
              Alert %
              <input
                type="number"
                min={50}
                max={100}
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(Number(e.target.value))}
              />
            </label>
          }
        >
          <div className="list-grid">
            {categorySpend.map((row) => (
              <article key={row.category} className="list-item">
                <div>
                  <strong>{row.category}</strong>
                  <p>
                    {money(row.spent)} / {money(row.limit)}
                  </p>
                </div>
                <p className={row.ratio > 1 ? "warn-text" : "ok-text"}>{Math.round(row.ratio * 100)}%</p>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Income Streams" subtitle="Salary + variable additional income with prior-month autofill support">
          <div className="list-grid">
            {mockIncomes.map((income) => (
              <article key={income.id} className="list-item">
                <div>
                  <strong>{income.name}</strong>
                  <p>{income.type}</p>
                </div>
                <p>{money(income.amount)}</p>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Expenses Breakdown" subtitle="Category + subcategory structure">
          <div className="list-grid">
            {mockExpenses.map((expense) => (
              <article key={expense.id} className="list-item">
                <div>
                  <strong>
                    {expense.category} - {expense.subcategory}
                  </strong>
                  <p>{expense.isRecurring ? "Recurring" : "Variable"}</p>
                </div>
                <p>{money(expense.amount)}</p>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Savings Goals" subtitle="Tax-free savings target tracking">
          <div className="list-grid">
            {mockGoals.map((goal) => {
              const progress = goal.currentAmount / goal.targetAmount;
              return (
                <article key={goal.id} className="list-item">
                  <div>
                    <strong>{goal.title}</strong>
                    <p>
                      {money(goal.currentAmount)} / {money(goal.targetAmount)}
                    </p>
                  </div>
                  <p>{Math.round(progress * 100)}%</p>
                </article>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="In-App Alerts" subtitle="Budget threshold and overdue recurring bills">
          <div className="list-grid">
            {notifications.length > 0 ? (
              notifications.map((note) => (
                <article key={note} className="list-item">
                  <p>{note}</p>
                </article>
              ))
            ) : (
              <p className="muted">No active alerts.</p>
            )}
          </div>
        </SectionCard>
      </section>
    </main>
  );
}

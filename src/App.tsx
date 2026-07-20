import { invoke } from "@tauri-apps/api/core";
import ReactECharts from "echarts-for-react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  ChevronDown,
  CircleDollarSign,
  FileCheck2,
  FileSpreadsheet,
  Import,
  LayoutDashboard,
  ListFilter,
  MoreHorizontal,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  WalletCards,
} from "lucide-react";
import { ChangeEvent, useMemo, useRef, useState } from "react";

import { demoResult } from "./demo";
import type { ImportResult, Transaction } from "./types";

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
});

const monthLabel = new Intl.DateTimeFormat("en-CA", { month: "short" });
const categoryColors = ["#5d7b6f", "#cf8557", "#7d8eb0", "#d1ad58", "#8d6d88", "#b8b4a6"];

function money(value: string) {
  return currency.format(Number(value));
}

function transactionLabel(count: number) {
  return `${count} ${count === 1 ? "transaction" : "transactions"}`;
}

function MetricCard({
  title,
  value,
  caption,
  tone,
  icon,
}: {
  title: string;
  value: string;
  caption: string;
  tone: "green" | "orange" | "blue" | "neutral";
  icon: React.ReactNode;
}) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__top">
        <span>{title}</span>
        <span className="metric-card__icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{caption}</small>
    </article>
  );
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const categoryClass =
    transaction.category === "Uncategorized" ? "status status--warning" : "status";

  return (
    <tr>
      <td>{new Date(`${transaction.date}T12:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</td>
      <td>
        <span className="merchant">{transaction.description}</span>
        <span className="rule-note">
          {transaction.matchedRule ? `Matched by ${transaction.matchedRule}` : "Needs review"}
        </span>
      </td>
      <td>
        <span className={categoryClass}>
          <span className="status__dot" />
          {transaction.category}
        </span>
      </td>
      <td className={`amount amount--${transaction.kind}`}>
        {transaction.kind === "income" ? "+" : "−"}
        {money(transaction.amount)}
      </td>
      <td>
        <button className="icon-button" aria-label={`More actions for ${transaction.description}`}>
          <MoreHorizontal size={18} />
        </button>
      </td>
    </tr>
  );
}

export default function App() {
  const [result, setResult] = useState<ImportResult>(demoResult);
  const [fileName, setFileName] = useState("Example workspace");
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { analysis, transactions } = result;

  const monthlyOption = useMemo(
    () => ({
      aria: { enabled: true, decal: { show: true } },
      color: ["#55776a", "#d58a5c"],
      tooltip: {
        trigger: "axis",
        valueFormatter: (value: number) => currency.format(value),
      },
      legend: {
        top: 2,
        right: 4,
        itemWidth: 9,
        itemHeight: 9,
        textStyle: { color: "#6d726d", fontFamily: "Inter, sans-serif" },
      },
      grid: { top: 48, right: 12, bottom: 28, left: 58 },
      xAxis: {
        type: "category",
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { color: "#7b807c" },
        data: analysis.monthlyTotals.map(({ month }) =>
          monthLabel.format(new Date(`${month}-01T12:00:00`)),
        ),
      },
      yAxis: {
        type: "value",
        splitNumber: 4,
        axisLabel: {
          color: "#9a9d99",
          formatter: (value: number) => `$${Math.round(value / 1000)}k`,
        },
        splitLine: { lineStyle: { color: "#ecece7" } },
      },
      series: [
        {
          name: "Income",
          type: "bar",
          barMaxWidth: 24,
          itemStyle: { borderRadius: [5, 5, 0, 0] },
          data: analysis.monthlyTotals.map(({ income }) => Number(income)),
        },
        {
          name: "Expenses",
          type: "bar",
          barMaxWidth: 24,
          itemStyle: { borderRadius: [5, 5, 0, 0] },
          data: analysis.monthlyTotals.map(({ expenses }) => Number(expenses)),
        },
      ],
    }),
    [analysis.monthlyTotals],
  );

  const categoryOption = useMemo(
    () => ({
      aria: { enabled: true, decal: { show: true } },
      color: categoryColors,
      tooltip: {
        trigger: "item",
        valueFormatter: (value: number) => currency.format(value),
      },
      series: [
        {
          name: "Expenses",
          type: "pie",
          radius: ["56%", "78%"],
          center: ["50%", "48%"],
          avoidLabelOverlap: true,
          padAngle: 2,
          itemStyle: { borderRadius: 5 },
          label: { show: false },
          emphasis: { scaleSize: 5 },
          data: analysis.categoryTotals.map(({ category, amount }) => ({
            name: category,
            value: Number(amount),
          })),
        },
      ],
    }),
    [analysis.categoryTotals],
  );

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setError(null);
    try {
      const csvText = await file.text();
      const imported = await invoke<ImportResult>("import_csv", { csvText });
      setResult(imported);
      setFileName(file.name);
    } catch (cause) {
      setError(
        typeof cause === "string"
          ? cause
          : "Importing requires the Tax Assistant desktop runtime.",
      );
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark">
            <ReceiptText size={22} />
          </span>
          <span>
            <strong>Tax Assistant</strong>
            <small>Personal workspace</small>
          </span>
        </div>

        <nav aria-label="Primary">
          <p className="nav-label">Workspace</p>
          <a className="nav-link nav-link--active" href="#overview">
            <LayoutDashboard size={18} /> Overview
          </a>
          <a className="nav-link" href="#transactions">
            <WalletCards size={18} /> Transactions
            <span className="nav-count">{transactions.length}</span>
          </a>
          <a className="nav-link" href="#rules">
            <ListFilter size={18} /> Rules
          </a>
          <a className="nav-link" href="#reports">
            <FileCheck2 size={18} /> Reports
          </a>

          <p className="nav-label nav-label--spaced">Tax year</p>
          <button className="year-switcher">
            <span><BookOpenCheck size={18} /> 2025 return</span>
            <ChevronDown size={16} />
          </button>
        </nav>

        <div className="sidebar__bottom">
          <div className="privacy-note">
            <ShieldCheck size={19} />
            <span>
              <strong>Private by design</strong>
              <small>Your data stays on this device</small>
            </span>
          </div>
          <a className="nav-link" href="#settings">
            <Settings size={18} /> Settings
          </a>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <span className="eyebrow">2025 tax year</span>
            <h1>Financial overview</h1>
            <p>{fileName} · {transactions.length} transactions</p>
          </div>
          <div className="topbar__actions">
            <label className="search">
              <Search size={17} />
              <input type="search" placeholder="Search transactions" />
              <kbd>⌘ K</kbd>
            </label>
            <input
              ref={fileInput}
              className="visually-hidden"
              type="file"
              accept=".csv,text/csv"
              onChange={handleImport}
            />
            <button
              className="button button--primary"
              onClick={() => fileInput.current?.click()}
              disabled={isImporting}
            >
              <Import size={17} />
              {isImporting ? "Importing…" : "Import CSV"}
            </button>
          </div>
        </header>

        <div className="content">
          {error && (
            <div className="alert" role="alert">
              <strong>Couldn’t import that file.</strong>
              <span>{error}</span>
              <button onClick={() => setError(null)}>Dismiss</button>
            </div>
          )}

          <section className="metrics" aria-label="Financial totals">
            <MetricCard
              title="Gross income"
              value={money(analysis.income)}
              caption={`${transactionLabel(transactions.filter((item) => item.kind === "income").length)} incoming`}
              tone="green"
              icon={<ArrowUpRight size={19} />}
            />
            <MetricCard
              title="Total expenses"
              value={money(analysis.expenses)}
              caption={`${transactionLabel(transactions.filter((item) => item.kind === "expense").length)} outgoing`}
              tone="orange"
              icon={<ArrowDownRight size={19} />}
            />
            <MetricCard
              title="Net income"
              value={money(analysis.net)}
              caption="Before tax adjustments"
              tone="blue"
              icon={<CircleDollarSign size={19} />}
            />
            <MetricCard
              title="Categorized"
              value={`${transactions.length === 0 ? 0 : Math.round((analysis.categorizedCount / transactions.length) * 100)}%`}
              caption={`${transactionLabel(analysis.uncategorizedCount)} to review`}
              tone="neutral"
              icon={<Tag size={19} />}
            />
          </section>

          <section className="chart-grid">
            <article className="panel panel--wide">
              <div className="panel__heading">
                <div>
                  <span className="panel__kicker"><BarChart3 size={15} /> Cash flow</span>
                  <h2>Income and expenses</h2>
                </div>
                <button className="filter-button">
                  Monthly <ChevronDown size={15} />
                </button>
              </div>
              <ReactECharts
                option={monthlyOption}
                style={{ height: 270 }}
                opts={{ renderer: "svg" }}
              />
            </article>

            <article className="panel">
              <div className="panel__heading">
                <div>
                  <span className="panel__kicker"><SlidersHorizontal size={15} /> Breakdown</span>
                  <h2>Expenses by category</h2>
                </div>
              </div>
              <div className="donut-wrap">
                <ReactECharts
                  option={categoryOption}
                  style={{ height: 205, width: 205 }}
                  opts={{ renderer: "svg" }}
                />
                <div className="donut-total">
                  <small>Total</small>
                  <strong>{money(analysis.expenses)}</strong>
                </div>
              </div>
              <ul className="legend">
                {analysis.categoryTotals.slice(0, 4).map((item, index) => (
                  <li key={item.category}>
                    <span
                      className="legend__swatch"
                      style={{ background: categoryColors[index] }}
                    />
                    <span>{item.category}</span>
                    <strong>{money(item.amount)}</strong>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="lower-grid">
            <article className="panel transactions-panel" id="transactions">
              <div className="panel__heading">
                <div>
                  <span className="panel__kicker"><FileSpreadsheet size={15} /> Activity</span>
                  <h2>Recent transactions</h2>
                </div>
                <button className="text-button">View all <ArrowUpRight size={15} /></button>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th><span className="visually-hidden">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 6).map((transaction) => (
                      <TransactionRow key={transaction.id} transaction={transaction} />
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <aside className="review-card">
              <span className="review-card__icon"><Sparkles size={21} /></span>
              <span className="panel__kicker">Review queue</span>
              <h2>Almost ready to report</h2>
              <p>
                {transactionLabel(analysis.uncategorizedCount)}{" "}
                {analysis.uncategorizedCount === 1 ? "needs" : "need"} a category
                before your totals are complete.
              </p>
              <div className="review-progress">
                <span
                  style={{
                    width: `${
                      transactions.length === 0
                        ? 0
                        : (analysis.categorizedCount / transactions.length) * 100
                    }%`,
                  }}
                />
              </div>
              <div className="review-stats">
                <span><strong>{analysis.categorizedCount}</strong> categorized</span>
                <span><strong>{analysis.uncategorizedCount}</strong> to review</span>
              </div>
              <button className="button button--light">
                Review transactions <ArrowUpRight size={16} />
              </button>
            </aside>
          </section>
        </div>
      </main>
    </div>
  );
}

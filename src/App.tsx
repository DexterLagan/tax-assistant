import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
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
  ScanSearch,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  WalletCards,
} from "lucide-react";
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import BillBookView from "./BillBookView";
import AutoDetectDialog from "./AutoDetectDialog";
import ConfigDialog from "./ConfigDialog";
import { demoResult } from "./demo";
import { fallbackConfig } from "./fallbackConfig";
import type {
  AppConfig,
  ConfigEnvelope,
  DetectedTransactionType,
  ImportResult,
  Transaction,
} from "./types";

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
});

const monthLabel = new Intl.DateTimeFormat("en-CA", { month: "short" });
const categoryColors = [
  "#5d7b6f",
  "#cf8557",
  "#7d8eb0",
  "#d1ad58",
  "#8d6d88",
  "#b8b4a6",
];
const zoomLevels = [0.8, 0.9, 1, 1.1, 1.2, 1.4, 1.6] as const;
const defaultZoomIndex = zoomLevels.indexOf(1);

interface PendingImport {
  result: ImportResult;
  fileName: string;
}

function savedZoomIndex() {
  const saved = Number(window.localStorage.getItem("tax-assistant-zoom"));
  const index = zoomLevels.findIndex((level) => level === saved);
  return index >= 0 ? index : defaultZoomIndex;
}

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
  const needsReview = ["Uncategorized", "Unmatched"].includes(transaction.category);
  const categoryClass = needsReview ? "status status--warning" : "status";

  return (
    <tr>
      <td>
        {new Date(`${transaction.date}T12:00:00`).toLocaleDateString("en-CA", {
          month: "short",
          day: "numeric",
        })}
      </td>
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
  const [activePage, setActivePage] = useState<"overview" | "bills">("overview");
  const [configOpen, setConfigOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [detections, setDetections] = useState<DetectedTransactionType[]>([]);
  const [detectInitialStep, setDetectInitialStep] = useState<"prompt" | "review">(
    "prompt",
  );
  const [detectBusy, setDetectBusy] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [hasImportedCsv, setHasImportedCsv] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(savedZoomIndex);
  const [envelope, setEnvelope] = useState<ConfigEnvelope>({
    config: fallbackConfig,
    source: "Built-in defaults",
    path: null,
    portable: false,
  });
  const fileInput = useRef<HTMLInputElement>(null);
  const { analysis, transactions, billBook } = result;
  const zoom = zoomLevels[zoomIndex];

  const changeZoom = useCallback((direction: "in" | "out" | "reset") => {
    setZoomIndex((current) => {
      if (direction === "reset") return defaultZoomIndex;
      const offset = direction === "in" ? 1 : -1;
      return Math.min(zoomLevels.length - 1, Math.max(0, current + offset));
    });
  }, []);

  useEffect(() => {
    window.localStorage.setItem("tax-assistant-zoom", String(zoom));
    if (isTauri()) {
      getCurrentWebview().setZoom(zoom).catch(() => {
        document.body.style.setProperty("zoom", String(zoom));
      });
    } else {
      document.body.style.setProperty("zoom", String(zoom));
    }
  }, [zoom]);

  useEffect(() => {
    function handleZoomShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        changeZoom("in");
      } else if (event.key === "-") {
        event.preventDefault();
        changeZoom("out");
      } else if (event.key === "0") {
        event.preventDefault();
        changeZoom("reset");
      }
    }

    window.addEventListener("keydown", handleZoomShortcut);
    return () => window.removeEventListener("keydown", handleZoomShortcut);
  }, [changeZoom]);

  useEffect(() => {
    let active = true;
    invoke<ConfigEnvelope>("load_config")
      .then(async (loaded) => {
        if (!active) return;
        setEnvelope(loaded);
        const reanalyzed = await invoke<ImportResult>("reanalyze_transactions", {
          transactions: demoResult.transactions,
          config: loaded.config,
        });
        if (active) setResult(reanalyzed);
      })
      .catch(() => {
        // Browser-only development keeps the deterministic demo configuration.
      });
    return () => {
      active = false;
    };
  }, []);

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
      const imported = await invoke<ImportResult>("import_csv", {
        csvText,
        config: envelope.config,
      });
      const found = await invoke<DetectedTransactionType[]>("detect_types", {
        transactions: imported.transactions,
      });
      setDetections(found);
      setDetectInitialStep("prompt");
      setDetectError(null);
      setPendingImport({ result: imported, fileName: file.name });
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

  function openImportedWorkspace(imported: PendingImport) {
    setResult(imported.result);
    setFileName(imported.fileName);
    setActivePage("bills");
    setHasImportedCsv(true);
    setPendingImport(null);
  }

  async function rerunDetection() {
    if (!hasImportedCsv) return;
    setError(null);
    setDetectBusy(true);
    try {
      const found = await invoke<DetectedTransactionType[]>("detect_types", {
        transactions: result.transactions,
      });
      setDetections(found);
      setDetectInitialStep("review");
      setDetectError(null);
      setPendingImport({ result, fileName });
    } catch (cause) {
      setError(typeof cause === "string" ? cause : "Could not detect transaction types.");
    } finally {
      setDetectBusy(false);
    }
  }

  async function applyDetectedTypes(
    selected: DetectedTransactionType[],
    clearExisting: boolean,
  ) {
    if (!pendingImport) return;

    setDetectBusy(true);
    setError(null);
    setDetectError(null);
    try {
      const detectedDefinitions = selected
        .filter((item) => clearExisting || !item.existingType)
        .map((item) => item.transactionType);
      const existingDefinitions = clearExisting
        ? []
        : envelope.config.transactionTypes;
      const existingIds = new Set(existingDefinitions.map((item) => item.id));
      const uniqueDetected = detectedDefinitions.map((definition) => {
        if (!existingIds.has(definition.id)) {
          existingIds.add(definition.id);
          return definition;
        }
        const id = `${definition.id}-${crypto.randomUUID?.().slice(0, 8) ?? Date.now()}`;
        existingIds.add(id);
        return { ...definition, id };
      });
      const config: AppConfig = {
        ...envelope.config,
        transactionTypes: [...uniqueDetected, ...existingDefinitions],
      };
      const saved = await invoke<ConfigEnvelope>("save_config", { config });
      const reanalyzed = await invoke<ImportResult>("reanalyze_transactions", {
        transactions: pendingImport.result.transactions,
        config: saved.config,
      });
      setEnvelope(saved);
      openImportedWorkspace({
        result: reanalyzed,
        fileName: pendingImport.fileName,
      });
    } catch (cause) {
      setDetectError(
        typeof cause === "string"
          ? cause
          : "Could not save the detected transaction types.",
      );
    } finally {
      setDetectBusy(false);
    }
  }

  async function reanalyze(config: AppConfig) {
    const updated = await invoke<ImportResult>("reanalyze_transactions", {
      transactions: result.transactions,
      config,
    });
    setResult(updated);
  }

  async function saveConfiguration(config: AppConfig) {
    const saved = await invoke<ConfigEnvelope>("save_config", { config });
    await reanalyze(saved.config);
    setEnvelope(saved);
  }

  async function importConfiguration() {
    const selected = await openDialog({
      title: "Import Tax Assistant configuration",
      multiple: false,
      filters: [{ name: "Tax Assistant configuration", extensions: ["conf"] }],
    });
    if (!selected || Array.isArray(selected)) return null;
    return invoke<AppConfig>("read_config_file", { path: selected });
  }

  async function exportConfiguration(config: AppConfig) {
    const selected = await saveDialog({
      title: "Export portable Tax Assistant configuration",
      defaultPath: "tax-assistant.conf",
      filters: [{ name: "Tax Assistant configuration", extensions: ["conf"] }],
    });
    if (!selected) return false;
    await invoke("write_config_file", { path: selected, config });
    return true;
  }

  async function restoreConfiguration() {
    return invoke<AppConfig>("get_default_config");
  }

  const pageTitle = activePage === "overview" ? "Financial overview" : "Bill review";
  const pageKicker = activePage === "overview" ? "2025 tax year" : "Home office expenses";

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
          <button
            className={`nav-link ${activePage === "overview" ? "nav-link--active" : ""}`}
            onClick={() => setActivePage("overview")}
          >
            <LayoutDashboard size={18} /> Overview
          </button>
          <button
            className={`nav-link ${activePage === "bills" ? "nav-link--active" : ""}`}
            onClick={() => setActivePage("bills")}
          >
            <WalletCards size={18} /> Bills & income
            <span className="nav-count">
              {billBook.summaries.filter((item) => item.transactionCount > 0).length}
            </span>
          </button>
          <button className="nav-link" onClick={() => setConfigOpen(true)}>
            <ListFilter size={18} /> Transaction types
          </button>
          <button
            className="nav-link"
            onClick={rerunDetection}
            disabled={!hasImportedCsv || detectBusy}
            title={
              hasImportedCsv
                ? "Review transaction types detected in the current CSV"
                : "Import a CSV before detecting transaction types"
            }
          >
            <ScanSearch size={18} /> Auto-detect types
          </button>
          <button className="nav-link" onClick={() => setActivePage("bills")}>
            <FileCheck2 size={18} /> Annual totals
          </button>

          <p className="nav-label nav-label--spaced">Tax year</p>
          <button className="year-switcher">
            <span>
              <BookOpenCheck size={18} /> 2025 return
            </span>
            <ChevronDown size={16} />
          </button>
        </nav>

        <div className="sidebar__bottom">
          <div className="zoom-control" role="group" aria-label="Interface size">
            <span>Interface size</span>
            <div>
              <button
                onClick={() => changeZoom("out")}
                disabled={zoomIndex === 0}
                aria-label="Make interface smaller"
                title="Make interface smaller (Command or Control minus)"
              >
                A−
              </button>
              <button
                className="zoom-control__value"
                onClick={() => changeZoom("reset")}
                disabled={zoomIndex === defaultZoomIndex}
                aria-label={`Reset interface size, currently ${Math.round(zoom * 100)}%`}
                title="Reset interface size (Command or Control 0)"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => changeZoom("in")}
                disabled={zoomIndex === zoomLevels.length - 1}
                aria-label="Make interface larger"
                title="Make interface larger (Command or Control plus)"
              >
                A+
              </button>
            </div>
          </div>
          <div className="privacy-note">
            <ShieldCheck size={19} />
            <span>
              <strong>Private by design</strong>
              <small>Your data and patterns stay on this device</small>
            </span>
          </div>
          <button className="nav-link" onClick={() => setConfigOpen(true)}>
            <Settings size={18} /> Configuration
          </button>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <span className="eyebrow">{pageKicker}</span>
            <h1>{pageTitle}</h1>
            <p>
              {fileName} · {transactions.length} transactions
            </p>
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

        {error && (
          <div className="alert app-alert" role="alert">
            <strong>Tax Assistant needs attention.</strong>
            <span>{error}</span>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {activePage === "bills" ? (
          <BillBookView
            billBook={billBook}
            fileName={fileName}
            envelope={envelope}
            onConfigure={() => setConfigOpen(true)}
          />
        ) : (
          <div className="content">
            <section className="metrics" aria-label="Financial totals">
              <MetricCard
                title="Gross income"
                value={money(analysis.income)}
                caption={`${transactionLabel(
                  transactions.filter((item) => item.kind === "income").length,
                )} incoming`}
                tone="green"
                icon={<ArrowUpRight size={19} />}
              />
              <MetricCard
                title="Total expenses"
                value={money(analysis.expenses)}
                caption={`${transactionLabel(
                  transactions.filter((item) => item.kind === "expense").length,
                )} outgoing`}
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
                title="Matched"
                value={`${
                  transactions.length === 0
                    ? 0
                    : Math.round((analysis.categorizedCount / transactions.length) * 100)
                }%`}
                caption={`${transactionLabel(analysis.uncategorizedCount)} to review`}
                tone="neutral"
                icon={<Tag size={19} />}
              />
            </section>

            <section className="chart-grid">
              <article className="panel panel--wide">
                <div className="panel__heading">
                  <div>
                    <span className="panel__kicker">
                      <BarChart3 size={15} /> Cash flow
                    </span>
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
                    <span className="panel__kicker">
                      <SlidersHorizontal size={15} /> Breakdown
                    </span>
                    <h2>Expenses by type</h2>
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
                    <span className="panel__kicker">
                      <FileSpreadsheet size={15} /> Activity
                    </span>
                    <h2>Recent transactions</h2>
                  </div>
                  <button className="text-button" onClick={() => setActivePage("bills")}>
                    Review all <ArrowUpRight size={15} />
                  </button>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Transaction type</th>
                        <th>Amount</th>
                        <th>
                          <span className="visually-hidden">Actions</span>
                        </th>
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
                <span className="review-card__icon">
                  <Sparkles size={21} />
                </span>
                <span className="panel__kicker">Visual check</span>
                <h2>Verify before filing</h2>
                <p>
                  {transactionLabel(analysis.uncategorizedCount)}{" "}
                  {analysis.uncategorizedCount === 1 ? "needs" : "need"} a transaction
                  type before your totals are complete.
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
                  <span>
                    <strong>{analysis.categorizedCount}</strong> matched
                  </span>
                  <span>
                    <strong>{analysis.uncategorizedCount}</strong> to review
                  </span>
                </div>
                <button className="button button--light" onClick={() => setActivePage("bills")}>
                  Review bills <ArrowUpRight size={16} />
                </button>
              </aside>
            </section>
          </div>
        )}
      </main>

      <ConfigDialog
        open={configOpen}
        config={envelope.config}
        envelope={envelope}
        onClose={() => setConfigOpen(false)}
        onSave={saveConfiguration}
        onImport={importConfiguration}
        onExport={exportConfiguration}
        onRestore={restoreConfiguration}
      />
      <AutoDetectDialog
        open={pendingImport !== null}
        fileName={pendingImport?.fileName ?? ""}
        detections={detections}
        initialStep={detectInitialStep}
        busy={detectBusy}
        error={detectError}
        onCancel={() => {
          setPendingImport(null);
          setDetectError(null);
        }}
        onUseCurrent={() => {
          if (pendingImport) openImportedWorkspace(pendingImport);
        }}
        onApply={applyDetectedTypes}
      />
    </div>
  );
}

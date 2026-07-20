import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSearch,
  ListChecks,
  Settings2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type {
  BillBook,
  ConfigEnvelope,
  Transaction,
  TransactionTypeSummary,
} from "./types";

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
});

function money(value: string | number) {
  return currency.format(Number(value));
}

function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="empty-matches">
        <FileSearch size={27} />
        <strong>No matching transactions</strong>
        <span>
          This is worth checking: the bill may be absent, or its bank description may have
          changed.
        </span>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table className="bill-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Bank description</th>
            <th>Direction</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td>
                {new Date(`${transaction.date}T12:00:00`).toLocaleDateString("en-CA", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </td>
              <td>
                <span className="merchant">{transaction.description}</span>
                <span className="rule-note">CSV row {transaction.sourceRow}</span>
              </td>
              <td>
                <span className={`direction direction--${transaction.kind}`}>
                  {transaction.kind}
                </span>
              </td>
              <td className={`amount amount--${transaction.kind}`}>
                {transaction.kind === "income" ? "+" : "−"}
                {money(transaction.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailView({ summary }: { summary: TransactionTypeSummary }) {
  const definition = summary.transactionType;
  return (
    <>
      <section className="bill-detail-hero">
        <div>
          <span className="panel__kicker">
            <span className="type-chip" style={{ background: definition.color }} />
            Transaction type
          </span>
          <h2>{definition.name}</h2>
          <p>
            {definition.patterns.map((pattern) => (
              <code key={pattern}>{pattern}</code>
            ))}
          </p>
        </div>
        <div className="bill-detail-totals">
          <span>
            <small>Matched</small>
            <strong>{summary.transactionCount}</strong>
          </span>
          <span>
            <small>Annual total</small>
            <strong>{money(summary.total)}</strong>
          </span>
        </div>
      </section>

      <section className="panel bill-detail-panel">
        <div className="panel__heading">
          <div>
            <span className="panel__kicker">
              <ListChecks size={15} /> Visual verification
            </span>
            <h2>Matched transactions</h2>
          </div>
          {summary.transactionCount > 0 ? (
            <span className="match-health match-health--ok">
              <CheckCircle2 size={14} /> Pattern active
            </span>
          ) : (
            <span className="match-health match-health--warning">
              <AlertTriangle size={14} /> Review pattern
            </span>
          )}
        </div>
        <TransactionTable transactions={summary.transactions} />
      </section>
    </>
  );
}

interface BillBookViewProps {
  billBook: BillBook;
  fileName: string;
  envelope: ConfigEnvelope;
  onConfigure: () => void;
}

export default function BillBookView({
  billBook,
  fileName,
  envelope,
  onConfigure,
}: BillBookViewProps) {
  const visibleSummaries = useMemo(
    () =>
      billBook.summaries.filter(
        (summary) =>
          summary.transactionType.showInSummary || summary.transactionCount > 0,
      ),
    [billBook.summaries],
  );
  const [activeId, setActiveId] = useState("summary");

  useEffect(() => {
    if (
      activeId !== "summary" &&
      activeId !== "unmatched" &&
      !visibleSummaries.some((summary) => summary.transactionType.id === activeId)
    ) {
      setActiveId("summary");
    }
  }, [activeId, visibleSummaries]);

  const selected = visibleSummaries.find(
    (summary) => summary.transactionType.id === activeId,
  );
  const expectedSummaries = visibleSummaries.filter(
    (item) => item.transactionType.showInSummary,
  );
  const expectedTransactions = expectedSummaries.flatMap((item) => item.transactions);
  const incomeTotal = expectedTransactions
    .filter((transaction) => transaction.kind === "income")
    .reduce((total, transaction) => total + Number(transaction.amount), 0);
  const expenseTotal = expectedTransactions
    .filter((transaction) => transaction.kind === "expense")
    .reduce((total, transaction) => total + Number(transaction.amount), 0);
  const missingCount = visibleSummaries.filter(
    (item) => item.transactionType.showInSummary && item.transactionCount === 0,
  ).length;

  return (
    <div className="content bill-book">
      <section className="bill-book__intro">
        <div>
          <span className="eyebrow">Accounting workspace</span>
          <h1>Transaction types</h1>
          <p>
            {fileName} · {envelope.source}
            {envelope.portable ? " · portable mode" : ""} · verify every recurring bill
            before using its annual total.
          </p>
        </div>
        <button className="button button--primary" onClick={onConfigure}>
          <Settings2 size={16} /> Configure types
        </button>
      </section>

      <div className="bill-tabs" role="tablist" aria-label="Transaction types">
        <button
          role="tab"
          aria-selected={activeId === "summary"}
          className={activeId === "summary" ? "bill-tab bill-tab--active" : "bill-tab"}
          onClick={() => setActiveId("summary")}
        >
          All bills
          <span>{visibleSummaries.length}</span>
        </button>
        {visibleSummaries.map((summary) => (
          <button
            key={summary.transactionType.id}
            role="tab"
            aria-selected={activeId === summary.transactionType.id}
            className={
              activeId === summary.transactionType.id
                ? "bill-tab bill-tab--active"
                : "bill-tab"
            }
            onClick={() => setActiveId(summary.transactionType.id)}
          >
            <i style={{ background: summary.transactionType.color }} />
            {summary.transactionType.name}
            <span>{summary.transactionCount}</span>
          </button>
        ))}
        <button
          role="tab"
          aria-selected={activeId === "unmatched"}
          className={activeId === "unmatched" ? "bill-tab bill-tab--active" : "bill-tab"}
          onClick={() => setActiveId("unmatched")}
        >
          Unmatched
          <span>{billBook.unmatched.length}</span>
        </button>
      </div>

      {activeId === "summary" && (
        <>
          <section className="bill-summary-metrics">
            <article>
              <small>Matched income</small>
              <strong>{money(incomeTotal)}</strong>
              <span>Across expected income types</span>
            </article>
            <article>
              <small>Matched expenses</small>
              <strong>{money(expenseTotal)}</strong>
              <span>Across expected bill types</span>
            </article>
            <article className={missingCount > 0 ? "metric-warning" : ""}>
              <small>Patterns needing review</small>
              <strong>{missingCount}</strong>
              <span>Expected types with no matches</span>
            </article>
          </section>

          <section className="panel bill-summary-panel">
            <div className="panel__heading">
              <div>
                <span className="panel__kicker">
                  <ListChecks size={15} /> Annual roll-up
                </span>
                <h2>All configured totals</h2>
              </div>
              <span className="summary-note">Select a row to inspect transactions</span>
            </div>
            <div className="table-scroll">
              <table className="summary-table">
                <thead>
                  <tr>
                    <th>Transaction type</th>
                    <th>Pattern</th>
                    <th>Matches</th>
                    <th>Annual total</th>
                    <th><span className="visually-hidden">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSummaries.map((summary) => (
                    <tr
                      key={summary.transactionType.id}
                      className={summary.transactionCount === 0 ? "row-missing" : ""}
                      onClick={() => setActiveId(summary.transactionType.id)}
                    >
                      <td>
                        <span className="summary-name">
                          <i style={{ background: summary.transactionType.color }} />
                          <span>
                            <strong>{summary.transactionType.name}</strong>
                          </span>
                        </span>
                      </td>
                      <td>
                        <code>{summary.transactionType.patterns[0]}</code>
                        {summary.transactionType.patterns.length > 1 && (
                          <small className="more-patterns">
                            +{summary.transactionType.patterns.length - 1} more
                          </small>
                        )}
                      </td>
                      <td>
                        {summary.transactionCount === 0 ? (
                          <span className="zero-match">
                            <AlertTriangle size={13} /> No matches
                          </span>
                        ) : (
                          summary.transactionCount
                        )}
                      </td>
                      <td className="amount">{money(summary.total)}</td>
                      <td><ArrowRight size={15} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {selected && <DetailView summary={selected} />}

      {activeId === "unmatched" && (
        <section className="panel bill-detail-panel">
          <div className="panel__heading">
            <div>
              <span className="panel__kicker">
                <FileSearch size={15} /> Review queue
              </span>
              <h2>Unmatched transactions</h2>
            </div>
            <button className="filter-button" onClick={onConfigure}>
              <Settings2 size={14} /> Add a matching type
            </button>
          </div>
          <TransactionTable transactions={billBook.unmatched} />
        </section>
      )}
    </div>
  );
}

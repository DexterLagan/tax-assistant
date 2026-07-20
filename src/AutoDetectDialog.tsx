import {
  ArrowLeft,
  CheckSquare2,
  Search,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { DetectedTransactionType } from "./types";

interface AutoDetectDialogProps {
  open: boolean;
  fileName: string;
  detections: DetectedTransactionType[];
  existingTypeCount: number;
  initialStep: "prompt" | "review";
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onUseCurrent: () => void;
  onApply: (
    selected: DetectedTransactionType[],
    clearExisting: boolean,
  ) => Promise<void>;
}

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

function dateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

export default function AutoDetectDialog({
  open,
  fileName,
  detections,
  existingTypeCount,
  initialStep,
  busy,
  error,
  onCancel,
  onUseCurrent,
  onApply,
}: AutoDetectDialogProps) {
  const [step, setStep] = useState<"prompt" | "review">("prompt");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [clearExisting, setClearExisting] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep(initialStep);
    setSelectedIds(new Set(detections.map((item) => item.transactionType.id)));
    setClearExisting(false);
    setQuery("");
  }, [detections, initialStep, open]);

  const visibleDetections = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return detections;
    return detections.filter((item) =>
      [
        item.transactionType.name,
        item.transactionType.direction,
        item.existingType ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [detections, query]);

  if (!open) return null;

  const selected = detections.filter((item) =>
    selectedIds.has(item.transactionType.id),
  );
  const visibleSelectedCount = visibleDetections.filter((item) =>
    selectedIds.has(item.transactionType.id),
  ).length;
  const filtered = query.trim().length > 0;
  const selectedToApply = filtered
    ? visibleDetections.filter((item) => selectedIds.has(item.transactionType.id))
    : selected;
  const typesToCreate = clearExisting
    ? selectedToApply.length
    : selectedToApply.filter((item) => !item.existingType).length;
  const typeCountLabel = `${typesToCreate} ${
    typesToCreate === 1 ? "transaction type" : "transaction types"
  }`;
  const resultingTypeCount = clearExisting
    ? selectedToApply.length
    : existingTypeCount + typesToCreate;

  function toggle(identifier: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(identifier)) next.delete(identifier);
      else next.add(identifier);
      return next;
    });
  }

  function setVisibleSelection(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      visibleDetections.forEach((item) => {
        if (checked) next.add(item.transactionType.id);
        else next.delete(item.transactionType.id);
      });
      return next;
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className={`detect-dialog detect-dialog--${step}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detect-title"
      >
        {step === "prompt" ? (
          <>
            <button
              className="icon-button detect-dialog__close"
              onClick={onCancel}
              aria-label="Cancel CSV import"
            >
              <X size={19} />
            </button>
            <div className="detect-prompt__icon">
              <Sparkles size={25} />
            </div>
            <span className="panel__kicker">Smart CSV import</span>
            <h2 id="detect-title">Auto-detect transaction types?</h2>
            <p>
              Tax Assistant found{" "}
              <strong>
                {detections.length} unique{" "}
                {detections.length === 1 ? "description" : "descriptions"}
              </strong>{" "}
              in <b>{fileName}</b>. Review them and choose which ones should become
              reusable transaction types.
            </p>
            <div className="detect-prompt__note">
              Nothing changes until you approve the review. You can also keep using
              your current transaction types.
            </div>
            <footer className="detect-prompt__actions">
              <button
                className="button button--secondary"
                onClick={onUseCurrent}
                disabled={busy}
              >
                No, use current types
              </button>
              <button
                className="button button--primary"
                onClick={() => setStep("review")}
                disabled={busy}
              >
                Yes, review types
              </button>
            </footer>
          </>
        ) : (
          <>
            <header className="config-dialog__header">
              <div>
                <span className="panel__kicker">
                  <Sparkles size={15} /> Smart CSV import
                </span>
                <h2 id="detect-title">Review detected transaction types</h2>
                <p>
                  Every unique description is selected. Uncheck anything you do not
                  want to keep as a reusable preset.
                </p>
              </div>
              <button
                className="icon-button"
                onClick={onCancel}
                aria-label="Cancel CSV import"
                disabled={busy}
              >
                <X size={19} />
              </button>
            </header>

            <div className="detect-toolbar">
              <label className="detect-search">
                <Search size={15} />
                <input
                  type="search"
                  placeholder="Filter detected types"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <button
                className="filter-button"
                onClick={() => setVisibleSelection(true)}
                disabled={visibleDetections.length === 0}
              >
                <CheckSquare2 size={14} /> {filtered ? "Select shown" : "Select all"}
              </button>
              <button
                className="filter-button"
                onClick={() => setVisibleSelection(false)}
                disabled={visibleDetections.length === 0}
              >
                <Square size={14} /> {filtered ? "Deselect shown" : "Select none"}
              </button>
              <span className="detect-toolbar__count">
                {filtered ? (
                  <>
                    <strong>
                      {visibleSelectedCount} of {visibleDetections.length}
                    </strong>{" "}
                    shown selected ·{" "}
                    <strong>{selectedToApply.length} will be imported</strong>
                  </>
                ) : (
                  <>
                    <strong>
                      {selected.length} of {detections.length}
                    </strong>{" "}
                    selected
                  </>
                )}
              </span>
            </div>

            <div className="detect-list" role="list">
              {visibleDetections.map((item) => {
                const definition = item.transactionType;
                const checked = selectedIds.has(definition.id);
                return (
                  <label
                    className={`detect-row ${checked ? "detect-row--selected" : ""}`}
                    key={definition.id}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(definition.id)}
                    />
                    <span
                      className="detect-row__dot"
                      style={{ background: definition.color }}
                    />
                    <span className="detect-row__name">
                      <strong>{definition.name}</strong>
                      <small>
                        {item.existingType
                          ? `Already covered by “${item.existingType}”`
                          : "New transaction type"}
                      </small>
                    </span>
                    <span className={`direction direction--${definition.direction}`}>
                      {definition.direction}
                    </span>
                    <span className="detect-row__period">
                      {dateLabel(item.firstDate)}
                      {item.firstDate !== item.lastDate
                        ? ` – ${dateLabel(item.lastDate)}`
                        : ""}
                    </span>
                    <span className="detect-row__count">
                      <strong>{item.transactionCount}</strong>
                      <small>{item.transactionCount === 1 ? "entry" : "entries"}</small>
                    </span>
                    <strong className="detect-row__total">
                      {currency.format(Number(item.total))}
                    </strong>
                  </label>
                );
              })}
              {visibleDetections.length === 0 && (
                <div className="empty-state detect-list__empty">
                  <Search size={24} />
                  <h3>No matching descriptions</h3>
                  <p>Try a different filter.</p>
                </div>
              )}
            </div>

            <div className="detect-options">
              <label className="detect-clear">
                <input
                  type="checkbox"
                  checked={clearExisting}
                  onChange={(event) => setClearExisting(event.target.checked)}
                />
                <span>
                  <strong>Clear existing transaction types</strong>
                  <small>
                    Start fresh and replace the current configuration with only the
                    checked types above.
                  </small>
                </span>
              </label>
              {!clearExisting && detections.some((item) => item.existingType) && (
                <p>
                  Existing matches are retained without duplicates. New exact-match
                  types are placed before broader presets.
                </p>
              )}
              {filtered && !clearExisting && existingTypeCount > 0 && (
                <p>
                  The filter limits new imports only. Your {existingTypeCount} current{" "}
                  {existingTypeCount === 1 ? "type remains" : "types remain"}. Select{" "}
                  <strong>Clear existing transaction types</strong> to finish with only
                  the filtered selection.
                </p>
              )}
            </div>

            <footer className="config-dialog__footer">
              <button
                className="text-button detect-back"
                onClick={() => setStep("prompt")}
                disabled={busy}
              >
                <ArrowLeft size={15} /> Back
              </button>
              <span className={error ? "config-message detect-error" : "config-path"}>
                {error ??
                  (clearExisting
                    ? `${typeCountLabel} will replace the current configuration. Result: ${resultingTypeCount}.`
                    : existingTypeCount > 0
                      ? `${typeCountLabel} will be added; ${existingTypeCount} current ${
                          existingTypeCount === 1 ? "type remains" : "types remain"
                        }. Result: ${resultingTypeCount}.`
                      : `${typeCountLabel} will be added. Result: ${resultingTypeCount}.`)}
              </span>
              <button
                className="button button--secondary"
                onClick={onCancel}
                disabled={busy}
              >
                Cancel import
              </button>
              <button
                className="button button--primary"
                onClick={() => onApply(selectedToApply, clearExisting)}
                disabled={busy || selectedToApply.length === 0}
              >
                <Sparkles size={15} />
                {busy
                  ? "Applying…"
                  : !clearExisting && typesToCreate === 0
                    ? "Use current types"
                  : filtered
                    ? `${clearExisting ? "Replace with" : "Add"} ${
                        clearExisting ? selectedToApply.length : typesToCreate
                      } shown ${
                        (clearExisting ? selectedToApply.length : typesToCreate) === 1
                          ? "type"
                          : "types"
                      }`
                    : "Apply and open dashboard"}
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

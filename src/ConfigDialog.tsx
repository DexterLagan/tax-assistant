import {
  Download,
  FileJson2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { AppConfig, ConfigEnvelope, TransactionType } from "./types";

interface ConfigDialogProps {
  open: boolean;
  config: AppConfig;
  envelope: ConfigEnvelope;
  onClose: () => void;
  onSave: (config: AppConfig) => Promise<void>;
  onImport: () => Promise<AppConfig | null>;
  onExport: (config: AppConfig) => Promise<boolean>;
  onRestore: () => Promise<AppConfig>;
}

const palette = [
  "#4e6f62",
  "#c98458",
  "#d1ad58",
  "#6a7f9d",
  "#8d6d88",
  "#5f8796",
];

function cloneConfig(config: AppConfig): AppConfig {
  return structuredClone(config);
}

function newDefinition(index: number): TransactionType {
  return {
    id: `custom-${crypto.randomUUID?.() ?? Date.now()}`,
    name: "New transaction type",
    patterns: [""],
    matchMode: "contains",
    direction: "expense",
    minimumAmount: null,
    claimPercentage: 100,
    enabled: true,
    showInSummary: true,
    color: palette[index % palette.length],
  };
}

export default function ConfigDialog({
  open,
  config,
  envelope,
  onClose,
  onSave,
  onImport,
  onExport,
  onRestore,
}: ConfigDialogProps) {
  const [draft, setDraft] = useState(() => cloneConfig(config));
  const [selectedId, setSelectedId] = useState(config.transactionTypes[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const next = cloneConfig(config);
    setDraft(next);
    setSelectedId((current) =>
      next.transactionTypes.some((item) => item.id === current)
        ? current
        : (next.transactionTypes[0]?.id ?? ""),
    );
    setMessage(null);
  }, [config, open]);

  const selected = useMemo(
    () => draft.transactionTypes.find((item) => item.id === selectedId) ?? null,
    [draft.transactionTypes, selectedId],
  );

  if (!open) return null;

  function updateSelected(patch: Partial<TransactionType>) {
    setDraft((current) => ({
      ...current,
      transactionTypes: current.transactionTypes.map((item) =>
        item.id === selectedId ? { ...item, ...patch } : item,
      ),
    }));
  }

  function addDefinition() {
    const definition = newDefinition(draft.transactionTypes.length);
    setDraft((current) => ({
      ...current,
      transactionTypes: [...current.transactionTypes, definition],
    }));
    setSelectedId(definition.id);
  }

  function deleteDefinition() {
    if (!selected) return;
    if (!window.confirm(`Delete “${selected.name}”? This cannot be undone after saving.`)) {
      return;
    }
    const index = draft.transactionTypes.findIndex((item) => item.id === selected.id);
    const next = draft.transactionTypes.filter((item) => item.id !== selected.id);
    setDraft((current) => ({ ...current, transactionTypes: next }));
    setSelectedId(next[Math.min(index, next.length - 1)]?.id ?? "");
  }

  async function clearDefinitions() {
    if (
      !window.confirm(
        "Clear and save every transaction type now? This immediately replaces the saved configuration with an empty one.",
      )
    ) {
      return;
    }
    const cleared = { ...draft, transactionTypes: [] };
    setBusy(true);
    setMessage(null);
    try {
      await onSave(cleared);
      setDraft(cleared);
      setSelectedId("");
      setMessage("All transaction types cleared and saved.");
    } catch (cause) {
      setMessage(
        typeof cause === "string"
          ? cause
          : "Could not clear the saved configuration.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    setBusy(true);
    setMessage(null);
    try {
      await onSave(draft);
      onClose();
    } catch (cause) {
      setMessage(typeof cause === "string" ? cause : "Could not save the configuration.");
    } finally {
      setBusy(false);
    }
  }

  async function importDraft() {
    setBusy(true);
    setMessage(null);
    try {
      const imported = await onImport();
      if (imported) {
        setDraft(cloneConfig(imported));
        setSelectedId(imported.transactionTypes[0]?.id ?? "");
        setMessage("Configuration loaded. Review it, then choose Save configuration.");
      }
    } catch (cause) {
      setMessage(typeof cause === "string" ? cause : "Could not import that configuration.");
    } finally {
      setBusy(false);
    }
  }

  async function exportDraft() {
    setBusy(true);
    setMessage(null);
    try {
      if (await onExport(draft)) {
        setMessage("Portable configuration exported.");
      }
    } catch (cause) {
      setMessage(typeof cause === "string" ? cause : "Could not export the configuration.");
    } finally {
      setBusy(false);
    }
  }

  async function restoreDefaults() {
    if (!window.confirm("Replace this draft with the original Tax Helper presets?")) return;
    setBusy(true);
    setMessage(null);
    try {
      const defaults = await onRestore();
      setDraft(cloneConfig(defaults));
      setSelectedId(defaults.transactionTypes[0]?.id ?? "");
      setMessage("Defaults restored in this draft. Choose Save configuration to keep them.");
    } catch (cause) {
      setMessage(typeof cause === "string" ? cause : "Could not restore defaults.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="config-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="config-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="config-dialog__header">
          <div>
            <span className="panel__kicker">
              <FileJson2 size={15} /> Portable presets
            </span>
            <h2 id="config-title">Transaction type configuration</h2>
            <p>
              First matching enabled type wins. Patterns are case-insensitive by default.
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close configuration">
            <X size={19} />
          </button>
        </header>

        <div className="config-toolbar">
          <button className="filter-button" onClick={importDraft} disabled={busy}>
            <Upload size={14} /> Import .conf
          </button>
          <button className="filter-button" onClick={exportDraft} disabled={busy}>
            <Download size={14} /> Export .conf
          </button>
          <button className="filter-button" onClick={restoreDefaults} disabled={busy}>
            <RotateCcw size={14} /> Original presets
          </button>
          <button
            className="danger-button config-toolbar__danger"
            onClick={clearDefinitions}
            disabled={busy || draft.transactionTypes.length === 0}
          >
            <Trash2 size={14} /> Clear all
          </button>
          <span className="config-source" title={envelope.path ?? undefined}>
            {envelope.source}
            {envelope.portable ? " · portable mode" : ""}
          </span>
        </div>

        <div className="config-dialog__body">
          <aside className="type-list">
            <button className="button button--secondary type-list__add" onClick={addDefinition}>
              <Plus size={15} /> New transaction type
            </button>
            <div className="type-list__scroll">
              {draft.transactionTypes.map((item) => (
                <button
                  key={item.id}
                  className={`type-list__item ${
                    selectedId === item.id ? "type-list__item--active" : ""
                  }`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="type-list__dot" style={{ background: item.color }} />
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.enabled ? "Enabled" : "Disabled"} · {item.patterns.length}{" "}
                      {item.patterns.length === 1 ? "pattern" : "patterns"}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <div className="type-editor">
            {selected ? (
              <>
                <div className="form-grid form-grid--name">
                  <label>
                    <span>Display name</span>
                    <input
                      value={selected.name}
                      onChange={(event) => updateSelected({ name: event.target.value })}
                    />
                  </label>
                  <label className="color-field">
                    <span>Colour</span>
                    <input
                      type="color"
                      value={selected.color}
                      onChange={(event) => updateSelected({ color: event.target.value })}
                    />
                  </label>
                </div>

                <label className="form-field">
                  <span>Patterns · one per line</span>
                  <textarea
                    rows={5}
                    value={selected.patterns.join("\n")}
                    onChange={(event) =>
                      updateSelected({ patterns: event.target.value.split("\n") })
                    }
                    placeholder="HYDRO OTTAWA"
                    spellCheck={false}
                  />
                  <small>
                    Any pattern may match. Regex mode supports advanced expressions such as{" "}
                    <code>hydro[- ](ottawa|one)</code>.
                  </small>
                </label>

                <div className="form-grid">
                  <label>
                    <span>Matching method</span>
                    <select
                      value={selected.matchMode}
                      onChange={(event) =>
                        updateSelected({
                          matchMode: event.target.value as TransactionType["matchMode"],
                        })
                      }
                    >
                      <option value="contains">Contains text</option>
                      <option value="regex">Regular expression</option>
                    </select>
                  </label>
                  <label>
                    <span>Transaction direction</span>
                    <select
                      value={selected.direction ?? ""}
                      onChange={(event) =>
                        updateSelected({
                          direction:
                            (event.target.value as TransactionType["direction"]) || null,
                        })
                      }
                    >
                      <option value="">Income or expense</option>
                      <option value="expense">Expense only</option>
                      <option value="income">Income only</option>
                    </select>
                  </label>
                </div>

                <div className="form-grid">
                  <label>
                    <span>Minimum amount</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={selected.minimumAmount ?? ""}
                      placeholder="No minimum"
                      onChange={(event) =>
                        updateSelected({
                          minimumAmount: event.target.value || null,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Claim percentage</span>
                    <div className="suffix-input">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={selected.claimPercentage}
                        onChange={(event) =>
                          updateSelected({
                            claimPercentage: Math.min(
                              100,
                              Math.max(0, Number(event.target.value)),
                            ),
                          })
                        }
                      />
                      <span>%</span>
                    </div>
                  </label>
                </div>

                <div className="toggle-grid">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={selected.enabled}
                      onChange={(event) => updateSelected({ enabled: event.target.checked })}
                    />
                    <span>
                      <strong>Enabled</strong>
                      <small>Use this type when matching imported transactions.</small>
                    </span>
                  </label>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={selected.showInSummary}
                      onChange={(event) =>
                        updateSelected({ showInSummary: event.target.checked })
                      }
                    />
                    <span>
                      <strong>Show even with no matches</strong>
                      <small>Useful for spotting a bill whose bank description changed.</small>
                    </span>
                  </label>
                </div>

                <button className="danger-button" onClick={deleteDefinition}>
                  <Trash2 size={14} /> Delete transaction type
                </button>
              </>
            ) : (
              <div className="empty-state">
                <FileJson2 size={28} />
                <h3>No transaction type selected</h3>
                <p>Add a transaction type to define its patterns.</p>
              </div>
            )}
          </div>
        </div>

        <footer className="config-dialog__footer">
          <span className={message ? "config-message" : "config-path"}>
            {message ?? envelope.path ?? "Defaults are embedded in the app until saved."}
          </span>
          <button className="button button--secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="button button--primary" onClick={saveDraft} disabled={busy}>
            <Save size={15} /> {busy ? "Working…" : "Save configuration"}
          </button>
        </footer>
      </section>
    </div>
  );
}

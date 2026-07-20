# Tax Assistant development plan

## Product intent

Tax Assistant helps a Canadian taxpayer turn a bank transaction export into a
reviewed, defensible set of income and expense totals. Its job is to reduce
clerical work and make uncertainty visible. It should not silently make tax
decisions for the user.

The product principles are:

1. **Local first.** Raw financial data stays on the user's computer.
2. **Explainable.** Every automatic category can identify the rule that matched.
3. **Reviewable.** Uncertain or unmatched transactions are prominent.
4. **Exact.** Money is stored and calculated as decimal values, never binary
   floating point.
5. **Portable.** Windows and macOS are first-class release targets.
6. **Year-based.** A workspace represents one tax year and preserves its inputs,
   rules, review state, and outputs.

## What carries forward from Tax Helper

The original Racket application established a strong, practical workflow:

- import a simple bank CSV;
- classify income and bill descriptions through editable pattern lists;
- display the transactions for inspection;
- total named categories; and
- preserve category configuration between sessions.

Its small codebase and direct interaction model make the workflow easy to
understand. The most valuable design choice is that categorization is based on
visible user rules rather than an opaque model.

The new application should improve several constraints of the original:

- parsing, UI state, classification, persistence, and totals should not live in
  one module;
- CSV parsing must correctly handle quoting, headers, alternate bank formats,
  and row-level errors;
- money must use an exact decimal representation;
- matching should be normalized, case-insensitive, ordered, and attributable to
  a specific rule;
- the app should avoid a fixed set of UI slots for categories;
- imports should be idempotent and duplicates should be detectable;
- totals and charts should derive from one tested analysis layer; and
- release packaging, automated tests, accessibility, and privacy behavior need
  to be part of the product rather than afterthoughts.

## Proposed architecture

```text
React + TypeScript UI
        │ typed Tauri commands/events
        ▼
Tauri application boundary
        │
        ├── tax-assistant-core
        │     CSV adapters → normalization → rules → analysis
        │
        ├── workspace persistence (SQLite)
        └── import/export and operating-system services
```

### Rust crates

- `tax-assistant-core`: domain types, importer interfaces, normalization,
  categorization, summaries, and validation. No dependency on Tauri or a
  database.
- `src-tauri`: desktop commands, file dialogs, persistence adapters, migrations,
  secure settings, and application lifecycle.
- A future `tax-assistant-cli` may reuse the core for fixture conversion and
  regression testing, but it is not needed for the first release.

### Interface

React owns transient presentation state only. Financial calculations,
deduplication, categorization, and validation remain in Rust. Frontend values
cross the Tauri boundary as decimal strings and are formatted for display.

## Domain model

A persisted workspace should contain:

- tax year, display name, locale, currency, timestamps, and schema version;
- import batches, including source name, content hash, import timestamp, and
  adapter used;
- normalized transactions with source row, date, description, exact amount,
  direction, stable fingerprint, category, review status, notes, and optional
  business-use percentage;
- ordered categorization rules with match type, normalized pattern, category,
  direction constraint, enabled state, and priority;
- user-defined categories with kind, color, display order, and optional tax-form
  mapping; and
- immutable audit events for important classification and adjustment changes.

Raw CSV contents should not be retained unless the user explicitly chooses to
archive them. A content hash is sufficient for duplicate-import detection.

## Delivery phases

### Phase 0 — foundation and vertical slice

Status: complete in the initial repository milestone.

- Rust workspace and isolated core crate
- Tauri 2 desktop shell
- React/TypeScript dashboard
- exact decimal transaction model
- generic four-column CSV importer
- conservative starter rules
- summary charts and review queue
- synthetic fixture, tests, documentation, and CI

Exit criteria: a contributor can build the project, import the sample CSV in
Tauri, and obtain deterministic totals covered by core tests.

### Phase 1 — durable single-year workspace

- SQLite schema and migrations
- create, open, rename, and archive workspaces
- persist transactions, categories, rules, and review state
- content-hash and transaction-fingerprint duplicate detection
- undoable category edits and multi-select bulk editing
- transaction search, filters, sorting, and pagination or virtualization
- autosave with visible state and recovery from interrupted writes

Exit criteria: closing and reopening the app preserves a reviewed tax year, and
reimporting the same file does not duplicate transactions.

### Phase 2 — robust bank imports

- import preview with detected columns and date/amount interpretation
- row-level warning collection instead of failing at the first bad row
- adapters for common Canadian bank and credit-card exports
- signed amount, separate debit/credit, and multi-account support
- date range and tax-year validation
- transfer, refund, reimbursement, and credit-card-payment handling
- reusable user-created column mappings

Exit criteria: representative fixtures from supported institutions import
correctly, ambiguities are shown before commit, and malformed rows are
recoverable.

### Phase 3 — rules and review workflow

Status: in progress. The ordered contains/regular-expression editor, original
Tax Helper presets, per-type visual verification, annual roll-up, unmatched
queue, and portable `.conf` persistence are implemented.

- category and rule editor
- contains, exact, starts-with, and regular-expression matching
- rule priority, preview, conflict reporting, and match counts
- learn-from-edit flow that proposes a transparent rule
- dedicated queues for uncategorized, conflicting, and unusual transactions
- split transactions and partial business-use allocation
- notes, attachments metadata, and review completion indicators

Exit criteria: users can explain every automatic classification and resolve the
entire review queue without editing configuration files.

### Phase 4 — tax-oriented reports and export

- income and expense summaries by month, category, and account
- configurable Canadian self-employment category mappings
- comparative and anomaly views
- printable annual summary
- CSV export of normalized and reviewed transactions
- accountant handoff bundle with report, transaction CSV, and methodology notes
- clear separation between source amounts, adjustments, and reportable totals

Exit criteria: exported totals reconcile to the workspace and can be independently
verified from the normalized transaction export.

### Phase 5 — release quality

- keyboard and screen-reader accessibility pass
- performance testing with large transaction sets
- threat model and privacy review
- database backup, restore, and schema-upgrade recovery tests
- Windows MSI/NSIS and macOS DMG builds
- code signing, notarization, checksums, and release notes
- opt-in update checks with a documented release channel

Exit criteria: signed Windows and macOS artifacts are produced from a tagged
commit by CI and pass a clean-machine installation checklist.

## Testing strategy

- **Unit tests:** parsing, normalization, decimal calculations, rule precedence,
  fingerprints, and tax-year validation.
- **Fixture tests:** anonymized exports for every supported bank adapter,
  including quoted commas, alternate dates, refunds, duplicates, and invalid
  rows.
- **Property tests:** amounts never change during normalization; import order
  does not change summaries; reimport is idempotent.
- **Persistence tests:** forward migrations, rollback recovery, backup/restore,
  and concurrent-open protection.
- **Tauri integration tests:** command payloads and errors at the Rust boundary.
- **UI tests:** import preview, review workflows, keyboard operation, charts'
  text alternatives, and export confirmation.
- **Release smoke tests:** install, open, import fixture, save, reopen, export,
  uninstall on each supported operating system.

Real customer financial data must never be committed as a fixture.

## Initial release definition of done

Version 1.0 is ready when a user can:

1. install a signed build on a supported Windows or macOS version;
2. create a workspace for a selected Canadian tax year;
3. preview and import a supported bank CSV without uploading it;
4. identify duplicates and recover from malformed rows;
5. review, edit, split, and annotate transactions;
6. create and test transparent categorization rules;
7. reconcile income and expense totals to the imported sources;
8. view accessible monthly and category charts;
9. export a readable annual report and normalized transaction CSV; and
10. back up and restore the workspace.

All calculation and importer suites must pass, there must be no known data-loss
defect, and the product must state that it is not a substitute for professional
tax advice.

## Decisions to revisit after Phase 1

- Which Canadian banks receive maintained first-party adapters?
- Should T1/T2125 mappings be built in, provided as templates, or remain
  completely user-configurable?
- Is encrypted attachment storage in scope, or should the app only link to
  documents managed elsewhere?
- Is optional end-to-end encrypted sync worth the security and support burden?
- What is the minimum supported Windows and macOS version for signed releases?

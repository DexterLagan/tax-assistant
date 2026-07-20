# Tax Assistant

Tax Assistant is a local-first desktop application for reviewing Canadian
personal and self-employment transactions before income tax filing. It imports
bank CSV exports, applies transparent categorization rules, and summarizes
income and expenses without sending financial data to a server.

This repository is a modern successor to
[Tax Helper](https://github.com/DexterLagan/tax-helper), preserving its practical
CSV-to-category workflow while replacing the original Racket GUI with a Rust
domain layer, a Tauri desktop shell, and a React dashboard.

> Tax Assistant is an organizational tool, not tax or accounting advice. Verify
> classifications and totals against source documents and current CRA guidance.

## Current milestone

The current preview includes:

- CSV import with header aliases and support for Tax Helper's four-column format
- Review-first auto-detection of distinct transaction descriptions in an imported CSV
- Exact decimal arithmetic for transaction and summary amounts
- The original Tax Helper presets, recovered from the Racket source
- Ordered, explainable text and regular-expression matching
- An annual roll-up plus a transaction-by-transaction view for every type
- A visual warning when an expected bill has no matches
- An editor for adding, changing, disabling, deleting, or clearing transaction types
- Versioned `.conf` import, export, and local persistence
- Income, expense, net, monthly, and expense-category summaries
- A desktop dashboard with interactive charts and a review queue
- Synthetic demo data, unit tests, and continuous integration

CSV data is currently processed in memory. Durable year workspaces,
reconciliation, report exports, and commercially signed installers are planned
next.

## Technology

- **Core:** Rust 2024, `rust_decimal`, `chrono`, and `csv`
- **Desktop:** Tauri 2
- **Interface:** React 19, TypeScript, Vite, and Apache ECharts
- **Package manager:** pnpm 11

The Rust core is intentionally independent of Tauri so import and calculation
logic can be tested without a windowing environment.

## Run locally

Prerequisites:

- Node.js 22 or newer
- pnpm 11
- the stable Rust toolchain
- Tauri's platform prerequisites

On macOS, first install Xcode command-line tools and accept the Xcode license:

```sh
sudo xcodebuild -license accept
```

Then:

```sh
pnpm install
pnpm tauri dev
```

For browser-only interface work, run `pnpm dev`. The bundled demo data will be
shown, but CSV import requires the Tauri desktop runtime.

## Verify

```sh
pnpm build
cargo fmt --all -- --check
cargo test -p tax-assistant-core
```

To try the importer, select
[`fixtures/sample-transactions.csv`](fixtures/sample-transactions.csv) from the
dashboard's **Import CSV** button while running the desktop app.

### Auto-detect transaction types

After a CSV is parsed, Tax Assistant asks whether to auto-detect its transaction
types. Choose **Yes, review types** to see every distinct bank description,
separated by income or expense direction. All are selected initially, and the
review includes the number of matching entries, total, date range, and any
existing preset that already covers the description.

Leave **Clear existing transaction types** unchecked to add only newly detected
types while preserving existing settings and avoiding duplicates. Check it to
replace the configuration with only the selected detected types. Generated
presets use exact, case-insensitive regular expressions so similarly named bank
descriptions do not accidentally overlap. Standalone bank reference numbers
with six or more digits are treated as per-transaction values: they are removed
from the displayed type name and represented by a numeric wildcard in its
matching pattern. Short numbers remain part of the name.

Filtering the review changes the visible selection count. While a filter is
active, **Select shown** and **Deselect shown** affect only the matching rows;
only visible checked rows are imported when **Apply** is chosen. Clear the
filter before applying when selections across the entire list should be used.

Use **Auto-detect types** in the sidebar to repeat the review for the current
CSV. The **Clear all** action in Transaction types empties the configuration
draft; choose **Save configuration** to make that change permanent.

### Interface size

Use the **Interface size** controls at the bottom of the sidebar, or the
standard keyboard shortcuts:

- `Command`/`Ctrl` + `+` makes the interface larger.
- `Command`/`Ctrl` + `-` makes it smaller.
- `Command`/`Ctrl` + `0` resets it to 100%.

The selected size is remembered on that computer.

## Review bills and income

After importing a CSV, open **Bills & income**:

- **All bills** is the annual roll-up from the original application.
- Each transaction-type tab shows every matched bank transaction and its total.
- **Unmatched** keeps new or changed bank descriptions visible.
- A zero beside an expected type is deliberate: it warns that a bank may have
  changed the description and the preset should be reviewed.

Open **Transaction types** to add, edit, disable, or delete definitions.
Definitions may contain several case-insensitive text patterns or regular
expressions. Types are evaluated in list order and the first enabled match wins.
The claim percentage supports adjustments such as the original Rogers 50%
calculation.

## Configuration and portable copies

Tax Assistant saves its active configuration as human-readable, versioned JSON
in a file named `tax-assistant.conf`. Use **Export .conf** to keep a copy beside
an installer on a USB stick, and **Import .conf** to restore it later.

The normal editable copy lives in the operating system's per-user application
configuration folder, because installed application folders are often
read-only. Portable lookup is also supported: if `tax-assistant.conf` already
exists beside the Windows executable, or beside the `.app` in its containing
folder on macOS, Tax Assistant loads and updates that file instead.

GitHub's **Release desktop installers** workflow builds Windows x64, macOS Apple
silicon, and macOS Intel packages. It also attaches a default
`tax-assistant.conf` containing the recovered presets. Preview packages are
currently unsigned or ad-hoc signed and may trigger an operating-system warning.

## CSV format

The importer recognizes common aliases for these fields:

| Required concept | Recognized examples |
| --- | --- |
| Date | `Date`, `Transaction Date`, `Posted Date` |
| Description | `Description`, `Transaction Name`, `Details`, `Memo` |
| Debit | `Debit`, `Debit Amount`, `Withdrawal`, `Withdrawals` |
| Credit | `Credit`, `Credit Amount`, `Deposit`, `Deposits` |

It also accepts a headerless `date,description,debit,credit` file. Supported
date formats currently include `YYYY-MM-DD`, `YYYY/MM/DD`, `MM/DD/YYYY`, and
`DD-MM-YYYY`.

## Direction

The phased roadmap, architectural boundaries, data model, and definition of
done are in [`docs/development-plan.md`](docs/development-plan.md).

## Privacy and security

Financial data should remain local by default. Future features that could
transmit data—such as cloud backup, telemetry, or AI-assisted categorization—
must be explicit opt-ins and document exactly what leaves the device.

When reporting issues, use synthetic or redacted transactions.

## License

[MIT](LICENSE)

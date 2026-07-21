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

## Install and first use

Download the installer for your computer from the
[latest GitHub release](https://github.com/DexterLagan/tax-assistant/releases/latest):

- **Windows x64:** use the `.msi` or `-setup.exe` installer.
- **Mac with Apple silicon:** use the `aarch64.dmg` package.
- **Mac with an Intel processor:** use the `x64.dmg` package.

The preview packages are not yet commercially signed or notarized, so Windows
or macOS may ask you to confirm that you trust the download. Once installed:

1. Select **Import CSV** and choose a banking transaction export.
2. Choose whether to review auto-detected transaction types.
3. Check the annual roll-up in **Bills & income** or **Annual totals**.
4. Open **Transaction types** to refine the matching rules and save them.

The bundled presets are based on the original Tax Helper application. They are
only a starting point: bank descriptions change, so review the matched rows and
the **Unmatched** tab before using any total. The **Help** item in the sidebar
opens this guide inside the app; its search box can find a feature, CSV field,
or keyboard shortcut.

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
and saves that change immediately after confirmation.

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
Tax Assistant reports raw annual totals and leaves home-office claim calculations
to tax-filing software.

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

For example:

```csv
Date,Description,Debit,Credit
2025-01-15,HYDRO OTTAWA,146.22,
2025-01-31,CLIENT PAYMENT,,1250.00
2025-02-04,"OFFICE SUPPLY STORE, OTTAWA",42.18,
```

Each row needs a date and description. Put expenses or withdrawals in the debit
column and income or deposits in the credit column; normally only one amount is
filled on a row. Blank amount cells are accepted. Descriptions containing a
comma must be enclosed in double quotes, as in the third example row.

Amounts may contain a dollar sign, thousands separators, surrounding spaces,
or accounting parentheses. Tax Assistant compares and totals their absolute
values, using the debit or credit column to determine direction.

It also accepts a headerless `date,description,debit,credit` file. Supported
date formats currently include `YYYY-MM-DD`, `YYYY/MM/DD`, `MM/DD/YYYY`, and
`DD-MM-YYYY`. A synthetic example is included at
[`fixtures/sample-transactions.csv`](fixtures/sample-transactions.csv) and is
attached to each release so the importer can be tested without real banking
data.

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

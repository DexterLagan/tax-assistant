mod analysis;
mod import;
mod model;
mod rules;

pub use analysis::analyze;
pub use import::{ImportError, import_csv};
pub use model::{
    Analysis, CategoryTotal, ImportIssue, ImportResult, MonthlyTotal, Transaction, TransactionKind,
};
pub use rules::{CategoryRule, default_rules};

/// Imports a bank CSV and immediately produces dashboard-ready totals.
///
/// This is the stable boundary used by the Tauri command layer.
pub fn import_and_analyze(csv_text: &str) -> Result<ImportResult, ImportError> {
    let transactions = import_csv(csv_text)?;
    let analysis = analyze(&transactions);

    Ok(ImportResult {
        transactions,
        analysis,
        issues: Vec::new(),
    })
}

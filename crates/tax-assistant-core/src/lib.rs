mod analysis;
mod config;
mod detection;
mod import;
mod model;
mod rules;

pub use analysis::analyze;
pub use config::{
    AppConfig, ConfigError, MatchMode, apply_config, default_config, validate_config,
};
pub use detection::{DetectedTransactionType, detect_transaction_types};
pub use import::{ImportError, import_csv};
pub use model::{
    Analysis, BillBook, CategoryTotal, ImportIssue, ImportResult, MonthlyTotal, Transaction,
    TransactionKind, TransactionType, TransactionTypeSummary,
};
pub use rules::{CategoryRule, default_rules};

/// Imports a bank CSV and immediately produces dashboard-ready totals.
///
/// This is the stable boundary used by the Tauri command layer.
///
/// # Errors
///
/// Returns an [`ImportError`] when the CSV cannot be imported or the built-in
/// configuration cannot be applied.
pub fn import_and_analyze(csv_text: &str) -> Result<ImportResult, ImportError> {
    import_and_analyze_with_config(csv_text, &default_config()).map_err(|error| match error {
        WorkspaceError::Import(error) => error,
        WorkspaceError::Config(error) => ImportError::Configuration(error.to_string()),
    })
}

#[derive(Debug, thiserror::Error)]
pub enum WorkspaceError {
    #[error(transparent)]
    Import(#[from] ImportError),
    #[error(transparent)]
    Config(#[from] ConfigError),
}

/// Reapplies a configuration to already imported transactions and recalculates
/// every bill and dashboard total.
///
/// # Errors
///
/// Returns a [`ConfigError`] when the configuration is invalid.
pub fn analyze_with_config(
    mut transactions: Vec<Transaction>,
    config: &AppConfig,
) -> Result<ImportResult, ConfigError> {
    let bill_book = apply_config(&mut transactions, config)?;
    let analysis = analyze(&transactions);

    Ok(ImportResult {
        transactions,
        analysis,
        bill_book,
        issues: Vec::new(),
    })
}

/// Imports CSV text, applies the supplied configuration, and calculates totals.
///
/// # Errors
///
/// Returns a [`WorkspaceError`] when either CSV import or configuration
/// application fails.
pub fn import_and_analyze_with_config(
    csv_text: &str,
    config: &AppConfig,
) -> Result<ImportResult, WorkspaceError> {
    let transactions = import_csv(csv_text)?;
    Ok(analyze_with_config(transactions, config)?)
}

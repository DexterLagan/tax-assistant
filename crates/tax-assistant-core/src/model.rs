use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::config::MatchMode;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TransactionKind {
    Income,
    Expense,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    pub id: String,
    pub date: NaiveDate,
    pub description: String,
    #[serde(with = "rust_decimal::serde::str")]
    pub amount: Decimal,
    pub kind: TransactionKind,
    pub category: String,
    pub matched_rule: Option<String>,
    pub source_row: usize,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryTotal {
    pub category: String,
    #[serde(with = "rust_decimal::serde::str")]
    pub amount: Decimal,
    pub transaction_count: usize,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthlyTotal {
    pub month: String,
    #[serde(with = "rust_decimal::serde::str")]
    pub income: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub expenses: Decimal,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Analysis {
    #[serde(with = "rust_decimal::serde::str")]
    pub income: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub expenses: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub net: Decimal,
    pub categorized_count: usize,
    pub uncategorized_count: usize,
    pub category_totals: Vec<CategoryTotal>,
    pub monthly_totals: Vec<MonthlyTotal>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportIssue {
    pub row: usize,
    pub message: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub transactions: Vec<Transaction>,
    pub analysis: Analysis,
    pub bill_book: BillBook,
    pub issues: Vec<ImportIssue>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionType {
    pub id: String,
    pub name: String,
    pub patterns: Vec<String>,
    pub match_mode: MatchMode,
    pub direction: Option<TransactionKind>,
    #[serde(with = "rust_decimal::serde::str_option")]
    pub minimum_amount: Option<Decimal>,
    pub claim_percentage: u8,
    pub enabled: bool,
    pub show_in_summary: bool,
    pub color: String,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionTypeSummary {
    pub transaction_type: TransactionType,
    #[serde(with = "rust_decimal::serde::str")]
    pub total: Decimal,
    #[serde(with = "rust_decimal::serde::str")]
    pub claim_total: Decimal,
    pub transaction_count: usize,
    pub transactions: Vec<Transaction>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BillBook {
    pub summaries: Vec<TransactionTypeSummary>,
    pub unmatched: Vec<Transaction>,
}

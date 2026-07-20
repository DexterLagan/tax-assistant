use std::collections::HashMap;
use std::fmt::Write as _;
use std::io::Cursor;
use std::str::FromStr;

use chrono::NaiveDate;
use csv::{ReaderBuilder, StringRecord, Trim};
use rust_decimal::Decimal;
use thiserror::Error;

use crate::model::{Transaction, TransactionKind};
use crate::rules::categorize;

const DATE_FORMATS: &[&str] = &["%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%d-%m-%Y"];

#[derive(Debug, Error)]
pub enum ImportError {
    #[error("the CSV file is empty")]
    Empty,
    #[error("the CSV header must contain date, description, debit, and credit columns")]
    MissingColumns,
    #[error("row {row}: {message}")]
    InvalidRow { row: usize, message: String },
    #[error("could not read CSV data: {0}")]
    Csv(#[from] csv::Error),
    #[error("configuration error: {0}")]
    Configuration(String),
}

#[derive(Clone, Copy)]
struct Columns {
    date: usize,
    description: usize,
    debit: usize,
    credit: usize,
}

#[derive(Clone, Copy)]
enum CsvShape {
    Header(Columns),
    Legacy(Columns),
}

#[must_use]
fn normalize_header(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .filter(char::is_ascii_alphanumeric)
        .collect()
}

fn columns_from_header(record: &StringRecord) -> Option<Columns> {
    let indices: HashMap<String, usize> = record
        .iter()
        .enumerate()
        .map(|(index, value)| (normalize_header(value), index))
        .collect();

    let find = |names: &[&str]| names.iter().find_map(|name| indices.get(*name).copied());

    Some(Columns {
        date: find(&["date", "transactiondate", "posteddate"])?,
        description: find(&["description", "transactionname", "details", "memo"])?,
        debit: find(&["debit", "debitamount", "withdrawal", "withdrawals"])?,
        credit: find(&["credit", "creditamount", "deposit", "deposits"])?,
    })
}

fn parse_date(value: &str) -> Option<NaiveDate> {
    DATE_FORMATS
        .iter()
        .find_map(|format| NaiveDate::parse_from_str(value.trim(), format).ok())
}

fn parse_amount(value: &str) -> Result<Option<Decimal>, rust_decimal::Error> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    let negative = trimmed.starts_with('(') && trimmed.ends_with(')');
    let normalized = trimmed
        .trim_matches(['(', ')'])
        .replace(['$', ','], "")
        .replace(' ', "");
    let amount = Decimal::from_str(&normalized)?.abs();
    Ok(Some(if negative { -amount } else { amount }))
}

fn parse_row(
    record: &StringRecord,
    columns: Columns,
    row_number: usize,
) -> Result<Transaction, ImportError> {
    let field = |index: usize| {
        record.get(index).ok_or_else(|| ImportError::InvalidRow {
            row: row_number,
            message: "not enough columns".to_owned(),
        })
    };

    let date_value = field(columns.date)?;
    let date = parse_date(date_value).ok_or_else(|| ImportError::InvalidRow {
        row: row_number,
        message: format!("unsupported date `{date_value}`"),
    })?;
    let description = field(columns.description)?.trim();
    if description.is_empty() {
        return Err(ImportError::InvalidRow {
            row: row_number,
            message: "description is empty".to_owned(),
        });
    }

    let debit = parse_amount(field(columns.debit)?).map_err(|error| ImportError::InvalidRow {
        row: row_number,
        message: format!("invalid debit amount: {error}"),
    })?;
    let credit = parse_amount(field(columns.credit)?).map_err(|error| ImportError::InvalidRow {
        row: row_number,
        message: format!("invalid credit amount: {error}"),
    })?;

    let (kind, amount) = match (debit, credit) {
        (Some(amount), None) if !amount.is_zero() => (TransactionKind::Expense, amount.abs()),
        (None, Some(amount)) if !amount.is_zero() => (TransactionKind::Income, amount.abs()),
        (Some(_), Some(_)) => {
            return Err(ImportError::InvalidRow {
                row: row_number,
                message: "both debit and credit contain amounts".to_owned(),
            });
        }
        _ => {
            return Err(ImportError::InvalidRow {
                row: row_number,
                message: "no non-zero debit or credit amount".to_owned(),
            });
        }
    };

    let (category, matched_rule) = categorize(description, kind);
    let mut id = String::with_capacity(48);
    let _ = write!(
        id,
        "{}-{}-{}",
        date.format("%Y%m%d"),
        row_number,
        kind_label(kind)
    );

    Ok(Transaction {
        id,
        date,
        description: description.to_owned(),
        amount,
        kind,
        category: category.to_owned(),
        matched_rule: matched_rule.map(str::to_owned),
        source_row: row_number,
    })
}

const fn kind_label(kind: TransactionKind) -> &'static str {
    match kind {
        TransactionKind::Income => "income",
        TransactionKind::Expense => "expense",
    }
}

/// Imports supported bank CSV text into normalized transactions.
///
/// # Errors
///
/// Returns an [`ImportError`] when the input is empty, required columns are
/// absent, a row is malformed, or a date or amount cannot be interpreted.
pub fn import_csv(csv_text: &str) -> Result<Vec<Transaction>, ImportError> {
    if csv_text.trim().is_empty() {
        return Err(ImportError::Empty);
    }

    let mut reader = ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .trim(Trim::All)
        .from_reader(Cursor::new(csv_text));
    let mut records = reader.records();
    let first = records.next().transpose()?.ok_or(ImportError::Empty)?;

    let shape = columns_from_header(&first).map_or(
        CsvShape::Legacy(Columns {
            date: 0,
            description: 1,
            debit: 2,
            credit: 3,
        }),
        CsvShape::Header,
    );
    let (columns, first_data_row, row_offset) = match shape {
        CsvShape::Header(columns) => (columns, None, 2),
        CsvShape::Legacy(columns) if first.len() >= 4 => (columns, Some(first), 1),
        CsvShape::Legacy(_) => return Err(ImportError::MissingColumns),
    };

    let mut transactions = Vec::new();
    if let Some(record) = first_data_row {
        transactions.push(parse_row(&record, columns, 1)?);
    }
    for (index, record) in records.enumerate() {
        transactions.push(parse_row(&record?, columns, index + row_offset)?);
    }

    if transactions.is_empty() {
        return Err(ImportError::Empty);
    }

    Ok(transactions)
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;
    use rust_decimal::Decimal;

    use super::*;

    #[test]
    fn imports_header_and_quoted_description() {
        let csv = "Date,Description,Debit,Credit\n\
                   2026-01-03,\"Cloud service, monthly\",24.99,\n\
                   2026-01-05,Client payment,,1500.00\n";

        let transactions = import_csv(csv).expect("valid CSV");

        assert_eq!(transactions.len(), 2);
        assert_eq!(transactions[0].description, "Cloud service, monthly");
        assert_eq!(transactions[0].amount, Decimal::new(2499, 2));
        assert_eq!(transactions[0].category, "Software & subscriptions");
        assert_eq!(transactions[1].kind, TransactionKind::Income);
    }

    #[test]
    fn supports_legacy_tax_helper_format_without_header() {
        let csv = "2016-12-22,GAS STATION,40.0,\n\
                   2016-12-21,CREDIT MEMO,,1000.0\n";

        let transactions = import_csv(csv).expect("legacy CSV");

        assert_eq!(transactions.len(), 2);
        assert_eq!(transactions[0].kind, TransactionKind::Expense);
        assert_eq!(transactions[1].kind, TransactionKind::Income);
    }

    #[test]
    fn rejects_rows_with_both_amounts() {
        let csv = "date,description,debit,credit\n2026-01-01,Invalid,10,20\n";
        let error = import_csv(csv).expect_err("invalid CSV");

        assert!(error.to_string().contains("both debit and credit"));
    }
}

use std::collections::{BTreeMap, BTreeSet};

use chrono::NaiveDate;
use regex::escape;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::{MatchMode, Transaction, TransactionKind, TransactionType};

const DETECTED_COLORS: &[&str] = &[
    "#4e6f62", "#c98458", "#d1ad58", "#6a7f9d", "#8d6d88", "#5f8796", "#7d8eb0", "#8a897d",
];

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedTransactionType {
    pub transaction_type: TransactionType,
    pub transaction_count: usize,
    #[serde(with = "rust_decimal::serde::str")]
    pub total: Decimal,
    pub first_date: NaiveDate,
    pub last_date: NaiveDate,
    pub existing_type: Option<String>,
}

struct DetectionGroup {
    description: String,
    patterns: BTreeSet<String>,
    direction: TransactionKind,
    transaction_count: usize,
    total: Decimal,
    first_date: NaiveDate,
    last_date: NaiveDate,
    existing_type: Option<String>,
}

fn normalized_description(description: &str) -> String {
    description.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn is_reference_number(token: &str) -> bool {
    token.len() >= 6 && token.chars().all(|character| character.is_ascii_digit())
}

fn description_without_references(description: &str) -> String {
    let description = normalized_description(description);
    let simplified = description
        .split_whitespace()
        .filter(|token| !is_reference_number(token))
        .collect::<Vec<_>>()
        .join(" ");

    if simplified.is_empty() {
        description
    } else {
        simplified
    }
}

fn direction_label(direction: TransactionKind) -> &'static str {
    match direction {
        TransactionKind::Income => "income",
        TransactionKind::Expense => "expense",
    }
}

fn stable_hash(value: &str) -> u64 {
    value.bytes().fold(0xcbf2_9ce4_8422_2325, |hash, byte| {
        (hash ^ u64::from(byte)).wrapping_mul(0x0000_0100_0000_01b3)
    })
}

fn slug(value: &str) -> String {
    let mut result = String::with_capacity(32);
    let mut separator_pending = false;

    for character in value.chars() {
        if character.is_ascii_alphanumeric() {
            if separator_pending && !result.is_empty() {
                result.push('-');
            }
            result.push(character.to_ascii_lowercase());
            separator_pending = false;
            if result.len() >= 32 {
                break;
            }
        } else {
            separator_pending = true;
        }
    }

    result.trim_end_matches('-').to_owned()
}

fn exact_pattern(description: &str) -> String {
    let words = description.split_whitespace().map(|token| {
        if is_reference_number(token) {
            r"[0-9]{6,}".to_owned()
        } else {
            escape(&token.to_lowercase())
        }
    });
    format!("^{}$", words.collect::<Vec<_>>().join(r"\s+"))
}

/// Finds distinct bank descriptions and converts each one into an exact,
/// direction-aware transaction type suitable for review.
#[must_use]
pub fn detect_transaction_types(transactions: &[Transaction]) -> Vec<DetectedTransactionType> {
    let mut groups = BTreeMap::<String, DetectionGroup>::new();

    for transaction in transactions {
        let description = description_without_references(&transaction.description);
        let direction = direction_label(transaction.kind);
        let key = format!("{direction}\0{}", description.to_lowercase());
        let entry = groups.entry(key).or_insert_with(|| DetectionGroup {
            description,
            patterns: BTreeSet::new(),
            direction: transaction.kind,
            transaction_count: 0,
            total: Decimal::ZERO,
            first_date: transaction.date,
            last_date: transaction.date,
            existing_type: transaction.matched_rule.clone(),
        });

        entry.transaction_count += 1;
        entry.total += transaction.amount;
        entry
            .patterns
            .insert(exact_pattern(&transaction.description));
        entry.first_date = entry.first_date.min(transaction.date);
        entry.last_date = entry.last_date.max(transaction.date);
        if entry.existing_type.is_none() {
            entry.existing_type.clone_from(&transaction.matched_rule);
        }
    }

    let mut detected: Vec<_> = groups
        .into_iter()
        .enumerate()
        .map(|(index, (key, group))| {
            let short_name = slug(&group.description);
            let identifier = format!(
                "detected-{}-{}-{:08x}",
                if short_name.is_empty() {
                    "transaction"
                } else {
                    &short_name
                },
                direction_label(group.direction),
                stable_hash(&key)
            );

            DetectedTransactionType {
                transaction_type: TransactionType {
                    id: identifier,
                    name: group.description,
                    patterns: group.patterns.into_iter().collect(),
                    match_mode: MatchMode::Regex,
                    direction: Some(group.direction),
                    minimum_amount: None,
                    claim_percentage: 100,
                    enabled: true,
                    show_in_summary: true,
                    color: DETECTED_COLORS[index % DETECTED_COLORS.len()].to_owned(),
                },
                transaction_count: group.transaction_count,
                total: group.total,
                first_date: group.first_date,
                last_date: group.last_date,
                existing_type: group.existing_type,
            }
        })
        .collect();

    detected.sort_by(|left, right| {
        left.transaction_type
            .name
            .to_lowercase()
            .cmp(&right.transaction_type.name.to_lowercase())
            .then_with(|| {
                left.transaction_type
                    .direction
                    .map(direction_label)
                    .cmp(&right.transaction_type.direction.map(direction_label))
            })
    });
    detected
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;

    use super::*;

    fn transaction(
        description: &str,
        direction: TransactionKind,
        amount: Decimal,
        day: u32,
        matched_rule: Option<&str>,
    ) -> Transaction {
        Transaction {
            id: format!("{description}-{day}"),
            date: NaiveDate::from_ymd_opt(2025, 1, day).expect("valid date"),
            description: description.to_owned(),
            amount,
            kind: direction,
            category: "Unmatched".to_owned(),
            matched_rule: matched_rule.map(str::to_owned),
            source_row: day as usize,
        }
    }

    #[test]
    fn groups_case_and_spacing_variants_and_summarizes_them() {
        let transactions = vec![
            transaction(
                "HYDRO   OTTAWA",
                TransactionKind::Expense,
                Decimal::new(100, 0),
                3,
                Some("Electricity"),
            ),
            transaction(
                "hydro ottawa",
                TransactionKind::Expense,
                Decimal::new(125, 0),
                8,
                Some("Electricity"),
            ),
        ];

        let detected = detect_transaction_types(&transactions);

        assert_eq!(detected.len(), 1);
        assert_eq!(detected[0].transaction_count, 2);
        assert_eq!(detected[0].total, Decimal::new(225, 0));
        assert_eq!(detected[0].existing_type.as_deref(), Some("Electricity"));
        assert_eq!(detected[0].transaction_type.patterns, [r"^hydro\s+ottawa$"]);
    }

    #[test]
    fn keeps_income_and_expense_descriptions_separate() {
        let transactions = vec![
            transaction(
                "TRANSFER",
                TransactionKind::Income,
                Decimal::new(500, 0),
                3,
                None,
            ),
            transaction(
                "TRANSFER",
                TransactionKind::Expense,
                Decimal::new(200, 0),
                4,
                None,
            ),
        ];

        let detected = detect_transaction_types(&transactions);

        assert_eq!(detected.len(), 2);
        assert_ne!(
            detected[0].transaction_type.id,
            detected[1].transaction_type.id
        );
    }

    #[test]
    fn groups_long_bank_references_and_wildcards_the_generated_pattern() {
        let transactions = vec![
            transaction(
                "Internet Banking INTERNET BILL PAY 000000101727 UTILITY INC",
                TransactionKind::Expense,
                Decimal::new(100, 0),
                3,
                None,
            ),
            transaction(
                "Internet Banking INTERNET BILL PAY 000000842910 UTILITY INC",
                TransactionKind::Expense,
                Decimal::new(125, 0),
                8,
                None,
            ),
        ];

        let detected = detect_transaction_types(&transactions);

        assert_eq!(detected.len(), 1);
        assert_eq!(
            detected[0].transaction_type.name,
            "Internet Banking INTERNET BILL PAY UTILITY INC"
        );
        assert_eq!(detected[0].transaction_count, 2);
        assert_eq!(
            detected[0].transaction_type.patterns,
            [r"^internet\s+banking\s+internet\s+bill\s+pay\s+[0-9]{6,}\s+utility\s+inc$"]
        );
    }

    #[test]
    fn retains_short_numbers_that_may_be_part_of_a_merchant_name() {
        let transactions = vec![
            transaction(
                "407 TOLL",
                TransactionKind::Expense,
                Decimal::new(20, 0),
                3,
                None,
            ),
            transaction(
                "416 TOLL",
                TransactionKind::Expense,
                Decimal::new(25, 0),
                8,
                None,
            ),
        ];

        assert_eq!(detect_transaction_types(&transactions).len(), 2);
    }
}

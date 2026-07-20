use regex::{Regex, RegexBuilder};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::model::{
    BillBook, Transaction, TransactionKind, TransactionType, TransactionTypeSummary,
};

pub const CONFIG_SCHEMA_VERSION: u32 = 1;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum MatchMode {
    Contains,
    Regex,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub schema_version: u32,
    pub transaction_types: Vec<TransactionType>,
}

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("transaction type `{transaction_type}` has no name")]
    EmptyName { transaction_type: String },
    #[error("transaction type `{transaction_type}` must have at least one pattern")]
    EmptyPatterns { transaction_type: String },
    #[error("transaction type `{transaction_type}` has invalid regex `{pattern}`: {message}")]
    InvalidRegex {
        transaction_type: String,
        pattern: String,
        message: String,
    },
    #[error(
        "transaction type `{transaction_type}` has claim percentage {percentage}; expected 0–100"
    )]
    InvalidPercentage {
        transaction_type: String,
        percentage: u8,
    },
    #[error("configuration schema version {found} is not supported; expected {expected}")]
    UnsupportedSchema { found: u32, expected: u32 },
}

enum CompiledPattern {
    Contains(String),
    Regex(Regex),
}

struct CompiledTransactionType<'a> {
    definition: &'a TransactionType,
    patterns: Vec<CompiledPattern>,
}

impl CompiledTransactionType<'_> {
    fn matches(&self, transaction: &Transaction) -> bool {
        if self
            .definition
            .direction
            .is_some_and(|direction| direction != transaction.kind)
        {
            return false;
        }
        if self
            .definition
            .minimum_amount
            .is_some_and(|minimum| transaction.amount < minimum)
        {
            return false;
        }

        let normalized = transaction.description.to_lowercase();
        self.patterns.iter().any(|pattern| match pattern {
            CompiledPattern::Contains(needle) => normalized.contains(needle),
            CompiledPattern::Regex(regex) => regex.is_match(&transaction.description),
        })
    }
}

#[allow(clippy::too_many_arguments)]
fn transaction_type(
    id: &str,
    name: &str,
    patterns: &[&str],
    direction: Option<TransactionKind>,
    minimum_amount: Option<Decimal>,
    claim_percentage: u8,
    enabled: bool,
    show_in_summary: bool,
    color: &str,
) -> TransactionType {
    TransactionType {
        id: id.to_owned(),
        name: name.to_owned(),
        patterns: patterns
            .iter()
            .map(|pattern| (*pattern).to_owned())
            .collect(),
        match_mode: MatchMode::Contains,
        direction,
        minimum_amount,
        claim_percentage,
        enabled,
        show_in_summary,
        color: color.to_owned(),
    }
}

/// Default transaction definitions recovered from the original Racket tool.
///
/// The nine summary definitions mirror the old GUI tabs. The remaining original
/// predicates stay available as disabled presets so they can be enabled without
/// recreating their historical bank-description strings.
#[must_use]
#[allow(clippy::too_many_lines)]
pub fn default_config() -> AppConfig {
    use TransactionKind::{Expense, Income};

    let mut transaction_types = vec![
        transaction_type(
            "gross-sales",
            "Gross sales",
            &["Branch Transaction CREDIT MEMO"],
            Some(Income),
            Some(Decimal::new(3000, 0)),
            100,
            true,
            true,
            "#4e6f62",
        ),
        transaction_type(
            "babysitting",
            "Babysitting",
            &["CHEQUE"],
            Some(Expense),
            Some(Decimal::new(400, 0)),
            100,
            true,
            true,
            "#8d6d88",
        ),
        transaction_type(
            "enbridge-gas",
            "Heat · Enbridge",
            &["ENBRIDGE"],
            Some(Expense),
            None,
            100,
            true,
            true,
            "#c98458",
        ),
        transaction_type(
            "hydro-ottawa",
            "Electricity · Hydro Ottawa",
            &["HYDRO OTTAWA"],
            Some(Expense),
            None,
            100,
            true,
            true,
            "#d1ad58",
        ),
        transaction_type(
            "home-insurance",
            "Home insurance",
            &["Dominion of Canada Gen"],
            Some(Expense),
            None,
            100,
            true,
            true,
            "#6a7f9d",
        ),
        transaction_type(
            "car-insurance",
            "Car insurance",
            &["DOMINION OF CANADA GROUP"],
            Some(Expense),
            None,
            100,
            true,
            true,
            "#7d8eb0",
        ),
        transaction_type(
            "bell-internet",
            "Internet · Bell",
            &["BELL CANADA"],
            Some(Expense),
            None,
            100,
            true,
            true,
            "#55776a",
        ),
        transaction_type(
            "rogers-mobile",
            "Mobile · Rogers",
            &["ROGERS"],
            Some(Expense),
            None,
            50,
            true,
            true,
            "#cf8557",
        ),
        transaction_type(
            "ottawa-water",
            "Water & sewer · Ottawa",
            &["OTTAWA WATER"],
            Some(Expense),
            None,
            100,
            true,
            true,
            "#5f8796",
        ),
        transaction_type(
            "pay-canada",
            "Pay Canada transfer",
            &["Electronic Funds Transfer PAY CANADA"],
            Some(Income),
            None,
            100,
            false,
            false,
            "#4e6f62",
        ),
        transaction_type(
            "internet-deposit",
            "Internet deposit",
            &["INTERNET DEPOSIT"],
            Some(Income),
            None,
            100,
            false,
            false,
            "#4e6f62",
        ),
        transaction_type(
            "deposit-canada",
            "Deposit Canada",
            &["DEPOSIT CANADA"],
            Some(Income),
            None,
            100,
            false,
            false,
            "#4e6f62",
        ),
        transaction_type(
            "transaction-fee",
            "Transaction fees",
            &["TRANSACTION FEE"],
            Some(Expense),
            None,
            100,
            false,
            false,
            "#8a897d",
        ),
        transaction_type(
            "tim-hortons",
            "Tim Hortons",
            &["TIM HORTONS"],
            Some(Expense),
            None,
            100,
            false,
            false,
            "#c98458",
        ),
        transaction_type(
            "shoppers-drug",
            "Shoppers Drug Mart",
            &["SHOPPER'S DRUG"],
            Some(Expense),
            None,
            100,
            false,
            false,
            "#8d6d88",
        ),
        transaction_type(
            "metro",
            "Metro",
            &["METRO"],
            Some(Expense),
            None,
            100,
            false,
            false,
            "#cf8557",
        ),
        transaction_type(
            "vw-credit",
            "VW Credit",
            &["VW CREDIT CAN"],
            Some(Expense),
            None,
            100,
            false,
            false,
            "#6a7f9d",
        ),
        transaction_type(
            "internet-bill-pay",
            "Internet bill payment",
            &["INTERNET BILL PAY"],
            Some(Expense),
            None,
            100,
            false,
            false,
            "#55776a",
        ),
        transaction_type(
            "bell-one-bill",
            "Bell One Bill",
            &["BELL CANADA - ONE BILL"],
            Some(Expense),
            None,
            100,
            false,
            false,
            "#55776a",
        ),
        transaction_type(
            "cra-revenue",
            "CRA revenue payment",
            &["CRA (REVENUE -"],
            Some(Expense),
            None,
            100,
            false,
            false,
            "#8a897d",
        ),
        transaction_type(
            "cra-revenue-2014",
            "CRA revenue 2014",
            &["CRA (REVENUE) - 2014"],
            Some(Expense),
            None,
            100,
            false,
            false,
            "#8a897d",
        ),
        transaction_type(
            "cra-installments",
            "CRA tax installments",
            &["CRA (REVENUE) - TAX INSTA"],
            Some(Expense),
            None,
            100,
            false,
            false,
            "#8a897d",
        ),
    ];

    // Modern generic fallbacks retain the useful categories introduced in the
    // first Tax Assistant milestone. They stay out of the home-office summary
    // unless they actually match a transaction.
    transaction_types.extend([
        transaction_type(
            "client-income",
            "Client income",
            &["client payment", "invoice payment", "credit memo"],
            Some(Income),
            None,
            100,
            true,
            false,
            "#4e6f62",
        ),
        transaction_type(
            "utilities",
            "Other utilities",
            &["hydro", "electric", "enbridge", "water"],
            Some(Expense),
            None,
            100,
            true,
            false,
            "#d1ad58",
        ),
        transaction_type(
            "internet-phone",
            "Other internet & phone",
            &["internet", "mobile", "wireless", "telecom"],
            Some(Expense),
            None,
            100,
            true,
            false,
            "#55776a",
        ),
        transaction_type(
            "insurance",
            "Other insurance",
            &["insurance"],
            Some(Expense),
            None,
            100,
            true,
            false,
            "#6a7f9d",
        ),
        transaction_type(
            "software",
            "Software & subscriptions",
            &["software", "hosting", "cloud service"],
            Some(Expense),
            None,
            100,
            true,
            false,
            "#8d6d88",
        ),
        transaction_type(
            "bank-fees",
            "Bank fees",
            &["service charge", "transaction fee", "bank fee"],
            Some(Expense),
            None,
            100,
            true,
            false,
            "#8a897d",
        ),
    ]);

    AppConfig {
        schema_version: CONFIG_SCHEMA_VERSION,
        transaction_types,
    }
}

/// Validates the schema and every transaction definition.
///
/// # Errors
///
/// Returns a [`ConfigError`] for unsupported schema versions, missing names or
/// patterns, invalid percentages, or malformed regular expressions.
pub fn validate_config(config: &AppConfig) -> Result<(), ConfigError> {
    if config.schema_version != CONFIG_SCHEMA_VERSION {
        return Err(ConfigError::UnsupportedSchema {
            found: config.schema_version,
            expected: CONFIG_SCHEMA_VERSION,
        });
    }

    for transaction_type in &config.transaction_types {
        if transaction_type.name.trim().is_empty() {
            return Err(ConfigError::EmptyName {
                transaction_type: transaction_type.id.clone(),
            });
        }
        if transaction_type.claim_percentage > 100 {
            return Err(ConfigError::InvalidPercentage {
                transaction_type: transaction_type.name.clone(),
                percentage: transaction_type.claim_percentage,
            });
        }
        let patterns: Vec<_> = transaction_type
            .patterns
            .iter()
            .map(|pattern| pattern.trim())
            .filter(|pattern| !pattern.is_empty())
            .collect();
        if patterns.is_empty() {
            return Err(ConfigError::EmptyPatterns {
                transaction_type: transaction_type.name.clone(),
            });
        }
        if transaction_type.match_mode == MatchMode::Regex {
            for pattern in patterns {
                RegexBuilder::new(pattern)
                    .case_insensitive(true)
                    .build()
                    .map_err(|error| ConfigError::InvalidRegex {
                        transaction_type: transaction_type.name.clone(),
                        pattern: pattern.to_owned(),
                        message: error.to_string(),
                    })?;
            }
        }
    }

    Ok(())
}

fn compile_config(config: &AppConfig) -> Result<Vec<CompiledTransactionType<'_>>, ConfigError> {
    validate_config(config)?;

    config
        .transaction_types
        .iter()
        .filter(|transaction_type| transaction_type.enabled)
        .map(|definition| {
            let patterns = definition
                .patterns
                .iter()
                .map(|pattern| pattern.trim())
                .filter(|pattern| !pattern.is_empty())
                .map(|pattern| match definition.match_mode {
                    MatchMode::Contains => Ok(CompiledPattern::Contains(pattern.to_lowercase())),
                    MatchMode::Regex => RegexBuilder::new(pattern)
                        .case_insensitive(true)
                        .build()
                        .map(CompiledPattern::Regex)
                        .map_err(|error| ConfigError::InvalidRegex {
                            transaction_type: definition.name.clone(),
                            pattern: pattern.to_owned(),
                            message: error.to_string(),
                        }),
                })
                .collect::<Result<_, _>>()?;

            Ok(CompiledTransactionType {
                definition,
                patterns,
            })
        })
        .collect()
}

/// Applies enabled definitions in configuration order.
///
/// The first matching definition wins, preventing one transaction from being
/// double-counted when broad and institution-specific patterns overlap.
///
/// # Errors
///
/// Returns a [`ConfigError`] when the configuration or one of its regular
/// expressions is invalid.
pub fn apply_config(
    transactions: &mut [Transaction],
    config: &AppConfig,
) -> Result<BillBook, ConfigError> {
    let compiled = compile_config(config)?;
    let mut summaries: Vec<_> = compiled
        .iter()
        .map(|item| TransactionTypeSummary {
            transaction_type: item.definition.clone(),
            total: Decimal::ZERO,
            claim_total: Decimal::ZERO,
            transaction_count: 0,
            transactions: Vec::new(),
        })
        .collect();
    let mut unmatched = Vec::new();

    for transaction in transactions {
        if let Some((index, matched)) = compiled
            .iter()
            .enumerate()
            .find(|(_, candidate)| candidate.matches(transaction))
        {
            transaction.category = matched.definition.name.clone();
            transaction.matched_rule = Some(matched.definition.name.clone());

            let summary = &mut summaries[index];
            summary.total += transaction.amount;
            summary.claim_total += transaction.amount
                * Decimal::from(matched.definition.claim_percentage)
                / Decimal::ONE_HUNDRED;
            summary.transaction_count += 1;
            summary.transactions.push(transaction.clone());
        } else {
            "Unmatched".clone_into(&mut transaction.category);
            transaction.matched_rule = None;
            unmatched.push(transaction.clone());
        }
    }

    Ok(BillBook {
        summaries,
        unmatched,
    })
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;
    use pretty_assertions::assert_eq;

    use super::*;

    fn expense(description: &str, amount: Decimal) -> Transaction {
        Transaction {
            id: description.to_owned(),
            date: NaiveDate::from_ymd_opt(2025, 1, 1).expect("valid date"),
            description: description.to_owned(),
            amount,
            kind: TransactionKind::Expense,
            category: "Uncategorized".to_owned(),
            matched_rule: None,
            source_row: 1,
        }
    }

    #[test]
    fn defaults_recover_original_home_office_presets() {
        let config = default_config();
        let visible_names: Vec<_> = config
            .transaction_types
            .iter()
            .filter(|definition| definition.show_in_summary)
            .map(|definition| definition.name.as_str())
            .collect();

        assert_eq!(
            visible_names,
            [
                "Gross sales",
                "Babysitting",
                "Heat · Enbridge",
                "Electricity · Hydro Ottawa",
                "Home insurance",
                "Car insurance",
                "Internet · Bell",
                "Mobile · Rogers",
                "Water & sewer · Ottawa",
            ]
        );
    }

    #[test]
    fn first_matching_definition_wins_and_claim_percentage_is_applied() {
        let mut config = default_config();
        let rogers = config
            .transaction_types
            .iter_mut()
            .find(|definition| definition.id == "rogers-mobile")
            .expect("Rogers preset");
        rogers.patterns.push("wireless invoice".to_owned());

        let mut transactions = vec![expense("ROGERS WIRELESS INVOICE", Decimal::new(120, 0))];
        let book = apply_config(&mut transactions, &config).expect("valid configuration");
        let summary = book
            .summaries
            .iter()
            .find(|summary| summary.transaction_type.id == "rogers-mobile")
            .expect("Rogers summary");

        assert_eq!(summary.total, Decimal::new(120, 0));
        assert_eq!(summary.claim_total, Decimal::new(60, 0));
        assert_eq!(transactions[0].category, "Mobile · Rogers");
    }

    #[test]
    fn validates_and_matches_case_insensitive_regex() {
        let mut config = AppConfig {
            schema_version: CONFIG_SCHEMA_VERSION,
            transaction_types: vec![TransactionType {
                id: "future-hydro".to_owned(),
                name: "Future hydro".to_owned(),
                patterns: vec![r"hydro[- ](?:ottawa|one)".to_owned()],
                match_mode: MatchMode::Regex,
                direction: Some(TransactionKind::Expense),
                minimum_amount: None,
                claim_percentage: 100,
                enabled: true,
                show_in_summary: true,
                color: "#4e6f62".to_owned(),
            }],
        };
        let mut transactions = vec![expense("Hydro-One payment", Decimal::new(90, 0))];

        let book = apply_config(&mut transactions, &config).expect("valid regex");
        assert_eq!(book.summaries[0].transaction_count, 1);

        config.transaction_types[0].patterns = vec!["(".to_owned()];
        assert!(matches!(
            validate_config(&config),
            Err(ConfigError::InvalidRegex { .. })
        ));
    }

    #[test]
    fn an_empty_configuration_leaves_every_transaction_unmatched() {
        let config = AppConfig {
            schema_version: CONFIG_SCHEMA_VERSION,
            transaction_types: Vec::new(),
        };
        let mut transactions = vec![expense("FUTURE BILL", Decimal::new(75, 0))];

        let book = apply_config(&mut transactions, &config).expect("empty configuration is valid");

        assert!(book.summaries.is_empty());
        assert_eq!(book.unmatched.len(), 1);
        assert_eq!(transactions[0].category, "Unmatched");
    }
}

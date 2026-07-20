use std::collections::BTreeMap;

use chrono::Datelike;
use rust_decimal::Decimal;

use crate::model::{Analysis, CategoryTotal, MonthlyTotal, Transaction, TransactionKind};

#[derive(Default)]
struct CategoryAccumulator {
    amount: Decimal,
    count: usize,
}

#[derive(Default)]
struct MonthAccumulator {
    income: Decimal,
    expenses: Decimal,
}

#[must_use]
pub fn analyze(transactions: &[Transaction]) -> Analysis {
    let mut income = Decimal::ZERO;
    let mut expenses = Decimal::ZERO;
    let mut categorized_count = 0;
    let mut uncategorized_count = 0;
    let mut categories: BTreeMap<String, CategoryAccumulator> = BTreeMap::new();
    let mut months: BTreeMap<String, MonthAccumulator> = BTreeMap::new();

    for transaction in transactions {
        match transaction.kind {
            TransactionKind::Income => income += transaction.amount,
            TransactionKind::Expense => expenses += transaction.amount,
        }

        if transaction.category == "Uncategorized" {
            uncategorized_count += 1;
        } else {
            categorized_count += 1;
        }

        if transaction.kind == TransactionKind::Expense {
            let category = categories.entry(transaction.category.clone()).or_default();
            category.amount += transaction.amount;
            category.count += 1;
        }

        let month_key = format!(
            "{:04}-{:02}",
            transaction.date.year(),
            transaction.date.month()
        );
        let month = months.entry(month_key).or_default();
        match transaction.kind {
            TransactionKind::Income => month.income += transaction.amount,
            TransactionKind::Expense => month.expenses += transaction.amount,
        }
    }

    let mut category_totals: Vec<_> = categories
        .into_iter()
        .map(|(category, total)| CategoryTotal {
            category,
            amount: total.amount,
            transaction_count: total.count,
        })
        .collect();
    category_totals.sort_by(|left, right| right.amount.cmp(&left.amount));

    let monthly_totals = months
        .into_iter()
        .map(|(month, total)| MonthlyTotal {
            month,
            income: total.income,
            expenses: total.expenses,
        })
        .collect();

    Analysis {
        income,
        expenses,
        net: income - expenses,
        categorized_count,
        uncategorized_count,
        category_totals,
        monthly_totals,
    }
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;
    use pretty_assertions::assert_eq;
    use rust_decimal::Decimal;

    use super::*;

    fn transaction(
        id: &str,
        amount: Decimal,
        kind: TransactionKind,
        category: &str,
    ) -> Transaction {
        Transaction {
            id: id.to_owned(),
            date: NaiveDate::from_ymd_opt(2026, 1, 1).expect("valid date"),
            description: id.to_owned(),
            amount,
            kind,
            category: category.to_owned(),
            matched_rule: None,
            source_row: 1,
        }
    }

    #[test]
    fn computes_exact_totals_and_net() {
        let transactions = vec![
            transaction(
                "income",
                Decimal::new(100_000, 2),
                TransactionKind::Income,
                "Business income",
            ),
            transaction(
                "internet",
                Decimal::new(10_001, 2),
                TransactionKind::Expense,
                "Internet & phone",
            ),
        ];

        let analysis = analyze(&transactions);

        assert_eq!(analysis.income, Decimal::new(100_000, 2));
        assert_eq!(analysis.expenses, Decimal::new(10_001, 2));
        assert_eq!(analysis.net, Decimal::new(89_999, 2));
        assert_eq!(analysis.categorized_count, 2);
        assert_eq!(analysis.uncategorized_count, 0);
    }
}

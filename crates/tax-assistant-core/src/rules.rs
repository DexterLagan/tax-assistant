use crate::model::TransactionKind;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CategoryRule {
    pub name: &'static str,
    pub category: &'static str,
    pub description_contains: &'static [&'static str],
    pub kind: Option<TransactionKind>,
}

impl CategoryRule {
    #[must_use]
    pub fn matches(&self, description: &str, kind: TransactionKind) -> bool {
        if self.kind.is_some_and(|expected| expected != kind) {
            return false;
        }

        let normalized = description.to_lowercase();
        self.description_contains
            .iter()
            .any(|needle| normalized.contains(&needle.to_lowercase()))
    }
}

/// Starter rules provide a useful demo without embedding personal tax data.
///
/// They are intentionally conservative. The persistence milestone will make
/// these rules editable and store them per tax project.
#[must_use]
pub fn default_rules() -> Vec<CategoryRule> {
    vec![
        CategoryRule {
            name: "Client income",
            category: "Business income",
            description_contains: &["client payment", "invoice payment", "credit memo"],
            kind: Some(TransactionKind::Income),
        },
        CategoryRule {
            name: "Utilities",
            category: "Utilities",
            description_contains: &["hydro", "electric", "enbridge", "water"],
            kind: Some(TransactionKind::Expense),
        },
        CategoryRule {
            name: "Internet and phone",
            category: "Internet & phone",
            description_contains: &["internet", "mobile", "wireless", "telecom"],
            kind: Some(TransactionKind::Expense),
        },
        CategoryRule {
            name: "Insurance",
            category: "Insurance",
            description_contains: &["insurance"],
            kind: Some(TransactionKind::Expense),
        },
        CategoryRule {
            name: "Software",
            category: "Software & subscriptions",
            description_contains: &["software", "hosting", "cloud service"],
            kind: Some(TransactionKind::Expense),
        },
        CategoryRule {
            name: "Bank fees",
            category: "Bank fees",
            description_contains: &["service charge", "transaction fee", "bank fee"],
            kind: Some(TransactionKind::Expense),
        },
    ]
}

pub(crate) fn categorize(
    description: &str,
    kind: TransactionKind,
) -> (&'static str, Option<&'static str>) {
    default_rules()
        .into_iter()
        .find(|rule| rule.matches(description, kind))
        .map_or(("Uncategorized", None), |rule| {
            (rule.category, Some(rule.name))
        })
}

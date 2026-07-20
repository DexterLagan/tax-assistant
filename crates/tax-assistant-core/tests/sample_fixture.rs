use rust_decimal::Decimal;
use tax_assistant_core::import_and_analyze;

const SAMPLE_CSV: &str = include_str!("../../../fixtures/sample-transactions.csv");

#[test]
fn sample_fixture_has_stable_dashboard_totals() {
    let result = import_and_analyze(SAMPLE_CSV).expect("sample fixture should import");

    assert_eq!(result.transactions.len(), 10);
    assert_eq!(result.analysis.income, Decimal::new(860_000, 2));
    assert_eq!(result.analysis.expenses, Decimal::new(96_767, 2));
    assert_eq!(result.analysis.net, Decimal::new(763_233, 2));
    assert_eq!(result.analysis.categorized_count, 8);
    assert_eq!(result.analysis.uncategorized_count, 2);
    assert_eq!(result.analysis.monthly_totals.len(), 5);
}

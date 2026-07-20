import type {
  AppConfig,
  BillBook,
  Transaction,
  TransactionType,
  TransactionTypeSummary,
} from "./types";

const expense = "expense" as const;

function preset(
  id: string,
  name: string,
  pattern: string,
  color: string,
  options: Partial<TransactionType> = {},
): TransactionType {
  return {
    id,
    name,
    patterns: [pattern],
    matchMode: "contains",
    direction: expense,
    minimumAmount: null,
    claimPercentage: 100,
    enabled: true,
    showInSummary: true,
    color,
    ...options,
  };
}

export const fallbackConfig: AppConfig = {
  schemaVersion: 1,
  transactionTypes: [
    preset("gross-sales", "Gross sales", "Branch Transaction CREDIT MEMO", "#4e6f62", {
      direction: "income",
      minimumAmount: "3000",
    }),
    preset("babysitting", "Babysitting", "CHEQUE", "#8d6d88", {
      minimumAmount: "400",
    }),
    preset("enbridge-gas", "Heat · Enbridge", "ENBRIDGE", "#c98458"),
    preset("hydro-ottawa", "Electricity · Hydro Ottawa", "HYDRO OTTAWA", "#d1ad58"),
    preset(
      "home-insurance",
      "Home insurance",
      "Dominion of Canada Gen",
      "#6a7f9d",
    ),
    preset(
      "car-insurance",
      "Car insurance",
      "DOMINION OF CANADA GROUP",
      "#7d8eb0",
    ),
    preset("bell-internet", "Internet · Bell", "BELL CANADA", "#55776a"),
    preset("rogers-mobile", "Mobile · Rogers", "ROGERS", "#cf8557", {
      claimPercentage: 50,
    }),
    preset("ottawa-water", "Water & sewer · Ottawa", "OTTAWA WATER", "#5f8796"),
  ],
};

function matches(transaction: Transaction, definition: TransactionType) {
  if (definition.direction && definition.direction !== transaction.kind) return false;
  if (
    definition.minimumAmount !== null &&
    Number(transaction.amount) < Number(definition.minimumAmount)
  ) {
    return false;
  }
  return definition.patterns.some((pattern) => {
    if (definition.matchMode === "regex") {
      try {
        return new RegExp(pattern, "i").test(transaction.description);
      } catch {
        return false;
      }
    }
    return transaction.description.toLowerCase().includes(pattern.toLowerCase());
  });
}

export function buildFallbackBillBook(
  transactions: Transaction[],
  config: AppConfig,
): BillBook {
  const enabled = config.transactionTypes.filter((definition) => definition.enabled);
  const summaries: TransactionTypeSummary[] = enabled.map((transactionType) => ({
    transactionType,
    total: "0",
    claimTotal: "0",
    transactionCount: 0,
    transactions: [],
  }));
  const unmatched: Transaction[] = [];

  transactions.forEach((transaction) => {
    const index = enabled.findIndex((definition) => matches(transaction, definition));
    if (index < 0) {
      unmatched.push(transaction);
      return;
    }
    const summary = summaries[index];
    const total = Number(summary.total) + Number(transaction.amount);
    summary.total = total.toFixed(2);
    summary.claimTotal = (
      Number(summary.claimTotal) +
      (Number(transaction.amount) * summary.transactionType.claimPercentage) / 100
    ).toFixed(2);
    summary.transactionCount += 1;
    summary.transactions.push(transaction);
  });

  return { summaries, unmatched };
}

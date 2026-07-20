export type TransactionKind = "income" | "expense";

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  kind: TransactionKind;
  category: string;
  matchedRule: string | null;
  sourceRow: number;
}

export interface CategoryTotal {
  category: string;
  amount: string;
  transactionCount: number;
}

export interface MonthlyTotal {
  month: string;
  income: string;
  expenses: string;
}

export interface Analysis {
  income: string;
  expenses: string;
  net: string;
  categorizedCount: number;
  uncategorizedCount: number;
  categoryTotals: CategoryTotal[];
  monthlyTotals: MonthlyTotal[];
}

export interface ImportResult {
  transactions: Transaction[];
  analysis: Analysis;
  issues: Array<{ row: number; message: string }>;
}

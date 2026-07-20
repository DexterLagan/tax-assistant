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
  billBook: BillBook;
  issues: Array<{ row: number; message: string }>;
}

export type MatchMode = "contains" | "regex";

export interface TransactionType {
  id: string;
  name: string;
  patterns: string[];
  matchMode: MatchMode;
  direction: TransactionKind | null;
  minimumAmount: string | null;
  claimPercentage: number;
  enabled: boolean;
  showInSummary: boolean;
  color: string;
}

export interface DetectedTransactionType {
  transactionType: TransactionType;
  transactionCount: number;
  total: string;
  firstDate: string;
  lastDate: string;
  existingType: string | null;
}

export interface AppConfig {
  schemaVersion: number;
  transactionTypes: TransactionType[];
}

export interface TransactionTypeSummary {
  transactionType: TransactionType;
  total: string;
  claimTotal: string;
  transactionCount: number;
  transactions: Transaction[];
}

export interface BillBook {
  summaries: TransactionTypeSummary[];
  unmatched: Transaction[];
}

export interface ConfigEnvelope {
  config: AppConfig;
  source: string;
  path: string | null;
  portable: boolean;
}

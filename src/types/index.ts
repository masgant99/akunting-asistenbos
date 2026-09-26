export enum AccountCategory {
  ASSET = "Asset",
  LIABILITY = "Liability",
  EQUITY = "Equity",
  REVENUE = "Revenue",
  EXPENSE = "Expense"
}

export enum NormalBalance {
  DEBIT = "Debit",
  CREDIT = "Credit"
}

export enum JournalStatus {
  DRAFT = "Draft",
  POSTED = "Posted"
}

export interface COA {
  id?: string;
  code: string;
  name: string;
  category: AccountCategory;
  subCategory?: string;
  normalBalance: NormalBalance;
  description?: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface JournalEntry {
  coaId: string;
  debit: number;
  credit: number;
}

export interface Journal {
  id?: string;
  date: Date;
  description: string;
  reference?: string;
  status: JournalStatus;
  entries: JournalEntry[];
  totalDebit: number;
  totalCredit: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Budget {
  id?: string;
  coaId: string;
  period: string; // YYYY-MM
  amount: number;
  actual: number;
}

export interface Notification {
  id?: string;
  message: string;
  type: 'Info' | 'Warning' | 'Success';
  read: boolean;
  createdAt: Date;
}

export interface ScheduledPayment {
  id?: string;
  dueDate: Date;
  amount: number;
  description: string;
  coaId: string;
  status: 'Pending' | 'Paid' | 'Overdue';
}

export interface BudgetTransaction {
  id?: string;
  coaId: string;
  amount: number;
  type: 'Pertambahan' | 'Pengurangan';
  description: string;
  date: Date;
  userId?: string;
  createdAt?: Date;
}

export interface ApiKey {
  id?: string;
  name: string;
  key: string;
  prefix: string;
  status: 'active' | 'revoked';
  userId: string;
  permissions: string[];
  createdAt: string;
  lastUsedAt?: string;
}


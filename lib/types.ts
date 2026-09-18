export interface AccountDetail {
  bank?: string
  accountNumber?: string
  accountName?: string
}

export interface LoanRecord {
  loanId: string
  name: string
  phone: string
  amount: number
  appType: string
  dayType: number
  accountDetails: AccountDetail[]
  id?: string
  userId?: string
}

export interface RawRecord {
  [key: string]: unknown
}

export interface ExtractionResult {
  records: LoanRecord[]
  warnings: ExtractionWarning[]
  excluded: ExcludedRecord[]
  stats: ExtractionStats
}

export interface ExtractionWarning {
  recordId: string
  appName?: string
  message: string
  rawData: RawRecord
}

export interface ExcludedRecord {
  reason: string
  appName?: string
  loanId?: string
  rawData: RawRecord
}

export interface ExtractionStats {
  rawCount: number
  candidateCount: number
  processedCount: number
  excludedCount: number
  warningCount: number
  uniqueApps: Set<string>
  totalAmount: number
}

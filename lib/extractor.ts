import {
  LoanRecord,
  RawRecord,
  ExtractionResult,
  ExtractionStats,
  ExtractionWarning,
  ExcludedRecord,
} from './types'
import { parseAmount } from './amount'
import { parsePhoneNumber } from './phone'

const REQUIRED_FIELDS = ['appName', 'orderNum', 'inpayAmount']

export function extractFromRawInput(
  input: string,
  normalizePhone: boolean = true
): ExtractionResult {
  const candidates = extractCandidates(input)

  const stats: ExtractionStats = {
    rawCount: candidates.length,
    candidateCount: 0,
    processedCount: 0,
    excludedCount: 0,
    warningCount: 0,
    uniqueApps: new Set(),
    totalAmount: 0,
  }

  const warnings: ExtractionWarning[] = []
  const excluded: ExcludedRecord[] = []
  const records: LoanRecord[] = []

  for (const candidate of candidates) {
    const validation = validateCandidate(candidate)

    if (!validation.isValid) {
      excluded.push({
        reason: validation.reason || 'Invalid record',
        appName: candidate.appName as string | undefined,
        loanId: candidate.orderNum as string | undefined,
        rawData: candidate,
      })
      stats.excludedCount++
      continue
    }

    stats.candidateCount++

    const amount = parseAmount(candidate.inpayAmount)
    if (amount === null) {
      excluded.push({
        reason: 'Zero or invalid amount',
        appName: candidate.appName as string | undefined,
        loanId: candidate.orderNum as string | undefined,
        rawData: candidate,
      })
      stats.excludedCount++
      continue
    }

    const record = transformRecord(candidate, amount, normalizePhone, warnings)

    if (record) {
      records.push(record)
      stats.processedCount++
      stats.totalAmount += amount
      stats.uniqueApps.add(record.appType)
    }
  }

  stats.warningCount = warnings.length

  return {
    records,
    warnings,
    excluded,
    stats,
  }
}

function extractCandidates(input: string): RawRecord[] {
  const candidates: RawRecord[] = []

  try {
    const parsed = JSON.parse(input)

    if (Array.isArray(parsed)) {
      candidates.push(
        ...parsed.filter((item) => typeof item === 'object' && item !== null)
      )
    } else if (typeof parsed === 'object' && parsed !== null) {
      if ('rows' in parsed && Array.isArray(parsed.rows)) {
        candidates.push(
          ...parsed.rows.filter((item: unknown) => typeof item === 'object' && item !== null)
        )
      } else {
        candidates.push(parsed)
      }
    }

    return candidates
  } catch {
    // JSON parse failed, try regex extraction
  }

  const jsonRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\[[^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*\]/g
  const matches = input.match(jsonRegex) || []

  for (const match of matches) {
    try {
      const parsed = JSON.parse(match)

      if (Array.isArray(parsed)) {
        candidates.push(
          ...parsed.filter((item) => typeof item === 'object' && item !== null)
        )
      } else if (typeof parsed === 'object' && parsed !== null) {
        if ('rows' in parsed && Array.isArray(parsed.rows)) {
          candidates.push(
            ...parsed.rows.filter((item: unknown) => typeof item === 'object' && item !== null)
          )
        } else {
          candidates.push(parsed)
        }
      }
    } catch {
      // Skip malformed matches
    }
  }

  return candidates
}

function validateCandidate(candidate: RawRecord): {
  isValid: boolean
  reason?: string
} {
  if (typeof candidate !== 'object' || candidate === null) {
    return { isValid: false, reason: 'Not an object' }
  }

  const hasRequiredFields = REQUIRED_FIELDS.some((field) => field in candidate)

  if (!hasRequiredFields) {
    return { isValid: false, reason: 'Missing required fields' }
  }

  return { isValid: true }
}

function transformRecord(
  raw: RawRecord,
  amount: number,
  normalizePhone: boolean,
  warnings: ExtractionWarning[]
): LoanRecord | null {
  const appName =
    (typeof raw.appName === 'string' ? raw.appName.trim() : '') || 'Unknown'
  const loanId =
    (typeof raw.orderNum === 'string' ? raw.orderNum.trim() : '') || ''
  const name =
    (typeof raw.customerName === 'string' ? raw.customerName.trim() : '') || ''
  const phone = parsePhoneNumber(raw.phone, normalizePhone)

  let dayType = 0
  if (typeof raw.overdueDays === 'number') {
    dayType = raw.overdueDays
  } else if (typeof raw.overdueDays === 'string') {
    const parsed = parseInt(raw.overdueDays, 10)
    if (!isNaN(parsed)) {
      dayType = parsed
    }
  }

  const accountDetails = []
  const virtualCard = raw.virtualCardInfo && typeof raw.virtualCardInfo === 'object'
    ? raw.virtualCardInfo as RawRecord
    : undefined
  const bank = virtualCard?.bankName ?? raw.bankName
  const accountNumber = virtualCard?.accountNum ?? raw.accountNum
  const accountName = virtualCard?.accountName ?? raw.accountName

  if (bank || accountNumber || accountName) {
    accountDetails.push({
      bank: typeof bank === 'string' ? bank : undefined,
      accountNumber: typeof accountNumber === 'string' ? accountNumber : undefined,
      accountName: typeof accountName === 'string' ? accountName : undefined,
    })
  }

  const recordWarnings: string[] = []
  if (!loanId) recordWarnings.push('Loan ID missing')
  if (!name) recordWarnings.push('Customer name missing')
  if (!phone) recordWarnings.push('Phone number missing')

  if (recordWarnings.length > 0) {
    warnings.push({
      recordId: loanId || 'unknown',
      appName,
      message: recordWarnings.join('; '),
      rawData: raw,
    })
  }

  return {
    loanId,
    name,
    phone,
    amount,
    appType: appName,
    dayType,
    accountDetails,
    id: typeof raw.id === 'string' ? raw.id : undefined,
    userId: typeof raw.userId === 'string' ? raw.userId : undefined,
  }
}

export function groupRecordsByApp(records: LoanRecord[]): Record<string, LoanRecord[]> {
  const grouped: Record<string, LoanRecord[]> = {}

  for (const record of records) {
    const app = record.appType
    if (!grouped[app]) {
      grouped[app] = []
    }
    grouped[app].push(record)
  }

  return grouped
}

export function removeDuplicates(records: LoanRecord[]): {
  unique: LoanRecord[]
  removed: number
} {
  const seen = new Set<string>()
  const unique: LoanRecord[] = []
  let removed = 0

  for (const record of records) {
    const key = `${record.appType}|${record.loanId}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(record)
    } else {
      removed++
    }
  }

  return { unique, removed }
}

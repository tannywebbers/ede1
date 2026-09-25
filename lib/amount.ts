export function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined) return null

  let numValue: number

  if (typeof value === 'number') {
    numValue = value
  } else if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    const cleaned = trimmed.replace(/,/g, '')
    numValue = parseFloat(cleaned)
  } else {
    return null
  }

  if (!Number.isFinite(numValue)) return null
  if (numValue <= 100) return null

  return numValue
}

export function formatNaira(amount: number): string {
  return '₦' + amount.toLocaleString('en-NG')
}

export function normalizeNigerianPhone(phone: string | unknown): string {
  if (typeof phone !== 'string') {
    return String(phone || '')
  }

  const cleaned = phone.replace(/\D/g, '')

  if (cleaned.length === 10 && cleaned.startsWith('80')) {
    return '0' + cleaned
  }

  if (cleaned.length === 13 && cleaned.startsWith('234')) {
    return '0' + cleaned.slice(3)
  } 

  if (cleaned.length === 12 && cleaned.startsWith('234')) {
    return '0' + cleaned.slice(3)
  }

  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return cleaned
  }

  if (cleaned.length === 10 && !cleaned.startsWith('0')) {
    return '0' + cleaned
  }

  return phone
}

export function parsePhoneNumber(value: unknown, normalize: boolean): string {
  if (!value) return ''

  const phone = String(value).trim()
  if (!phone) return ''

  return normalize ? normalizeNigerianPhone(phone) : phone
}

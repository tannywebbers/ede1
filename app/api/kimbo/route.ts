import { NextRequest, NextResponse } from 'next/server'

const ORIGIN = 'https://www.kimbo.world'
const ALLOWED = ['/adminApi/system/loan/collectionAssign/collect/case/list', '/adminApi/system/loan/order/', '/adminApi/system/loan/userContact/app/list', '/adminApi/system/loan/collectionAssign/app/getSmsContent', '/adminApi/system/loan/collectionAssign/sendSms', '/adminApi/system/loan/collectionRecord']

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const path = typeof body?.path === 'string' ? body.path : ''
  const method = body?.method === 'POST' ? 'POST' : 'GET'
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  const payload = body?.payload
  if (!token) return NextResponse.json({ message: 'Bearer token is required.' }, { status: 400 })
  if (!ALLOWED.some((allowed) => path === allowed || path.startsWith(allowed))) return NextResponse.json({ message: 'Endpoint is not allowed.' }, { status: 400 })

  try {
    const response = await fetch(`${ORIGIN}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
      body: method === 'POST' ? JSON.stringify(payload ?? {}) : undefined,
      cache: 'no-store',
    })
    const text = await response.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = { message: text || response.statusText } }
    return NextResponse.json({ data }, { status: response.status })
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Network request failed.' }, { status: 502 })
  }
}

export async function GET() { return NextResponse.json({ message: 'Use POST.' }, { status: 405 }) }

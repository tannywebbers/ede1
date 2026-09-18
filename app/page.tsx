'use client'

import { useMemo, useState } from 'react'
import { extractFromRawInput, groupRecordsByApp, removeDuplicates } from '@/lib/extractor'
import { EXAMPLE_DATA } from '@/lib/example-data'
import { ExtractionResult, LoanRecord } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Check, Copy, Download, FileJson, Globe, Loader2, Save, Settings2, Upload, Wifi } from 'lucide-react'

type Tab = 'whatsapp' | 'phones' | 'sms' | 'remarks' | 'contacts' | 'settings'
type ApiRow = Record<string, unknown>
const LIST_PATH = '/adminApi/system/loan/collectionAssign/collect/case/list?pageNum=1&pageSize=200&recordType=0'
const templates = ['2057421681597583361', '2062494888535728129']

function rowsFrom(data: unknown): ApiRow[] {
  if (Array.isArray(data)) return data.flatMap(rowsFrom)
  if (!data || typeof data !== 'object') return []
  const obj = data as ApiRow
  if (Array.isArray(obj.rows)) return obj.rows.filter((r): r is ApiRow => !!r && typeof r === 'object')
  if (obj.data && typeof obj.data === 'object') return rowsFrom(obj.data)
  return [obj]
}

async function kimbo(path: string, token: string, method: 'GET' | 'POST' = 'GET', payload?: unknown) {
  const response = await fetch('/api/kimbo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, token, method, payload }) })
  const body = await response.json()
  if (!response.ok) throw new Error(body.message || body.data?.msg || `Request failed (${response.status})`)
  if (body.data?.code && body.data.code !== 200) throw new Error(body.data.msg || `Kimbo returned code ${body.data.code}`)
  return body.data
}

export default function Page() {
  const [tab, setTab] = useState<Tab>('whatsapp')
  const [input, setInput] = useState('')
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [rows, setRows] = useState<ApiRow[]>([])
  const [token, setToken] = useState('')
  const [saved, setSaved] = useState(false)
  const [status, setStatus] = useState('Ready')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'personalized' | 'plain'>('personalized')
  const [template, setTemplate] = useState(templates[0])
  const [remark, setRemark] = useState('')
  const [contactResult, setContactResult] = useState('No Reply')
  const [output, setOutput] = useState('')

  const records = useMemo(() => result?.records ?? rows.map((r) => ({ loanId: String(r.orderNum ?? r.id ?? ''), name: String(r.customerName ?? ''), phone: String(r.phone ?? r.phoneNumber ?? ''), amount: Number(r.inpayAmount ?? 0), appType: String(r.appName ?? ''), dayType: Number(r.overdueDays ?? 0), accountDetails: [] } as LoanRecord)), [result, rows])

  const saveToken = () => { localStorage.setItem('kimbo-bearer-token', token.trim()); setSaved(true); setStatus('Bearer token saved in this browser'); setTimeout(() => setSaved(false), 1800) }
  const loadToken = () => setToken(localStorage.getItem('kimbo-bearer-token') || '')
  const clear = () => { setInput(''); setRows([]); setResult(null); setOutput(''); setError(''); setStatus('Ready') }

  const fetchLive = async () => {
    if (!token.trim()) { setError('Add and save a bearer token in Settings first.'); return }
    setLoading(true); setError(''); setStatus('Fetching case list and bank details...')
    try {
      const first = await kimbo(LIST_PATH, token)
      const cases = rowsFrom(first)
      const enriched: ApiRow[] = []
      for (const item of cases) {
        const id = item.id
        if (!id) { enriched.push(item); continue }
        try { const detail = await kimbo(`/adminApi/system/loan/order/${encodeURIComponent(String(id))}`, token); enriched.push({ ...item, ...(detail?.data && typeof detail.data === 'object' ? detail.data : detail) }) }
        catch (detailError) { enriched.push({ ...item, _detailError: detailError instanceof Error ? detailError.message : 'Bank detail request failed' }) }
      }
      setRows(enriched); setInput(JSON.stringify(enriched, null, 2)); setStatus(`Loaded ${enriched.length} cases with order details`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Token or network request failed.'); setStatus('Request failed') }
    finally { setLoading(false) }
  }

  const extract = () => { const next = extractFromRawInput(input, true); setResult(next); setOutput(JSON.stringify(groupRecordsByApp(next.records), null, 2)); setStatus(`Extracted ${next.records.length} records`) }
  const doAction = async (action: 'sms' | 'remark') => {
    if (!token.trim()) { setError('Add and save a bearer token in Settings first.'); return }
    const source = rows.length ? rows : rowsFrom(input ? JSON.parse(input) : [])
    setLoading(true); setError(''); setOutput('')
    const logs: string[] = []
    for (const row of source) {
      const orderNum = String(row.orderNum ?? '')
      if (!orderNum) continue
      try {
        const path = action === 'sms' ? '/adminApi/system/loan/collectionAssign/sendSms' : '/adminApi/system/loan/collectionRecord'
        const payload = action === 'sms' ? { orderNum, templateId: Number(template), country: row.country || 'NG', appName: row.appName || '' } : { orderNum, reachOutBy: 'Phone', contactRelations: 'Self', contactResult, collectionTag: contactResult, contactName: row.customerName || '', contactNo: row.phone || '', fraudVoucher: '', promisedTime: '', remark }
        await kimbo(path, token, 'POST', payload); logs.push(`${action === 'sms' ? 'SMS SENT' : 'REPORT ADDED'} ${orderNum}`)
      } catch (e) { logs.push(`FAILED ${action.toUpperCase()} ${orderNum}: ${e instanceof Error ? e.message : 'Unknown error'}`) }
    }
    setOutput(logs.join('\n') || 'No orderNum values found.'); setStatus(`${action === 'sms' ? 'SMS' : 'Report'} batch finished`); setLoading(false)
  }

  const copy = () => { navigator.clipboard.writeText(output || input); setStatus('Copied output') }
  const download = () => { const a = document.createElement('a'); a.href = `data:text/plain;charset=utf-8,${encodeURIComponent(output || input)}`; a.download = `${tab}-output.txt`; a.click() }
  const nav: [Tab, string][] = [['whatsapp', 'WhatsApp'], ['phones', 'Phone Extractor'], ['sms', 'SMS'], ['remarks', 'Remarks'], ['contacts', 'Contact Extractor'], ['settings', 'Settings']]

  return <main className="min-h-screen bg-muted/30 text-foreground"><header className="border-b bg-background"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Collection workbench</p><h1 className="text-2xl font-semibold tracking-tight">Loan operations hub</h1></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><Wifi className="size-4" /> {status}</div></div><nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6">{nav.map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap ${tab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{label}</button>)}</nav></header>
    <div className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-xl border bg-background p-5 shadow-sm"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{tab === 'settings' ? 'Universal settings' : `${nav.find(([key]) => key === tab)?.[1]} workspace`}</h2><p className="text-sm text-muted-foreground">All actions use the saved Kimbo bearer token.</p></div>{tab !== 'settings' && <div className="flex gap-2"><Button variant="outline" size="sm" onClick={clear}>Clear</Button><Button variant="outline" size="sm" onClick={copy}><Copy data-icon="inline-start" />Copy</Button><Button variant="outline" size="sm" onClick={download}><Download data-icon="inline-start" />Save</Button></div>}</div>
      {tab === 'settings' ? <div className="max-w-xl space-y-5"><div className="rounded-lg border bg-muted/30 p-4"><h3 className="font-medium">Kimbo API access</h3><p className="mt-1 text-sm text-muted-foreground">The token is stored only in this browser&apos;s local cache and sent through the secure app proxy.</p><div className="mt-4 flex gap-2"><input value={token} onChange={(e) => setToken(e.target.value)} onFocus={loadToken} type="password" placeholder="Paste bearer token" className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm" /><Button onClick={saveToken}><Save data-icon="inline-start" />{saved ? 'Saved' : 'Save token'}</Button></div></div><div className="rounded-lg border p-4 text-sm text-muted-foreground"><p className="font-medium text-foreground">API flow</p><p className="mt-2">Case list → order detail by <code>id</code> → merged bank details. The order <code>id</code> is intentionally different from <code>orderNum</code>.</p></div></div> : <><div className="mb-4 flex flex-wrap gap-2"><Button onClick={fetchLive} disabled={loading}><Globe data-icon="inline-start" />{loading ? 'Working...' : 'Fetch from Kimbo'}</Button><Button variant="outline" onClick={() => setInput(EXAMPLE_DATA)}><FileJson data-icon="inline-start" />Load example</Button>{(tab === 'whatsapp' || tab === 'phones') && <Button variant="outline" onClick={extract}><Upload data-icon="inline-start" />Extract pasted data</Button>}</div>{(tab === 'sms' || tab === 'remarks') && <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3 text-sm">{tab === 'sms' ? <><label>Template <select value={template} onChange={(e) => setTemplate(e.target.value)} className="ml-2 rounded border bg-background px-2 py-1">{templates.map((id, i) => <option key={id} value={id}>Template {i + 1} — {id}</option>)}</select></label><Button size="sm" onClick={() => doAction('sms')} disabled={loading}>Send SMS to all</Button></> : <><input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Remark" className="rounded border bg-background px-3 py-1.5" /><select value={contactResult} onChange={(e) => setContactResult(e.target.value)} className="rounded border bg-background px-2 py-1.5"><option>No Reply</option><option>Answered</option><option>No Answer</option><option>Wrong Number</option><option>Busy</option></select><Button size="sm" onClick={() => doAction('remark')} disabled={loading}>Add report to all</Button></>}</div>}{tab === 'phones' && <div className="mb-4 flex gap-2"><Button size="sm" variant={mode === 'personalized' ? 'default' : 'outline'} onClick={() => setMode('personalized')}>Personalized</Button><Button size="sm" variant={mode === 'plain' ? 'default' : 'outline'} onClick={() => setMode('plain')}>Plain</Button></div>}<div className="grid gap-4 lg:grid-cols-2"><textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste raw JSON or fetch live data..." className="min-h-[430px] resize-y rounded-lg border bg-background p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-ring" /><textarea readOnly value={output || (tab === 'phones' ? records.map((r) => mode === 'personalized' ? `${r.name}:${r.phone}` : r.phone).join('\n') : '')} placeholder="Output appears here..." className="min-h-[430px] resize-y rounded-lg border bg-muted/20 p-3 font-mono text-xs" /></div></>}</section>
      <aside className="space-y-4"><div className="rounded-xl border bg-background p-5 shadow-sm"><h3 className="font-semibold">Run summary</h3><div className="mt-4 grid grid-cols-2 gap-3">{[['Cases', rows.length || result?.stats.rawCount || 0], ['Processed', result?.stats.processedCount || 0], ['Apps', result?.stats.uniqueApps.size || 0], ['Warnings', result?.stats.warningCount || 0]].map(([label, value]) => <div key={label} className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}</div></div>{error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><p className="font-semibold">Request error</p><p className="mt-1">{error}</p></div>}<div className="rounded-xl border bg-background p-5 text-sm text-muted-foreground"><Settings2 className="mb-3 size-4 text-primary" /><p className="font-medium text-foreground">One token, every section</p><p className="mt-1">Configure access once in Settings. Live extraction reports authentication, API, and per-order detail errors instead of silently returning incomplete data.</p></div></aside>
    </div></main>
}

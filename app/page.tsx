'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { extractFromRawInput } from '@/lib/extractor'
import { EXAMPLE_DATA } from '@/lib/example-data'
import type { ExtractionResult, LoanRecord } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, Copy, Download, FileJson, Globe, Loader2, Menu, Moon, Save, Sun, Upload, Wifi, X } from 'lucide-react'

type Tab = 'whatsapp' | 'phones' | 'sms' | 'remarks' | 'contacts' | 'settings'
type ApiRow = Record<string, any>
const LIST_PATH = '/adminApi/system/loan/collectionAssign/collect/case/list?pageNum=1&pageSize=200&recordType=0'
const TEMPLATES = ['2062494888535728129', '2057421681597583361']

function rowsFrom(value: any): ApiRow[] {
  if (Array.isArray(value)) return value.flatMap(rowsFrom)
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value.rows)) return value.rows.filter((row: any) => row && typeof row === 'object')
  if (value.data) return rowsFrom(value.data)
  return [value]
}

async function kimbo(path: string, token: string, method: 'GET' | 'POST' = 'GET', payload?: unknown) {
  const response = await fetch('/api/kimbo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, token, method, payload }) })
  const body = await response.json()
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`)
  if (body.data?.code && body.data.code !== 200) throw new Error(body.data.msg || `Kimbo returned code ${body.data.code}`)
  return body.data
}

function downloadFile(name: string, text: string, type = 'text/plain') {
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([text], { type })); link.download = name; link.click(); URL.revokeObjectURL(link.href)
}

export default function Page() {
  const [tab, setTab] = useState<Tab>('whatsapp')
  const [token, setToken] = useState('')
  const [rows, setRows] = useState<ApiRow[]>([])
  const [input, setInput] = useState('')
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [output, setOutput] = useState('')
  const [status, setStatus] = useState('Ready')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [openInput, setOpenInput] = useState(true)
  const [openOutput, setOpenOutput] = useState(false)
  const [mode, setMode] = useState<'personalized' | 'plain'>('personalized')
  const [contactRows, setContactRows] = useState<ApiRow[]>([])
  const [liveLog, setLiveLog] = useState<string[]>([])
  const [template, setTemplate] = useState(TEMPLATES[0])
  const [templateText, setTemplateText] = useState('')
  const [reachOutBy, setReachOutBy] = useState('Sms')
  const [contactRelations, setContactRelations] = useState('Self')
  const [remark, setRemark] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactResult, setContactResult] = useState('No Reply')
  const [collectionTag, setCollectionTag] = useState('No Answer')
  const [contactNo, setContactNo] = useState('')
  const [topFilter, setTopFilter] = useState<'all' | '10' | '20' | '30'>('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    const savedTheme = localStorage.getItem('empathy-theme') === 'dark' ? 'dark' : 'light'
    setTheme(savedTheme)
    document.documentElement.classList.toggle('dark', savedTheme === 'dark')
    document.documentElement.classList.toggle('light', savedTheme === 'light')
  }, [])

  useEffect(() => {
    if (!error && !saved) return
    setAlert({ type: error ? 'error' : 'success', message: error || 'Bearer token saved in browser cache' })
    const timeout = window.setTimeout(() => {
      setAlert(null)
      setError('')
      setSaved(false)
    }, 2000)
    return () => window.clearTimeout(timeout)
  }, [error, saved])

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  }, [])

  const filteredRows = useMemo(() => {
    const source = [...rows].sort((a, b) => Number(b.inpayAmount ?? 0) - Number(a.inpayAmount ?? 0))
    return topFilter === 'all' ? source : source.slice(0, Number(topFilter))
  }, [rows, topFilter])
  const records = useMemo(() => result?.records ?? filteredRows.map((r) => ({ loanId: String(r.orderNum ?? ''), name: String(r.customerName ?? r.name ?? ''), phone: String(r.phone ?? r.phoneNumber ?? ''), amount: Number(r.inpayAmount ?? 0), appType: String(r.appName ?? ''), dayType: Number(r.overdueDays ?? 0), accountDetails: r.accountNum ? [{ bank: r.bankName, accountNumber: r.accountNum, accountName: r.accountName }] : [] } as LoanRecord)), [result, filteredRows])
  const apps = useMemo(() => [...new Set(rows.map((row) => String(row.appName || 'Unknown app')))], [rows])

  const saveToken = () => { localStorage.setItem('kimbo-bearer-token', token.trim()); setSaved(true); setStatus('Bearer token saved in browser cache') }
  const loadToken = () => setToken(localStorage.getItem('kimbo-bearer-token') || '')
  const changeTheme = (nextTheme: 'light' | 'dark') => { setTheme(nextTheme); localStorage.setItem('empathy-theme', nextTheme); document.documentElement.classList.toggle('dark', nextTheme === 'dark'); document.documentElement.classList.toggle('light', nextTheme === 'light') }
  const closeAlert = () => { setAlert(null); setError(''); setSaved(false) }
  const clear = () => { setRows([]); setResult(null); setOutput(''); setInput(''); setError(''); setStatus('Ready') }

  const fetchLive = async () => {
    if (!token.trim()) return setError('Save a bearer token in Settings before fetching.')
    setLoading(true); setError(''); setLiveLog([]); setStatus('Fetching raw case list...')
    try {
      const list = rowsFrom(await kimbo(LIST_PATH, token));
      setRows(list); setInput(JSON.stringify(list, null, 2)); setStatus(`Raw data loaded: ${list.length} cases. Ready to extract.`)
      setLiveLog([`GET case list: ${list.length} cases loaded`, 'No detail requests run yet — click Extract to enrich rows.'])
    } catch (e) { setError(e instanceof Error ? e.message : 'Token or network request failed.'); setStatus('Request failed') }
    finally { setLoading(false) }
  }

  const sourceRows = () => {
    const source = rows.length ? rows : rowsFrom(JSON.parse(input))
    const sorted = [...source].sort((a, b) => Number(b.inpayAmount ?? 0) - Number(a.inpayAmount ?? 0))
    return topFilter === 'all' ? sorted : sorted.slice(0, Number(topFilter))
  }

  const extract = () => {
    try {
      const source = sourceRows(); if (!source.length) return setError('Fetch raw Kimbo data first.')
      const next = extractFromRawInput(JSON.stringify(source), true)
      setResult(next); setOutput(JSON.stringify(next.records, null, 2)); setOpenOutput(true); setStatus(`Extracted ${next.records.length} records. Use Update bank details to enrich them.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Input is not valid JSON.'); setStatus('Extraction failed') }
  }

  const updateBankDetails = async () => {
    const source = sourceRows(); if (!source.length) return setError('Fetch raw Kimbo data first.')
    setLoading(true); setError(''); setLiveLog(['Starting bank detail update...']); const enriched: ApiRow[] = []
    try {
      for (let i = 0; i < source.length; i++) {
        const row = source[i]; setStatus(`Getting bank details ${i + 1} of ${source.length}...`)
        if (!row.id) { enriched.push({ ...row, _bankDetailError: 'Missing case id' }); setLiveLog((log) => [...log, `FAILED ${row.orderNum || 'row'}: missing case id`]); continue }
        try {
          const response = await kimbo(`/adminApi/system/loan/order/${encodeURIComponent(String(row.id))}`, token)
          const detail = response?.data?.virtualCardInfo ?? response?.data?.data?.virtualCardInfo ?? response?.virtualCardInfo ?? response?.data?.data ?? response?.data ?? response
          const detailUserId = detail?.userId ?? detail?.virtualCardInfo?.userId
          const matched = Boolean(detailUserId && row.userId && String(detailUserId) === String(row.userId))
          enriched.push({ ...row, accountNum: detail?.accountNum, accountName: detail?.accountName, bankName: detail?.bankName, detailUserId, _bankMatched: matched, _bankDetailLoaded: true })
          setLiveLog((log) => [...log, `${matched ? 'SUCCESS' : 'CHECKED'} bank for ${row.orderNum || row.id}: ${detail?.bankName || 'no bank returned'}${matched ? ` (userId ${detailUserId} matched)` : ' (userId did not match)'}`])
        } catch (e) { const message = e instanceof Error ? e.message : 'request failed'; enriched.push({ ...row, _bankDetailError: message }); setLiveLog((log) => [...log, `FAILED ${row.orderNum || row.id}: ${message}`]) }
      }
      setRows(enriched); setInput(JSON.stringify(enriched, null, 2)); const next = extractFromRawInput(JSON.stringify(enriched), true); setResult(next); setOutput(JSON.stringify(next.records, null, 2)); setOpenOutput(true); setStatus(`Bank update complete: ${enriched.filter((r) => r._bankMatched).length} matched`)
    } finally { setLoading(false); setTimeout(() => setLiveLog([]), 2500) }
  }

  const extractPhones = () => {
    const grouped = new Map<string, string[]>()
    sourceRows().forEach((row) => { const app = String(row.appName || 'Unknown app'); const phone = String(row.phone || row.phoneNumber || '').trim(); if (phone) grouped.set(app, [...(grouped.get(app) || []), phone]) })
    const text = [...grouped].map(([app, phones]) => `${app}\n${[...new Set(phones)].map((phone) => { const row = sourceRows().find((candidate) => String(candidate.phone || candidate.phoneNumber || '').trim() === phone); return mode === 'personalized' ? `${String(row?.customerName || 'Unknown customer').trim()}:${phone}` : phone }).join('\n')}`).join('\n\n'); setOutput(text); setOpenOutput(true); setStatus(`Extracted ${mode} phones for ${grouped.size} apps`)
  }

  const extractContacts = async () => {
    if (!rows.length) return setError('Fetch raw Kimbo data first.')
    const selectedRows = sourceRows()
    setLoading(true); setError(''); setLiveLog(['Starting contact extraction...']); const results: ApiRow[] = []
    try {
      for (let i = 0; i < selectedRows.length; i++) { const row = selectedRows[i]; const userId = row.userId; if (!userId) continue; setStatus(`Fetching contacts ${i + 1} of ${rows.length}...`); setLiveLog((log) => [...log, `GET userContact/app/list?userId=${userId}`]); const response = await kimbo(`/adminApi/system/loan/userContact/app/list?userId=${encodeURIComponent(String(userId))}`, token); const data = response?.data || response; const contacts = [...(data?.contactList || []), ...(data?.emergencyContact || [])]; results.push({ row, contacts }); }
      setContactRows(results); setOutput(results.map(({ row, contacts }) => `${row.customerName || 'Unknown customer'}\n${[row.phone, ...contacts.map((c: ApiRow) => c.contactNo || c.contactPhone)].filter(Boolean).join('\n')}`).join('\n\n')); setOpenOutput(true); setStatus(`Extracted contacts for ${results.length} customers`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Contact request failed.') } finally { setLoading(false) }
  }

  const loadSmsTemplate = async () => {
    const row = rows[0]; if (!row?.orderNum) return setError('Fetch Kimbo data first so a template can be previewed.')
    setLoading(true); setError(''); try { const query = `/adminApi/system/loan/collectionAssign/app/getSmsContent?templateId=${template}&orderNum=${encodeURIComponent(row.orderNum)}&country=${row.country || 'NG'}&appName=${encodeURIComponent(row.appName || '')}`; const data = await kimbo(query, token); setTemplateText(JSON.stringify(data, null, 2)); setStatus('SMS template loaded') } catch (e) { setError(e instanceof Error ? e.message : 'Template request failed.') } finally { setLoading(false) }
  }

  const runAction = async (action: 'sms' | 'remark') => {
    if (!rows.length) return setError('Fetch Kimbo data first.')
    setLoading(true); setError(''); const logs: string[] = []
    for (let i = 0; i < rows.length; i++) { const row = rows[i]; const orderNum = String(row.orderNum || ''); if (!orderNum) continue; setStatus(`${action === 'sms' ? 'Sending SMS' : 'Saving remarks'} ${i + 1} of ${rows.length}...`); try { const payload = action === 'sms' ? { orderNum, templateId: Number(template), country: row.country || 'NG', appName: row.appName || '' } : { orderNum, reachOutBy, contactRelations, remark: remark || null, contactName: contactName || null, contactResult, collectionTag, contactNo: contactNo || null }; await kimbo(action === 'sms' ? '/adminApi/system/loan/collectionAssign/sendSms' : '/adminApi/system/loan/collectionRecord', token, 'POST', payload); logs.push(`SUCCESS ${orderNum}`) } catch (e) { logs.push(`FAILED ${orderNum}: ${e instanceof Error ? e.message : 'Unknown error'}`) } }
    setOutput(logs.join('\n') || 'No order numbers found.'); setOpenOutput(true); setStatus(`${action === 'sms' ? 'SMS' : 'Remark'} run complete`); setLoading(false); setLiveLog(logs); setTimeout(() => setLiveLog([]), 2500)
  }

  const nav: [Tab, string][] = [['whatsapp', 'WhatsApp'], ['phones', 'Phone Extractor'], ['sms', 'SMS'], ['remarks', 'Remarks'], ['contacts', 'Contact Extractor'], ['settings', 'Settings']]
  const copy = () => { navigator.clipboard.writeText(output); setStatus('Output copied') }
  const save = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    downloadFile(`${tab}-output-${timestamp}.${tab === 'whatsapp' ? 'json' : 'txt'}`, output, tab === 'whatsapp' ? 'application/json' : 'text/plain')
  }

  return <main className="min-h-screen bg-muted/30 text-foreground"><header className="border-b bg-background"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-6 sm:py-5"><div className="min-w-0"><p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-primary sm:text-xs sm:tracking-[0.2em]">Empathy Desk Workspace</p><h1 className="truncate text-lg font-semibold tracking-tight sm:text-2xl">Empathy Desk Workspace</h1></div><div className="flex shrink-0 items-center gap-2"><div className="hidden min-w-0 items-center gap-2 text-xs text-muted-foreground sm:flex"><Wifi className="size-4 shrink-0" /><span className="max-w-52 truncate">{status}</span></div><Button variant="outline" size="icon" aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X data-icon="inline-start" /> : <Menu data-icon="inline-start" />}</Button></div></div>{menuOpen && <nav className="mx-3 mb-3 grid gap-1 rounded-lg border bg-muted/30 p-2 shadow-sm sm:mx-6 sm:grid-cols-3 lg:mx-auto lg:max-w-7xl">{nav.map(([key, label]) => <button key={key} onClick={() => { setTab(key); setMenuOpen(false) }} className={`rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors ${tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-background hover:text-foreground'}`}>{label}</button>)}</nav>}</header>
    <div className="mx-auto grid max-w-7xl gap-4 p-3 sm:gap-6 sm:p-6 lg:grid-cols-[minmax(0,1fr)_340px]"><section className="min-w-0 rounded-xl border bg-background p-3 shadow-sm sm:p-5"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"><div className="min-w-0"><h2 className="text-lg font-semibold">{tab === 'settings' ? 'Universal settings' : `${nav.find(([key]) => key === tab)?.[1]} workspace`}</h2><p className="text-sm text-muted-foreground">Fetch once, then run each section from the same clean data set.</p></div>{tab !== 'settings' && <div className="flex gap-2"><Button variant="outline" size="sm" onClick={clear}>Clear</Button>{output && <><Button variant="outline" size="sm" onClick={copy}><Copy data-icon="inline-start" />Copy</Button>{['whatsapp', 'phones', 'contacts'].includes(tab) && <Button variant="outline" size="sm" onClick={save}><Download data-icon="inline-start" />Save</Button>}</>}</div>}</div>
      {tab === 'settings' ? <div className="max-w-xl"><div className="rounded-lg border bg-muted/30 p-4"><h3 className="font-medium">Kimbo API access</h3><p className="mt-1 text-sm text-muted-foreground">Stored only in this browser cache. It is never persisted by the server.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={token} onChange={(e) => setToken(e.target.value)} onFocus={loadToken} type="password" placeholder="Paste bearer token" className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm" /><Button onClick={saveToken}><Save data-icon="inline-start" />{saved ? 'Saved' : 'Save token'}</Button></div></div><div className="mt-4 rounded-lg border p-4 text-sm text-muted-foreground">Case list → detail lookup by <code>id</code> → matched <code>userId</code>, bank, account number, and account name. The detail request never uses <code>orderNum</code>.</div><div className="mt-4 rounded-lg border bg-muted/30 p-4"><h3 className="font-medium">Appearance</h3><p className="mt-1 text-sm text-muted-foreground">Choose the workspace theme.</p><div className="mt-3 flex gap-2"><Button variant={theme === 'light' ? 'default' : 'outline'} onClick={() => changeTheme('light')}><Sun data-icon="inline-start" />Light</Button><Button variant={theme === 'dark' ? 'default' : 'outline'} onClick={() => changeTheme('dark')}><Moon data-icon="inline-start" />Dark</Button></div></div></div> : <><div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center"><Button className="col-span-2 min-w-0 sm:col-span-1" onClick={fetchLive} disabled={loading}>{loading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Globe data-icon="inline-start" />}Fetch from Kimbo</Button>{tab === 'whatsapp' && <Button variant="outline" onClick={() => setInput(EXAMPLE_DATA)}><FileJson data-icon="inline-start" />Load example</Button>}{tab === 'whatsapp' && <Button variant="outline" onClick={extract}><Upload data-icon="inline-start" />Extract</Button>}{tab === 'whatsapp' && <Button variant="outline" onClick={updateBankDetails} disabled={loading}><Wifi data-icon="inline-start" />Update bank details</Button>}{tab === 'phones' && <Button variant="outline" onClick={extractPhones}><Upload data-icon="inline-start" />Extract phones</Button>}{tab === 'contacts' && <Button variant="outline" onClick={extractContacts}><Upload data-icon="inline-start" />Extract contacts</Button>}{['whatsapp', 'phones', 'contacts'].includes(tab) && <label className="col-span-2 flex min-w-0 items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1 text-sm text-muted-foreground sm:col-span-1 sm:ml-auto sm:justify-start">Top customers<select aria-label="Customer filter" value={topFilter} onChange={(e) => setTopFilter(e.target.value as typeof topFilter)} className="rounded-md border bg-background px-2 py-2 text-foreground"><option value="all">All</option><option value="10">Top 10</option><option value="20">Top 20</option><option value="30">Top 30</option></select></label>}</div>
        {(tab === 'whatsapp' || tab === 'phones' || tab === 'contacts') && <Panel title="Input data" open={openInput} onToggle={() => setOpenInput(!openInput)}><textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Fetch from Kimbo or paste JSON here" className="min-h-44 w-full rounded-md border bg-background p-3 font-mono text-xs" /></Panel>}
        {tab === 'phones' && <div className="mt-4 flex gap-2"><Button variant={mode === 'personalized' ? 'default' : 'outline'} onClick={() => setMode('personalized')}>Personalized</Button><Button variant={mode === 'plain' ? 'default' : 'outline'} onClick={() => setMode('plain')}>Plain</Button></div>}
        {tab === 'sms' && <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3 text-sm"><label className="flex flex-col gap-1">Template<select value={template} onChange={(e) => setTemplate(e.target.value)} className="rounded border bg-background px-2 py-2">{TEMPLATES.map((id, i) => <option key={id} value={id}>Template {i + 1} — {id}</option>)}</select></label><Button onClick={loadSmsTemplate} disabled={loading}>Preview template</Button><Button onClick={() => runAction('sms')} disabled={loading}>Send SMS to all</Button></div>}
        {tab === 'remarks' && <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2">{[['Reach out by', reachOutBy, setReachOutBy, ['Phone', 'Whatsapp', 'Sms']], ['Contact relations', contactRelations, setContactRelations, ['Self', 'Contact']], ['Contact result', contactResult, setContactResult, ['No Reply']], ['Collection tag', collectionTag, setCollectionTag, ['No Answer', 'Sent Unread', 'Read', 'Unavailable', 'Not on whatsapp']]].map(([label, value, setter, options]: any) => <label key={label as string} className="flex flex-col gap-1">{label as string}<select value={value as string} onChange={(e) => setter(e.target.value)} className="rounded border bg-background px-2 py-2">{options.map((option: string) => <option key={option}>{option}</option>)}</select></label>)}<input placeholder="Remark (optional)" value={remark} onChange={(e) => setRemark(e.target.value)} className="rounded border bg-background px-3 py-2" /><input placeholder="Contact name (optional)" value={contactName} onChange={(e) => setContactName(e.target.value)} className="rounded border bg-background px-3 py-2" /><input placeholder="Contact no. (optional)" value={contactNo} onChange={(e) => setContactNo(e.target.value)} className="rounded border bg-background px-3 py-2" /><Button onClick={() => runAction('remark')} disabled={loading}>Save remarks for all</Button></div>}
        {templateText && <Panel title="SMS template response" open={true} onToggle={() => setTemplateText('')}><pre className="max-h-52 overflow-auto whitespace-pre-wrap text-xs">{templateText}</pre></Panel>}
        {output && <Panel title="Output" open={openOutput} onToggle={() => setOpenOutput(!openOutput)}><OutputView tab={tab} records={records} output={output} onCopyGroup={(text, label) => { navigator.clipboard.writeText(text); setStatus(`${label} group copied`) }} /></Panel>}
        {liveLog.length > 0 && <Panel title="Live request progress" open={true} onToggle={() => setLiveLog([])}><div className="max-h-48 overflow-auto rounded-md bg-muted/40 p-3 font-mono text-xs">{liveLog.map((line, i) => <div key={`${line}-${i}`} className="border-b border-border/50 py-1 last:border-0">{line}</div>)}</div></Panel>}
      </>}</section>
      <aside className="space-y-4">{alert && <div role="alert" className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-sm shadow-sm ${alert.type === 'error' ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-primary/30 bg-primary/10 text-foreground'}`}><div><p className="font-semibold">{alert.type === 'error' ? 'Request error' : 'Success'}</p><p className="mt-1">{alert.message}</p></div><Button variant="ghost" size="icon" aria-label="Close alert" onClick={closeAlert}><X data-icon="inline-start" /></Button></div>}<div className="rounded-xl border bg-background p-5 shadow-sm"><h3 className="font-semibold">Run summary</h3><div className="mt-4 grid grid-cols-2 gap-3">{[['Cases', rows.length], ['Processed', result?.stats.processedCount || 0], ['Apps', apps.length], ['Warnings', result?.stats.warningCount || rows.filter((r) => r._bankDetailError).length || 0]].map(([label, value]) => <div key={label as string} className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label as string}</p><p className="mt-1 text-xl font-semibold">{value as number}</p></div>)}</div></div></aside></div></main>
}

function OutputView({ tab, records, output, onCopyGroup }: { tab: Tab; records: LoanRecord[]; output: string; onCopyGroup: (text: string, label: string) => void }) {
  if (tab === 'whatsapp') return <div className="max-h-[30rem] overflow-auto rounded-md border"><table className="w-full min-w-[760px] text-left text-xs"><thead className="sticky top-0 bg-muted"><tr>{['App','Customer','Phone','Loan ID','Amount','Bank','Account number','Account name'].map((heading) => <th key={heading} className="px-3 py-2 font-semibold">{heading}</th>)}</tr></thead><tbody>{records.map((record) => <tr key={`${record.appType}-${record.loanId}`} className="border-t"><td className="px-3 py-2">{record.appType}</td><td className="px-3 py-2">{record.name}</td><td className="px-3 py-2">{record.phone}</td><td className="px-3 py-2">{record.loanId}</td><td className="px-3 py-2">{record.amount}</td><td className="px-3 py-2">{record.accountDetails[0]?.bank || '—'}</td><td className="px-3 py-2">{record.accountDetails[0]?.accountNumber || '—'}</td><td className="px-3 py-2">{record.accountDetails[0]?.accountName || '—'}</td></tr>)}</tbody></table></div>
  if (tab === 'phones' || tab === 'contacts') return <div className="grid gap-3">{output.split(/\n\n+/).filter(Boolean).map((group) => { const [app, ...lines] = group.split('\n'); return <div key={app} className="rounded-md border bg-muted/20"><div className="flex items-center justify-between border-b px-3 py-2"><span className="font-semibold">{app}</span><Button variant="outline" size="sm" onClick={() => onCopyGroup(lines.join('\n'), app)}><Copy data-icon="inline-start" />Copy group</Button></div><pre className="whitespace-pre-wrap p-3 text-xs">{lines.join('\n')}</pre></div> })}</div>
  return <pre className="max-h-[30rem] overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-4 text-xs">{output}</pre>
}

function Panel({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) { return <div className="mt-4 rounded-lg border"><button onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"><span>{title}</span>{open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</button>{open && <div className="border-t p-4">{children}</div>}</div> }

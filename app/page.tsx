'use client'

import { useState, useMemo } from 'react'
import {
  extractFromRawInput,
  groupRecordsByApp,
  removeDuplicates,
} from '@/lib/extractor'
import { formatNaira } from '@/lib/amount'
import { EXAMPLE_DATA } from '@/lib/example-data'
import { LoanRecord, ExtractionResult } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  Copy,
  Download,
  RotateCcw,
  Search,
  Settings2,
  Check,
} from 'lucide-react'

interface UIState {
  input: string
  result: ExtractionResult | null
  activeTab: 'processed' | 'warnings' | 'excluded'
  searchQuery: string
  selectedApp: string
  outputMode: 'grouped' | 'array' | 'text'
  normalizePhone: boolean
  removeDuplicates: boolean
  showSettings: boolean
  copiedSection: string | null
}

export default function Page() {
  const [state, setState] = useState<UIState>({
    input: '',
    result: null,
    activeTab: 'processed',
    searchQuery: '',
    selectedApp: 'All Apps',
    outputMode: 'grouped',
    normalizePhone: true,
    removeDuplicates: false,
    showSettings: false,
    copiedSection: null,
  })

  const processedRecords = useMemo(() => {
    if (!state.result) return []

    let records = state.result.records

    if (state.removeDuplicates) {
      const { unique } = removeDuplicates(records)
      records = unique
    }

    if (state.selectedApp !== 'All Apps') {
      records = records.filter((r) => r.appType === state.selectedApp)
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase()
      records = records.filter(
        (r) =>
          r.loanId.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.phone.toLowerCase().includes(q) ||
          r.appType.toLowerCase().includes(q)
      )
    }

    return records
  }, [state.result, state.selectedApp, state.searchQuery, state.removeDuplicates])

  const uniqueApps = useMemo(() => {
    if (!state.result) return []
    return Array.from(state.result.stats.uniqueApps).sort()
  }, [state.result])

  const outputContent = useMemo(() => {
    if (!state.result) return ''

    const records = processedRecords

    switch (state.outputMode) {
      case 'grouped': {
        const grouped = groupRecordsByApp(records)
        return JSON.stringify(grouped, null, 2)
      }
      case 'array':
        return JSON.stringify(records, null, 2)
      case 'text': {
        const grouped = groupRecordsByApp(records)
        return Object.entries(grouped)
          .map(
            ([app, recs]) =>
              `${app}\n\n${JSON.stringify(recs, null, 2)}`
          )
          .join('\n\n---\n\n')
      }
    }
  }, [processedRecords, state.outputMode])

  const handleExtract = () => {
    const result = extractFromRawInput(state.input, state.normalizePhone)
    setState((s) => ({ ...s, result }))
  }

  const handleLoadExample = () => {
    setState((s) => ({ ...s, input: EXAMPLE_DATA }))
  }

  const handleClear = () => {
    setState((s) => ({
      ...s,
      input: '',
      result: null,
      searchQuery: '',
      selectedApp: 'All Apps',
      copiedSection: null,
    }))
  }

  const handleFormatInput = () => {
    try {
      const parsed = JSON.parse(state.input)
      const formatted = JSON.stringify(parsed, null, 2)
      setState((s) => ({ ...s, input: formatted }))
    } catch {
      // Not valid JSON, ignore
    }
  }

  const handleCopy = (section: string) => {
    navigator.clipboard.writeText(outputContent)
    setState((s) => ({ ...s, copiedSection: section }))
    setTimeout(() => {
      setState((s) => ({ ...s, copiedSection: null }))
    }, 2000)
  }

  const handleDownload = () => {
    const element = document.createElement('a')
    element.setAttribute(
      'href',
      'data:text/json;charset=utf-8,' + encodeURIComponent(outputContent)
    )
    element.setAttribute('download', 'processed-loans.json')
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const stats = state.result?.stats

  return (
    <main className="min-h-screen bg-background">
      <div className="flex flex-col lg:flex-row">
        <div className="flex-1 border-r border-border p-6 lg:min-h-screen">
          <div className="max-w-2xl">
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-1">Loan Dump Extractor</h1>
              <p className="text-sm text-muted-foreground">
                Extract, clean, transform and group raw loan data.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Paste Raw Data</label>
                  <div className="flex gap-2">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={handleLoadExample}
                      className="text-xs"
                    >
                      Load Example
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        setState((s) => ({
                          ...s,
                          showSettings: !s.showSettings,
                        }))
                      }
                      className="text-xs"
                    >
                      <Settings2 className="size-3 mr-1" />
                      Settings
                    </Button>
                  </div>
                </div>

                <textarea
                  value={state.input}
                  onChange={(e) =>
                    setState((s) => ({ ...s, input: e.target.value }))
                  }
                  placeholder="Paste JSON, JSON fragments, API dumps, or raw text here..."
                  className="w-full h-48 p-3 border border-border rounded-lg bg-background text-foreground text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {state.showSettings && (
                <div className="p-3 border border-border rounded-lg bg-muted/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Normalize Nigerian phone numbers
                    </label>
                    <button
                      onClick={() =>
                        setState((s) => ({
                          ...s,
                          normalizePhone: !s.normalizePhone,
                        }))
                      }
                      className="w-9 h-5 rounded-full bg-muted border border-border flex items-center transition-colors"
                      style={{
                        backgroundColor: state.normalizePhone
                          ? 'var(--color-primary)'
                          : 'var(--color-muted)',
                      }}
                    >
                      <span
                        className="w-4 h-4 rounded-full bg-white transition-transform"
                        style={{
                          transform: state.normalizePhone
                            ? 'translateX(18px)'
                            : 'translateX(2px)',
                        }}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <label className="text-sm font-medium">
                      Remove exact duplicates
                    </label>
                    <button
                      onClick={() =>
                        setState((s) => ({
                          ...s,
                          removeDuplicates: !s.removeDuplicates,
                        }))
                      }
                      className="w-9 h-5 rounded-full bg-muted border border-border flex items-center transition-colors"
                      style={{
                        backgroundColor: state.removeDuplicates
                          ? 'var(--color-primary)'
                          : 'var(--color-muted)',
                      }}
                    >
                      <span
                        className="w-4 h-4 rounded-full bg-white transition-transform"
                        style={{
                          transform: state.removeDuplicates
                            ? 'translateX(18px)'
                            : 'translateX(2px)',
                        }}
                      />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-border">
                    <label className="text-sm font-medium block mb-2">
                      Output Mode
                    </label>
                    <div className="flex gap-2">
                      {(['grouped', 'array', 'text'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() =>
                            setState((s) => ({ ...s, outputMode: mode }))
                          }
                          className={`px-2 py-1 text-xs rounded border transition-colors ${
                            state.outputMode === mode
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border bg-background hover:bg-muted'
                          }`}
                        >
                          {mode === 'grouped' ? 'Grouped' : mode === 'array' ? 'Array' : 'Text'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleExtract}
                  className="flex-1"
                >
                  Extract Data
                </Button>
                <Button onClick={handleFormatInput} variant="outline" size="sm">
                  Format
                </Button>
                <Button onClick={handleClear} variant="outline" size="sm">
                  <RotateCcw className="size-4" />
                </Button>
              </div>
            </div>

            {stats && (
              <div className="mt-8 p-4 border border-border rounded-lg bg-card">
                <h3 className="font-medium text-sm mb-3">Extraction Report</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Detected</div>
                    <div className="font-mono font-semibold">
                      {stats.rawCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">
                      Candidates
                    </div>
                    <div className="font-mono font-semibold">
                      {stats.candidateCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">
                      Processed
                    </div>
                    <div className="font-mono font-semibold">
                      {stats.processedCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Excluded</div>
                    <div className="font-mono font-semibold">
                      {stats.excludedCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Warnings</div>
                    <div className="font-mono font-semibold">
                      {stats.warningCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Apps</div>
                    <div className="font-mono font-semibold">
                      {stats.uniqueApps.size}
                    </div>
                  </div>
                  {stats.processedCount > 0 && (
                    <div className="col-span-2">
                      <div className="text-muted-foreground text-xs">
                        Total Amount
                      </div>
                      <div className="font-mono font-semibold">
                        {formatNaira(stats.totalAmount)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!state.result && (
              <div className="mt-8 p-4 border border-border rounded-lg bg-muted/50">
                <div className="text-sm">
                  <p className="font-medium mb-1">Local Processing</p>
                  <p className="text-muted-foreground text-xs">
                    Your raw data is processed in your browser and is not
                    uploaded to a server.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 p-6 lg:min-h-screen lg:overflow-y-auto">
          <div className="max-w-2xl">
            {!state.result ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No data extracted yet. Paste raw data and click Extract.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search loan ID, name, phone or app..."
                        value={state.searchQuery}
                        onChange={(e) =>
                          setState((s) => ({
                            ...s,
                            searchQuery: e.target.value,
                          }))
                        }
                        className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        setState((s) => ({
                          ...s,
                          selectedApp: 'All Apps',
                        }))
                      }
                      className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                        state.selectedApp === 'All Apps'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border bg-background hover:bg-muted'
                      }`}
                    >
                      All Apps ({state.result.records.length})
                    </button>
                    {uniqueApps.map((app) => {
                      const count = state.result.records.filter(
                        (r) => r.appType === app
                      ).length
                      return (
                        <button
                          key={app}
                          onClick={() =>
                            setState((s) => ({
                              ...s,
                              selectedApp: app,
                            }))
                          }
                          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                            state.selectedApp === app
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'border-border bg-background hover:bg-muted'
                          }`}
                        >
                          {app} ({count})
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="flex border-b border-border bg-muted/30">
                    {['processed', 'warnings', 'excluded'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() =>
                          setState((s) => ({
                            ...s,
                            activeTab: tab as UIState['activeTab'],
                          }))
                        }
                        className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                          state.activeTab === tab
                            ? 'bg-background border-b-2 border-primary text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {tab === 'processed'
                          ? `Processed (${processedRecords.length})`
                          : tab === 'warnings'
                            ? `Warnings (${state.result.warnings.length})`
                            : `Excluded (${state.result.excluded.length})`}
                      </button>
                    ))}
                  </div>

                  <div className="overflow-x-auto">
                    {state.activeTab === 'processed' && (
                      <table className="w-full text-sm">
                        <thead className="bg-muted/30 border-b border-border">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">App</th>
                            <th className="px-3 py-2 text-left font-medium">
                              Loan ID
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Customer
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Phone
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Amount
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Days
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Bank
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {processedRecords.length === 0 ? (
                            <tr>
                              <td
                                colSpan={7}
                                className="px-3 py-4 text-center text-muted-foreground text-xs"
                              >
                                No records found
                              </td>
                            </tr>
                          ) : (
                            processedRecords.map((record, idx) => (
                              <tr
                                key={idx}
                                className="border-b border-border hover:bg-muted/30 transition-colors"
                              >
                                <td className="px-3 py-2 font-mono text-xs">
                                  {record.appType}
                                </td>
                                <td className="px-3 py-2 font-mono text-xs">
                                  {record.loanId}
                                </td>
                                <td className="px-3 py-2 text-xs">
                                  {record.name}
                                </td>
                                <td className="px-3 py-2 font-mono text-xs">
                                  {record.phone}
                                </td>
                                <td className="px-3 py-2 font-mono text-xs font-medium">
                                  {formatNaira(record.amount)}
                                </td>
                                <td className="px-3 py-2 font-mono text-xs">
                                  {record.dayType}
                                </td>
                                <td className="px-3 py-2 text-xs">
                                  {record.accountDetails[0]?.bank || '-'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}

                    {state.activeTab === 'warnings' && (
                      <div className="p-3 space-y-2">
                        {state.result.warnings.length === 0 ? (
                          <p className="text-muted-foreground text-xs py-4">
                            No warnings
                          </p>
                        ) : (
                          state.result.warnings.map((warning, idx) => (
                            <div
                              key={idx}
                              className="p-2 border border-border rounded bg-background text-xs"
                            >
                              <div className="font-mono font-medium">
                                {warning.recordId || 'Unknown'}
                              </div>
                              <div className="text-muted-foreground mt-1">
                                {warning.message}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {state.activeTab === 'excluded' && (
                      <div className="p-3 space-y-2">
                        {state.result.excluded.length === 0 ? (
                          <p className="text-muted-foreground text-xs py-4">
                            No excluded records
                          </p>
                        ) : (
                          state.result.excluded.map((record, idx) => (
                            <div
                              key={idx}
                              className="p-2 border border-border rounded bg-background text-xs"
                            >
                              <div className="flex justify-between">
                                <div className="font-mono font-medium">
                                  {record.loanId || 'Unknown'}
                                </div>
                                <div className="text-destructive">
                                  {record.reason}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm">JSON Output</h3>
                    <div className="flex gap-2">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => handleCopy('json')}
                        className="text-xs"
                      >
                        {state.copiedSection === 'json' ? (
                          <>
                            <Check className="size-3 mr-1" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="size-3 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={handleDownload}
                        className="text-xs"
                      >
                        <Download className="size-3 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>

                  <pre className="p-3 border border-border rounded-lg bg-muted/30 overflow-auto max-h-96 text-xs font-mono text-foreground">
                    {outputContent}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

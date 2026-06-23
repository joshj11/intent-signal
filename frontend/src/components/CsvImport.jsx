import { useState, useRef, useCallback } from 'react'
import { api } from '../lib/api.js'
import { LOSS_REASONS } from '../lib/constants.js'

const NAME_HEADERS = ['account', 'company', 'name', 'org', 'organisation', 'organization', 'company name', 'account name']
const DOMAIN_HEADERS = ['domain', 'website', 'url', 'web', 'site', 'homepage', 'company url', 'company website', 'website url']

function parseDomain(raw) {
  if (!raw) return ''
  try {
    const withProto = raw.startsWith('http') ? raw : `https://${raw}`
    const host = new URL(withProto).hostname
    return host.replace(/^www\./, '')
  } catch {
    return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  }
}

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const rows = []
  for (const line of lines) {
    if (!line.trim()) continue
    const fields = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current.trim())
    rows.push(fields)
  }
  return rows
}

function looksLikeUrl(value) {
  if (!value) return false
  return /^https?:\/\//i.test(value) || /^www\./i.test(value)
}

function detectNameColumn(headers, rows) {
  const lower = headers.map((h) => h.toLowerCase().trim())
  const idx = lower.findIndex((h) => NAME_HEADERS.includes(h))
  if (idx >= 0) return idx

  // No header match — find the first column whose values don't look like URLs
  const sample = rows.slice(0, 5)
  for (let i = 0; i < headers.length; i++) {
    const vals = sample.map((r) => r[i]).filter(Boolean)
    if (vals.length > 0 && vals.every((v) => !looksLikeUrl(v))) return i
  }
  return 0
}

function detectDomainColumn(headers) {
  const lower = headers.map((h) => h.toLowerCase().trim())
  const idx = lower.findIndex((h) => DOMAIN_HEADERS.includes(h))
  return idx >= 0 ? idx : -1
}

export default function CsvImport({ accountType, existingNames, onSuccess, onClose }) {
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState(null)
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [colIndex, setColIndex] = useState(0)
  const [domainColIndex, setDomainColIndex] = useState(-1)
  const [selectedType, setSelectedType] = useState(accountType || 'closed_lost')
  const [lossReason, setLossReason] = useState('no_budget')
  const [closedLostAt, setClosedLostAt] = useState(new Date().toISOString().split('T')[0])
  const [error, setError] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const fileRef = useRef()

  const isClosedLost = selectedType === 'closed_lost'

  function processFile(file) {
    if (!file) return
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a .csv file.')
      return
    }
    setError(null)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const parsed = parseCSV(e.target.result)
      if (parsed.length < 2) {
        setError('CSV has no data rows.')
        setHeaders([])
        setRows([])
        return
      }
      const [headerRow, ...dataRows] = parsed
      setHeaders(headerRow)
      setRows(dataRows)
      setColIndex(detectNameColumn(headerRow, dataRows))
      setDomainColIndex(detectDomainColumn(headerRow))
    }
    reader.readAsText(file)
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    processFile(e.dataTransfer.files[0])
  }

  function onFileChange(e) {
    processFile(e.target.files[0])
  }

  // Derive preview names from current column selection
  const rawNames = rows.map((r) => r[colIndex]).filter((v) => v && v.trim())

  // Dedup within CSV
  const seenInCsv = new Set()
  const uniqueNames = []
  let intraCsvDupes = 0
  for (const name of rawNames) {
    const key = name.toLowerCase().trim()
    if (seenInCsv.has(key)) { intraCsvDupes++; continue }
    seenInCsv.add(key)
    uniqueNames.push(name.trim())
  }

  // Dedup against existing accounts
  const existingLower = existingNames instanceof Set
    ? existingNames
    : new Set((existingNames || []).map((n) => n.toLowerCase().trim()))

  const newNames = uniqueNames.filter((n) => !existingLower.has(n.toLowerCase().trim()))
  const existingDupes = uniqueNames.length - newNames.length
  const totalSkipped = intraCsvDupes + existingDupes

  const hasNames = rows.length > 0
  const noValidRows = hasNames && newNames.length === 0

  async function handleImport() {
    if (!newNames.length) return
    setImporting(true)
    setError(null)
    try {
      // Build a map of name → domain from the raw rows for lookup during import
      const domainByName = {}
      if (domainColIndex >= 0) {
        for (const row of rows) {
          const n = row[colIndex]?.trim()
          const d = parseDomain(row[domainColIndex])
          if (n && d) domainByName[n.toLowerCase()] = d
        }
      }

      const accounts = newNames.map((name) => ({
        name,
        domain: domainByName[name.toLowerCase()] || undefined,
        account_type: selectedType,
        loss_reason: isClosedLost ? lossReason : null,
        closed_lost_at: isClosedLost ? closedLostAt : null,
      }))
      const res = await api.accounts.bulk(accounts)
      setResult(res)
      onSuccess()
    } catch (err) {
      setError(err.message)
      setImporting(false)
    }
  }

  if (result) {
    return (
      <div className="text-center py-4">
        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-900">
          {result.inserted} account{result.inserted !== 1 ? 's' : ''} imported
        </p>
        {result.skipped > 0 && (
          <p className="text-xs text-gray-400 mt-1">{result.skipped} duplicate{result.skipped !== 1 ? 's' : ''} skipped</p>
        )}
        <button
          onClick={onClose}
          className="mt-5 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700"
        >
          Done
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl px-6 py-8 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
        {fileName ? (
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">{fileName}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFileName(null); setHeaders([]); setRows([]); setError(null) }}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-gray-500">Drop a CSV file here, or <span className="text-gray-700 font-medium">click to browse</span></p>
          </>
        )}
      </div>

      {/* Account type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Account type</label>
        <div className="grid grid-cols-2 gap-2">
          {[['closed_lost', 'Closed Lost'], ['territory', 'Target Account']].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setSelectedType(val)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors text-left ${
                selectedType === val
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Column selector + defaults */}
      {hasNames && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company name column</label>
            <select
              value={colIndex}
              onChange={(e) => setColIndex(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {headers.map((h, i) => (
                <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Domain / website column</label>
            <select
              value={domainColIndex}
              onChange={(e) => setDomainColIndex(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value={-1}>None detected</option>
              {headers.map((h, i) => (
                <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
              ))}
            </select>
          </div>

          {isClosedLost && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loss reason</label>
                <select
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {LOSS_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Closed-lost date</label>
                <input
                  type="date"
                  value={closedLostAt}
                  onChange={(e) => setClosedLostAt(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview */}
      {hasNames && !noValidRows && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{newNames.length} account{newNames.length !== 1 ? 's' : ''} to import</span>
            {totalSkipped > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
                {totalSkipped} duplicate{totalSkipped !== 1 ? 's' : ''} will be skipped
              </span>
            )}
          </div>
          <div className="border border-gray-200 rounded-lg overflow-y-auto max-h-48">
            {newNames.map((name, i) => (
              <div key={i} className={`px-3 py-2 text-sm text-gray-700 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                {name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error states */}
      {noValidRows && (
        <p className="text-sm text-red-600">
          No valid company names found in this column. {totalSkipped > 0 ? `All ${totalSkipped} rows already exist as accounts.` : 'Try selecting a different column.'}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Footer */}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
          Cancel
        </button>
        <button
          onClick={handleImport}
          disabled={!hasNames || newNames.length === 0 || importing}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-40"
        >
          {importing ? 'Importing...' : `Import ${newNames.length || 0} account${newNames.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}

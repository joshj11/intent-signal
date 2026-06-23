import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api.js'
import Modal from '../components/Modal.jsx'

const STATUS_OPTIONS = [
  { value: 'uncontacted', label: 'Uncontacted' },
  { value: 'intro_requested', label: 'Intro requested' },
  { value: 'connected', label: 'Connected' },
  { value: 'not_relevant', label: 'Not relevant' },
]

const STATUS_STYLES = {
  uncontacted: 'bg-gray-100 text-gray-600',
  intro_requested: 'bg-blue-50 text-blue-700',
  connected: 'bg-green-50 text-green-700',
  not_relevant: 'bg-red-50 text-red-600',
}

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────

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
      if (ch === '"') { inQuotes = !inQuotes }
      else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = '' }
      else { current += ch }
    }
    fields.push(current.trim())
    rows.push(fields)
  }
  return rows
}

function parseDomain(raw) {
  if (!raw) return ''
  try {
    const withProto = raw.startsWith('http') ? raw : `https://${raw}`
    return new URL(withProto).hostname.replace(/^www\./, '')
  } catch {
    return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  }
}

function detectCol(headers, candidates) {
  const lower = headers.map((h) => h.toLowerCase().trim())
  const idx = lower.findIndex((h) => candidates.includes(h))
  return idx >= 0 ? idx : -1
}

// ─── Add company form ─────────────────────────────────────────────────────────

function AddCompanyForm({ onSuccess, onClose }) {
  const [form, setForm] = useState({ company_name: '', domain: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.company_name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const data = await api.investorProspects.create(form)
      onSuccess(data)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company name <span className="text-red-500">*</span></label>
        <input
          type="text"
          required
          value={form.company_name}
          onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="Acme Corp"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
        <input
          type="text"
          value={form.domain}
          onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="acme.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          placeholder="Optional context…"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
        <button
          type="submit"
          disabled={saving || !form.company_name.trim()}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Add company'}
        </button>
      </div>
    </form>
  )
}

// ─── CSV upload modal ─────────────────────────────────────────────────────────

function CsvUploadModal({ onSuccess, onClose }) {
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState(null)
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [nameCol, setNameCol] = useState(0)
  const [domainCol, setDomainCol] = useState(-1)
  const [notesCol, setNotesCol] = useState(-1)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef()

  function processFile(file) {
    if (!file) return
    if (!file.name.endsWith('.csv')) { setError('Please upload a .csv file.'); return }
    setError(null)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const parsed = parseCSV(e.target.result)
      if (parsed.length < 2) { setError('CSV has no data rows.'); return }
      const [headerRow, ...dataRows] = parsed
      setHeaders(headerRow)
      setRows(dataRows)
      const detectedName = detectCol(headerRow, ['company_name', 'company name', 'account name', 'company', 'name', 'account', 'organization'])
      setNameCol(detectedName >= 0 ? detectedName : 0)
      setDomainCol(detectCol(headerRow, ['domain', 'website', 'url', 'site']))
      setNotesCol(detectCol(headerRow, ['notes', 'note', 'comments', 'comment']))
    }
    reader.readAsText(file)
  }

  const preview = rows
    .map((r) => ({
      company_name: r[nameCol]?.trim(),
      domain: domainCol >= 0 ? parseDomain(r[domainCol]) : '',
      notes: notesCol >= 0 ? r[notesCol]?.trim() : '',
    }))
    .filter((p) => p.company_name)

  async function handleImport() {
    if (!preview.length) return
    setImporting(true)
    setError(null)
    try {
      const res = await api.investorProspects.bulk(preview)
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
        <p className="text-sm font-semibold text-gray-900">{result.inserted} prospect{result.inserted !== 1 ? 's' : ''} imported</p>
        {result.skipped_duplicates > 0 && (
          <p className="text-xs text-gray-400 mt-1">{result.skipped_duplicates} duplicate{result.skipped_duplicates !== 1 ? 's' : ''} skipped</p>
        )}
        <p className="text-xs text-gray-400 mt-1">Shared investor check running in background — refresh in a moment.</p>
        {result.errors?.length > 0 && (
          <p className="text-xs text-amber-600 mt-1">{result.errors.length} row{result.errors.length !== 1 ? 's' : ''} skipped: {result.errors[0]}</p>
        )}
        <button onClick={onClose} className="mt-5 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700">Done</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); processFile(e.dataTransfer.files[0]) }}
        className={`border-2 border-dashed rounded-xl px-6 py-8 text-center cursor-pointer transition-colors ${dragOver ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
      >
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => processFile(e.target.files[0])} />
        {fileName ? (
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">{fileName}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); setFileName(null); setHeaders([]); setRows([]); setError(null) }} className="text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ) : (
          <>
            <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-gray-500">Drop a CSV file here, or <span className="text-gray-700 font-medium">click to browse</span></p>
            <p className="text-xs text-gray-400 mt-1">Columns: company_name (required), domain, notes</p>
          </>
        )}
      </div>

      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Company name column', value: nameCol, setter: setNameCol, required: true },
              { label: 'Domain column', value: domainCol, setter: setDomainCol, required: false },
              { label: 'Notes column', value: notesCol, setter: setNotesCol, required: false },
            ].map(({ label, value, setter, required }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                <select
                  value={value}
                  onChange={(e) => setter(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  {!required && <option value={-1}>—</option>}
                  {headers.map((h, i) => <option key={i} value={i}>{h || `Col ${i + 1}`}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-gray-700">{preview.length} prospect{preview.length !== 1 ? 's' : ''} to import</span>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-y-auto max-h-40">
              {preview.slice(0, 20).map((p, i) => (
                <div key={i} className={`px-3 py-2 text-sm ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                  <span className="text-gray-800">{p.company_name}</span>
                  {p.domain && <span className="text-gray-400 ml-2 text-xs">{p.domain}</span>}
                </div>
              ))}
              {preview.length > 20 && (
                <div className="px-3 py-2 text-xs text-gray-400 border-t border-gray-100">+{preview.length - 20} more</div>
              )}
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
        <button
          onClick={handleImport}
          disabled={!preview.length || importing}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-40"
        >
          {importing ? 'Importing…' : `Import ${preview.length || 0} prospect${preview.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}

// ─── Prospect table row ───────────────────────────────────────────────────────

function ProspectRow({ prospect, selected, onToggle, onStatusChange, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <tr
      onClick={onToggle}
      className={`border-t border-gray-100 cursor-pointer ${selected ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
    >
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={onToggle} className="rounded border-gray-300 cursor-pointer" />
      </td>
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-gray-900">{prospect.company_name}</div>
        {prospect.domain && <div className="text-xs text-gray-400 mt-0.5">{prospect.domain}</div>}
      </td>
      <td className="px-4 py-3">
        {prospect.has_shared_investor ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200">
            {prospect.shared_investor_names?.join(', ')}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <select
          value={prospect.status}
          onChange={(e) => onStatusChange(prospect.id, e.target.value)}
          className={`text-xs font-medium rounded px-2 py-1 border-0 ring-1 ring-inset cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-900 ${STATUS_STYLES[prospect.status] || STATUS_STYLES.uncontacted} ring-transparent`}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 max-w-xs">
        {prospect.notes ? (
          <div>
            <p className={`text-sm text-gray-600 ${expanded ? '' : 'truncate'}`}>{prospect.notes}</p>
            {prospect.notes.length > 60 && (
              <button onClick={() => setExpanded((v) => !v)} className="text-xs text-gray-400 hover:text-gray-600 mt-0.5">
                {expanded ? 'Less' : 'More'}
              </button>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{timeAgo(prospect.uploaded_at)}</td>
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => onDelete(prospect.id)} className="text-xs text-gray-400 hover:text-red-600">Delete</button>
      </td>
    </tr>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InvestorProspects() {
  const [prospects, setProspects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [showRecheck, setShowRecheck] = useState(false)
  const [rechecking, setRechecking] = useState(false)
  const [recheckResult, setRecheckResult] = useState(null)
  const [filterSharedOnly, setFilterSharedOnly] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())

  useEffect(() => { loadProspects() }, [])

  async function loadProspects() {
    setLoading(true)
    try {
      setProspects(await api.investorProspects.list())
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(id, status) {
    setProspects((prev) => prev.map((p) => p.id === id ? { ...p, status } : p))
    try {
      await api.investorProspects.update(id, { status })
    } catch {
      loadProspects()
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this prospect?')) return
    setProspects((prev) => prev.filter((p) => p.id !== id))
    await api.investorProspects.delete(id)
  }

  async function handleBulkDelete() {
    const ids = [...selected]
    if (!confirm(`Permanently delete ${ids.length} prospect${ids.length !== 1 ? 's' : ''}?`)) return
    setProspects((prev) => prev.filter((p) => !selected.has(p.id)))
    setSelected(new Set())
    await api.investorProspects.bulkDelete(ids)
  }

  function toggleOne(id) {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  async function handleRecheck() {
    setRechecking(true)
    setRecheckResult(null)
    try {
      const result = await api.investorProspects.recheck()
      setRecheckResult(result)
      loadProspects()
    } catch (err) {
      setRecheckResult({ error: err.message })
    } finally {
      setRechecking(false)
    }
  }

  function downloadCSV() {
    const header = ['Company', 'Domain', 'Shared investor', 'Shared investor names', 'Status', 'Notes', 'Added']
    const rows = filtered.map((p) => [
      p.company_name,
      p.domain || '',
      p.has_shared_investor ? 'Yes' : 'No',
      (p.shared_investor_names || []).join('; '),
      p.status,
      p.notes || '',
      new Date(p.uploaded_at).toLocaleDateString('en-GB'),
    ])
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'investor-prospects.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = prospects
    .filter((p) => !filterSharedOnly || p.has_shared_investor)
    .filter((p) => !filterStatus || p.status === filterStatus)
    .filter((p) => !search || p.company_name.toLowerCase().includes(search.toLowerCase()))

  const filteredIds = filtered.map((p) => p.id)
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id))
  const someSelected = filteredIds.some((id) => selected.has(id))
  function toggleAll() { setSelected(allSelected ? new Set() : new Set(filteredIds)) }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Investor prospects</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Companies outside your territory where a shared investor may unlock a warm introduction.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button
            onClick={() => setShowRecheck(true)}
            className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Re-check investors
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Add company
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700"
          >
            Upload CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search companies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 w-52"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div
            onClick={() => setFilterSharedOnly((v) => !v)}
            className={`relative w-8 h-4 rounded-full transition-colors ${filterSharedOnly ? 'bg-teal-600' : 'bg-gray-200'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${filterSharedOnly ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm text-gray-600">Shared investor only</span>
        </label>
        <button
          onClick={downloadCSV}
          disabled={filtered.length === 0}
          className="ml-auto text-sm text-gray-500 hover:text-gray-900 disabled:opacity-40"
        >
          Download CSV
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-sm text-gray-400">Loading…</div>
      ) : prospects.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-sm font-medium text-gray-900 mb-1">No investor prospects yet</p>
          <p className="text-sm text-gray-500">Upload a CSV or add a company to get started.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">No results match your filters.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {selected.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-900 text-white text-sm">
              <span>{selected.size} selected</span>
              <button onClick={handleBulkDelete} className="ml-auto px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-medium">
                Delete {selected.size}
              </button>
              <button onClick={() => setSelected(new Set())} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium">
                Clear
              </button>
            </div>
          )}
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
                    onChange={toggleAll}
                    className="rounded border-gray-300 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Company</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Shared investor</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Notes</th>
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Added</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <ProspectRow
                  key={p.id}
                  prospect={p}
                  selected={selected.has(p.id)}
                  onToggle={() => toggleOne(p.id)}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <Modal title="Add company" onClose={() => setShowAdd(false)}>
          <AddCompanyForm
            onSuccess={(p) => { setProspects((prev) => [p, ...prev]); setShowAdd(false) }}
            onClose={() => setShowAdd(false)}
          />
        </Modal>
      )}

      {showUpload && (
        <Modal title="Import prospects from CSV" onClose={() => setShowUpload(false)}>
          <CsvUploadModal
            onSuccess={() => { loadProspects() }}
            onClose={() => setShowUpload(false)}
          />
        </Modal>
      )}

      {showRecheck && (
        <Modal title="Re-check shared investors" onClose={() => { if (!rechecking) setShowRecheck(false) }}>
          {recheckResult ? (
            <div className="text-center py-4">
              {recheckResult.error ? (
                <p className="text-sm text-red-600">{recheckResult.error}</p>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{recheckResult.checked} prospect{recheckResult.checked !== 1 ? 's' : ''} checked</p>
                  <p className="text-sm text-gray-500 mt-1">{recheckResult.shared_investors_found} shared investor match{recheckResult.shared_investors_found !== 1 ? 'es' : ''} found</p>
                </>
              )}
              <button onClick={() => { setShowRecheck(false); setRecheckResult(null) }} className="mt-5 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700">Done</button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                This will re-check all prospects against the investor portfolio cache. Use this after uploading new prospects or when you want to refresh shared investor matches.
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowRecheck(false)} disabled={rechecking} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40">Cancel</button>
                <button
                  onClick={handleRecheck}
                  disabled={rechecking}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-40"
                >
                  {rechecking ? 'Checking…' : 'Re-check now'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

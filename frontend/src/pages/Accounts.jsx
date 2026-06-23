import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { api } from '../lib/api.js'
import { LOSS_REASONS, LOSS_REASON_COLORS } from '../lib/constants.js'
import Badge from '../components/Badge.jsx'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import CsvImport from '../components/CsvImport.jsx'
import CareersGapModal from '../components/CareersGapModal.jsx'
import Toast from '../components/Toast.jsx'

const LOSS_REASON_LABELS = Object.fromEntries(LOSS_REASONS.map((r) => [r.value, r.label]))

function ScanResultBanner({ result, onDismiss }) {
  const hasWarnings = result.skipped?.length > 0
  const hasErrors = result.errors?.length > 0
  return (
    <div className={`mb-5 rounded-xl border p-4 ${hasWarnings || hasErrors ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-gray-900">
            Scan complete — {result.accounts_scanned} account{result.accounts_scanned !== 1 ? 's' : ''} scanned, {result.signals_found} new signal{result.signals_found !== 1 ? 's' : ''} found
          </p>
          {hasWarnings && result.skipped.map((w) => (
            <p key={w.label} className="text-xs text-amber-700">
              ⚠ {w.label} key not set — {w.affects.join(', ')} signals skipped.{' '}
              <a href="/settings" className="underline hover:no-underline">Add in Settings</a>
            </p>
          ))}
          {hasErrors && (
            <p className="text-xs text-red-600">⚠ {result.errors.length} account{result.errors.length !== 1 ? 's' : ''} failed to scan</p>
          )}
        </div>
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 text-xs shrink-0 mt-0.5">Dismiss</button>
      </div>
    </div>
  )
}

const DORMANCY_DAYS = 90

function weeksSince(dateStr) {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr)) / (7 * 24 * 60 * 60 * 1000))
}

function isDormant(account) {
  if (!account.last_signal_at) {
    // Never had a signal — dormant if account is older than DORMANCY_DAYS
    const ageDays = (Date.now() - new Date(account.created_at)) / (1000 * 60 * 60 * 24)
    return ageDays > DORMANCY_DAYS
  }
  const daysSince = (Date.now() - new Date(account.last_signal_at)) / (1000 * 60 * 60 * 24)
  return daysSince > DORMANCY_DAYS
}

function AccountForm({ initial, defaultType, onSave, onClose }) {
  const [form, setForm] = useState(
    initial || {
      account_type: defaultType || 'closed_lost',
      name: '',
      domain: '',
      careers_url: '',
      loss_reason: 'no_budget',
      rep_email: '',
      notes: '',
      closed_lost_at: new Date().toISOString().split('T')[0],
      competitor: '',
    }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [competitors, setCompetitors] = useState([])
  const [customCompetitor, setCustomCompetitor] = useState('')

  useEffect(() => {
    api.competitors.list().then(setCompetitors).catch(() => {})
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const isClosedLost = form.account_type === 'closed_lost'

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const finalForm = { ...form }
      if (form.competitor === '__custom__') {
        const trimmed = customCompetitor.trim()
        if (trimmed) {
          await api.competitors.add(trimmed).catch(() => {})
          finalForm.competitor = trimmed
        } else {
          finalForm.competitor = ''
        }
      }
      await onSave(finalForm)
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!initial && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Account type</label>
          <div className="flex gap-2">
            {[['closed_lost', 'Closed Lost'], ['territory', 'Target Account']].map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setForm((f) => ({ ...f, account_type: v }))}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.account_type === v
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company name *</label>
        <input
          required
          value={form.name}
          onChange={set('name')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Acme Corp"
        />
      </div>
      <div className={isClosedLost ? 'grid grid-cols-2 gap-3' : ''}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
          <input
            value={form.domain}
            onChange={set('domain')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="acme.com"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Careers page URL <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="url"
          value={form.careers_url || ''}
          onChange={set('careers_url')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="https://jobs.lever.co/acmecorp"
        />
        <p className="text-xs text-gray-400 mt-1">Leave blank — Signal auto-discovers from the domain. Set this only if the standard URLs don't work.</p>
      </div>

      {isClosedLost && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loss reason *</label>
            <select
              required
              value={form.loss_reason}
              onChange={set('loss_reason')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {LOSS_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Closed-lost date *</label>
            <input
              required
              type="date"
              value={form.closed_lost_at}
              onChange={set('closed_lost_at')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
      )}

      {isClosedLost && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Competitor <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <select
            value={form.competitor || ''}
            onChange={set('competitor')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">— None —</option>
            {competitors.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__custom__">Other (add new…)</option>
          </select>
          {form.competitor === '__custom__' && (
            <input
              autoFocus
              value={customCompetitor}
              onChange={(e) => setCustomCompetitor(e.target.value)}
              className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. Alteryx"
            />
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Rep email</label>
        <input
          type="email"
          value={form.rep_email}
          onChange={set('rep_email')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="rep@company.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={form.notes}
          onChange={set('notes')}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          placeholder={isClosedLost ? 'Why did we lose this? What would change the situation?' : 'ICP fit notes, research context...'}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : initial ? 'Save changes' : 'Add account'}
        </button>
      </div>
    </form>
  )
}

function Checkbox({ checked, indeterminate, onChange }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => { if (el) el.indeterminate = indeterminate }}
      onChange={onChange}
      className="w-4 h-4 rounded border-gray-300 text-gray-900 cursor-pointer"
      onClick={(e) => e.stopPropagation()}
    />
  )
}

function ActionBar({ selected, onClear, onBulkDelete, onBulkUpdate, showLossReason }) {
  const [showReasonForm, setShowReasonForm] = useState(false)
  const [lossReason, setLossReason] = useState('no_budget')
  const [closedLostAt, setClosedLostAt] = useState(new Date().toISOString().split('T')[0])
  const [applying, setApplying] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleApplyReason() {
    setApplying(true)
    await onBulkUpdate({ loss_reason: lossReason, closed_lost_at: closedLostAt, account_type: 'closed_lost' })
    setShowReasonForm(false)
    setApplying(false)
  }

  async function handleDelete() {
    if (!confirm(`Permanently delete ${selected} account${selected !== 1 ? 's' : ''} and all their contacts?`)) return
    setDeleting(true)
    await onBulkDelete()
    setDeleting(false)
  }

  return (
    <div className="mb-3 bg-gray-900 text-white rounded-xl px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium">{selected} selected</span>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {showLossReason && !showReasonForm && (
            <button
              onClick={() => setShowReasonForm(true)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors"
            >
              Set loss reason
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : `Delete ${selected}`}
          </button>
          <button onClick={onClear} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {showReasonForm && (
        <div className="mt-3 pt-3 border-t border-white/20 flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-white/60 mb-1">Loss reason</label>
            <select
              value={lossReason}
              onChange={(e) => setLossReason(e.target.value)}
              className="border-0 bg-white/10 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              {LOSS_REASONS.map((r) => (
                <option key={r.value} value={r.value} className="text-gray-900">{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Closed-lost date</label>
            <input
              type="date"
              value={closedLostAt}
              onChange={(e) => setClosedLostAt(e.target.value)}
              className="border-0 bg-white/10 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleApplyReason}
              disabled={applying}
              className="px-3 py-1.5 bg-white text-gray-900 rounded-lg text-xs font-medium hover:bg-gray-100 disabled:opacity-50"
            >
              {applying ? 'Applying...' : 'Apply'}
            </button>
            <button
              onClick={() => setShowReasonForm(false)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ClosedLostTab({ accounts, onEdit, onDelete, onBulkDelete, onBulkUpdate, onAdd }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortByWeeks, setSortByWeeks] = useState(false)
  const [sharedInvestorOnly, setSharedInvestorOnly] = useState(false)
  const [selected, setSelected] = useState(new Set())

  let filtered = accounts.filter((a) => {
    if (filter !== 'all' && a.loss_reason !== filter) return false
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false
    if (sharedInvestorOnly && !a.has_shared_investor) return false
    return true
  })

  if (sortByWeeks) {
    filtered = [...filtered].sort((a, b) => (weeksSince(b.closed_lost_at) || 0) - (weeksSince(a.closed_lost_at) || 0))
  }

  const filteredIds = filtered.map((a) => a.id)
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id))
  const someSelected = filteredIds.some((id) => selected.has(id))

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filteredIds))
  }

  function toggleOne(id) {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search accounts..."
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-48"
        />
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === 'all' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>All</button>
          {LOSS_REASONS.map((r) => (
            <button key={r.value} onClick={() => setFilter(r.value)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === r.value ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{r.label}</button>
          ))}
        </div>
        <button
          onClick={() => setSharedInvestorOnly((v) => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${sharedInvestorOnly ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          Shared investor
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={accounts.length === 0 ? 'No closed-lost accounts yet' : 'No matching accounts'}
          description={accounts.length === 0 ? 'Add your first closed-lost account to start tracking signals.' : undefined}
          action={accounts.length === 0 ? <button onClick={onAdd} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700">Add account</button> : null}
        />
      ) : (
        <>
          {selected.size > 0 && (
            <ActionBar
              selected={selected.size}
              showLossReason
              onClear={() => setSelected(new Set())}
              onBulkDelete={async () => { await onBulkDelete([...selected]); setSelected(new Set()) }}
              onBulkUpdate={async (updates) => { await onBulkUpdate([...selected], updates); setSelected(new Set()) }}
            />
          )}

          <div className="flex items-center gap-4 px-5 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
            <Checkbox checked={allSelected} indeterminate={someSelected && !allSelected} onChange={toggleAll} />
            <div className="flex-1">Account</div>
            <button
              onClick={() => setSortByWeeks((s) => !s)}
              className={`flex items-center gap-1 hover:text-gray-700 transition-colors shrink-0 ${sortByWeeks ? 'text-gray-700' : ''}`}
            >
              Weeks since close
              <svg className={`w-3 h-3 transition-transform ${sortByWeeks ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="w-16 text-right shrink-0">Actions</div>
          </div>

          <div className="space-y-2">
            {filtered.map((account) => {
              const weeks = weeksSince(account.closed_lost_at)
              const dormant = isDormant(account)
              const isSelected = selected.has(account.id)
              return (
                <div
                  key={account.id}
                  onClick={() => toggleOne(account.id)}
                  className={`bg-white rounded-xl border px-5 py-4 flex items-center gap-4 cursor-pointer transition-colors ${isSelected ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <Checkbox checked={isSelected} indeterminate={false} onChange={() => toggleOne(account.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Link to={`/accounts/${account.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-gray-900 hover:text-brand-600 text-sm">
                        {account.name}
                      </Link>
                      {account.domain && <span className="text-xs text-gray-400">{account.domain}</span>}
                      {dormant && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-200">dormant</span>}
                      {account.has_shared_investor && (
                        <span title={account.shared_investor_names?.join(', ')} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200 cursor-default">Shared investor</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge label={LOSS_REASON_LABELS[account.loss_reason]} color={LOSS_REASON_COLORS[account.loss_reason]} />
                      <span className="text-xs text-gray-400">{account.contacts?.length || 0} contact{account.contacts?.length !== 1 ? 's' : ''}</span>
                      {account.rep_email && <span className="text-xs text-gray-400">· {account.rep_email}</span>}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 shrink-0 w-24 text-right">{weeks !== null ? `${weeks}w` : '—'}</div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => onEdit(account)} className="text-sm text-gray-400 hover:text-gray-700">Edit</button>
                    <button onClick={() => onDelete(account.id)} className="text-sm text-gray-400 hover:text-red-600">Delete</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function TerritoryTab({ accounts, onEdit, onDelete, onBulkDelete, onBulkUpdate, onAdd }) {
  const [search, setSearch] = useState('')
  const [sharedInvestorOnly, setSharedInvestorOnly] = useState(false)
  const [selected, setSelected] = useState(new Set())

  const filtered = accounts.filter((a) => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false
    if (sharedInvestorOnly && !a.has_shared_investor) return false
    return true
  })

  const filteredIds = filtered.map((a) => a.id)
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id))
  const someSelected = filteredIds.some((id) => selected.has(id))

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filteredIds))
  }

  function toggleOne(id) {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search target accounts..."
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-56"
        />
        <button
          onClick={() => setSharedInvestorOnly((v) => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${sharedInvestorOnly ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          Shared investor
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={accounts.length === 0 ? 'No target accounts yet' : 'No matching accounts'}
          description={accounts.length === 0 ? 'Add ICP target accounts to monitor for intent signals.' : undefined}
          action={accounts.length === 0 ? <button onClick={onAdd} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700">Add account</button> : null}
        />
      ) : (
        <>
          {selected.size > 0 && (
            <ActionBar
              selected={selected.size}
              showLossReason
              onClear={() => setSelected(new Set())}
              onBulkDelete={async () => { await onBulkDelete([...selected]); setSelected(new Set()) }}
              onBulkUpdate={async (updates) => { await onBulkUpdate([...selected], updates); setSelected(new Set()) }}
            />
          )}

          <div className="flex items-center gap-4 px-5 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
            <Checkbox checked={allSelected} indeterminate={someSelected && !allSelected} onChange={toggleAll} />
            <div className="flex-1">Account</div>
            <div className="w-16 text-right shrink-0">Actions</div>
          </div>

          <div className="space-y-2">
            {filtered.map((account) => {
              const dormant = isDormant(account)
              const isSelected = selected.has(account.id)
              return (
                <div
                  key={account.id}
                  onClick={() => toggleOne(account.id)}
                  className={`bg-white rounded-xl border px-5 py-4 flex items-center gap-4 cursor-pointer transition-colors ${isSelected ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <Checkbox checked={isSelected} indeterminate={false} onChange={() => toggleOne(account.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link to={`/accounts/${account.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-gray-900 hover:text-brand-600 text-sm">
                        {account.name}
                      </Link>
                      {account.domain && <span className="text-xs text-gray-400">{account.domain}</span>}
                      {dormant && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-200">dormant</span>}
                      {account.has_shared_investor && (
                        <span title={account.shared_investor_names?.join(', ')} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200 cursor-default">Shared investor</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{account.contacts?.length || 0} contact{account.contacts?.length !== 1 ? 's' : ''}</span>
                      {account.rep_email && <span className="text-xs text-gray-400">· {account.rep_email}</span>}
                      {account.last_signal_at && (
                        <span className="text-xs text-gray-400">· last signal {Math.floor((Date.now() - new Date(account.last_signal_at)) / (1000 * 60 * 60 * 24))}d ago</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => onEdit(account)} className="text-sm text-gray-400 hover:text-gray-700">Edit</button>
                    <button onClick={() => onDelete(account.id)} className="text-sm text-gray-400 hover:text-red-600">Delete</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default function Accounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [activeTab, setActiveTab] = useState('closed_lost')
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editing, setEditing] = useState(null)
  const [careersGaps, setCareersGaps] = useState(null)
  const [showCareersGap, setShowCareersGap] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [lastScan, setLastScan] = useState(null)
  const [toast, setToast] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await api.accounts.list()
      setAccounts(data)
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.scan.runs(1).then((runs) => setLastScan(runs[0] ?? null)).catch(() => {})
  }, [])

  useEffect(() => {
    api.coverage.careers().then(setCareersGaps).catch(() => {})
  }, [])

  async function handleDelete(id) {
    if (!confirm('Remove this account and all its contacts?')) return
    await api.accounts.delete(id)
    setAccounts((prev) => prev.filter((a) => a.id !== id))
  }

  async function handleBulkDelete(ids) {
    await api.accounts.bulkDelete(ids)
    await load()
  }

  async function handleBulkUpdate(ids, updates) {
    await api.accounts.bulkUpdate(ids, updates)
    await load()
  }

  async function handleScanAll() {
    if (!confirm(`Scan all ${accounts.length} account${accounts.length !== 1 ? 's' : ''}? This may take a few minutes.`)) return
    setScanning(true)
    setScanResult(null)
    try {
      const result = await api.scanAll()
      setScanResult(result)
      setLastScan({ ran_at: new Date().toISOString(), ...result })
      await load()
    } catch (err) {
      setToast(`Scan failed: ${err.message}`)
    } finally {
      setScanning(false)
    }
  }

  const closedLost = accounts.filter((a) => a.account_type === 'closed_lost')
  const territory = accounts.filter((a) => a.account_type === 'territory')
  const tabAccounts = activeTab === 'closed_lost' ? closedLost : territory

  return (
    <div>
      {loadError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Failed to load accounts: {loadError}
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Accounts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {closedLost.length} closed-lost · {territory.length} target accounts
            {lastScan?.ran_at && (
              <span className="text-gray-400">
                {' '}· Last scan {formatDistanceToNow(new Date(lastScan.ran_at), { addSuffix: true })}
                {lastScan.triggered_by === 'cron' && ' (auto)'}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleScanAll}
            disabled={scanning}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Scanning...
              </>
            ) : 'Scan all accounts'}
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import CSV
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add account
          </button>
        </div>
      </div>

      {/* Scan result banner */}
      {scanResult && <ScanResultBanner result={scanResult} onDismiss={() => setScanResult(null)} />}

      {/* Careers coverage gap banner */}
      {careersGaps && (careersGaps.no_domain?.length > 0 || careersGaps.not_found?.length > 0) && (
        <button
          onClick={() => setShowCareersGap(true)}
          className="w-full mb-5 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-left hover:bg-amber-100 transition-colors"
        >
          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span className="text-sm text-amber-800 flex-1">
            <span className="font-medium">
              {(careersGaps.no_domain?.length || 0) + (careersGaps.not_found?.length || 0)} account{((careersGaps.no_domain?.length || 0) + (careersGaps.not_found?.length || 0)) !== 1 ? 's' : ''} have no job monitoring
            </span>
            {' '}— click to add missing domains or careers page URLs
          </span>
          <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b border-gray-200">
        {[['closed_lost', 'Closed Lost', closedLost.length], ['territory', 'Target Accounts', territory.length]].map(([v, l, count]) => (
          <button
            key={v}
            onClick={() => setActiveTab(v)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === v
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {l}
            <span className={`ml-2 text-xs rounded-full px-1.5 py-0.5 ${activeTab === v ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-10 text-center">Loading...</div>
      ) : activeTab === 'closed_lost' ? (
        <ClosedLostTab
          accounts={closedLost}
          onEdit={setEditing}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          onBulkUpdate={handleBulkUpdate}
          onAdd={() => setShowAdd(true)}
        />
      ) : (
        <TerritoryTab
          accounts={territory}
          onEdit={setEditing}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          onBulkUpdate={handleBulkUpdate}
          onAdd={() => setShowAdd(true)}
        />
      )}

      {showAdd && (
        <Modal title="Add account" onClose={() => setShowAdd(false)}>
          <AccountForm
            defaultType={activeTab}
            onSave={(form) => api.accounts.create(form).then(() => load())}
            onClose={() => setShowAdd(false)}
          />
        </Modal>
      )}

      {editing && (
        <Modal title="Edit account" onClose={() => setEditing(null)}>
          <AccountForm
            initial={editing}
            onSave={(form) => api.accounts.update(editing.id, form).then(() => load())}
            onClose={() => setEditing(null)}
          />
        </Modal>
      )}

      {showImport && (
        <Modal title="Import accounts from CSV" onClose={() => setShowImport(false)}>
          <CsvImport
            accountType={activeTab}
            existingNames={new Set(accounts.map((a) => a.name.toLowerCase().trim()))}
            onSuccess={() => { load(); }}
            onClose={() => setShowImport(false)}
          />
        </Modal>
      )}

      {showCareersGap && careersGaps && (
        <CareersGapModal
          gaps={careersGaps}
          onClose={() => setShowCareersGap(false)}
          onSaved={() => api.coverage.careers().then(setCareersGaps).catch(() => {})}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { SIGNAL_TYPES, LOSS_REASON_COLORS } from '../lib/constants.js'
import Badge from '../components/Badge.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Modal from '../components/Modal.jsx'

const LOSS_REASON_LABELS = {
  no_budget: 'No Budget', bad_timing: 'Bad Timing', no_priority: 'No Priority',
  competitor_won: 'Competitor Won', bad_fit: 'Bad Fit',
}
const TAG_COLORS = { champion: 'green', evaluator: 'blue', blocker: 'red' }

function SignalCard({ signal, onAlert, onIgnore }) {
  const [acting, setAct] = useState(null)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const meta = SIGNAL_TYPES[signal.signal_type] || { label: signal.signal_type, color: 'gray' }
  const account = signal.accounts
  const contact = signal.contacts

  const isResolved = signal.alerted || signal.ignored
  const date = new Date(signal.fired_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  async function handleAcknowledge() {
    setAct('alert')
    try { await onAlert(notes.trim() || null) } finally { setAct(null) }
  }

  return (
    <div className={`bg-white rounded-xl border px-5 py-4 ${isResolved ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge label={meta.label} color={meta.color} />
            {account && (
              <Link to={`/accounts/${account.id}`} className="font-medium text-sm text-gray-900 hover:text-brand-600">
                {account.name}
              </Link>
            )}
            {account?.loss_reason && (
              <Badge
                label={account.loss_reason === 'competitor_won' && account.competitor
                  ? `Competitor Won · ${account.competitor}`
                  : LOSS_REASON_LABELS[account.loss_reason]}
                color={LOSS_REASON_COLORS[account.loss_reason]}
              />
            )}
            {contact && (
              <Badge label={`${contact.name} · ${contact.tag}`} color={TAG_COLORS[contact.tag]} />
            )}
          </div>
          <p className="text-sm font-medium text-gray-800">{signal.title}</p>
          {signal.detail && (
            <p className="text-sm text-gray-500 mt-0.5">{signal.detail}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-gray-400">{date}</span>
            {signal.source_url && (
              <a href={signal.source_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">
                View source
              </a>
            )}
            {signal.alerted && <span className="text-xs text-green-600 font-medium">Acknowledged</span>}
            {signal.ignored && <span className="text-xs text-gray-400 font-medium">Ignored</span>}
            {signal.notes && <span className="text-xs text-gray-500 italic">"{signal.notes}"</span>}
          </div>

          {showNotes && (
            <div className="mt-3 flex gap-2 items-start">
              <textarea
                autoFocus
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did you do? (optional)"
                rows={2}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={handleAcknowledge}
                  disabled={!!acting}
                  className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-700 disabled:opacity-50"
                >
                  {acting === 'alert' ? 'Saving...' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowNotes(false)}
                  className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {!isResolved && !showNotes && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowNotes(true)}
              className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-700"
            >
              Acknowledge
            </button>
            <button
              onClick={() => { setAct('ignore'); onIgnore().finally(() => setAct(null)) }}
              disabled={!!acting}
              className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Ignore
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function SignalFeed() {
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(null)
  const [acknowledging, setAcknowledging] = useState(false)
  const [showScanModal, setShowScanModal] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [filter, setFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [lastScan, setLastScan] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, runs] = await Promise.all([api.signals.list(), api.scan.runs(1)])
      setSignals(data)
      setLastScan(runs[0] ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    let pollInterval = null

    api.scan.progress().then((p) => {
      if (!p.inProgress) return
      setRunning(true)
      setProgress(p)

      pollInterval = setInterval(async () => {
        try {
          const next = await api.scan.progress()
          if (next.inProgress) {
            setProgress(next)
          } else {
            clearInterval(pollInterval)
            setRunning(false)
            setProgress(null)
            load()
          }
        } catch {}
      }, 2000)
    }).catch(() => {})

    return () => clearInterval(pollInterval)
  }, [])

  async function handleScan(accountType) {
    setShowScanModal(false)
    setRunning(true)
    setProgress(null)
    setScanResult(null)
    if (Notification.permission === 'default') await Notification.requestPermission()

    let pollInterval = null
    if (accountType !== 'investor_prospects') {
      pollInterval = setInterval(async () => {
        try {
          const p = await api.scan.progress()
          if (p.inProgress) setProgress(p)
        } catch {}
      }, 2000)
    }

    try {
      let result
      if (accountType === 'investor_prospects') {
        const r = await api.investorProspects.recheck()
        result = { accounts_scanned: r.checked, signals_found: r.shared_investors_found }
      } else {
        result = await api.scanAll(accountType)
      }
      setScanResult(result)
      await load()
      if (Notification.permission === 'granted') {
        new Notification('Signal scan complete', {
          body: `${result.accounts_scanned} accounts scanned · ${result.signals_found} new signal${result.signals_found !== 1 ? 's' : ''} found`,
          icon: '/favicon.ico',
        })
      }
    } catch (err) {
      setScanResult({ error: err.message })
    } finally {
      clearInterval(pollInterval)
      setRunning(false)
      setProgress(null)
    }
  }

  const filtered = signals.filter((s) => {
    if (filter === 'pending' && (s.alerted || s.ignored)) return false
    if (filter === 'alerted' && !s.alerted) return false
    if (filter === 'ignored' && !s.ignored) return false
    if (search && !s.accounts?.name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const pendingCount = signals.filter((s) => !s.alerted && !s.ignored).length

  async function handleAcknowledgeAll() {
    setAcknowledging(true)
    try {
      await api.signals.acknowledgeAll()
      setSignals((prev) => prev.map((s) => (!s.alerted && !s.ignored ? { ...s, alerted: true } : s)))
    } finally {
      setAcknowledging(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Signal Feed</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pendingCount} pending signal{pendingCount !== 1 ? 's' : ''}
            {lastScan && (
              <span className="text-gray-400"> · Last scan {timeAgo(lastScan.ran_at)}</span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={() => setShowScanModal(true)}
            disabled={running}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {running ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Scanning...
              </>
            ) : 'Run scan now'}
          </button>
          {progress?.total > 0 && (
            <p className="text-xs text-gray-400">
              {progress.current} / {progress.total} — {progress.currentAccount}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by account..."
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 w-48"
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {[['pending', 'Pending'], ['alerted', 'Acknowledged'], ['ignored', 'Ignored'], ['all', 'All']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === v ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {l}
            </button>
          ))}
        </div>
        {filter === 'pending' && pendingCount > 0 && (
          <button
            onClick={handleAcknowledgeAll}
            disabled={acknowledging}
            className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {acknowledging ? 'Acknowledging...' : `Acknowledge all (${pendingCount})`}
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-10 text-center">Loading...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={filter === 'pending' ? 'No pending signals' : 'No signals'}
          description={filter === 'pending' ? 'Run a scan to check for new signals.' : undefined}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onAlert={async (notes) => {
                await api.signals.alert(signal.id, notes)
                setSignals((prev) =>
                  prev.map((s) => s.id === signal.id ? { ...s, alerted: true, notes: notes || s.notes } : s)
                )
              }}
              onIgnore={async () => {
                await api.signals.ignore(signal.id)
                setSignals((prev) =>
                  prev.map((s) => s.id === signal.id ? { ...s, ignored: true } : s)
                )
              }}
            />
          ))}
        </div>
      )}

      {scanResult && (
        <div className={`mt-4 rounded-xl border p-4 ${scanResult.error ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-center justify-between">
            {scanResult.error
              ? <p className="text-sm text-red-700">Scan failed: {scanResult.error}</p>
              : <p className="text-sm text-gray-900 font-medium">Scan complete — {scanResult.accounts_scanned} accounts scanned, {scanResult.signals_found} new signal{scanResult.signals_found !== 1 ? 's' : ''} found</p>
            }
            <button onClick={() => setScanResult(null)} className="text-xs text-gray-400 hover:text-gray-600 ml-4">Dismiss</button>
          </div>
        </div>
      )}

      {showScanModal && (
        <Modal title="Run scan" onClose={() => setShowScanModal(false)}>
          <p className="text-sm text-gray-500 mb-4">Choose which accounts to scan for new signals.</p>
          <div className="space-y-2">
            {[
              { type: 'closed_lost', label: 'Closed Lost', description: 'Re-engagement signals — funding, hiring, champion moves, competitor news' },
              { type: 'territory', label: 'Target Accounts', description: 'Buying signals — when to reach out to accounts you\'re tracking' },
              { type: 'investor_prospects', label: 'Investor Prospects', description: 'Re-check shared investor matches across all prospects' },
              { type: 'all', label: 'All Accounts', description: 'Scan everything in one go' },
            ].map(({ type, label, description }) => (
              <button
                key={type}
                onClick={() => handleScan(type)}
                className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                <div className="text-sm font-medium text-gray-900">{label}</div>
                <p className="text-xs text-gray-500 mt-0.5">{description}</p>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

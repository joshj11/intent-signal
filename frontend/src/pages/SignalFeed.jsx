import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { SIGNAL_TYPES, LOSS_REASON_COLORS } from '../lib/constants.js'
import Badge from '../components/Badge.jsx'
import EmptyState from '../components/EmptyState.jsx'

const LOSS_REASON_LABELS = {
  no_budget: 'No Budget', bad_timing: 'Bad Timing', no_priority: 'No Priority',
  competitor_won: 'Competitor Won', bad_fit: 'Bad Fit',
}
const TAG_COLORS = { champion: 'green', evaluator: 'blue', blocker: 'red' }

function SignalCard({ signal, onAlert, onIgnore }) {
  const [acting, setAct] = useState(null)
  const meta = SIGNAL_TYPES[signal.signal_type] || { label: signal.signal_type, color: 'gray' }
  const account = signal.accounts
  const contact = signal.contacts

  async function act(fn, label) {
    setAct(label)
    try { await fn() } finally { setAct(null) }
  }

  const isResolved = signal.alerted || signal.ignored
  const date = new Date(signal.fired_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

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
            {account && (
              <Badge
                label={LOSS_REASON_LABELS[account.loss_reason]}
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
            {signal.alerted && (
              <span className="text-xs text-green-600 font-medium">Acknowledged</span>
            )}
            {signal.ignored && (
              <span className="text-xs text-gray-400 font-medium">Ignored</span>
            )}
          </div>
        </div>

        {!isResolved && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => act(onAlert, 'alert')}
              disabled={!!acting}
              className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-700 disabled:opacity-50"
            >
              {acting === 'alert' ? 'Saving...' : 'Acknowledge'}
            </button>
            <button
              onClick={() => act(onIgnore, 'ignore')}
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

export default function SignalFeed() {
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [filter, setFilter] = useState('pending')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.signals.list()
      setSignals(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleRunSignals() {
    setRunning(true)
    try {
      const result = await api.runSignals()
      await load()
      if (result.fired === 0) alert('Scan complete — no new signals found.')
      else alert(`Scan complete — ${result.fired} new signal(s) fired.`)
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setRunning(false)
    }
  }

  const filtered = signals.filter((s) => {
    if (filter === 'pending') return !s.alerted && !s.ignored
    if (filter === 'alerted') return s.alerted
    if (filter === 'ignored') return s.ignored
    return true
  })

  const pendingCount = signals.filter((s) => !s.alerted && !s.ignored).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Signal Feed</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pendingCount} pending signal{pendingCount !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={handleRunSignals}
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
      </div>

      <div className="flex gap-1 mb-4">
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

      {loading ? (
        <div className="text-sm text-gray-400 py-10 text-center">Loading...</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={filter === 'pending' ? 'No pending signals' : 'No signals'}
          description={filter === 'pending' ? 'Run a scan or wait for the daily cron to pick up new signals.' : undefined}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onAlert={async () => {
                await api.signals.alert(signal.id)
                setSignals((prev) =>
                  prev.map((s) => s.id === signal.id ? { ...s, alerted: true } : s)
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
    </div>
  )
}

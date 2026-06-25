import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { CONTACT_TAGS, LOSS_REASON_COLORS, SIGNAL_TYPES } from '../lib/constants.js'
import Badge from '../components/Badge.jsx'
import Modal from '../components/Modal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Toast from '../components/Toast.jsx'

function timeAgo(dateStr) {
  if (!dateStr) return null
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

const TAG_COLORS = { champion: 'green', economic_buyer: 'violet', evaluator: 'blue', blocker: 'red' }
const TAG_DESC = {
  champion: 'Loved the product — always alert',
  economic_buyer: 'Controls the budget — always alert',
  evaluator: 'Involved but neutral — alert on budget signals only',
  blocker: 'Never alert',
}

const LOSS_REASON_LABELS = {
  no_budget: 'No Budget', no_priority: 'No Priority', no_resources: 'No Resources',
  wrong_timing: 'Wrong Timing', competitor_won: 'Competitor Won', bad_fit: 'Bad Fit',
}

function ContactForm({ accountId, isTerritory, initial, onSave, onClose }) {
  const [form, setForm] = useState(
    initial || { account_id: accountId, name: '', title: '', email: '', linkedin_url: '', tag: isTerritory ? '' : 'evaluator', notes: '' }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({ ...form, tag: form.tag || null })
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input
          required
          value={form.name}
          onChange={set('name')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Jane Smith"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            value={form.title}
            onChange={set('title')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="VP Engineering"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tag {isTerritory ? <span className="text-gray-400 font-normal">(optional)</span> : '*'}
          </label>
          <select
            required={!isTerritory}
            value={form.tag}
            onChange={set('tag')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {isTerritory && <option value="">No tag</option>}
            {CONTACT_TAGS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>
      {!isTerritory && form.tag && (
        <p className="text-xs text-gray-500 -mt-2">{TAG_DESC[form.tag]}</p>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={form.email}
          onChange={set('email')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn URL</label>
        <input
          value={form.linkedin_url}
          onChange={set('linkedin_url')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="https://linkedin.com/in/..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={form.notes}
          onChange={set('notes')}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
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
          {saving ? 'Saving...' : initial ? 'Save changes' : 'Add contact'}
        </button>
      </div>
    </form>
  )
}

export default function AccountDetail() {
  const { id } = useParams()
  const [account, setAccount] = useState(null)
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [toast, setToast] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [accountData, signalData] = await Promise.all([
        api.accounts.get(id),
        api.signals.list({ account_id: id, limit: 100 }),
      ])
      setAccount(accountData)
      setSignals(signalData)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleDeleteContact(contactId) {
    if (!confirm('Remove this contact?')) return
    await api.contacts.delete(contactId)
    load()
  }

  async function handleScan() {
    setScanning(true)
    try {
      const result = await api.accounts.scan(id)
      setAccount((a) => ({ ...a, last_scanned_at: new Date().toISOString() }))
      if (result.signals_found > 0) {
        const signalData = await api.signals.list({ account_id: id, limit: 100 })
        setSignals(signalData)
      }
      setToast(
        result.signals_found > 0
          ? `Scan complete — ${result.signals_found} new signal${result.signals_found !== 1 ? 's' : ''} found`
          : 'Scan complete — no new signals'
      )
    } catch (err) {
      setToast(`Scan failed: ${err.message}`)
    } finally {
      setScanning(false)
    }
  }

  if (loading) return <div className="text-sm text-gray-400 py-10 text-center">Loading...</div>
  if (!account) return <div className="text-sm text-gray-500 py-10 text-center">Account not found</div>

  const isTerritory = account.account_type === 'territory'

  return (
    <div>
      <div className="mb-6">
        <Link to="/accounts" className="text-sm text-gray-400 hover:text-gray-600 mb-2 inline-block">
          ← Accounts
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-semibold text-gray-900">{account.name}</h1>
              <Badge
                label={isTerritory ? 'Target Account' : 'Closed Lost'}
                color={isTerritory ? 'sky' : 'gray'}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {!isTerritory && account.loss_reason && (
                <Badge label={LOSS_REASON_LABELS[account.loss_reason]} color={LOSS_REASON_COLORS[account.loss_reason]} />
              )}
              {account.domain && <span className="text-sm text-gray-400">{account.domain}</span>}
              {account.rep_email && <span className="text-sm text-gray-400">· {account.rep_email}</span>}
              {!isTerritory && account.closed_lost_at && (
                <span className="text-sm text-gray-400">
                  · closed {new Date(account.closed_lost_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
            {account.has_shared_investor && account.shared_investor_names?.length > 0 && (
              <p className="text-sm text-teal-700 mt-1">
                Shared investors: {account.shared_investor_names.join(', ')}
              </p>
            )}
            {account.notes && (
              <p className="text-sm text-gray-500 mt-2 max-w-2xl">{account.notes}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0 ml-6">
            <button
              onClick={handleScan}
              disabled={scanning}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scanning ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Scanning...
                </>
              ) : 'Run scan'}
            </button>
            <span className="text-xs text-gray-400">
              {account.last_scanned_at
                ? `Last scanned: ${timeAgo(account.last_scanned_at)}`
                : 'Never scanned'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-medium text-gray-900">Contacts</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add contact
        </button>
      </div>

      {!account.contacts?.length ? (
        <EmptyState
          title="No contacts yet"
          description={isTerritory
            ? 'Optionally add contacts to track. All signals fire regardless of contact tags.'
            : 'Add contacts and tag them as champion, evaluator, or blocker.'}
        />
      ) : (
        <div className="space-y-2">
          {account.contacts.map((contact) => (
            <div key={contact.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-gray-900">{contact.name}</span>
                  {contact.title && <span className="text-xs text-gray-400">{contact.title}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {contact.tag && <Badge label={contact.tag} color={TAG_COLORS[contact.tag]} />}
                  {contact.email && <span className="text-xs text-gray-400">{contact.email}</span>}
                  {contact.linkedin_url && (
                    <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">
                      LinkedIn
                    </a>
                  )}
                </div>
                {contact.notes && <p className="text-xs text-gray-400 mt-1">{contact.notes}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setEditing(contact)} className="text-sm text-gray-400 hover:text-gray-700">Edit</button>
                <button onClick={() => handleDeleteContact(contact.id)} className="text-sm text-gray-400 hover:text-red-600">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-base font-medium text-gray-900 mb-4">Signal history</h2>
        {signals.length === 0 ? (
          <EmptyState title="No signals yet" description="Run a scan to check for signals on this account." />
        ) : (
          <div className="space-y-2">
            {signals.map((signal) => {
              const meta = SIGNAL_TYPES[signal.signal_type] || { label: signal.signal_type, color: 'gray' }
              const date = new Date(signal.fired_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              return (
                <div key={signal.id} className={`bg-white rounded-xl border px-5 py-4 ${signal.alerted || signal.ignored ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge label={meta.label} color={meta.color} />
                        {signal.contacts && (
                          <span className="text-xs text-gray-400">{signal.contacts.name} · {signal.contacts.tag}</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800">{signal.title}</p>
                      {signal.detail && <p className="text-sm text-gray-500 mt-0.5">{signal.detail}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-400">{date}</span>
                        {signal.source_url && (
                          <a href={signal.source_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">View source</a>
                        )}
                        {signal.alerted && <span className="text-xs text-green-600 font-medium">Acknowledged</span>}
                        {signal.ignored && <span className="text-xs text-gray-400 font-medium">Ignored</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <Modal title="Add contact" onClose={() => setShowAdd(false)}>
          <ContactForm
            accountId={account.id}
            isTerritory={isTerritory}
            onSave={(form) => api.contacts.create(form).then(() => load())}
            onClose={() => setShowAdd(false)}
          />
        </Modal>
      )}

      {editing && (
        <Modal title="Edit contact" onClose={() => setEditing(null)}>
          <ContactForm
            accountId={account.id}
            isTerritory={isTerritory}
            initial={editing}
            onSave={(form) => api.contacts.update(editing.id, form).then(() => load())}
            onClose={() => setEditing(null)}
          />
        </Modal>
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}

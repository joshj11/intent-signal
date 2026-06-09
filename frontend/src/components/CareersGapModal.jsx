import { useState } from 'react'
import { api } from '../lib/api.js'

function GapRow({ account, onSaved }) {
  const noDomain = !account.domain
  const [domain, setDomain] = useState(account.domain || '')
  const [careersUrl, setCareersUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSave() {
    if (!domain.trim() && !careersUrl.trim()) return
    setSaving(true)
    const updates = {}
    if (domain.trim()) updates.domain = domain.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    if (careersUrl.trim()) updates.careers_url = careersUrl.trim()
    await api.accounts.update(account.id, updates)
    setSaving(false)
    setDone(true)
    onSaved()
  }

  if (done) return null

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-40 shrink-0">
        <div className="text-sm font-medium text-gray-900 truncate">{account.name}</div>
        <div className="text-xs text-gray-400">{account.account_type === 'territory' ? 'Target Account' : 'Closed lost'}</div>
      </div>

      {noDomain ? (
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="acmecorp.com"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      ) : (
        <>
          <span className="text-xs text-gray-400 w-32 shrink-0 truncate">{account.domain}</span>
          <input
            value={careersUrl}
            onChange={(e) => setCareersUrl(e.target.value)}
            placeholder="https://jobs.lever.co/acmecorp"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </>
      )}

      <button
        onClick={handleSave}
        disabled={saving || (!domain.trim() && !careersUrl.trim())}
        className="shrink-0 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-700 disabled:opacity-40"
      >
        {saving ? '...' : 'Save'}
      </button>
    </div>
  )
}

export default function CareersGapModal({ gaps, onClose, onSaved }) {
  const { no_domain = [], not_found = [] } = gaps
  const [savedCount, setSavedCount] = useState(0)

  function handleSaved() {
    setSavedCount((n) => n + 1)
    onSaved()
  }

  const total = no_domain.length + not_found.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Accounts with no job monitoring</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {total - savedCount} remaining · add a domain or careers page URL to enable monitoring
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-2">
          {no_domain.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 py-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">No domain set</span>
                <span className="text-xs text-gray-400">— Signal can't monitor these at all</span>
              </div>
              {no_domain.map((a) => (
                <GapRow key={a.id} account={a} onSaved={handleSaved} />
              ))}
            </div>
          )}

          {not_found.length > 0 && (
            <div>
              <div className="flex items-center gap-2 py-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Careers page not found</span>
                <span className="text-xs text-gray-400">— domain is set but auto-discovery failed</span>
              </div>
              {not_found.map((a) => (
                <GapRow key={a.id} account={a} onSaved={handleSaved} />
              ))}
            </div>
          )}

          {total === 0 && (
            <div className="py-10 text-center text-sm text-gray-400">All accounts have job monitoring configured.</div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

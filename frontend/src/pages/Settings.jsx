import { useState, useEffect } from 'react'
import { api } from '../lib/api.js'

function Section({ title, description, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function SaveButton({ saving, saved }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
    >
      {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
    </button>
  )
}

export default function Settings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState({})
  const [saving, setSaving] = useState({})

  useEffect(() => {
    api.settings.get().then((data) => {
      setSettings(data)
      setLoading(false)
    })
  }, [])

  async function save(key, value) {
    setSaving((s) => ({ ...s, [key]: true }))
    await api.settings.update(key, value)
    setSaving((s) => ({ ...s, [key]: false }))
    setSaved((s) => ({ ...s, [key]: true }))
    setTimeout(() => setSaved((s) => ({ ...s, [key]: false })), 2000)
  }

  if (loading) return <div className="text-sm text-gray-400 py-10 text-center">Loading...</div>

  const alertEmails = settings?.alert_emails || []
  const conferenceUrls = settings?.conference_urls || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure alerting, monitoring sources, and integrations.</p>
      </div>

      {/* Alert emails */}
      <Section
        title="Alert emails"
        description="These addresses receive signal alert emails. Separate multiple with commas."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const val = e.target.emails.value
            const parsed = val.split(',').map((s) => s.trim()).filter(Boolean)
            save('alert_emails', parsed)
          }}
          className="flex gap-3"
        >
          <input
            name="emails"
            defaultValue={alertEmails.join(', ')}
            placeholder="rep@company.com, manager@company.com"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <SaveButton saving={saving.alert_emails} saved={saved.alert_emails} />
        </form>
      </Section>

      {/* Conference URLs */}
      <Section
        title="Conference URLs to monitor"
        description="One URL per line. The scraper checks these pages for company names matching your accounts."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const val = e.target.urls.value
            const parsed = val.split('\n').map((s) => s.trim()).filter(Boolean)
            save('conference_urls', parsed)
          }}
          className="space-y-3"
        >
          <textarea
            name="urls"
            defaultValue={conferenceUrls.join('\n')}
            rows={5}
            placeholder="https://someconf.com/sponsors&#10;https://anotherconf.com/attendees"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
          <div className="flex justify-end">
            <SaveButton saving={saving.conference_urls} saved={saved.conference_urls} />
          </div>
        </form>
      </Section>

      {/* Crunchbase */}
      <Section
        title="Crunchbase API"
        description="Free tier: 200 calls/day. Used for funding round detection."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save('crunchbase_api_key', e.target.key.value || null)
          }}
          className="flex gap-3"
        >
          <input
            name="key"
            placeholder={settings?.crunchbase_api_key ? 'Key saved — enter a new value to replace' : 'cb_live_...'}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <SaveButton saving={saving.crunchbase_api_key} saved={saved.crunchbase_api_key} />
        </form>
      </Section>

      {/* Proxycurl */}
      <Section
        title="Proxycurl (optional)"
        description="Enables automated LinkedIn monitoring for champion job moves. ~£2/month. Leave blank to use manual reminders instead."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const key = e.target.key.value
            await save('proxycurl_api_key', key || null)
            await save('proxycurl_enabled', !!key)
          }}
          className="space-y-3"
        >
          <div className="flex gap-3">
            <input
              name="key"
              placeholder={settings?.proxycurl_api_key ? 'Key saved — enter a new value to replace' : 'Leave blank for manual reminders'}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <SaveButton saving={saving.proxycurl_api_key} saved={saved.proxycurl_api_key} />
          </div>
          <p className="text-xs text-gray-400">
            {settings?.proxycurl_enabled
              ? 'Automated LinkedIn monitoring is enabled.'
              : 'Manual mode: Signal will prompt you to check champions\' LinkedIn profiles every 30 days.'}
          </p>
        </form>
      </Section>
    </div>
  )
}

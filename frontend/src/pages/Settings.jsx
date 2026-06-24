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
      {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
    </button>
  )
}

function HowToGet({ steps }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-brand-600 hover:underline"
      >
        {open ? 'Hide instructions' : 'How to get this key ↓'}
      </button>
      {open && (
        <ol className="mt-2 space-y-1 list-decimal list-inside text-xs text-gray-500">
          {steps.map((step, i) => (
            <li key={i}>
              {step.url ? (
                <>
                  {step.text}{' '}
                  <a href={step.url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                    {step.linkText}
                  </a>
                </>
              ) : step.text}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export default function Settings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState({})
  const [saving, setSaving] = useState({})

  useEffect(() => {
    api.settings.get()
      .then((data) => setSettings(data))
      .catch(() => setSettings({}))
      .finally(() => setLoading(false))
  }, [])

  async function save(key, value) {
    setSaving((s) => ({ ...s, [key]: true }))
    await api.settings.update(key, value)
    setSaving((s) => ({ ...s, [key]: false }))
    setSaved((s) => ({ ...s, [key]: true }))
    setTimeout(() => setSaved((s) => ({ ...s, [key]: false })), 2000)
  }

  if (loading) return <div className="text-sm text-gray-400 py-10 text-center">Loading...</div>

  const conferenceUrls = settings?.conference_urls || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure alerting, monitoring sources, and integrations.</p>
      </div>

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
        description="Detects new funding rounds and M&A activity at your accounts. Requires a paid Crunchbase plan."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save('crunchbase_api_key', e.target.key.value || null)
          }}
          className="space-y-2"
        >
          <div className="flex gap-3">
            <input
              name="key"
              placeholder={settings?.crunchbase_api_key ? 'Key saved — enter a new value to replace' : 'cb_live_...'}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <SaveButton saving={saving.crunchbase_api_key} saved={saved.crunchbase_api_key} />
          </div>
          <HowToGet steps={[
            { text: 'Crunchbase API requires a paid plan. See pricing at', url: 'https://www.crunchbase.com/pricing', linkText: 'crunchbase.com/pricing' },
            { text: 'After subscribing, go to', url: 'https://www.crunchbase.com/account/api_keys', linkText: 'crunchbase.com/account/api_keys' },
            { text: 'Copy your key and paste it above.' },
          ]} />
        </form>
      </Section>

      {/* Perigon */}
      <Section
        title="Perigon News API"
        description="Powers competitor bad-press and product-sunset signals. Free tier: 1,000 calls/month."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save('perigon_api_key', e.target.key.value || null)
          }}
          className="space-y-2"
        >
          <div className="flex gap-3">
            <input
              name="key"
              placeholder={settings?.perigon_api_key ? 'Key saved — enter a new value to replace' : 'API key...'}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <SaveButton saving={saving.perigon_api_key} saved={saved.perigon_api_key} />
          </div>
          <HowToGet steps={[
            { text: 'Go to', url: 'https://www.goperigon.com', linkText: 'goperigon.com' },
            { text: 'Click "Get started free" and create an account.' },
            { text: 'In your dashboard, go to API Keys and copy your key.' },
          ]} />
        </form>
      </Section>

      {/* Adzuna */}
      <Section
        title="Adzuna Jobs API"
        description="Detects when accounts hire senior finance or revenue leaders — a signal of new budget authority. Free tier: 1,000 calls/month."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const appId = e.target.app_id.value.trim()
            const appKey = e.target.app_key.value.trim()
            await save('adzuna_app_id', appId || null)
            await save('adzuna_app_key', appKey || null)
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">App ID</label>
              <input
                name="app_id"
                placeholder={settings?.adzuna_app_id ? 'Saved — enter to replace' : 'App ID'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">App Key</label>
              <input
                name="app_key"
                placeholder={settings?.adzuna_app_key ? 'Saved — enter to replace' : 'App Key'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <HowToGet steps={[
              { text: 'Go to', url: 'https://developer.adzuna.com/signup', linkText: 'developer.adzuna.com/signup' },
              { text: 'Create a free account.' },
              { text: 'Once approved, go to Dashboard → Your Apps to find your App ID and App Key.' },
            ]} />
            <SaveButton saving={saving.adzuna_app_id || saving.adzuna_app_key} saved={saved.adzuna_app_id && saved.adzuna_app_key} />
          </div>
        </form>
      </Section>

      {/* Proxycurl */}
      <Section
        title="Proxycurl (optional)"
        description="Enables automated LinkedIn monitoring for champion and blocker job moves."
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
              ? 'Automated mode: Signal checks LinkedIn profiles on every scan and fires a signal automatically when someone moves.'
              : 'Manual mode: Signal can\'t check LinkedIn automatically without an API key. Instead, every 30 days it will create a "Check [Name]\'s LinkedIn" signal in your feed as a reminder to check manually. Add a key above to automate this.'}
          </p>
          <HowToGet steps={[
            { text: 'Go to', url: 'https://nubela.co/proxycurl', linkText: 'nubela.co/proxycurl' },
            { text: 'Sign up and purchase credits (pay-as-you-go, ~$0.01/profile).' },
            { text: 'Go to Dashboard → API Key and copy your key.' },
          ]} />
        </form>
      </Section>
    </div>
  )
}

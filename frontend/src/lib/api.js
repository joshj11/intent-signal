import { supabase } from './supabaseClient.js'

const BASE = import.meta.env.VITE_API_URL || ''

async function request(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }

  if (res.status === 204) return null
  return res.json()
}

// Accounts
export const api = {
  accounts: {
    list: () => request('/api/accounts'),
    get: (id) => request(`/api/accounts/${id}`),
    create: (body) => request('/api/accounts', { method: 'POST', body }),
    update: (id, body) => request(`/api/accounts/${id}`, { method: 'PATCH', body }),
    delete: (id) => request(`/api/accounts/${id}`, { method: 'DELETE' }),
    bulk: (accounts) => request('/api/accounts/bulk', { method: 'POST', body: { accounts } }),
    bulkUpdate: (ids, updates) => request('/api/accounts/bulk', { method: 'PATCH', body: { ids, updates } }),
    bulkDelete: (ids) => request('/api/accounts/bulk', { method: 'DELETE', body: { ids } }),
    scan: (id) => request(`/api/accounts/${id}/scan`, { method: 'POST' }),
  },
  contacts: {
    list: (accountId) =>
      request(`/api/contacts${accountId ? `?account_id=${accountId}` : ''}`),
    create: (body) => request('/api/contacts', { method: 'POST', body }),
    update: (id, body) => request(`/api/contacts/${id}`, { method: 'PATCH', body }),
    delete: (id) => request(`/api/contacts/${id}`, { method: 'DELETE' }),
  },
  signals: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString()
      return request(`/api/signals${qs ? `?${qs}` : ''}`)
    },
    pendingCount: () => request('/api/signals/pending-count'),
    acknowledgeAll: () => request('/api/signals/acknowledge-all', { method: 'POST' }),
    alert: (id, notes) => request(`/api/signals/${id}/alert`, { method: 'POST', body: { notes: notes || null } }),
    ignore: (id) => request(`/api/signals/${id}/ignore`, { method: 'POST' }),
  },
  settings: {
    get: () => request('/api/settings'),
    update: (key, value) => request(`/api/settings/${key}`, { method: 'PATCH', body: { value } }),
  },
  investorProspects: {
    list: () => request('/api/investor-prospects'),
    create: (body) => request('/api/investor-prospects', { method: 'POST', body }),
    bulk: (prospects) => request('/api/investor-prospects/bulk', { method: 'POST', body: { prospects } }),
    update: (id, body) => request(`/api/investor-prospects/${id}`, { method: 'PATCH', body }),
    delete: (id) => request(`/api/investor-prospects/${id}`, { method: 'DELETE' }),
    bulkDelete: (ids) => request('/api/investor-prospects/bulk', { method: 'DELETE', body: { ids } }),
    recheck: () => request('/api/investor-prospects/recheck', { method: 'POST' }),
  },
  scan: {
    runs: (limit = 1) => request(`/api/scan/runs?limit=${limit}`),
    progress: () => request('/api/scan/progress'),
  },
  competitors: {
    list: () => request('/api/competitors'),
    add: (name) => request('/api/competitors', { method: 'POST', body: { name } }),
  },
  runSignals: () => request('/api/run-signals', { method: 'POST' }),
  scanAll: (accountType = 'all') => request('/api/scan/all', { method: 'POST', body: { confirm: true, account_type: accountType } }),
  coverage: {
    careers: () => request('/api/coverage/careers'),
  },
}

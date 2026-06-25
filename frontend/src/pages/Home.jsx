import { useState } from 'react'
import { Link } from 'react-router-dom'

const SETUP_STEPS = [
  {
    number: '1',
    title: 'Configure your signal sources',
    description: 'Add API keys for Perigon (competitor news) and Adzuna (economic buyer signals). Proxycurl is optional — without it, Signal reminds you to check LinkedIn manually every 30 days.',
    cta: 'Go to Settings',
    href: '/settings',
  },
  {
    number: '2',
    title: 'Import your closed-lost accounts',
    description: 'Upload a CSV of accounts you\'ve lost or add them manually. Include the domain, loss reason, and closed date for best results.',
    cta: 'Go to Accounts',
    href: '/accounts',
  },
  {
    number: '3',
    title: 'Add contacts to each account',
    description: 'Tag champions (your internal advocates) and blockers (deal killers). Add LinkedIn URLs to enable job move detection.',
    cta: 'Go to Accounts',
    href: '/accounts',
  },
  {
    number: '4',
    title: 'Run your first scan',
    description: 'Trigger a scan from the Signal Feed or Accounts page whenever you want to check for new signals.',
    cta: 'Go to Signal Feed',
    href: '/signals',
  },
  {
    number: '5',
    title: 'Add investor prospects',
    description: 'Upload a list of target accounts you want warm introductions to. Signal will cross-reference them against Sisense\'s investor portfolios to find shared investors who can make the intro.',
    cta: 'Go to Investor Prospects',
    href: '/investor-prospects',
  },
]

const SIGNAL_TYPES = [
  {
    label: 'Funding Round',
    description: 'New capital = new budget cycles. A funded account that went dark may now have room to buy.',
    color: 'bg-green-100 text-green-700',
    requires: 'Crunchbase API',
    how: 'On each scan, Signal queries the Crunchbase API for the account\'s domain. If a new funding round has been announced since the last scan, a signal fires. Crunchbase requires a paid plan.',
  },
  {
    label: 'Engineering Hiring',
    description: 'Active technical hiring signals growth. Scaling teams need tooling to match.',
    color: 'bg-violet-100 text-violet-700',
    requires: 'Adzuna API + account careers page URL',
    how: 'Signal searches Adzuna for active engineering job postings at the company. If 3 or more open roles are found, it fires a signal — indicating the team is scaling and likely evaluating new tooling.',
  },
  {
    label: 'Champion Job Move',
    description: 'Your champion carries context to their next role. Their new employer is a warm lead.',
    color: 'bg-amber-100 text-amber-700',
    requires: 'Proxycurl API (or manual)',
    how: 'For every contact tagged as a champion with a LinkedIn URL, Signal checks their current employer via Proxycurl. If it has changed, a signal fires pointing to their new company. Without Proxycurl, Signal creates a "Check [Name]\'s LinkedIn" reminder every 30 days instead.',
  },
  {
    label: 'Blocker Departed',
    description: 'The person who killed the deal has left. The objection may have walked out with them.',
    color: 'bg-red-100 text-red-700',
    requires: 'Proxycurl API (or manual)',
    how: 'Same as champion job moves, but for contacts tagged as blockers. If the person who killed the deal has moved on, Signal fires — it\'s often worth reaching back out. Without Proxycurl, you get a manual reminder every 30 days.',
  },
  {
    label: 'Competitor Bad Press',
    description: 'Acquisitions, layoffs, or outages at the tool they chose create a natural re-engagement opening.',
    color: 'bg-orange-100 text-orange-700',
    requires: 'Perigon API',
    how: 'Signal searches Perigon for recent news articles mentioning the competitor the account uses (e.g. Tableau, Power BI, Looker). Articles containing keywords like "layoffs", "acquisition", "outage", or "shutdown" in the last 7 days trigger a signal. If no specific competitor is set on the account, all Sisense competitors are checked.',
  },
  {
    label: 'Competitor Sunsetting',
    description: 'A product being wound down means they urgently need a replacement.',
    color: 'bg-pink-100 text-pink-700',
    requires: 'Perigon API',
    how: 'Signal searches Perigon for news about the competitor being discontinued, end-of-lifed, or deprecated. Keywords like "end of life", "discontinue", "sunset", and "deprecated" are used. If matched, it fires a high-priority signal — the account urgently needs an alternative.',
  },
  {
    label: 'Conference Attendance',
    description: 'A contact at an industry event is out of heads-down mode and open to conversation.',
    color: 'bg-blue-100 text-blue-700',
    requires: 'Conference URLs (Settings)',
    how: 'Signal scrapes the sponsor and attendee pages you add in Settings. It looks for company name matches against your accounts. If found, it fires a signal — conference season is one of the best times to re-engage.',
  },
  {
    label: 'New Economic Buyer',
    description: 'A new CFO or VP Finance means new budget ownership and fresh buying decisions.',
    color: 'bg-teal-100 text-teal-700',
    requires: 'Adzuna API',
    how: 'Signal searches Adzuna for senior finance and revenue leadership job postings at the company — roles like CFO, VP Finance, Head of Revenue Operations, and Chief Revenue Officer. A new hire in these roles often means budget decisions are being revisited.',
  },
  {
    label: 'IPO Filing',
    description: 'A company filing for IPO is about to need enterprise-grade tooling at scale.',
    color: 'bg-indigo-100 text-indigo-700',
    requires: 'Crunchbase API',
    how: 'Signal checks Crunchbase for IPO filings associated with the account\'s domain. A company preparing to go public typically undergoes significant operational scaling and is an ideal time to re-engage with an enterprise pitch.',
  },
  {
    label: 'Shared Investor',
    description: 'A mutual investor can make a warm introduction to any prospect you\'re trying to reach.',
    color: 'bg-teal-100 text-teal-700',
    requires: 'Crunchbase API',
    how: 'Signal cross-references a prospect\'s investors (via Crunchbase) against Sisense\'s own investor list. If there\'s an overlap, it surfaces on the Investor Prospects page — that investor can make a warm introduction on your behalf.',
  },
]

function SignalModal({ signal, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          ×
        </button>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mb-3 ${signal.color}`}>
          {signal.label}
        </span>
        <p className="text-sm text-gray-700 mb-4">{signal.description}</p>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">How it works</p>
            <p className="text-sm text-gray-600 leading-relaxed">{signal.how}</p>
          </div>
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Requires</p>
            <p className="text-sm text-gray-600">{signal.requires}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [activeSignal, setActiveSignal] = useState(null)

  return (
    <div className="max-w-3xl mx-auto space-y-12">

      {/* Hero */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Welcome to Signal</h1>
        <p className="text-gray-500 text-base leading-relaxed">
          Signal monitors your closed-lost accounts and target prospects for buying signals — funding rounds, hiring surges, champion moves, competitor bad news, and more — so you know exactly when to re-engage and why.
        </p>
        <div className="flex gap-3 mt-5">
          <Link to="/signals" className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700">
            View Signal Feed
          </Link>
          <Link to="/accounts" className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50">
            View Accounts
          </Link>
        </div>
      </div>

      {/* What signals does it detect */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">What signals does it detect?</h2>
        <p className="text-sm text-gray-400 mb-3">Click any card to see how it works.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SIGNAL_TYPES.map((s) => (
            <button
              key={s.label}
              onClick={() => setActiveSignal(s)}
              className="text-left border border-gray-100 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mb-2 ${s.color}`}>{s.label}</span>
              <p className="text-sm text-gray-500">{s.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Setup steps */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">How to set it up</h2>
        <div className="space-y-3">
          {SETUP_STEPS.map((step) => (
            <div key={step.number} className="flex gap-4 border border-gray-100 rounded-xl p-4">
              <div className="w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                {step.number}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{step.title}</p>
                <p className="text-sm text-gray-500 mt-0.5">{step.description}</p>
              </div>
              <Link to={step.href} className="text-xs text-gray-400 hover:text-gray-700 shrink-0 self-start mt-0.5 whitespace-nowrap">
                {step.cta} →
              </Link>
            </div>
          ))}
        </div>
      </div>

      {activeSignal && <SignalModal signal={activeSignal} onClose={() => setActiveSignal(null)} />}

    </div>
  )
}

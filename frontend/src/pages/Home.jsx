import { Link } from 'react-router-dom'

const SETUP_STEPS = [
  {
    number: '1',
    title: 'Import your closed-lost accounts',
    description: 'Upload a CSV of accounts you\'ve lost or add them manually. Include the domain, loss reason, and closed date for best results.',
    cta: 'Go to Accounts',
    href: '/accounts',
  },
  {
    number: '2',
    title: 'Add contacts to each account',
    description: 'Tag champions (your internal advocates) and blockers (deal killers). Add LinkedIn URLs to enable job move detection.',
    cta: 'Go to Accounts',
    href: '/accounts',
  },
  {
    number: '3',
    title: 'Configure your signal sources',
    description: 'Add API keys for Perigon (competitor news) and Adzuna (economic buyer signals). Proxycurl is optional — without it, Signal reminds you to check LinkedIn manually every 30 days.',
    cta: 'Go to Settings',
    href: '/settings',
  },
  {
    number: '4',
    title: 'Run your first scan',
    description: 'Trigger a scan from the Signal Feed or Accounts page. Scans also run automatically every Monday at 7am UTC.',
    cta: 'Go to Signal Feed',
    href: '/signals',
  },
  {
    number: '5',
    title: 'Add investor prospects',
    description: 'Upload a list of target accounts outside your territory. Signal will cross-reference them against Sisense\'s investor portfolios to find warm intro opportunities.',
    cta: 'Go to Investor Prospects',
    href: '/investor-prospects',
  },
]

const SIGNAL_TYPES = [
  { label: 'Funding Round', description: 'New capital = new budget cycles. A funded account that went dark may now have room to buy.', color: 'bg-green-100 text-green-700' },
  { label: 'Engineering Hiring', description: 'Active technical hiring signals growth. Scaling teams need tooling to match.', color: 'bg-violet-100 text-violet-700' },
  { label: 'Champion Job Move', description: 'Your champion carries context to their next role. Their new employer is a warm lead.', color: 'bg-amber-100 text-amber-700' },
  { label: 'Blocker Departed', description: 'The person who killed the deal has left. The objection may have walked out with them.', color: 'bg-red-100 text-red-700' },
  { label: 'Competitor Bad Press', description: 'Acquisitions, layoffs, or outages at the tool they chose create a natural re-engagement opening.', color: 'bg-orange-100 text-orange-700' },
  { label: 'Competitor Sunsetting', description: 'A product being wound down means they urgently need a replacement.', color: 'bg-pink-100 text-pink-700' },
  { label: 'Conference Attendance', description: 'A contact at an industry event is out of heads-down mode and open to conversation.', color: 'bg-blue-100 text-blue-700' },
  { label: 'New Economic Buyer', description: 'A new CFO or VP Finance means new budget ownership and fresh buying decisions.', color: 'bg-teal-100 text-teal-700' },
  { label: 'IPO Filing', description: 'A company filing for IPO is about to need enterprise-grade tooling at scale.', color: 'bg-indigo-100 text-indigo-700' },
  { label: 'Shared Investor', description: 'A mutual investor can make a warm introduction to a prospect outside your territory.', color: 'bg-teal-100 text-teal-700' },
]

export default function Home() {
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
        <h2 className="text-base font-semibold text-gray-900 mb-3">What signals does it detect?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SIGNAL_TYPES.map((s) => (
            <div key={s.label} className="border border-gray-100 rounded-xl p-4">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mb-2 ${s.color}`}>{s.label}</span>
              <p className="text-sm text-gray-500">{s.description}</p>
            </div>
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

    </div>
  )
}

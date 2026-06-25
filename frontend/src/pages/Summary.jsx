const SIGNALS = [
  {
    type: 'funding_round',
    name: 'Funding Round',
    color: 'green',
    source: 'Crunchbase',
    cadence: 'Weekly (Mon)',
    why: 'New capital means new budget cycles. A funded company that went dark on cost grounds may now have room to buy.',
  },
  {
    type: 'ipo_filing',
    name: 'IPO Filing',
    color: 'green',
    source: 'Crunchbase',
    cadence: 'Weekly (Mon)',
    why: 'IPO prep unlocks large pre-listing budgets and drives a wave of software purchasing to look investor-ready.',
  },
  {
    type: 'new_hire',
    name: 'Engineering / Product Hiring',
    color: 'violet',
    source: 'Careers page + Adzuna',
    cadence: 'Weekly (Mon)',
    why: 'Active technical hiring signals growth and investment. Teams scaling up often need the tooling to match.',
  },
  {
    type: 'new_economic_buyer',
    name: 'New Economic Buyer Hired',
    color: 'violet',
    source: 'Adzuna',
    cadence: 'Weekly (Mon)',
    why: 'A new CFO, CRO, or VP Finance brings fresh priorities and a mandate to evaluate the stack.',
  },
  {
    type: 'conference_attendance',
    name: 'Conference Attendance',
    color: 'blue',
    source: 'Conference sites',
    cadence: 'Weekly (Mon)',
    why: 'A contact showing up at an industry event is out of heads-down mode and open to conversation.',
  },
  {
    type: 'champion_move',
    name: 'Champion Job Move',
    color: 'amber',
    source: 'Proxycurl (LinkedIn)',
    cadence: 'Weekly (Mon)',
    why: 'Your champion carries context and goodwill to their next role. Their new employer is a warm lead.',
  },
  {
    type: 'blocker_departed',
    name: 'Blocker Left Company',
    color: 'red',
    source: 'Proxycurl (LinkedIn)',
    cadence: 'Weekly (Mon)',
    why: 'The person who killed the deal is gone. The objection may have walked out with them.',
  },
  {
    type: 'competitor_bad_news',
    name: 'Competitor Negative Press',
    color: 'orange',
    source: 'Perigon',
    cadence: 'Weekly (Mon)',
    why: 'Acquisitions, layoffs, pricing hikes, and outages at the competitor create a natural opening to re-engage.',
  },
  {
    type: 'competitor_sunset',
    name: 'Competitor Product Sunset',
    color: 'red',
    source: 'Perigon',
    cadence: 'Weekly (Mon)',
    why: 'End-of-life announcements force customers to find a replacement. Act before they evaluate the wrong alternative.',
  },
  {
    type: 'shared_investor',
    name: 'Shared Investor',
    color: 'teal',
    source: 'Crunchbase',
    cadence: 'Weekly (Mon)',
    why: 'A mutual investor can make a warm introduction to a prospect. Surfaces on the Investor Prospects page.',
  },
]

const TAGS = [
  {
    tag: 'champion',
    label: 'Champion',
    color: 'green',
    rule: 'Always tracked',
    desc: 'Loved the product. Their job move is a signal — their new employer is a warm lead and their departure is worth acting on.',
  },
  {
    tag: 'evaluator',
    label: 'Evaluator',
    color: 'blue',
    rule: 'Tracked for LinkedIn moves',
    desc: 'Involved in the evaluation but neutral. LinkedIn moves are tracked the same as champions.',
  },
  {
    tag: 'blocker',
    label: 'Blocker',
    color: 'red',
    rule: 'Departure is the signal',
    desc: 'Actively opposed the deal. A blocker departing the company is itself a signal — it may be worth re-engaging.',
  },
]

const LOSS_RULES = [
  { reason: 'No Budget', rule: 'Normal — all signals fire', suppress: false },
  { reason: 'No Priority', rule: 'Normal — all signals fire', suppress: false },
  { reason: 'No Resources', rule: 'Normal — all signals fire', suppress: false },
  { reason: 'Wrong Timing', rule: 'Normal — all signals fire', suppress: false },
  { reason: 'Competitor Won', rule: 'Normal — competitor signals are especially relevant', suppress: false },
  { reason: 'Bad Fit', rule: 'All signals suppressed — do not re-engage', suppress: true },
]

const COLOR_CLASSES = {
  green: 'bg-green-50 text-green-700 ring-green-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  teal: 'bg-teal-50 text-teal-700 ring-teal-200',
  purple: 'bg-purple-50 text-purple-700 ring-purple-200',
}

const DOT_CLASSES = {
  green: 'bg-green-500',
  violet: 'bg-violet-500',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  teal: 'bg-teal-500',
  purple: 'bg-purple-500',
}

function Pill({ label, color }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ring-inset ${COLOR_CLASSES[color] ?? COLOR_CLASSES.blue}`}>
      {label}
    </span>
  )
}

function Section({ title, description, children }) {
  return (
    <section className="mb-12">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export default function Summary() {
  return (
    <div className="max-w-4xl">
      <div className="mb-10">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">How Signal works</h1>
        <p className="text-sm text-gray-500 leading-relaxed max-w-2xl">
          Signal monitors your closed-lost accounts and target accounts for intent signals — external events that suggest a deal is worth re-opening. When a signal fires it appears in your Signal Feed to acknowledge or ignore.
        </p>
      </div>

      <Section
        title="Signal detectors"
        description="10 detectors run every Monday at 7am UTC and can also be triggered manually. Each fires at most once per account every 30 days."
      >
        <div className="space-y-2">
          {SIGNALS.map((s) => (
            <div key={s.type} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <div className="flex items-start gap-4">
                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${DOT_CLASSES[s.color]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium text-gray-900">{s.name}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{s.source}</span>
                    <span className="text-xs text-gray-400">{s.cadence}</span>
                  </div>
                  <p className="text-sm text-gray-500">{s.why}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Contact tags"
        description="Tags on contacts tell Signal who to monitor and what to look for. Set them from the account detail page."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {TAGS.map((t) => (
            <div key={t.tag} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <Pill label={t.label} color={t.color} />
                <span className="text-xs text-gray-400">{t.rule}</span>
              </div>
              <p className="text-sm text-gray-500">{t.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Loss reason rules"
        description="The reason a deal was lost affects whether signals fire at all."
      >
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {LOSS_RULES.map((r, i) => (
            <div
              key={r.reason}
              className={`flex items-center gap-4 px-5 py-3.5 text-sm ${i > 0 ? 'border-t border-gray-100' : ''}`}
            >
              <span className="font-medium text-gray-900 w-36 shrink-0">{r.reason}</span>
              <span className={r.suppress ? 'text-red-600' : 'text-gray-500'}>{r.rule}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Data sources">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {[
            { source: 'Crunchbase', key: 'Configured in Settings', used: 'Funding rounds, IPO filings, shared investors' },
            { source: 'Proxycurl', key: 'Configured in Settings (optional)', used: 'Champion moves, blocker departures — falls back to manual reminders' },
            { source: 'Perigon', key: 'Configured in Settings', used: 'Competitor bad news, competitor sunset' },
            { source: 'Adzuna', key: 'Configured in Settings', used: 'Engineering hiring, new economic buyer' },
            { source: 'Conference sites', key: 'URLs configured in Settings', used: 'Conference attendance' },
            { source: 'Careers pages', key: 'Domain set on each account', used: 'Engineering / product hiring' },
          ].map((r, i) => (
            <div
              key={r.source}
              className={`flex items-start gap-4 px-5 py-3.5 text-sm ${i > 0 ? 'border-t border-gray-100' : ''}`}
            >
              <span className="font-medium text-gray-900 w-32 shrink-0">{r.source}</span>
              <span className="text-gray-500 w-56 shrink-0">{r.key}</span>
              <span className="text-gray-400">{r.used}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

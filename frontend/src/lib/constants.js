export const LOSS_REASONS = [
  { value: 'no_budget', label: 'No Budget' },
  { value: 'no_priority', label: 'No Priority' },
  { value: 'no_resources', label: 'No Resources' },
  { value: 'wrong_timing', label: 'Wrong Timing' },
  { value: 'competitor_won', label: 'Competitor Won' },
  { value: 'bad_fit', label: 'Bad Fit' },
]

export const CONTACT_TAGS = [
  { value: 'champion', label: 'Champion' },
  { value: 'economic_buyer', label: 'Economic Buyer' },
  { value: 'evaluator', label: 'Evaluator' },
  { value: 'blocker', label: 'Blocker' },
]

export const SIGNAL_TYPES = {
  conference_attendance: { label: 'Conference', color: 'blue' },
  new_hire: { label: 'New Hire', color: 'violet' },
  funding_round: { label: 'Funding', color: 'green' },
  champion_move: { label: 'Champion Move', color: 'amber' },
  reengagement_window: { label: 'Re-engagement Window', color: 'sky' },
}

export const LOSS_REASON_COLORS = {
  no_budget: 'red',
  no_priority: 'orange',
  no_resources: 'amber',
  wrong_timing: 'sky',
  competitor_won: 'purple',
  bad_fit: 'gray',
}

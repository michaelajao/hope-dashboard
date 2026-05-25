// ====== icons.jsx ======
// Minimal stroke icons. No emoji.
const I = {
  Search:    () => <svg className="ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>,
  Filter:    () => <svg className="ic" viewBox="0 0 24 24"><path d="M4 5h16M7 12h10M10 19h4"/></svg>,
  Bell:      () => <svg className="ic" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>,
  Settings:  () => <svg className="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 4.27 16.96l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 4.27l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.16.66.43.86.78"/></svg>,
  Sparkle:   () => <svg className="ic sm" viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>,
  Send:      () => <svg className="ic" viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4 20-7Z"/></svg>,
  Edit:      () => <svg className="ic" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>,
  Refresh:   () => <svg className="ic" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>,
  Mail:      () => <svg className="ic" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>,
  Note:      () => <svg className="ic" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/></svg>,
  Plus:      () => <svg className="ic" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
  Check:     () => <svg className="ic" viewBox="0 0 24 24"><path d="m20 6-11 11-5-5"/></svg>,
  Snooze:    () => <svg className="ic" viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6M19 3l3 3"/></svg>,
  X:         () => <svg className="ic" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Info:      () => <svg className="ic sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/></svg>,
  External:  () => <svg className="ic sm" viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/></svg>,
  Down:      () => <svg className="ic sm" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>,
  Up:        () => <svg className="ic sm" viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg>,
  Dot:       () => <svg className="ic sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>,
};
window.I = I;


// ====== data.jsx ======
// Mocked participants + model outputs.
// In production: dropout fields come from the ML model, drafts come from the SLM.

const initials = (n) => n.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

const PARTICIPANTS = [
  {
    id: 'p1', name: 'Jamie Cooper', age: 34,
    status: 'needs-attention',
    lastActiveDays: 10,
    dropoutPct: 78,
    // Feature attributions returned by the ML model (sum ≈ dropoutPct, capped to top 4)
    drivers: [
      { feature: 'No login in 10 days', weight: 0.34 },
      { feature: 'Discussion posts ↓ 80%', weight: 0.26 },
      { feature: 'Goal progress stalled (14d)', weight: 0.18 },
      { feature: 'Low message response rate', weight: 0.12 },
    ],
    signals: {
      lastActive: { v: '10d ago', tone: 'down', sub: 'vs. 1.2d cohort avg' },
      posts:      { v: '↓ 80%',  tone: 'down', sub: 'over 2 weeks' },
      response:   { v: '12%',    tone: 'warn', sub: 'message reply rate' },
      goal:       { v: 'Stalled', tone: 'warn', sub: '0/3 steps in 14d' },
    },
    note: 'Engagement declined sharply after week 3 module. No feedback submitted in last 2 sessions.',
    history: [
      { when: '10d ago', what: <>Last login — opened <b>Module 3: Reframing</b>, did not start activity</> },
      { when: '14d ago', what: <>Submitted goal: <b>“walk 3× per week”</b> — 0 of 3 steps complete</> },
      { when: '18d ago', what: <>Posted in cohort discussion · 2 replies received</> },
      { when: '22d ago', what: <>Completed Module 2 reflection</> },
    ],
    activity: [
      { type: 'note', title: 'Coach note added', sub: 'Possible work travel — flagged by Sara', time: '3d ago' },
    ],
  },
  {
    id: 'p2', name: 'Taylor Morgan',
    status: 'check-in-soon',
    lastActiveDays: 4,
    dropoutPct: 52,
    drivers: [
      { feature: 'Participation below cohort median', weight: 0.22 },
      { feature: 'Skipped 2 optional sessions', weight: 0.16 },
      { feature: 'Sentiment trending neutral→low', weight: 0.10 },
    ],
    signals: {
      lastActive: { v: '4d ago', tone: 'warn', sub: 'vs. 1.2d cohort avg' },
      posts:      { v: '↓ 35%',  tone: 'warn', sub: 'over 2 weeks' },
      response:   { v: '48%',    tone: '',     sub: 'message reply rate' },
      goal:       { v: '1 of 3', tone: '',     sub: 'on pace' },
    },
    note: 'Lower participation this week. Otherwise engaged and responsive.',
    history: [
      { when: '4d ago', what: <>Read <b>Module 4: Habits</b> · did not post</> },
      { when: '7d ago', what: <>Replied to coach message · positive sentiment</> },
    ],
    activity: [],
  },
  {
    id: 'p3', name: 'Riley Ahmed',
    status: 'on-track',
    lastActiveDays: 1,
    dropoutPct: 12,
    drivers: [
      { feature: 'Consistent daily activity', weight: 0.04 },
    ],
    signals: {
      lastActive: { v: '1d ago', tone: '', sub: 'vs. 1.2d cohort avg' },
      posts:      { v: '+18%',  tone: '', sub: 'over 2 weeks' },
      response:   { v: '76%',   tone: '', sub: 'message reply rate' },
      goal:       { v: '3 of 3', tone: '', sub: 'on pace' },
    },
    note: 'On track. No reply needed to last message.',
    history: [
      { when: '1d ago', what: <>Completed <b>Module 4 reflection</b></> },
      { when: '3d ago', what: <>Posted in discussion · 4 replies sent</> },
    ],
    activity: [],
  },
  {
    id: 'p4', name: 'Priya Shah',
    status: 'needs-attention',
    lastActiveDays: 7,
    dropoutPct: 64,
    drivers: [
      { feature: 'No posts since joining', weight: 0.28 },
      { feature: 'Low session attendance', weight: 0.20 },
      { feature: 'No goal set', weight: 0.14 },
    ],
    signals: {
      lastActive: { v: '7d ago', tone: 'warn', sub: 'vs. 1.2d cohort avg' },
      posts:      { v: '0 posts', tone: 'down', sub: 'since joining' },
      response:   { v: '—', tone: '', sub: 'no messages sent' },
      goal:       { v: 'Not set', tone: 'warn', sub: 'onboarding incomplete' },
    },
    note: 'No engagement signals since enrollment. Likely needs onboarding help.',
    history: [
      { when: '7d ago', what: <>Enrolled in cohort</> },
    ],
    activity: [],
  },
  {
    id: 'p5', name: 'Alex Johnson',
    status: 'check-in-soon',
    lastActiveDays: 5,
    dropoutPct: 44,
    drivers: [
      { feature: 'Missed 2 scheduled activities', weight: 0.18 },
      { feature: 'Drop in response speed', weight: 0.12 },
    ],
    signals: {
      lastActive: { v: '5d ago', tone: 'warn', sub: 'vs. 1.2d cohort avg' },
      posts:      { v: '↓ 22%',  tone: 'warn', sub: 'over 2 weeks' },
      response:   { v: '38%',    tone: '',     sub: 'message reply rate' },
      goal:       { v: '1 of 3', tone: '',     sub: 'behind by 1' },
    },
    note: 'Missed two activities in a row. Otherwise responsive.',
    history: [
      { when: '5d ago', what: <>Opened module 3 · did not complete activity</> },
      { when: '9d ago', what: <>Replied to coach DM</> },
    ],
    activity: [],
  },
  {
    id: 'p6', name: 'Devon Carter',
    status: 'on-track',
    lastActiveDays: 0,
    dropoutPct: 8,
    drivers: [{ feature: 'Consistent engagement', weight: 0.03 }],
    signals: {
      lastActive: { v: 'Today', tone: '', sub: 'vs. 1.2d cohort avg' },
      posts:      { v: '+24%', tone: '', sub: 'over 2 weeks' },
      response:   { v: '82%', tone: '', sub: 'message reply rate' },
      goal:       { v: '3 of 3', tone: '', sub: 'on pace' },
    },
    note: 'Highly engaged.',
    history: [{ when: 'Today', what: <>Posted in discussion</> }],
    activity: [],
  },
];

// Mock SLM — tone-conditional drafts.
// In production, this is a fetch() to your hosted SLM endpoint with:
//  { participant, drivers, tone } → { draft }
const MOCK_DRAFTS = {
  p1: {
    warm:   "Hi Jamie — just checking in. I noticed it's been a little while since we connected and I wanted to make sure you're doing okay. No pressure to reply, but if there's anything making this week tricky, I'm here.",
    nudge:  "Hey Jamie — small idea: could you pick one tiny thing from Module 3 to try this week? Even five minutes counts. Reply with what you pick and I'll keep an eye out for it.",
    goal:   "Hi Jamie — your walking goal is still waiting on its first step. Want to try one walk this week, even short, and tell me how it went? Happy to adjust the goal if it's not the right fit right now.",
  },
  p2: {
    warm:   "Hi Taylor — how's your week going? Just a quick check-in, no need to reply if you're heads-down.",
    nudge:  "Hi Taylor — Module 4 has a quick journal prompt you might enjoy. Want to give it 5 minutes and tell me what came up?",
    goal:   "Hi Taylor — you're 1 of 3 on this week's goal, which is solid. Anything I can help unblock for step 2?",
  },
  p4: {
    warm:   "Hi Priya — welcome again. I wanted to make sure you have what you need to get started. Anything confusing so far?",
    nudge:  "Hi Priya — when you have a minute, the onboarding video is 4 mins and sets you up for the cohort. Let me know if you hit any snags.",
    goal:   "Hi Priya — once you set a starting goal we can shape the cohort around it. Want me to suggest one based on your sign-up answers?",
  },
  p5: {
    warm:   "Hi Alex — checking in. Hope this past week wasn't too packed. Anything I should know about?",
    nudge:  "Hi Alex — want to pick one of the two missed activities and give it a quick try this week? I can shorten either of them.",
    goal:   "Hi Alex — you're 1 of 3 on goals this week. What would help to land step 2 by Friday?",
  },
};

// Generic fallback for low-risk participants
const FALLBACK_DRAFT = {
  warm:  "Hi {name} — just a quick hello and a thanks for staying engaged. Anything I can help with this week?",
  nudge: "Hi {name} — nice momentum this week. Want to try one stretch activity in the bonus track?",
  goal:  "Hi {name} — your goals are tracking well. Want to set the next milestone now?",
};

const TONES = [
  { id: 'warm',  label: 'Warm check-in' },
  { id: 'nudge', label: 'Next-step nudge' },
  { id: 'goal',  label: 'Goal-focused' },
];

const STATUS_META = {
  'needs-attention': { label: 'Needs attention', cls: 'hi' },
  'check-in-soon':   { label: 'Check in soon',   cls: 'md' },
  'on-track':        { label: 'On track',        cls: 'lo' },
};

window.PARTICIPANTS = PARTICIPANTS;
window.MOCK_DRAFTS = MOCK_DRAFTS;
window.FALLBACK_DRAFT = FALLBACK_DRAFT;
window.TONES = TONES;
window.STATUS_META = STATUS_META;
window.initials = initials;


// ====== queue.jsx ======
// Left column — triage / follow-up queue
const { useState, useMemo } = React;

function Queue({ participants, selectedId, onSelect, filter, setFilter, query, setQuery }) {
  const filters = [
    { id: 'all', label: 'All' },
    { id: 'needs-attention', label: 'Needs attention' },
    { id: 'check-in-soon', label: 'Check in soon' },
    { id: 'on-track', label: 'On track' },
  ];

  const filtered = useMemo(() => {
    let list = participants;
    if (filter !== 'all') list = list.filter(p => p.status === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    // sort by dropout desc within filter
    return [...list].sort((a,b) => b.dropoutPct - a.dropoutPct);
  }, [participants, filter, query]);

  return (
    <div className="col queue">
      <div className="col-head">
        <h2>Follow-up queue <span className="count">{filtered.length}</span></h2>
        <div className="search">
          <I.Search />
          <input placeholder="Search participants…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className="chips">
          {filters.map(f => (
            <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="qlist">
        {filtered.length === 0 && (
          <div style={{ padding: 24, color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>
            No participants match.
          </div>
        )}
        {filtered.map(p => {
          const meta = STATUS_META[p.status];
          return (
            <div key={p.id} className="qrow" aria-current={p.id === selectedId} onClick={() => onSelect(p.id)}>
              <div className="avatar">{initials(p.name)}</div>
              <div>
                <div className="name">{p.name}</div>
                <div className="meta">
                  {p.lastActiveDays === 0 ? 'Active today' : `Last active ${p.lastActiveDays}d ago`} · {p.dropoutPct}% risk
                </div>
              </div>
              <span className={`pill ${meta.cls} dot`}>{meta.label}</span>
            </div>
          );
        })}
      </div>

      <div className="pager">
        <div>Showing 1–{filtered.length} of {participants.length}</div>
        <div className="pages">
          <button aria-current="true">1</button>
          <button>2</button>
          <button>3</button>
        </div>
      </div>
    </div>
  );
}

window.Queue = Queue;


// ====== detail.jsx ======
// Center column — participant detail
// Cleanups vs concept:
//  - one risk module (gauge + driver attributions from ML model), not two meters + bullet list
//  - 4 deduped signals (no repeats with the cards above)
//  - one activity timeline replaces "AI summary" paragraph + "Why highlighted" bullets
//  - smaller avatar, no brochure headshot
//  - recommended next-action lives in the right column (where the coach acts)

function Detail({ p, onSnooze, onDismiss }) {
  if (!p) {
    return (
      <div className="col detail">
        <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>
          Select a participant to see their profile.
        </div>
      </div>
    );
  }
  const meta = STATUS_META[p.status];
  const isHi = p.dropoutPct >= 66;
  const isMd = p.dropoutPct >= 40 && p.dropoutPct < 66;
  const pctClass = isHi ? 'hi' : isMd ? 'md' : 'lo';

  // Risk band color via inline style override so the meter matches the score
  const fillColor = isHi ? 'var(--risk-hi)' : isMd ? 'var(--risk-md)' : 'var(--risk-lo)';

  return (
    <div className="col detail">
      <div className="detail-inner">

        {/* Person header */}
        <div className="card">
          <div className="person">
            <div className="avatar lg">{initials(p.name)}</div>
            <div>
              <h1>{p.name}</h1>
              <div className="sub">
                <span>Cohort FFC-MH-220426</span>
                <span className="sep"></span>
                <span className={`pill ${meta.cls} dot`}>{meta.label}</span>
                <span className="sep"></span>
                <a href="#" style={{ color: 'var(--accent-ink)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  View full profile <I.External />
                </a>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="ghost-btn" onClick={onSnooze}>
                <I.Snooze /> &nbsp;Snooze 7d
              </button>
              <button className="ghost-btn danger" onClick={onDismiss}>Dismiss</button>
            </div>
          </div>
        </div>

        {/* Risk + drivers */}
        <div className="card">
          <div className="card-head">
            <h3>Dropout likelihood</h3>
            <div className="right">
              <I.Info />
              <span>From dropout model · updated 4h ago</span>
            </div>
          </div>
          <div className="risk">
            <div className="risk-left">
              <div className="risk-num">
                <div className={`pct ${pctClass}`}>{p.dropoutPct}%</div>
                <div className="label">likelihood of disengaging<br/>in the next 14 days</div>
              </div>
              <div className="meter">
                <div className="fill" style={{ width: `${p.dropoutPct}%`, background: fillColor }}></div>
              </div>
              <div className="meter-legend">
                <span>Low risk</span><span>Medium</span><span>High risk</span>
              </div>
            </div>
            <div className="risk-right">
              <div className="drivers">
                <div className="title">Top contributing signals</div>
                {p.drivers.map((d, i) => (
                  <div className="row" key={i}>
                    <div>
                      <div className="lab">{d.feature}</div>
                      <div className="bar"><i style={{ width: `${Math.min(100, d.weight * 100 / 0.35)}%` }}></i></div>
                    </div>
                    <div className="val">+{Math.round(d.weight * 100)}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Signals grid - one place each metric lives */}
        <div className="card">
          <div className="card-head">
            <h3>Engagement signals</h3>
            <div className="right">last 14 days</div>
          </div>
          <div className="signals">
            <div className="sig">
              <div className="k">Last active</div>
              <div className={`v ${p.signals.lastActive.tone}`}>{p.signals.lastActive.v}</div>
              <div className="d">{p.signals.lastActive.sub}</div>
            </div>
            <div className="sig">
              <div className="k">Discussion posts</div>
              <div className={`v ${p.signals.posts.tone}`}>{p.signals.posts.v}</div>
              <div className="d">{p.signals.posts.sub}</div>
            </div>
            <div className="sig">
              <div className="k">Reply rate</div>
              <div className={`v ${p.signals.response.tone}`}>{p.signals.response.v}</div>
              <div className="d">{p.signals.response.sub}</div>
            </div>
            <div className="sig">
              <div className="k">Goal progress</div>
              <div className={`v ${p.signals.goal.tone}`}>{p.signals.goal.v}</div>
              <div className="d">{p.signals.goal.sub}</div>
            </div>
          </div>
        </div>

        {/* Timeline replaces "AI summary" paragraph + "Why highlighted" bullets */}
        <div className="card">
          <div className="card-head">
            <h3>Recent activity</h3>
            <div className="right">
              <a href="#" style={{ color: 'var(--accent-ink)', textDecoration: 'none', fontSize: 12 }}>Full history →</a>
            </div>
          </div>
          <div className="tl">
            {p.history.map((h, i) => (
              <div className="tl-row" key={i}>
                <div className="when">{h.when}</div>
                <div className="what">{h.what}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

window.Detail = Detail;


// ====== outreach.jsx ======
// Right column — outreach drafter + activity log
// Cleanups vs concept:
//  - one draft at a time with a tone switcher (not 3 expanded cards)
//  - shows what the SLM was conditioned on (transparency)
//  - regenerate hits a mock SLM with a small delay + skeleton

const { useState: useStateO, useEffect: useEffectO } = React;

function getDraft(p, tone) {
  if (MOCK_DRAFTS[p.id] && MOCK_DRAFTS[p.id][tone]) return MOCK_DRAFTS[p.id][tone];
  return FALLBACK_DRAFT[tone].replace('{name}', p.name.split(' ')[0]);
}

function Outreach({ p, onSend, onAddNote, activity }) {
  const [tone, setTone] = useStateO('warm');
  const [draft, setDraft] = useStateO('');
  const [generating, setGenerating] = useStateO(false);
  const [note, setNote] = useStateO('');

  // Regenerate when participant or tone changes (simulates SLM call)
  useEffectO(() => {
    if (!p) return;
    setGenerating(true);
    const t = setTimeout(() => {
      setDraft(getDraft(p, tone));
      setGenerating(false);
    }, 380);
    return () => clearTimeout(t);
  }, [p && p.id, tone]);

  if (!p) {
    return <div className="col act"><div className="col-head"><h2>Outreach</h2></div></div>;
  }

  const regenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      // tiny variation to feel alive
      const variations = [
        getDraft(p, tone),
        getDraft(p, tone).replace(/^Hi /, 'Hey '),
        getDraft(p, tone).replace(/—/, '-'),
      ];
      setDraft(variations[Math.floor(Math.random() * variations.length)]);
      setGenerating(false);
    }, 450);
  };

  const submitNote = (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    onAddNote(note.trim());
    setNote('');
  };

  return (
    <div className="col act">
      <div className="col-head">
        <h2>Outreach <span className="count">· {p.name.split(' ')[0]}</span></h2>
      </div>

      <div className="act-inner">

        {/* Tone switcher */}
        <div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>Suggested tone</span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><I.Sparkle /> Drafted by SLM</span>
          </div>
          <div className="tones" role="tablist">
            {TONES.map(t => (
              <button key={t.id} className="tone-btn" aria-pressed={tone === t.id} onClick={() => setTone(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Draft */}
        <div className="draft">
          <div className="draft-head">
            <span className="label">To: <b style={{ color: 'var(--text-2)', fontWeight: 500 }}>{p.name}</b> · in-app message</span>
            <span className="gen">
              <I.Sparkle /> {generating ? 'Generating…' : 'Editable draft'}
            </span>
          </div>
          {generating ? (
            <div style={{ padding: 12 }}>
              <div className="skel w90"></div>
              <div className="skel w80"></div>
              <div className="skel w60"></div>
              <div className="skel w80"></div>
            </div>
          ) : (
            <textarea value={draft} onChange={e => setDraft(e.target.value)} spellCheck={false} />
          )}
          <div className="draft-foot">
            <button className="btn-icon" title="Regenerate" onClick={regenerate} disabled={generating}>
              <I.Refresh />
            </button>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              {draft.length} chars
            </span>
            <span style={{ marginLeft: 'auto' }}></span>
            <button className="btn-primary" disabled={generating || !draft.trim()} onClick={() => onSend(tone, draft)}>
              <I.Send /> &nbsp;Send
            </button>
          </div>
        </div>

        {/* Transparency strip — what the SLM was given */}
        <details style={{ fontSize: 12, color: 'var(--muted)' }}>
          <summary style={{ cursor: 'pointer', userSelect: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <I.Info /> What this draft is based on
          </summary>
          <div style={{ marginTop: 8, padding: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, lineHeight: 1.6 }}>
            <div><b style={{ color: 'var(--text-2)' }}>Tone:</b> {TONES.find(t=>t.id===tone).label}</div>
            <div><b style={{ color: 'var(--text-2)' }}>Top signals:</b> {p.drivers.slice(0,2).map(d=>d.feature).join('; ')}</div>
            <div><b style={{ color: 'var(--text-2)' }}>Last active:</b> {p.signals.lastActive.v}</div>
            <div style={{ marginTop: 6, fontStyle: 'italic' }}>Drafts are suggestions. Always review before sending.</div>
          </div>
        </details>

        {/* Activity log */}
        <div className="card" style={{ marginTop: 4 }}>
          <div className="card-head">
            <h3>Follow-up activity</h3>
            <div className="right">{activity.length} item{activity.length === 1 ? '' : 's'}</div>
          </div>
          <div className="activity">
            {activity.length === 0 && (
              <div style={{ padding: 16, color: 'var(--muted)', fontSize: 12.5, textAlign: 'center' }}>
                No follow-ups yet for {p.name.split(' ')[0]}.
              </div>
            )}
            {activity.map((a, i) => (
              <div className="row" key={i}>
                <div className="ico">
                  {a.type === 'message' ? <I.Mail /> : <I.Note />}
                </div>
                <div>
                  <div className="title">{a.title}</div>
                  <div className="sub">{a.sub}</div>
                </div>
                <div className="time">{a.time}</div>
              </div>
            ))}
            <form className="note-input" onSubmit={submitNote}>
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder={`Add a note about ${p.name.split(' ')[0]}…`}
              />
              <button className="btn-icon" type="submit" title="Add note"><I.Plus /></button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}

window.Outreach = Outreach;


// ====== app.jsx ======
// Main app — wires queue ↔ detail ↔ outreach with shared state
const { useState: useStateA, useEffect: useEffectA } = React;

function App() {
  const [participants, setParticipants] = useStateA(PARTICIPANTS);
  const [selectedId, setSelectedId] = useStateA('p1');
  const [filter, setFilter] = useStateA('needs-attention');
  const [query, setQuery] = useStateA('');
  const [toast, setToast] = useStateA(null);
  // activity is keyed by participant id
  const [activityMap, setActivityMap] = useStateA(() => {
    const m = {};
    PARTICIPANTS.forEach(p => { m[p.id] = p.activity || []; });
    return m;
  });

  const selected = participants.find(p => p.id === selectedId);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const handleSend = (tone, draft) => {
    const toneLabel = TONES.find(t => t.id === tone).label;
    const preview = draft.length > 64 ? draft.slice(0, 62) + '…' : draft;
    setActivityMap(m => ({
      ...m,
      [selectedId]: [
        { type: 'message', title: `Sent: ${toneLabel}`, sub: preview, time: 'Just now' },
        ...(m[selectedId] || []),
      ],
    }));
    // Mark as contacted — move to "check-in-soon" so they leave the priority queue
    setParticipants(ps => ps.map(p => p.id === selectedId
      ? { ...p, status: p.status === 'needs-attention' ? 'check-in-soon' : p.status }
      : p));
    flash(`Message sent to ${selected.name.split(' ')[0]}`);
  };

  const handleAddNote = (text) => {
    setActivityMap(m => ({
      ...m,
      [selectedId]: [
        { type: 'note', title: 'Coach note added', sub: text, time: 'Just now' },
        ...(m[selectedId] || []),
      ],
    }));
    flash('Note saved');
  };

  const handleSnooze = () => {
    setParticipants(ps => ps.map(p => p.id === selectedId ? { ...p, status: 'on-track' } : p));
    flash(`${selected.name.split(' ')[0]} snoozed for 7 days`);
  };

  const handleDismiss = () => {
    setParticipants(ps => ps.filter(p => p.id !== selectedId));
    const next = participants.find(p => p.id !== selectedId);
    setSelectedId(next ? next.id : null);
    flash(`${selected.name.split(' ')[0]} removed from queue`);
  };

  // Top stats derived from live state, not hard-coded
  const stats = {
    needsFollowUp: participants.filter(p => p.status === 'needs-attention').length,
    highPriority:  participants.filter(p => p.dropoutPct >= 66).length,
    contacted:     Object.values(activityMap).reduce((n, arr) => n + arr.filter(a => a.type==='message').length, 0),
  };

  return (
    <div className="app">
      {/* Top bar */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">h·</div>
          <span>hope·move</span>
        </div>
        <div className="crumbs">
          <span>Participant support</span>
          <span className="sep">/</span>
          <span className="cohort mono">FFC-MH-220426</span>
        </div>
        <div className="topstats">
          <div className="stat"><span className="v">{stats.needsFollowUp}</span><span className="l">need follow-up</span></div>
          <div className="stat"><span className="v">{stats.highPriority}</span><span className="l">high priority</span></div>
          <div className="stat"><span className="v">{stats.contacted}</span><span className="l">contacted this session</span></div>
        </div>
      </header>

      <div className="columns">
        <Queue
          participants={participants}
          selectedId={selectedId}
          onSelect={setSelectedId}
          filter={filter} setFilter={setFilter}
          query={query} setQuery={setQuery}
        />
        <Detail
          p={selected}
          onSnooze={handleSnooze}
          onDismiss={handleDismiss}
        />
        <Outreach
          p={selected}
          onSend={handleSend}
          onAddNote={handleAddNote}
          activity={selected ? (activityMap[selected.id] || []) : []}
        />
      </div>

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);



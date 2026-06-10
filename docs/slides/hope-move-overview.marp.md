---
marp: true
paginate: true
size: 16:9
title: Hope Move — AI Facilitator Assistant
---

<style>
/* Brand theme, matched to the dashboard (oklch palette + clean system sans).
   No code styling anywhere — this deck is for facilitators. */
:root {
  --bg: oklch(98.5% 0.004 90);
  --surface: #ffffff;
  --surface-2: oklch(97% 0.005 90);
  --text: oklch(22% 0.012 250);
  --text-2: oklch(42% 0.012 250);
  --muted: oklch(58% 0.012 250);
  --accent: oklch(48% 0.14 255);
  --accent-ink: oklch(35% 0.14 255);
  --accent-2: oklch(96% 0.02 255);
  --border: oklch(91% 0.006 90);
  --risk-hi: oklch(56% 0.17 25);
  --risk-md: oklch(62% 0.14 70);
  --risk-lo: oklch(52% 0.12 155);
}
section {
  font-family: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
  font-size: 26px;
  line-height: 1.4;
  padding: 56px 70px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
h1 { color: var(--text); font-size: 52px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 8px; }
h2 { color: var(--text); font-size: 38px; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 22px; }
h3 { color: var(--accent-ink); font-size: 24px; font-weight: 600; margin: 0 0 6px; }
strong { color: var(--accent-ink); }
em { color: var(--text-2); font-style: italic; }
a { color: var(--accent); }
ul { margin-top: 6px; }
li { margin: 10px 0; }
section::after { color: var(--muted); font-size: 16px; }
.muted { color: var(--muted); }
.lead-sub { color: var(--text-2); font-size: 30px; margin-top: 4px; }
.tiny { color: var(--muted); font-size: 18px; }

/* hope·move wordmark */
.brand { display: flex; align-items: center; gap: 12px; margin-bottom: 30px; }
.brand .mark {
  width: 44px; height: 44px; border-radius: 10px;
  background: var(--text); color: var(--surface);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 22px;
}
.brand .word { font-size: 30px; font-weight: 600; letter-spacing: -0.01em; }

/* title slide */
section.lead { background: var(--surface); align-items: center; text-align: center; }
section.lead h1 { font-size: 60px; }
section.lead .brand { justify-content: center; }
section.lead .lead-sub, section.lead .tiny { max-width: 900px; }

/* card grid */
.cards { display: flex; justify-content: center; gap: 20px; margin-top: 18px; }
.card {
  flex: 1; background: var(--surface); border: 1px solid var(--border);
  border-radius: 14px; padding: 22px 24px;
}
.card .k { color: var(--muted); font-size: 16px; text-transform: uppercase; letter-spacing: 0.05em; }
.card .t { font-size: 24px; font-weight: 600; margin: 6px 0 8px; }
.card .b { color: var(--text-2); font-size: 21px; }
.card.accent { border-left: 6px solid var(--accent); }
.card.hi { border-left: 6px solid var(--risk-hi); }
.card.md { border-left: 6px solid var(--risk-md); }
.card.lo { border-left: 6px solid var(--risk-lo); }

/* architecture diagram */
.arch { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 26px; }
.node {
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  padding: 18px 20px; text-align: center;
}
.node .h { font-weight: 700; font-size: 22px; color: var(--text); }
.node .d { color: var(--muted); font-size: 16px; margin-top: 4px; }
.node.dash { border: 2px solid var(--accent); background: var(--accent-2); }
.node.engine { border-left: 6px solid var(--accent); text-align: left; max-width: 430px; }
.node .how { color: var(--text-2); font-size: 15px; margin-top: 8px; line-height: 1.35; }
.arrow { color: var(--accent); font-size: 34px; font-weight: 700; }
.stack { display: flex; flex-direction: column; gap: 14px; }
.archnote { color: var(--muted); font-size: 18px; margin-top: 22px; text-align: center; }

.screenshot { display: block; margin: 14px auto 0; border: 1px solid var(--border); border-radius: 12px; }
section img { display: block; margin: 10px auto 0; }
section.fig { padding: 40px 56px; }
section.fig h2 { font-size: 30px; margin-bottom: 12px; }
.callout { background: var(--accent-2); border-radius: 12px; padding: 16px 22px; color: var(--accent-ink); font-size: 22px; margin-top: 18px; }
.logos { display: flex; align-items: center; justify-content: center; gap: 48px; margin-top: 52px; }
.logos img { height: 52px; width: auto; margin: 0; border: none; }
.logos img.logo-cov { height: 48px; }
</style>

<!-- _class: lead -->

# AI Facilitator Assistant

<p class="lead-sub">Helping you support every participant on the Hope Programme — spot who needs you, and reply with warmth, faster.</p>

<p class="tiny">People living with IIH 2025 · Participant-support dashboard</p>

<div class="logos">
  <img src="assets/logo-innovateuk.png" alt="Innovate UK" />
  <img src="assets/logo-hope.png" alt="The Hope Programme" />
  <img src="assets/logo-coventry.png" class="logo-cov" alt="Coventry University" />
</div>

---

## Why we built this

- People living with long-term conditions can **quietly disengage** between sessions — and then drop out.
- No facilitator can watch **everyone, every week**.
- A short, warm, **well-timed** message early often makes the difference between someone staying or leaving.

<div class="callout">The assistant helps you see who needs you this week — and reply sooner, in your voice.</div>

---

## What it does

<div class="cards">
  <div class="card accent"><div class="k">1 · Spot</div><div class="t">Who needs attention</div><div class="b">Every participant, ranked each week — and the plain-language reasons why.</div></div>
  <div class="card accent"><div class="k">2 · Support</div><div class="t">A warm draft reply</div><div class="b">A ready-to-send message in the programme's voice — you review, edit, and send.</div></div>
</div>

<div class="callout">It <strong>surfaces and suggests</strong>. You <strong>decide and send</strong>.</div>

---

## How it fits together

<div class="arch">
  <div class="node"><div class="h">Hope platform</div><div class="d">cohorts · posts · replies</div></div>
  <div class="arrow">→</div>
  <div class="node dash"><div class="h">The dashboard</div><div class="d">which you use</div></div>
  <div class="arrow">→</div>
  <div class="stack">
    <div class="node engine"><div class="h">Risk engine</div><div class="d">who needs attention + why</div><div class="how">A prediction model that learns from past cohorts' weekly activity — it spots the early signs of someone slipping away, and shows the reasons.</div></div>
    <div class="node engine"><div class="h">Drafting engine</div><div class="d">warm reply suggestions</div><div class="how">A small AI language model, trained on real (anonymised) Hope facilitator replies — so its drafts sound like the programme.</div></div>
  </div>
</div>

<p class="archnote">Everything runs on secure, private systems · personal details are removed · nothing is sent without you.</p>

---

## Each week: who needs attention — and why

- **The queue** ranks everyone by who needs attention — *Needs attention · Check in soon · On track*. The people most likely to slip sit at the top.
- **The why is clear**: a risk level, the main reasons (e.g. few visits, not posting, no contact yet), and a recommended approach + wellbeing cue for how to reach out.
- **A weekly rhythm**: the scores refresh each week — start at the top of the queue.

<div class="callout">Week 1 matters most: a warm first contact early measurably lowers the chance someone drops out.</div>

---

## Drafting the reply

- **Two or three warm tones** to choose from — pick what fits.
- **Edit, polish, and send** — always your words, your call.
- Someone **hasn't posted yet**? A "first check-in" gives you a warm opener so you can still reach out.

<div class="callout">The draft is a starting point — never sent on its own.</div>

---

## What's behind it

- The **draft replies** come from a small, fine-tuned **AI language model**, trained on real *(anonymised)* Hope facilitator replies — so it sounds like the programme, not a generic chatbot.
- The **risk score** comes from a **Random Forest** model — a well-established machine-learning method. It treats early drop-out as a **classification problem**: from each participant's weekly activity, how likely are they to disengage? Validated on past cohorts (about **0.94** accuracy).
- Both produce **suggestions only** — your judgement always leads.

---

<!-- _class: fig -->

## How it fits together — the full picture

![h:560](assets/architecture.png)

<p class="tiny">The detailed view (for reference): the platform · the dashboard · the two AI services — with where data is kept and how it's secured.</p>

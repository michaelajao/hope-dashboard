---
marp: true
paginate: true
size: 16:9
title: Hope Move — Backup slides
---

<style>
/* Brand theme, matched to the dashboard + the main overview deck. */
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
h2 { color: var(--text); font-size: 38px; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 22px; }
strong { color: var(--accent-ink); }
section::after { color: var(--muted); font-size: 16px; }
.tiny { color: var(--muted); font-size: 18px; }
.screenshot { display: block; margin: 14px auto 0; border: 1px solid var(--border); border-radius: 12px; }
section img { display: block; margin: 10px auto 0; }
</style>

<!-- Backup / Q&A slides — not part of the main talk. Pull up only if needed,
     or just share the live dashboard in the browser. -->

## The dashboard at a glance

![w:1000](assets/dashboard.jpeg)

<p class="tiny">Three panels — <strong>who needs attention</strong> (left) · <strong>why</strong> (middle) · <strong>a ready-to-send reply</strong> (right).</p>

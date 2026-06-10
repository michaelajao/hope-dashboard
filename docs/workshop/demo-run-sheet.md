# Facilitator workshop — live demo run sheet

This sheet maps every example in the printed **`model_examples.pdf`** to the exact
spot on the dashboard, so you can pull the same comment up live and **regenerate
the AI reply** while facilitators score it on the rating sheets
(`rater_rubric.pdf`, `per_draft_likert.pdf`).

---

## Before the session (setup checklist)

1. **Tunnel to the model** is open (leave the terminal running):
   `ssh -N -L 8011:localhost:8011 bronan`
2. **Dashboard is running:** `npm run dev`, then open `http://localhost:3000`.
3. **Set the model** to match the printed pack: in the top bar **Model** picker,
   choose **"Qwen3 4B"**. (The printed replies were made with the 4B forum
   model; this keeps the live replies close. The picker setting is shared, so set
   it once.)
4. **Have the pack ready:** print or open `model_examples.pdf` and the rating
   sheet(s) for the facilitators.

> Note on judging: the printed reply is a **reference**. Live regeneration uses the
> current production 4B-forum model, so wording can differ slightly run-to-run and
> from the print — that contrast is good to discuss. Activity posts return **2–3
> tones**; forum (Discussion) posts return **1 warm reply**.

---

## How to pull up any example (same 5 steps every time)

1. Open the cohort (the **Route** column below) — e.g. via the address bar.
2. In the **queue search box** (top-left), type the **Search id** from the table.
3. Click the participant that appears.
4. In **Recent activity** click **"Full history →"**, then click the post that
   matches the printed comment — it gets a **"drafting"** badge and loads into the
   Outreach panel on the right.
5. In **Outreach**, press **Generate** (or **Regenerate** to run it again live).
   Compare to the printed reply; facilitators score it.

---

## The 12 examples (printed pack)

These 12 are the printed pack (`model_examples.pdf`) — the main set for the live
session. The **Week** column is when each post was made: set the **Score at week**
selector to that week to show the risk as it stood then. (The post itself is always
reachable via **Full history →** regardless of the selector.)

### Cohort IIH-COH10-190325 · #1600 — Route: `/cohorts/1600`

| # | Search id | Label | Activity | Week | Participant comment (opening) |
|---|---|---|---|---|---|
| 1 | `17906` | P48 | Discussion | W1 | "I joined the course in the main to help me to learn coping strategies." |
| 2 | `17874` | P10 | Discussion | W6 | "I really enjoyed this exercise, I felt myself relaxing into my chair…" |
| 3 | `17904` | P7 | Gratitude | W1 | "I am grateful for my nurse today in hospital, who recognised I am having a really tough time…" |
| 4 | `6559` | P15 | GoalSetting | W2 | "Build my new dressing table, at home this weekend. I will aim to do this only once." |

### Cohort IIH-COH11-170925 · #1651 — Route: `/cohorts/1651`

| # | Search id | Label | Activity | Week | Participant comment (opening) |
|---|---|---|---|---|---|
| 5 | `100273` | P23 | Discussion | W1 | "Information is unclear and confusing. I feel alone and like no one understands me…" |
| 6 | `100249` | P19 | Gratitude | W3 | "The 15 minutes of time I had today by myself, sat in the sun at my parents' fish pond…" |
| 7 | `17897` | P5 | GoalSetting | W2 | "To fly to Canada to see my great nephew, on Sunday. I will aim to do this just once." |
| 8 | `100318` | P1 | MyHOPE | W6 | "I want to publish my PhD as an actual book. IIH kind of stalled that process…" |

### Cohort IIH-COH12-110226 · #1680 — Route: `/cohorts/1680`

| # | Search id | Label | Activity | Week | Participant comment (opening) |
|---|---|---|---|---|---|
| 9 | `101733` | P10 | Discussion | W1 | "I wanted to learn more and not feel so alone. I've had some very bad days…" |
| 10 | `101733` | P10 | Gratitude | W1 | "Spending time with my partner and cats." |
| 11 | `13499` | P5 | GoalSetting | W1 | "I am going to start walking with my 2 pugs, daily, from home, and build up a route and routine…" |
| 12 | `101731` | P1 | MyHOPE | W6 | "My sister is getting married in July. I hope I'm able to assist the photographer…" |

> Examples 9 and 10 are the **same participant** (search `101733`) — after opening
> them, pick the **Discussion** post for #9 and the **Gratitude** post for #10 from
> the activity timeline.

---

## Extended examples (extra variety — no printed reference)

> Eight more cohort posts for extra variety on the day. They have no printed
> reference reply, so just regenerate and discuss the live output.

| # | Search id | Label | Activity | Week | Cohort | Participant comment (opening) |
|---|---|---|---|---|---|---|
| 13 | `17877` | P2 | Discussion | W1 | 1600 | "I joined the course because I want to actively feel like I'm in control…" |
| 14 | `17863` | P3 | GoalSetting | W1 | 1600 | "I am going to work on my overall health by improving my eating habits and going to the gym…" |
| 15 | `100263` | P2 | Discussion | W1 | 1651 | "I've joined the programme having been recently diagnosed… struggling to come to terms…" |
| 16 | `100297` | P4 | Gratitude | W5 | 1651 | "Bit late putting it on here but I'm grateful for the support of a good friend!…" |
| 17 | `100264` | P26 | GoalSetting | W1 | 1651 | "To take my meds regularly, at breakfast and dinner. I'll carry the pill caddy…" |
| 18 | `101719` | P3 | Discussion | W1 | 1680 | "I've found it difficult to accept that having IIH flare ups and/or medication could be for forever…" |
| 19 | `101745` | P8 | Gratitude | W1 | 1680 | "I am grateful for my 2 young boys. My eldest shown me a heart with his fingers…" |
| 20 | `101723` | P9 | GoalSetting | W3 | 1680 | "Going to the gym for the first time, after work on the way home…" |

---

## Good demo tips

- **Best single demo arc:** #3 (P7 Gratitude — warmth), then #5 (P23 Discussion —
  empathy for distress), then #11 (P5 GoalSetting — practical encouragement). Three
  activity types, three tones.
- The selection **resets if you refresh the page** — navigate, don't reload.
- For an activity post, switch the **tone tabs** (Warm check-in / Next-step nudge /
  Goal-focused) to show the personas; for a forum post you'll see one warm reply.
- To show the "act on someone silent" path, open any **Needs attention** participant
  with no post and use **"Write a first check-in"** (seeds a warm starter message).

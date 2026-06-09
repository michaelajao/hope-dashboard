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
   choose **"Qwen3 4B (forum)"**. (The printed replies were made with a 4B forum
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

## The 12 examples (in the order they appear in the printed pack)

### Cohort IIH-COH10-190325 · #1600 — Route: `/cohorts/1600`

| # | Search id | Label | Activity | Participant comment (opening) |
|---|---|---|---|---|
| 1 | `17906` | P48 | Discussion | "I joined the course in the main to help me to learn coping strategies." |
| 2 | `17874` | P10 | Discussion | "I really enjoyed this exercise, I felt myself relaxing into my chair…" |
| 3 | `17904` | P7 | Gratitude | "I am grateful for my nurse today in hospital, who recognised I am having a really tough time…" |
| 4 | `6559` | P15 | GoalSetting | "Build my new dressing table, at home this weekend. I will aim to do this only once." |

### Cohort IIH-COH11-170925 · #1651 — Route: `/cohorts/1651`

| # | Search id | Label | Activity | Participant comment (opening) |
|---|---|---|---|---|
| 5 | `100273` | P23 | Discussion | "Information is unclear and confusing. I feel alone and like no one understands me…" |
| 6 | `100249` | P19 | Gratitude | "The 15 minutes of time I had today by myself, sat in the sun at my parents' fish pond…" |
| 7 | `17897` | P5 | GoalSetting | "To fly to Canada to see my great nephew, on Sunday. I will aim to do this just once." |
| 8 | `100318` | P1 | MyHOPE | "I want to publish my PhD as an actual book. IIH kind of stalled that process…" |

### Cohort IIH-COH12-110226 · #1680 — Route: `/cohorts/1680`

| # | Search id | Label | Activity | Participant comment (opening) |
|---|---|---|---|---|
| 9 | `101733` | P10 | Discussion | "I wanted to learn more and not feel so alone. I've had some very bad days…" |
| 10 | `101733` | P10 | Gratitude | "Spending time with my partner and cats." |
| 11 | `13499` | P5 | GoalSetting | "I am going to start walking with my 2 pugs, daily, from home, and build up a route and routine…" |
| 12 | `101731` | P1 | MyHOPE | "My sister is getting married in July. I hope I'm able to assist the photographer…" |

> Examples 9 and 10 are the **same participant** (search `101733`) — after opening
> them, pick the **Discussion** post for #9 and the **Gratitude** post for #10 from
> the activity timeline.

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

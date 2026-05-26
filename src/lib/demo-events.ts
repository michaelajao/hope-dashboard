/**
 * Synthetic event logs for the demo cohort. The platform feed is not yet
 * wired, so the dashboard generates a deterministic event stream per
 * participant id so the queue + risk gauge have something to score.
 *
 * Once webhook-ingested events are available, replace this with a real
 * fetcher (e.g. server action that reads the platform's events table for
 * the requested participants).
 *
 * Contract: every returned `ParticipantHistory` is valid against
 * engagement_ml's Pydantic schema — events fall inside
 * `[effective_start, effective_start + score_at_day)`, cohort context is
 * supplied, and `score_at_day` is at least 7 days.
 */

import type {
    EventRecord,
    ParticipantHistory,
} from "@/lib/api/dropout";

// Anchor the demo programme to a fixed start so synthetic data is stable
// across renders. The dashboard's only demo cohort (IIH-COH12-110226)
// starts here in our scenario; production should hydrate from cohort_meta.
const DEMO_EFFECTIVE_START = new Date("2025-11-01T09:00:00Z");
/** Default programme length for the synthetic path when no cohort meta
 * is supplied. Real cohorts pass `programmeLengthDays` through; this is
 * only the fallback for fresh-clone / CI rendering. */
const DEMO_DEFAULT_PROGRAMME_LENGTH_DAYS = 42;
const DEMO_SCORE_AT_DAY = 42; // score at the final week of the demo

// Cohort-context defaults for the IIH demo. Production replaces these
// with per-cohort metadata.
const DEMO_COHORT_SIZE = 6;
const DEMO_COHORT_FACILITATOR_DENSITY = 0.5;

// Emotions removed 2026-05-27 — the comment-gen API rejects it
// (no training pairs), so synthetic histories shouldn't emit posts
// the AI surface can't draft for. See RETRAIN.md §1.2.
const ACTIVITY_TYPES = ["GoalSetting", "Gratitude", "MyHOPE"] as const;

export function seedHash(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
}

function rng(seed: number): () => number {
    let x = seed || 1;
    return () => {
        x = (x * 9301 + 49297) % 233280;
        return x / 233280;
    };
}

function addDays(d: Date, days: number, hourOffset = 9): Date {
    const out = new Date(d);
    out.setUTCDate(out.getUTCDate() + Math.floor(days));
    out.setUTCHours(hourOffset, 0, 0, 0);
    return out;
}

/**
 * Produce a synthetic event history for one participant.
 *
 * The seed is the participant id, so the same id deterministically yields
 * the same risk profile across reloads. Profiles span the full risk
 * spectrum across the six IIH demo ids so the queue panel renders all
 * three tiers without manual fixture choice.
 */
export function syntheticHistory(
    participantId: string,
    scoreAtDay: number = DEMO_SCORE_AT_DAY,
    programmeLengthDays: number = DEMO_DEFAULT_PROGRAMME_LENGTH_DAYS,
): ParticipantHistory {
    const r = rng(seedHash(participantId));

    // Engagement intensity governs both the count of events per day and
    // the late-tail tail-off. 0.0 = silent, 1.0 = heavily engaged.
    const intensity = r();

    const events: EventRecord[] = [];
    for (let day = 0; day < scoreAtDay; day++) {
        // Activity fades after week 4 unless the participant is intense.
        const decay = day < 28 ? 1 : Math.max(0.2, 1 - (day - 28) / 28);
        const dailyDensity = intensity * decay;
        // 0–3 events per day, weighted by density.
        const nEvents = Math.floor(r() * 4 * dailyDensity);
        for (let k = 0; k < nEvents; k++) {
            // Hours 9-18 (effective_start is 09:00Z, so events always land
            // inside the [effective_start, effective_start + score_at_day)
            // window the API requires).
            const baseHour = 9 + Math.floor(r() * 10);
            const ts = addDays(DEMO_EFFECTIVE_START, day, baseHour);
            const dice = r();
            if (dice < 0.45) {
                events.push({ timestamp: ts.toISOString(), event_type: "login" });
            } else if (dice < 0.75) {
                const activityType =
                    ACTIVITY_TYPES[Math.floor(r() * ACTIVITY_TYPES.length)];
                events.push({
                    timestamp: ts.toISOString(),
                    event_type: "activity",
                    activity_type: activityType,
                    words_written: Math.floor(40 + r() * 120),
                    description:
                        activityType === "Gratitude"
                            ? "Today I am grateful for the walks I have managed."
                            : "Working through the prompts and noticing progress.",
                });
            } else if (dice < 0.92) {
                events.push({ timestamp: ts.toISOString(), event_type: "page_visit" });
            } else if (dice < 0.97) {
                events.push({
                    timestamp: ts.toISOString(),
                    event_type: "discussion_post",
                    words_written: Math.floor(20 + r() * 50),
                });
            } else {
                events.push({ timestamp: ts.toISOString(), event_type: "bookmark" });
            }
        }
    }

    // Optional facilitator-comment event, fired only for engaged participants.
    if (intensity > 0.4 && r() > 0.3) {
        const day = Math.floor(7 + r() * 21);
        events.push({
            timestamp: addDays(DEMO_EFFECTIVE_START, day, 14).toISOString(),
            event_type: "facilitator_comment",
        });
    }

    // Events must be strictly inside the score window; cap defensively.
    const windowEndsAt = addDays(DEMO_EFFECTIVE_START, scoreAtDay).getTime();
    const filtered = events.filter(
        (e) => new Date(e.timestamp).getTime() < windowEndsAt,
    );

    return {
        participant_id: participantId,
        effective_start: DEMO_EFFECTIVE_START.toISOString(),
        events: filtered,
        cohort_size: DEMO_COHORT_SIZE,
        cohort_facilitator_density: DEMO_COHORT_FACILITATOR_DENSITY,
        programme_length_days: programmeLengthDays,
        score_at_day: scoreAtDay,
    };
}

export function syntheticBatch(
    ids: string[],
    scoreAtDay?: number,
    programmeLengthDays?: number,
): ParticipantHistory[] {
    return ids.map((id) =>
        syntheticHistory(id, scoreAtDay, programmeLengthDays),
    );
}

/**
 * Best-effort engagement-context fields for the comment-gen prompt.
 * engagement_ml itself returns calibrated risk + factors via the typed
 * client; this helper just derives a few cheap aggregates from the demo
 * history so the LLM gets richer prompt context. Returns undefined for
 * any field that cannot be computed; comment-gen handles missing values
 * gracefully.
 */
export function demoEngagementContext(history: ParticipantHistory | null) {
    if (!history) return undefined;
    const sorted = [...history.events].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    const last = sorted.at(-1);
    const lastLogin = [...sorted]
        .reverse()
        .find((e) => e.event_type === "login");
    const lastActivity = [...sorted]
        .reverse()
        .find((e) => e.event_type === "activity");

    const cumLogins = sorted.filter((e) => e.event_type === "login").length;
    const cumActivities = sorted.filter(
        (e) => e.event_type === "activity",
    ).length;
    const uniquePages = new Set(
        sorted
            .filter((e) => e.event_type === "page_visit")
            .map((e, i) => `p${i}`),
    ).size;

    const start_ms = new Date(history.effective_start).getTime();
    const score_at_ms = addDays(
        new Date(history.effective_start),
        history.score_at_day,
    ).getTime();
    const dayMs = 86_400_000;
    const firstWeekEnd = start_ms + 7 * dayMs;
    const wroteFirstWeek = sorted.some(
        (e) =>
            e.event_type === "activity" &&
            new Date(e.timestamp).getTime() < firstWeekEnd,
    );

    // engagement_slope: simple sign-of-difference between first-half and
    // second-half event counts. Positive = climbing, negative = declining.
    // The model only needs a directional cue, not a precise OLS fit.
    const halfMs = (score_at_ms - start_ms) / 2;
    const half = start_ms + halfMs;
    let firstHalf = 0;
    let secondHalf = 0;
    for (const e of sorted) {
        const ts = new Date(e.timestamp).getTime();
        if (ts < half) firstHalf += 1;
        else secondHalf += 1;
    }
    const denom = Math.max(firstHalf, 1);
    const engagementSlope = (secondHalf - firstHalf) / denom;

    const daysSince = (ts: string) =>
        Math.max(0, Math.floor((score_at_ms - new Date(ts).getTime()) / dayMs));

    return {
        days_since_last_login: lastLogin
            ? daysSince(lastLogin.timestamp)
            : history.score_at_day,
        days_since_last_activity: lastActivity
            ? daysSince(lastActivity.timestamp)
            : history.score_at_day,
        current_inactive_streak: last
            ? daysSince(last.timestamp)
            : history.score_at_day,
        cum_login_count: cumLogins,
        cum_activity_count: cumActivities,
        cum_unique_pages: uniquePages,
        wrote_first_week_binary: (wroteFirstWeek ? 1 : 0) as 0 | 1,
        engagement_slope: engagementSlope,
    };
}

/**
 * Week number (1-based) within the participant's programme, derived from
 * `score_at_day`. Useful for the comment-gen prompt so the model knows
 * "this is week 6 messaging" vs "this is week 1 onboarding".
 */
export function weekNumber(history: ParticipantHistory | null): number | undefined {
    if (!history) return undefined;
    return Math.max(1, Math.ceil(history.score_at_day / 7));
}

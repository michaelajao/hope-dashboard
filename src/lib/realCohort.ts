/**
 * Adapter layer between the server-extracted cohort bundle (real Hope Move
 * platform data, gitignored under `local/`) and the dashboard's existing
 * dropout-API / profile / memory contracts.
 *
 * Keeping the adapter in one place means the queue / detail / drafts panels
 * stay shape-stable when the platform feed eventually replaces the bundle —
 * they all consume `ParticipantHistory` and `Profile`, regardless of source.
 */

import type {
    CohortBundle,
    RealParticipant,
} from "@/lib/server/cohort-data";
import type { EventRecord, ParticipantHistory } from "@/lib/api/dropout";
import type { Profile } from "@/lib/profile";

/**
 * Score-at-day mirrors engagement_ml's per-horizon training. Six bundles
 * are trained for T ∈ {7, 14, 21, 28, 35, 42}; callers pick which one.
 * Default to the final week so existing callers keep behaviour. The
 * dashboard's week-selector overrides this per call.
 */
const DEFAULT_SCORE_AT_DAY = 42;
const PROGRAMME_LENGTH_DAYS = 42;

/**
 * Platform exports use local datetime strings without a `Z` suffix.
 * engagement_ml's Pydantic model requires explicit timezone designation.
 * Add `Z` when missing; preserve already-tz-aware values untouched.
 *
 * This is defense in depth — the extraction script does the same — so the
 * adapter is robust if anyone hands us a bundle that wasn't normalised.
 */
function ensureUtc(ts: string): string {
    if (!ts) return ts;
    if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(ts)) return ts;
    return ts + "Z";
}

export function bundleParticipantIds(bundle: CohortBundle): string[] {
    return bundle.participants.map((p) => p.participant_id);
}

export function findRealParticipant(
    bundle: CohortBundle,
    participantId: string,
): RealParticipant | undefined {
    return bundle.participants.find((p) => p.participant_id === participantId);
}

/**
 * Convert a real participant's raw events into the `ParticipantHistory`
 * shape engagement_ml expects.
 *
 * effective_start is the cohort's published start (from the platform),
 * NOT the participant's first event. engagement_ml uses cohort-relative
 * timing to compare like-for-like across participants.
 *
 * Events that fall outside `[effective_start, effective_start + score_at_day)`
 * are dropped — those would 422 from the API. Late starters get an empty
 * stream, which the model correctly treats as a high-risk signal.
 */
export function bundleToHistory(
    bundle: CohortBundle,
    participantId: string,
    scoreAtDay: number = DEFAULT_SCORE_AT_DAY,
): ParticipantHistory | null {
    const p = findRealParticipant(bundle, participantId);
    if (!p) return null;

    const effectiveStart = new Date(bundle.cohort.effectiveStart);
    const windowEndMs =
        effectiveStart.getTime() + scoreAtDay * 24 * 60 * 60 * 1000;

    const events: EventRecord[] = [];
    for (const e of p.events) {
        const ts = ensureUtc(e.timestamp);
        const tsMs = new Date(ts).getTime();
        if (Number.isNaN(tsMs)) continue;
        if (tsMs < effectiveStart.getTime() || tsMs >= windowEndMs) continue;
        events.push({
            timestamp: ts,
            event_type: e.event_type as EventRecord["event_type"],
            activity_type: e.activity_type,
            words_written: e.words_written,
            description: e.description ?? undefined,
        });
    }

    return {
        participant_id: p.participant_id,
        effective_start: ensureUtc(bundle.cohort.effectiveStart),
        events,
        cohort_size: bundle.participants.length,
        // Real cohort-facilitator-density is computable from the platform's
        // facilitator-event stream; for the bundle we approximate with the
        // share of participants who received any facilitator comment.
        cohort_facilitator_density: facilitatorDensity(bundle),
        programme_length_days: PROGRAMME_LENGTH_DAYS,
        score_at_day: scoreAtDay,
    };
}

export function bundleToProfile(
    bundle: CohortBundle,
    participantId: string,
): Profile | null {
    const p = findRealParticipant(bundle, participantId);
    if (!p) return null;
    return {
        participantId: p.participant_id,
        displayName: p.displayName,
        bio: p.bio,
        startedAt: p.startedAt,
    };
}

/**
 * Real prior facilitator replies for this participant, suitable as seeds
 * for `/memory/post` so the next /generate call retrieves them as context.
 * Truncate to the most recent N because memory retrieval is rank-by-recency
 * weighted; very old replies dilute the prompt.
 */
export function bundlePriorReplies(
    bundle: CohortBundle,
    participantId: string,
    limit = 5,
): Array<{ text: string; recordedAt: string | null; activityType: string }> {
    const p = findRealParticipant(bundle, participantId);
    if (!p) return [];
    return [...p.priorFacilitatorReplies]
        .sort((a, b) => (b.recordedAt ?? "").localeCompare(a.recordedAt ?? ""))
        .slice(0, limit);
}

function facilitatorDensity(bundle: CohortBundle): number {
    if (bundle.participants.length === 0) return 0;
    const touched = bundle.participants.filter(
        (p) => p.priorFacilitatorReplies.length > 0,
    ).length;
    return Number((touched / bundle.participants.length).toFixed(2));
}

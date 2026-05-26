/**
 * Demo memory seeder for the laptop dev loop.
 *
 * comment_generation's /generate endpoint retrieves prior participant
 * posts via the memory store and folds the top hits into the LLM prompt
 * (the `memory_used: true` flag in the response confirms this fired).
 * For the laptop demo, no platform webhook is wiring real posts in, so
 * the memory store is empty and every generation is cold-start.
 *
 * `seedDemoMemory()` writes 2–3 plausible prior posts for a participant
 * once per session, the first time their detail panel opens. The next
 * `/generate` call then has real conversational context to draw on.
 *
 * Degrades silently when comment-gen is unreachable — the post fetch
 * fails, we log a warning, and the panel renders as if memory is empty.
 */

import type { ActivityType } from "@/lib/api/commentGen";
import type { RealParticipant } from "@/lib/server/cohort-data";

const SEEDED = new Set<string>();

type SeedEntry = {
    activityType: ActivityType;
    text: string;
    daysAgo: number; // relative to "now" at seed time
};

const SEED_TEMPLATES: Record<string, SeedEntry[]> = {
    "iih-coh12-001": [
        {
            activityType: "GoalSetting",
            text: "I want to walk three times a week, even if just for ten minutes. The pressure changes are scary but I want to try.",
            daysAgo: 28,
        },
        {
            activityType: "Gratitude",
            text: "Grateful for my partner who's been picking up extra at home while I figure this out.",
            daysAgo: 21,
        },
    ],
    "iih-coh12-002": [
        // Was an Emotions seed pre-2026-05-27 — swapped to MyHOPE to
        // match the (now-3-value) ActivityType enum.
        {
            activityType: "MyHOPE",
            text: "I hope I can name what's happening before it overwhelms me. Monday's appointment was hard but the journal prompt helped.",
            daysAgo: 18,
        },
        {
            activityType: "MyHOPE",
            text: "Reminded myself today that flare-ups are not failures.",
            daysAgo: 9,
        },
    ],
    "iih-coh12-003": [
        {
            activityType: "GoalSetting",
            text: "Goal for the month: sleep 7 hours, no screens after 10pm.",
            daysAgo: 24,
        },
        {
            activityType: "Gratitude",
            text: "Three nights of solid sleep this week — and the headaches dropped to a 4 from a 7.",
            daysAgo: 12,
        },
    ],
};

export type SeededPost = {
    activity_id: number;
    participant_id: number;
    cohort_id: number;
    module_id: number;
    activity_type: ActivityType;
    text: string;
    recorded_at: string;
    source: "json_reconcile";
};

export type SeededReply = {
    comment_id: number;
    activity_id: number;
    participant_id: number;
    cohort_id: number;
    facilitator_id: string;
    text: string;
    recorded_at: string;
    source: "json_reconcile";
};

const ACTIVITY_TYPE_SET: ReadonlySet<ActivityType> = new Set<ActivityType>([
    "GoalSetting",
    "Gratitude",
    "MyHOPE",
]);

function asActivityType(raw: string | undefined): ActivityType {
    if (raw && ACTIVITY_TYPE_SET.has(raw as ActivityType)) {
        return raw as ActivityType;
    }
    return "MyHOPE";
}

function truncate(text: string, max = 500): string {
    if (text.length <= max) return text;
    return text.slice(0, max - 1) + "…";
}

export function buildSeedPosts(
    participantId: string,
    cohortId: number,
    moduleId: number,
): SeededPost[] {
    const templates = SEED_TEMPLATES[participantId];
    if (!templates) return [];
    const pidNum = Number(participantId.replace(/[^0-9]/g, "") || "0");
    const now = Date.now();
    return templates.map((t, i) => ({
        activity_id: pidNum * 1000 + i, // deterministic idempotency key
        participant_id: pidNum,
        cohort_id: cohortId,
        module_id: moduleId,
        activity_type: t.activityType,
        text: t.text,
        recorded_at: new Date(now - t.daysAgo * 86_400_000).toISOString(),
        source: "json_reconcile",
    }));
}

/**
 * Build memory seeds from the real cohort bundle.
 *
 * Two streams: participant posts (the descriptions on their activity
 * events) and facilitator replies. Both flow through `source:
 * "json_reconcile"` because that's exactly what's happening — we're
 * reconciling the platform's JSON export into comment-gen's memory store.
 */
export function buildSeedPostsFromBundle(
    participant: RealParticipant,
    cohortId: number,
    moduleId: number,
): SeededPost[] {
    const pidNum = Number(
        participant.participant_id.replace(/[^0-9]/g, "") || "0",
    );
    const out: SeededPost[] = [];
    let i = 0;
    for (const e of participant.events) {
        if (e.event_type !== "activity") continue;
        const text = (e.description ?? "").trim();
        if (!text) continue;
        out.push({
            activity_id: pidNum * 1_000_000 + i,
            participant_id: pidNum,
            cohort_id: cohortId,
            module_id: moduleId,
            activity_type: asActivityType(e.activity_type),
            text: truncate(text),
            recorded_at: e.timestamp,
            source: "json_reconcile",
        });
        i += 1;
    }
    return out;
}

export function buildSeedRepliesFromBundle(
    participant: RealParticipant,
    cohortId: number,
): SeededReply[] {
    const pidNum = Number(
        participant.participant_id.replace(/[^0-9]/g, "") || "0",
    );
    return participant.priorFacilitatorReplies
        .filter((r) => r.recordedAt && (r.text ?? "").trim().length > 0)
        .map((r, i) => ({
            comment_id: pidNum * 1_000_000 + i,
            activity_id: r.activityId,
            participant_id: pidNum,
            cohort_id: cohortId,
            facilitator_id: "demo-facilitator",
            text: truncate(r.text),
            recorded_at: r.recordedAt as string,
            source: "json_reconcile",
        }));
}

/**
 * Idempotent. Posts each seed entry to comment-gen's memory store via
 * the local proxy routes. Marks the participant as seeded so subsequent
 * panel opens don't re-fire.
 *
 * When `realParticipant` is supplied (cohort bundle is loaded), the seeds
 * come from the real platform export — actual prior activity descriptions
 * + facilitator replies. Otherwise falls back to the synthetic
 * `SEED_TEMPLATES` so a fresh clone still has demo memory to retrieve.
 *
 * Best-effort: errors are logged but never thrown. comment-gen offline
 * = silent no-op (the proxy degrades to `{ skipped: true }`).
 */
export async function seedDemoMemory(
    participantId: string,
    cohortId: number,
    moduleId: number,
    realParticipant?: RealParticipant | null,
): Promise<void> {
    if (SEEDED.has(participantId)) return;
    SEEDED.add(participantId);

    const posts = realParticipant
        ? buildSeedPostsFromBundle(realParticipant, cohortId, moduleId)
        : buildSeedPosts(participantId, cohortId, moduleId);
    const replies = realParticipant
        ? buildSeedRepliesFromBundle(realParticipant, cohortId)
        : [];

    if (posts.length === 0 && replies.length === 0) return;

    const writes: Array<Promise<unknown>> = [];
    for (const p of posts) {
        writes.push(
            fetch("/api/proxy/memory/post", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(p),
            }).catch((err) => {
                console.warn(
                    "[seedDemoMemory] post failed",
                    p.activity_id,
                    err,
                );
            }),
        );
    }
    for (const r of replies) {
        writes.push(
            fetch("/api/proxy/memory/reply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(r),
            }).catch((err) => {
                console.warn(
                    "[seedDemoMemory] reply failed",
                    r.comment_id,
                    err,
                );
            }),
        );
    }
    await Promise.all(writes);
}

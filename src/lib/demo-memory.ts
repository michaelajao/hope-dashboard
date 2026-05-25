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
        {
            activityType: "Emotions",
            text: "Felt low after Monday's appointment but the journal prompt actually helped me name it.",
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
 * Idempotent. Posts each seed entry to /api/proxy/memory/post (which
 * forwards to comment-gen's /memory/post). Marks the participant as
 * seeded so subsequent panel opens don't re-fire. Best-effort: errors
 * are logged but never thrown.
 */
export async function seedDemoMemory(
    participantId: string,
    cohortId: number,
    moduleId: number,
): Promise<void> {
    if (SEEDED.has(participantId)) return;
    SEEDED.add(participantId);
    const posts = buildSeedPosts(participantId, cohortId, moduleId);
    if (posts.length === 0) return;
    try {
        await Promise.all(
            posts.map((p) =>
                fetch("/api/proxy/memory/post", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(p),
                }).catch((err) => {
                    // Don't let one bad post stop the others.
                    console.warn(
                        "[seedDemoMemory] failed to seed",
                        p.activity_id,
                        err,
                    );
                }),
            ),
        );
    } catch (err) {
        console.warn("[seedDemoMemory] aborted", err);
    }
}

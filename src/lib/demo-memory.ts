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

// Synthetic SEED_TEMPLATES removed alongside the broader synthetic
// fallback. Seeds now come exclusively from the real cohort bundle via
// `buildSeedPostsFromBundle` / `buildSeedRepliesFromBundle`.
const SEED_TEMPLATES: Record<string, SeedEntry[]> = {};

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

// The activity_type union on the dashboard side is intentionally kept
// narrow (GoalSetting / Gratitude / MyHOPE) per the 2026-05-29 scoping
// decision, but the memory seeder ALSO needs to recognise "Discussion"
// when reading bundle events so forum posts can be sent to the
// server-side memory store. The server's ActivityType enum has
// "Discussion" too; the dashboard never sends it as an /generate
// activity_type, only as a memory-seed activity_type.
const SEED_ACTIVITY_TYPES: ReadonlySet<string> = new Set<string>([
    "GoalSetting",
    "Gratitude",
    "MyHOPE",
    "Discussion",
]);

function asActivityType(raw: string | undefined): ActivityType {
    if (raw && SEED_ACTIVITY_TYPES.has(raw)) {
        // The Discussion case widens past the dashboard-side
        // ActivityType union — we cast through `unknown` so the seed
        // request can carry it to the server, where the enum DOES
        // accept "Discussion". The server-side memory store indexes it
        // and downstream retrieve merges it alongside activity posts;
        // see drafts.py Discussion-merge logic.
        return raw as unknown as ActivityType;
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
    let j = 0;
    for (const e of participant.events) {
        // Activities (Gratitude/GoalSetting/MyHOPE) AND discussion-forum
        // posts both seed the memory store. Activities are tagged with
        // their own activity_type; discussion posts get
        // activity_type="Discussion" so the server-side retrieve's hard
        // filter keeps them from leaking into Gratitude/GoalSetting
        // generations but lets them surface as additional context via
        // drafts.py's Discussion-merge step.
        const isActivity = e.event_type === "activity";
        const isDiscussion = e.event_type === "discussion_post";
        if (!isActivity && !isDiscussion) continue;
        const text = (e.description ?? "").trim();
        if (!text) continue;
        // Separate id namespaces so activity and discussion seeds never
        // collide on the dedupe key the memory store uses (activity_id).
        const activityId = isDiscussion
            ? pidNum * 1_000_000 + 500_000 + j++
            : pidNum * 1_000_000 + i++;
        out.push({
            activity_id: activityId,
            participant_id: pidNum,
            cohort_id: cohortId,
            module_id: moduleId,
            activity_type: asActivityType(
                isDiscussion ? "Discussion" : e.activity_type,
            ),
            text: truncate(text),
            recorded_at: e.timestamp,
            source: "json_reconcile",
        });
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

/**
 * Synthetic engagement features for the demo cohort. The platform feed is
 * not wired yet, so the dashboard generates a deterministic spread per
 * participant id so the queue + risk gauge have something to show.
 *
 * Once webhook-ingested features are available, replace this with a real
 * `cumulative_features_panel.parquet` reader + server action.
 */

import type { ParticipantFeatures } from "@/lib/api/dropout";

function seedHash(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
}

function rand(seed: number): () => number {
    let x = seed || 1;
    return () => {
        x = (x * 9301 + 49297) % 233280;
        return x / 233280;
    };
}

export function syntheticFeatures(participantId: string): ParticipantFeatures {
    const r = rand(seedHash(participantId));
    const inactiveStreak = Math.floor(r() * 14);
    const daysSinceLogin = Math.max(0, Math.floor(r() * 18 - 2));
    const cumLogins = Math.floor(r() * 12) + 1;
    const cumActivities = Math.floor(r() * 8);
    return {
        participant_id: participantId,
        features: {
            current_inactive_streak: inactiveStreak,
            days_since_last_login: daysSinceLogin,
            days_since_last_activity: daysSinceLogin + Math.floor(r() * 3),
            cum_login_count: cumLogins,
            cum_activity_count: cumActivities,
            cum_unique_pages: cumActivities * 4 + Math.floor(r() * 10),
            cum_discussion_replies: Math.floor(r() * 4),
            week_page_hits: Math.floor(r() * 30),
            engagement_slope: r() * 1.4 - 0.7,
            wrote_first_week_binary: r() > 0.5 ? 1 : 0,
            received_comment_first_week_binary: r() > 0.4 ? 1 : 0,
            posted_forum_first_week_binary: r() > 0.6 ? 1 : 0,
            cum_bookmarks: Math.floor(r() * 5),
        },
    };
}

export function syntheticBatch(ids: string[]): ParticipantFeatures[] {
    return ids.map(syntheticFeatures);
}

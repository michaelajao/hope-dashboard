/**
 * Server-only loader for the Hope Move cohort bundle.
 *
 * The JSON at `local/iih-coh12-110226.json` is produced by
 * `scripts/extract-iih-cohort.mjs` from the platform exports in
 * `../comment_generation/data/`. It contains real participant IDs and
 * activity histories for cohort 1680 (IIH-COH12-110226). Bios fall back
 * to a placeholder because the UserProfile export in hand doesn't cover
 * module 337.
 *
 * The bundle is committed in-tree so the dashboard is self-contained on
 * any host. The synthetic-fallback path that previously rendered
 * fake participants when the file was absent has been removed — if the
 * file ever disappears, the API route returns 204 and the queue shows
 * an empty state rather than fabricating data.
 */

import fs from "node:fs";
import path from "node:path";

if (typeof window !== "undefined") {
    throw new Error(
        "cohort-data.ts must not be imported in client code (reads fs)",
    );
}

const BUNDLE_PATH = path.join(
    process.cwd(),
    "local",
    "iih-coh12-110226.json",
);

export type RealEvent = {
    timestamp: string;
    event_type: string;
    activity_type?: string;
    words_written?: number;
    description?: string | null;
};

export type RealFacilitatorReply = {
    activityId: number;
    activityType: string;
    text: string;
    recordedAt: string | null;
};

export type RealParticipant = {
    participant_id: string;
    displayName: string;
    bio: string;
    firstName: string | null;
    startedAt: string;
    finishedAt: string | null;
    events: RealEvent[];
    priorFacilitatorReplies: RealFacilitatorReply[];
    activityCount: number;
};

export type CohortBundle = {
    cohort: {
        id: number;
        code: string;
        moduleId: number;
        moduleName: string;
        effectiveStart: string;
        /** Length of the programme in days. Multiple of 7 (one week
         * granularity). Used to derive the week-selector range and the
         * `programme_length_days` field sent to engagement_ml. */
        programmeLengthDays: number;
    };
    participants: RealParticipant[];
};

let _cache: CohortBundle | null | undefined = undefined;
let _cacheMtimeMs: number | null = null;

/**
 * Loads the bundle, invalidating the in-memory cache when the file on
 * disk has changed. Mtime-based invalidation is important during dev:
 * when the extraction script is re-run, we want the next dashboard
 * request to pick up the new data without a Next.js restart.
 */
export function loadCohortBundle(): CohortBundle | null {
    try {
        if (!fs.existsSync(BUNDLE_PATH)) {
            _cache = null;
            _cacheMtimeMs = null;
            return null;
        }
        const mtimeMs = fs.statSync(BUNDLE_PATH).mtimeMs;
        if (_cache !== undefined && _cacheMtimeMs === mtimeMs) {
            return _cache;
        }
        const raw = fs.readFileSync(BUNDLE_PATH, "utf8");
        _cache = JSON.parse(raw) as CohortBundle;
        _cacheMtimeMs = mtimeMs;
        return _cache;
    } catch (err) {
        console.warn("[cohort-data] failed to load bundle:", err);
        _cache = null;
        _cacheMtimeMs = null;
        return null;
    }
}

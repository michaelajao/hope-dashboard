/**
 * Server-only loader for the local Hope Move cohort bundle.
 *
 * The JSON at `local/iih-coh12-110226.json` is produced by
 * `scripts/extract-iih-cohort.mjs` from the engagement_ml/data raw
 * Hope Move platform exports. It contains real participant IDs, real
 * activity histories (when present), and real bios (when present) —
 * gitignored so the repo stays publishable.
 *
 * Returns `null` if the bundle isn't on disk (CI, fresh clone, etc.);
 * client code then falls back to the synthetic generators in
 * `src/lib/demo-events.ts`.
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

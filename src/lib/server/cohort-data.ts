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

// Per-cohort bundle slugs. Match the `bundleSlug` field in
// scripts/extract-iih-cohort.mjs's COHORT_REGISTRY so the loader and
// extractor stay in sync. Adding a new cohort means adding a row here
// AND in src/lib/cohorts.ts; both lookups are id-keyed for an O(1)
// resolve at request time.
const BUNDLE_SLUG_BY_COHORT_ID: Record<number, string> = {
    1600: "iih-coh10-190325",
    1651: "iih-coh11-170925",
    1680: "iih-coh12-110226",
};

function bundlePathFor(cohortId: number): string | null {
    const slug = BUNDLE_SLUG_BY_COHORT_ID[cohortId];
    if (!slug) return null;
    return path.join(process.cwd(), "local", `${slug}.json`);
}

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

type CacheEntry = { bundle: CohortBundle | null; mtimeMs: number | null };
const _cache: Map<number, CacheEntry> = new Map();

/**
 * Loads the bundle for a given cohort, invalidating the in-memory cache
 * when the file on disk has changed. Mtime-based invalidation is
 * important during dev: when the extraction script is re-run, the next
 * dashboard request picks up the new data without a Next.js restart.
 *
 * Returns `null` when the cohort has no bundle slug or the file isn't
 * on disk yet — the API route surfaces this as a 204 and the queue
 * renders its empty state.
 */
export function loadCohortBundle(cohortId: number): CohortBundle | null {
    const bundlePath = bundlePathFor(cohortId);
    if (!bundlePath) return null;
    try {
        if (!fs.existsSync(bundlePath)) {
            _cache.set(cohortId, { bundle: null, mtimeMs: null });
            return null;
        }
        const mtimeMs = fs.statSync(bundlePath).mtimeMs;
        const cached = _cache.get(cohortId);
        if (cached && cached.mtimeMs === mtimeMs) {
            return cached.bundle;
        }
        const raw = fs.readFileSync(bundlePath, "utf8");
        const bundle = JSON.parse(raw) as CohortBundle;
        _cache.set(cohortId, { bundle, mtimeMs });
        return bundle;
    } catch (err) {
        console.warn(
            `[cohort-data] failed to load bundle for cohort ${cohortId}:`,
            err,
        );
        _cache.set(cohortId, { bundle: null, mtimeMs: null });
        return null;
    }
}

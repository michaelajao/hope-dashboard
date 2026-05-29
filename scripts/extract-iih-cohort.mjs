#!/usr/bin/env node
/**
 * One-off: extract a small, demo-friendly cohort bundle from the Hope
 * Move platform JSON exports in engagement_ml/data/.
 *
 *   node scripts/extract-iih-cohort.mjs
 *
 * Writes `local/iih-coh12-110226.json` — gitignored. Dashboard reads it
 * at runtime via `src/lib/server/cohort-data.ts` and falls back to
 * synthetic data when the file is absent.
 *
 * Picks 6 participants from cohort 1680 (IIH-COH12-110226) covering the
 * engagement spectrum: top-2 by activity count (richer memory demos),
 * middle-2 (typical), bottom-2 (silent/late starters — the high-risk
 * cases the model flags).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const RAW_ROOT = path.resolve(REPO_ROOT, "..", "comment_generation", "data");

// Per-cohort metadata for the IIH course (module 337). Every cohort in
// this table is bundle-extractable from `UserActivity (2).txt`. Add a
// new cohort by appending here and the dashboard's cohort index will
// pick it up automatically.
const COHORT_REGISTRY = {
    1600: {
        code: "IIH-COH10-190325",
        effectiveStart: "2025-03-19T00:00:00Z",
        programmeLengthDays: 42,
        bundleSlug: "iih-coh10-190325",
    },
    1651: {
        code: "IIH-COH11-170925",
        effectiveStart: "2025-09-17T00:00:00Z",
        programmeLengthDays: 42,
        bundleSlug: "iih-coh11-170925",
    },
    1680: {
        code: "IIH-COH12-110226",
        effectiveStart: "2026-02-11T00:00:00Z",
        programmeLengthDays: 42,
        bundleSlug: "iih-coh12-110226",
    },
};

// CLI: `node scripts/extract-iih-cohort.mjs [cohortId|all]`. Default is
// COH12 (the demo cohort we ship in-tree). Pass `all` to extract every
// cohort in COHORT_REGISTRY in one pass.
function parseCohortIds() {
    const arg = (process.argv[2] || "1680").toString();
    if (arg === "all") return Object.keys(COHORT_REGISTRY).map(Number);
    const id = Number(arg);
    if (!COHORT_REGISTRY[id]) {
        throw new Error(
            `Unknown cohort ${arg}; known: ${Object.keys(COHORT_REGISTRY).join(", ")}, or 'all'.`,
        );
    }
    return [id];
}

const OUTPUT_DIR = path.join(REPO_ROOT, "local");

function loadJson(name) {
    const p = path.join(RAW_ROOT, name);
    if (!fs.existsSync(p)) {
        throw new Error(`Missing source file: ${p}`);
    }
    console.log(`reading ${p} (${(fs.statSync(p).size / 1_048_576).toFixed(1)} MB)…`);
    return JSON.parse(fs.readFileSync(p, "utf8"));
}

function findCohort(doc, targetCohortId) {
    for (const m of doc.modules ?? []) {
        for (const c of m.cohorts ?? []) {
            if (c.id === targetCohortId) {
                return { module: m, cohort: c };
            }
        }
    }
    return null;
}

function extractUsers(ua, targetCohortId) {
    const hit = findCohort(ua, targetCohortId);
    if (!hit) {
        throw new Error(`Cohort ${targetCohortId} not found in UserActivity`);
    }
    const { module, cohort } = hit;
    return (cohort.users ?? []).map((u) => ({
        userId: u.userId,
        moduleId: module.id,
        moduleName: module.name,
        cohortId: cohort.id,
        cohortName: cohort.name,
        started: u.started ?? null,
        finished: u.finished ?? null,
        activities: u.activities ?? [],
        logins: u.logins ?? [],
        pageVisits: u.pageVisits ?? [],
        bookmarks: u.bookmarks ?? [],
    }));
}

function buildProfileLookup(up) {
    const out = new Map();
    for (const m of up.modules ?? []) {
        for (const profile of m.userProfiles ?? []) {
            out.set(profile.userId, {
                bio: profile.bio ?? "",
                firstName: profile.firstName ?? null,
                lastName: profile.lastName ?? null,
            });
        }
    }
    return out;
}

function extractFacilitatorReplies(fc, userIds) {
    const wanted = new Set(userIds);
    const out = new Map();
    for (const m of fc.modules ?? []) {
        for (const ua of m.userActivities ?? []) {
            if (!wanted.has(ua.userId)) continue;
            // Skip facilitator replies anchored to Emotions activities —
            // those parent activities are dropped from the bundle (see
            // main()), so the reply would orphan in the timeline.
            if (ua.typeName === "Emotions") continue;
            for (const fcEntry of ua.facilitatorComments ?? []) {
                if (!out.has(ua.userId)) out.set(ua.userId, []);
                out.get(ua.userId).push({
                    activityId: ua.id,
                    activityType: ua.typeName,
                    text: fcEntry.comment ?? "",
                    recordedAt: fcEntry.recorded
                        ? normaliseTimestamp(fcEntry.recorded)
                        : null,
                });
            }
        }
    }
    return out;
}

function picks0Module(users) {
    return users[0]?.moduleId ?? null;
}

/**
 * All cohort learners, ranked by activity count (descending) so the
 * heaviest-engagement participants appear first in the bundle order.
 * The queue panel re-ranks by risk at render time; this ordering is
 * just a stable initial sort.
 *
 * Previously this picked a 6-person representative slice (top-2 /
 * mid-2 / bot-2) to keep the demo bundle tractable. With pagination
 * in the queue we surface the full cohort — facilitators get a real
 * triage experience.
 */
function pickRepresentative(users) {
    return users
        .map((u) => ({ ...u, activityCount: u.activities.length }))
        .sort((a, b) => b.activityCount - a.activityCount);
}

function shortBio(profile, fallback) {
    const bio = (profile?.bio ?? "").trim();
    if (bio) return bio.length > 320 ? bio.slice(0, 317) + "…" : bio;
    return fallback;
}

/**
 * Platform exports use local datetime strings without a `Z` suffix
 * (e.g. "2026-02-12T07:09:08.477"). engagement_ml's Pydantic model
 * requires ISO-8601 with an explicit UTC designator. Append `Z` when one
 * isn't already present; preserves already-tz-aware values untouched.
 */
function normaliseTimestamp(ts) {
    if (!ts) return ts;
    // already has tz designator (`Z` or `+HH:MM` / `-HH:MM`)?
    if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(ts)) return ts;
    return ts + "Z";
}

function eventFromActivity(a) {
    return {
        timestamp: normaliseTimestamp(a.recorded),
        event_type: "activity",
        activity_type: a.typeName,
        words_written: a.description ? a.description.split(/\s+/).length : 0,
        description: a.description ?? null,
    };
}


function extractOne(ua, up, fc, profileBy, modulesInProfile, cohortId) {
    const meta = COHORT_REGISTRY[cohortId];
    const users = extractUsers(ua, cohortId);
    console.log(`\ncohort ${meta.code} (id=${cohortId}): ${users.length} learners`);

    if (!modulesInProfile.has(picks0Module(users))) {
        console.warn(
            `⚠  UserProfile (1).txt does not include module ${picks0Module(users)} — ` +
            `bios will fall back to a generic placeholder.`,
        );
    }
    const picks = pickRepresentative(users);

    const facilitatorByUser = extractFacilitatorReplies(
        fc,
        picks.map((u) => u.userId),
    );

    const participants = picks.map((u, i) => {
        const profile = profileBy.get(u.userId);

        // Combine activities, logins, page-visits, bookmarks into a unified
        // event stream — engagement_ml's risk model uses all of these.
        // Facilitator-comment events are derived from FacilitatorComments.txt
        // so they appear in the participant's timeline (the activity export
        // doesn't always inline them for older comments).
        const events = [];
        for (const a of u.activities ?? []) {
            if (!a.recorded) continue;
            // Emotions activities are tag selections (e.g.
            // "Scared;Irritable;Determined") and comment-gen rejects them
            // as draft targets (no training pairs — see
            // RETRAIN.md §1.2). Drop them from the bundle so the timeline
            // doesn't surface posts the AI surface can't draft for.
            if (a.typeName === "Emotions") continue;
            events.push(eventFromActivity(a));
        }
        for (const l of u.logins ?? []) {
            // Platform schema uses `signedIn` for the login timestamp.
            const ts = l.signedIn ?? l.loggedIn ?? l.recorded ?? l.timestamp;
            if (!ts) continue;
            events.push({ timestamp: normaliseTimestamp(ts), event_type: "login" });
        }
        for (const v of u.pageVisits ?? []) {
            // pageVisits are rollups (one row per URL with `hits` count and
            // `latest` timestamp). Emit one `page_visit` event at `latest`;
            // engagement_ml's feature builder only needs the timestamp.
            const ts = v.latest ?? v.recorded ?? v.timestamp;
            if (!ts) continue;
            events.push({ timestamp: normaliseTimestamp(ts), event_type: "page_visit" });
        }
        for (const b of u.bookmarks ?? []) {
            // Platform schema stores the bookmark timestamp under
            // `bookmarked` (not `recorded`). The earlier `b.recorded ?? b.timestamp`
            // probe always missed and silently dropped every bookmark —
            // the IIH cohort lost 245 bookmark events that way. Probe
            // the canonical field first, keep the legacy fallbacks for
            // safety in case the export shape ever changes.
            const ts = b.bookmarked ?? b.recorded ?? b.timestamp;
            if (!ts) continue;
            events.push({ timestamp: normaliseTimestamp(ts), event_type: "bookmark" });
        }
        for (const fc of facilitatorByUser.get(u.userId) ?? []) {
            if (!fc.recordedAt) continue;
            events.push({
                timestamp: normaliseTimestamp(fc.recordedAt),
                event_type: "facilitator_comment",
                description: fc.text,
            });
        }
        events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        return {
            participant_id: String(u.userId),
            displayName: `P${i + 1}`,
            bio: shortBio(
                profile,
                `Joined ${meta.code}. No profile bio submitted yet.`,
            ),
            firstName: profile?.firstName ?? null,
            startedAt: normaliseTimestamp(u.started ?? meta.effectiveStart),
            finishedAt: u.finished ? normaliseTimestamp(u.finished) : null,
            events,
            priorFacilitatorReplies: facilitatorByUser.get(u.userId) ?? [],
            // Count post-Emotions-filter so the displayed activityCount
            // matches what's actually in `events` and surfaces in the UI.
            activityCount: events.filter((e) => e.event_type === "activity").length,
        };
    });

    const out = {
        cohort: {
            id: cohortId,
            code: meta.code,
            moduleId: picks[0].moduleId,
            moduleName: picks[0].moduleName,
            effectiveStart: meta.effectiveStart,
            programmeLengthDays: meta.programmeLengthDays,
        },
        participants,
    };

    const outputPath = path.join(OUTPUT_DIR, `${meta.bundleSlug}.json`);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(out, null, 2));
    const sizeKb = (fs.statSync(outputPath).size / 1024).toFixed(1);
    console.log(`wrote ${outputPath} (${sizeKb} KB)`);

    const totals = { activity: 0, login: 0, page_visit: 0, facilitator_comment: 0, bookmark: 0, discussion_post: 0 };
    for (const p of participants) {
        for (const e of p.events) {
            totals[e.event_type] = (totals[e.event_type] ?? 0) + 1;
        }
    }
    console.log(`  totals: ${participants.length} participants`);
    console.log(`  events: ${Object.entries(totals).map(([k, v]) => `${k.slice(0, 4)}:${v}`).join(" ")}`);
}


function main() {
    // "UserActivity (2).txt" is the May 26 2026 export — the first one
    // that includes module 337 (IIH 2025) where the IIH cohorts live. The
    // older "UserActivity (1).txt" stops at module 332.
    const ua = loadJson("UserActivity (2).txt");
    const up = loadJson("UserProfile (1).txt");
    const fc = loadJson("FacilitatorComments.txt");

    const profileBy = buildProfileLookup(up);
    const modulesInProfile = new Set();
    for (const m of up.modules ?? []) modulesInProfile.add(m.id);

    const cohortIds = parseCohortIds();
    for (const cid of cohortIds) {
        extractOne(ua, up, fc, profileBy, modulesInProfile, cid);
    }
}

main();

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
const RAW_ROOT = "C:/Users/ajaoo/Desktop/engagement_ml/data";

const TARGET_COHORT_ID = 1680;
const TARGET_COHORT_NAME = "IIH-COH12-110226";
const COHORT_EFFECTIVE_START = "2026-02-11T00:00:00Z"; // earliest learner started

const OUTPUT_DIR = path.join(REPO_ROOT, "local");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "iih-coh12-110226.json");

function loadJson(name) {
    const p = path.join(RAW_ROOT, name);
    if (!fs.existsSync(p)) {
        throw new Error(`Missing source file: ${p}`);
    }
    console.log(`reading ${p} (${(fs.statSync(p).size / 1_048_576).toFixed(1)} MB)…`);
    return JSON.parse(fs.readFileSync(p, "utf8"));
}

function findIihCohort(doc) {
    for (const m of doc.modules ?? []) {
        for (const c of m.cohorts ?? []) {
            if (c.id === TARGET_COHORT_ID) {
                return { module: m, cohort: c };
            }
        }
    }
    return null;
}

function extractUsers(ua) {
    const hit = findIihCohort(ua);
    if (!hit) {
        throw new Error(`Cohort ${TARGET_COHORT_ID} not found in UserActivity`);
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
        questionnaireResults: u.questionnaireResults ?? [],
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

function pickRepresentative(users) {
    const ranked = users
        .map((u) => ({ ...u, activityCount: u.activities.length }))
        .sort((a, b) => b.activityCount - a.activityCount);
    if (ranked.length <= 6) return ranked;
    const top2 = ranked.slice(0, 2);
    const bot2 = ranked.slice(-2);
    const midStart = Math.floor((ranked.length - 2) / 2);
    const mid2 = ranked.slice(midStart, midStart + 2);
    return [...top2, ...mid2, ...bot2];
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

/**
 * SWEMWBS dedup per Gabriel (2026-05-26):
 *   "for any instances where there are 2 or more entries within the same
 *    session (e.g. Session 1) please take the first entry and score —
 *    ignore the later. We consider the first answer/Score to be valid."
 *
 * The data has no explicit session number, but the programme administers
 * SWEMWBS at multi-week intervals (Session 1 ≈ baseline, Session 2 ≈ mid,
 * Session 3 ≈ end). Sessions are weeks apart; same-day submissions are the
 * duplicate case the rule targets. We bucket by `started` calendar date
 * and keep the earliest entry per (user, format, date).
 */
function dedupSwemwbs(results) {
    const seen = new Set();
    const out = [];
    const sorted = [...(results ?? [])].sort((a, b) =>
        (a.started ?? "").localeCompare(b.started ?? ""),
    );
    for (const q of sorted) {
        if (q.format !== "SWEMWBS") continue;
        if (q.metricTotalScore == null || q.started == null) continue;
        const day = q.started.slice(0, 10);
        const key = `${q.userId}|SWEMWBS|${day}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
            recordedAt: normaliseTimestamp(q.started),
            rawScore: q.rawTotalScore ?? null,
            metricScore: q.metricTotalScore,
        });
    }
    return out;
}

function main() {
    // UserActivity_120526.txt is the May 25 2026 export — it's the first one
    // that includes module 337 (IIH 2025) where cohort 1680 lives. The older
    // "UserActivity (1).txt" stops at module 332 and excludes this cohort.
    const ua = loadJson("UserActivity_120526.txt");
    const up = loadJson("UserProfile (1).txt");
    const fc = loadJson("FacilitatorComments.txt");

    const users = extractUsers(ua);
    console.log(`cohort ${TARGET_COHORT_NAME}: ${users.length} learners`);

    const profileBy = buildProfileLookup(up);
    const modulesInProfile = new Set();
    for (const m of up.modules ?? []) modulesInProfile.add(m.id);
    if (!modulesInProfile.has(picks0Module(users))) {
        console.warn(
            `⚠  UserProfile (1).txt does not include module ${picks0Module(users)} — ` +
            `bios will fall back to a generic placeholder. Modules covered: ` +
            `${[...modulesInProfile].sort((a, b) => a - b).join(", ")}`,
        );
    }
    const picks = pickRepresentative(users);
    console.log(`picked ${picks.length} representative learners`);

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
            const ts = b.recorded ?? b.timestamp;
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
                "Joined the IIH 2025 cohort. No profile bio submitted yet.",
            ),
            firstName: profile?.firstName ?? null,
            startedAt: normaliseTimestamp(u.started ?? COHORT_EFFECTIVE_START),
            finishedAt: u.finished ? normaliseTimestamp(u.finished) : null,
            events,
            priorFacilitatorReplies: facilitatorByUser.get(u.userId) ?? [],
            swemwbs: dedupSwemwbs(u.questionnaireResults ?? []),
            activityCount: u.activityCount,
        };
    });

    const out = {
        cohort: {
            id: TARGET_COHORT_ID,
            code: TARGET_COHORT_NAME,
            moduleId: picks[0].moduleId,
            moduleName: picks[0].moduleName,
            effectiveStart: COHORT_EFFECTIVE_START,
        },
        participants,
    };

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2));
    const sizeKb = (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1);
    console.log(`wrote ${OUTPUT_PATH} (${sizeKb} KB)`);
    console.log("summary:");
    for (const p of participants) {
        const hasBio = p.bio.startsWith("Joined the IIH") ? "—" : "bio";
        const swemwbs = p.swemwbs.length
            ? `swemwbs=${p.swemwbs.map((s) => s.metricScore.toFixed(1)).join("→")}`
            : "swemwbs=—";
        const byType = {};
        for (const e of p.events) byType[e.event_type] = (byType[e.event_type] ?? 0) + 1;
        const evDetail = Object.entries(byType)
            .map(([k, v]) => `${k.slice(0, 4)}:${v}`)
            .join(" ");
        console.log(
            `  ${p.displayName}  uid=${p.participant_id}  events=${p.events.length} (${evDetail})  ${swemwbs}  ${hasBio}`,
        );
    }
}

main();

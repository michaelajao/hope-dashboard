"use client";

import { useMemo, useState } from "react";
import {
    Activity,
    Bookmark,
    LogIn,
    MessageCircle,
    MessageSquare,
    type LucideIcon,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import type { EventRecord, ParticipantHistory } from "@/lib/api/dropout";
import { useUiStore } from "@/lib/store/uiStore";

/**
 * Chronological activity feed for the detail panel.
 *
 * Two modes:
 *  - Compact (default): 5 most-recent non-page-visit events as narrative
 *    one-liners ("10d ago — Posted Gratitude: 'For Spring...'"). Quick
 *    skim for the facilitator.
 *  - Expanded: day-bucketed feed with icons + content snippets +
 *    page-visit aggregations. Shows up to MAX_EXPANDED events.
 *
 * Page visits are collapsed in both modes — a heavily-engaged
 * participant generates 100+ page-visits and per-row entries would
 * drown out the substantive events (posts, replies, logins).
 */

const COMPACT_ROWS = 5;
const MAX_EXPANDED = 15;

type DayBucket = {
    dayKey: string;
    label: string;
    events: EventRecord[];
    pageVisitCount: number;
};

const ICONS: Record<EventRecord["event_type"], LucideIcon> = {
    activity: Activity,
    login: LogIn,
    page_visit: Activity, // unused — page visits are aggregated
    bookmark: Bookmark,
    discussion_post: MessageCircle,
    facilitator_comment: MessageSquare,
};

const ACCENTS: Record<EventRecord["event_type"], string> = {
    activity: "text-accent-ink bg-accent/20",
    login: "text-text-2 bg-surface-2",
    page_visit: "text-muted bg-surface-2",
    bookmark: "text-text-2 bg-surface-2",
    discussion_post: "text-accent-ink bg-accent/20",
    facilitator_comment: "text-risk-md bg-risk-md-bg",
};

function dayLabel(date: Date, now: Date): string {
    const startOf = (d: Date) =>
        new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayMs = 86_400_000;
    const diffDays = Math.round((startOf(now) - startOf(date)) / dayMs);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) {
        return date.toLocaleDateString(undefined, { weekday: "long" });
    }
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function timeOnly(date: Date): string {
    return date.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
    });
}

/** Compact relative time for the narrative rows. "Today", "Yesterday",
 * "3d ago" up to a week; date otherwise. */
function relativeTime(date: Date, now: Date): string {
    const startOf = (d: Date) =>
        new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayMs = 86_400_000;
    const diffDays = Math.round((startOf(now) - startOf(date)) / dayMs);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 14) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function eventLabel(e: EventRecord): string {
    switch (e.event_type) {
        case "activity":
            return `Posted ${e.activity_type ?? "an activity"}`;
        case "login":
            return "Logged in";
        case "bookmark":
            return "Bookmarked content";
        case "discussion_post":
            return "Posted in discussion";
        case "facilitator_comment":
            return "Facilitator replied";
        default:
            return "Activity";
    }
}

function snippet(e: EventRecord, max = 120): string | null {
    const text = (e.description ?? "").trim();
    if (!text) return null;
    if (text.length <= max) return text;
    return text.slice(0, max - 1) + "…";
}

/** One-line narrative for the compact mode. Combines the event label
 * with a short snippet for content-carrying events; for logins the
 * most-recent one becomes "Last login" so the row reads naturally. */
function narrativeLine(
    e: EventRecord,
    isMostRecentLogin: boolean,
): string {
    if (e.event_type === "login") {
        return isMostRecentLogin ? "Last login" : "Logged in";
    }
    const snip = snippet(e, 80);
    const label = eventLabel(e);
    if (!snip) return label;
    return `${label}: “${snip}”`;
}

function bucketEvents(events: EventRecord[], now: Date): DayBucket[] {
    const sorted = [...events].sort((a, b) =>
        b.timestamp.localeCompare(a.timestamp),
    );

    const buckets = new Map<string, DayBucket>();
    let kept = 0;
    for (const e of sorted) {
        const d = new Date(e.timestamp);
        const dayKey = d.toISOString().slice(0, 10);
        let bucket = buckets.get(dayKey);
        if (!bucket) {
            bucket = {
                dayKey,
                label: dayLabel(d, now),
                events: [],
                pageVisitCount: 0,
            };
            buckets.set(dayKey, bucket);
        }
        if (e.event_type === "page_visit") {
            bucket.pageVisitCount += 1;
            continue;
        }
        if (kept >= MAX_EXPANDED) continue;
        bucket.events.push(e);
        kept += 1;
    }

    return Array.from(buckets.values()).filter(
        (b) => b.events.length > 0 || b.pageVisitCount > 0,
    );
}

export function ActivityTimeline({
    history,
}: {
    history: ParticipantHistory;
}) {
    const [expanded, setExpanded] = useState(false);
    const now = useMemo(() => new Date(), []);
    const selectedPostTs = useUiStore((s) => s.selectedPostTs);
    const selectPost = useUiStore((s) => s.selectPost);
    // The post the Drafts panel is currently generating against — newest
    // when nothing is explicitly picked. Highlighting it makes the
    // implicit "we're drafting this one" state visible.
    const draftedTs = useMemo(() => {
        if (selectedPostTs) return selectedPostTs;
        return history.events
            .filter(
                (e) =>
                    e.event_type === "activity" &&
                    typeof e.description === "string" &&
                    e.description.trim().length > 0,
            )
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
            ?.timestamp;
    }, [selectedPostTs, history.events]);

    // Compact-mode rows: most-recent non-page-visit events as narrative
    // one-liners. Identify the most-recent login so its row reads "Last
    // login" rather than the generic "Logged in".
    const compactRows = useMemo(() => {
        const sorted = [...history.events]
            .filter((e) => e.event_type !== "page_visit")
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        const mostRecentLoginTs = sorted.find(
            (e) => e.event_type === "login",
        )?.timestamp;
        return sorted.slice(0, COMPACT_ROWS).map((e) => ({
            event: e,
            line: narrativeLine(
                e,
                e.event_type === "login" && e.timestamp === mostRecentLoginTs,
            ),
            when: relativeTime(new Date(e.timestamp), now),
        }));
    }, [history.events, now]);

    const buckets = useMemo(
        () => bucketEvents(history.events, now),
        [history.events, now],
    );

    if (compactRows.length === 0 && buckets.length === 0) {
        return (
            <div className="rounded-md border border-border bg-surface-2 px-3 py-6">
                <EmptyState
                    title="No platform activity yet"
                    description="When the participant logs in or posts, their activity will appear here."
                />
            </div>
        );
    }

    return (
        <div>
            <div className="mb-2 flex items-baseline justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Recent activity
                </h4>
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="text-xs text-accent-ink hover:underline"
                >
                    {expanded ? "Show less" : "Full history →"}
                </button>
            </div>

            {!expanded ? (
                <ol className="divide-y divide-border rounded-md border border-border bg-surface-2">
                    {compactRows.map((r) => {
                        const isPost =
                            r.event.event_type === "activity" &&
                            typeof r.event.description === "string" &&
                            r.event.description.trim().length > 0;
                        const isDrafted =
                            isPost && r.event.timestamp === draftedTs;
                        const content = (
                            <>
                                <span className="w-16 shrink-0 text-xs text-muted">
                                    {r.when}
                                </span>
                                <span className="min-w-0 flex-1 text-text-2">
                                    {r.line}
                                </span>
                                {isDrafted && (
                                    <span className="shrink-0 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-medium text-accent-ink">
                                        drafting
                                    </span>
                                )}
                            </>
                        );
                        if (!isPost) {
                            return (
                                <li
                                    key={r.event.timestamp + r.event.event_type}
                                    className="flex items-start gap-3 px-3 py-2.5 text-sm"
                                >
                                    {content}
                                </li>
                            );
                        }
                        return (
                            <li
                                key={r.event.timestamp + r.event.event_type}
                                className={isDrafted ? "bg-accent/10" : ""}
                            >
                                <button
                                    type="button"
                                    onClick={() => selectPost(r.event.timestamp)}
                                    className="flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                    aria-pressed={isDrafted ? "true" : "false"}
                                    title="Draft a reply to this post"
                                >
                                    {content}
                                </button>
                            </li>
                        );
                    })}
                </ol>
            ) : (
                <ol className="space-y-3">
                    {buckets.map((b) => (
                        <li key={b.dayKey}>
                            <div className="mb-1.5 flex items-baseline gap-2">
                                <span className="text-xs font-semibold text-text-2">
                                    {b.label}
                                </span>
                                {b.pageVisitCount > 0 && (
                                    <span className="text-xs text-muted">
                                        · viewed {b.pageVisitCount}{" "}
                                        {b.pageVisitCount === 1 ? "page" : "pages"}
                                    </span>
                                )}
                            </div>
                            <ul className="space-y-1.5">
                                {b.events.map((e) => {
                                    const Icon = ICONS[e.event_type] ?? Activity;
                                    const accent =
                                        ACCENTS[e.event_type] ?? ACCENTS.login;
                                    const text = snippet(e);
                                    return (
                                        <li
                                            key={e.timestamp + e.event_type}
                                            className="flex gap-2.5 rounded-md border border-border bg-surface-2 px-2.5 py-2"
                                        >
                                            <div
                                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${accent}`}
                                            >
                                                <Icon
                                                    className="h-3.5 w-3.5"
                                                    aria-hidden
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-baseline justify-between gap-2">
                                                    <span className="text-sm text-text">
                                                        {eventLabel(e)}
                                                    </span>
                                                    <span className="shrink-0 text-xs text-muted">
                                                        {timeOnly(
                                                            new Date(e.timestamp),
                                                        )}
                                                    </span>
                                                </div>
                                                {text && (
                                                    <p className="mt-0.5 line-clamp-2 text-xs text-text-2">
                                                        {text}
                                                    </p>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

"use client";

import { useMemo } from "react";
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

/**
 * Chronological activity feed for the detail panel.
 *
 * Reads the participant's real event stream (from the cohort bundle when
 * present, synthetic otherwise) and renders the most recent N events
 * grouped by day. Replaces the static InfoCardRow that occupied this
 * slot. Designed to feel "live" — when the platform webhook lands, this
 * surface will update without code changes.
 *
 * Page visits are aggregated per-day rather than rendered as individual
 * rows: a heavily-engaged participant generates 20+ page-visits per day
 * and a one-row-per-visit feed would drown out the substantive events
 * (posts, replies, logins).
 */

const MAX_EVENTS = 15;

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

/** Subtle accent per event type. Maps to oklch risk/neutral tokens so
 * the timeline reads as part of the surface, not a colourful sidebar. */
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

/** Bucket events by calendar day in descending order, with page visits
 * collapsed into a per-day count. Caps total visible events at MAX_EVENTS
 * so the panel doesn't run to a thousand rows for a heavily-engaged
 * participant. */
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
        if (kept >= MAX_EVENTS) continue;
        bucket.events.push(e);
        kept += 1;
    }

    // Drop empty buckets (a day with only page visits and nothing else
    // doesn't earn a header).
    return Array.from(buckets.values()).filter(
        (b) => b.events.length > 0 || b.pageVisitCount > 0,
    );
}

export function ActivityTimeline({
    history,
}: {
    history: ParticipantHistory;
}) {
    const buckets = useMemo(
        () => bucketEvents(history.events, new Date()),
        [history.events],
    );

    if (buckets.length === 0) {
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
                <span className="text-xs text-muted">
                    Last {Math.min(MAX_EVENTS, history.events.length)} events
                </span>
            </div>
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
                                const accent = ACCENTS[e.event_type] ?? ACCENTS.login;
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
        </div>
    );
}

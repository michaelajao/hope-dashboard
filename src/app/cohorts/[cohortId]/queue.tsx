"use client";

import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 10;

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QueueItem } from "@/components/queue-item";
import { Skeleton } from "@/components/ui/skeleton";
import { useCohortBatch } from "@/lib/hooks/api";
import { useCohortBundle } from "@/lib/hooks/useCohortBundle";
import { syntheticBatch, syntheticHistory } from "@/lib/demo-events";
import { bundleParticipantIds, bundleToHistory } from "@/lib/realCohort";
import {
    scoreAtDay as scoreAtDayForWeek,
    useScoringStore,
} from "@/lib/store/scoringStore";
import { useUiStore } from "@/lib/store/uiStore";
import { useQueueStore } from "@/lib/store/queueStore";
import { QUEUE_PILL_LABELS } from "@/lib/risk";
import { lastActiveLabel, displayName } from "@/lib/signals";
import type { CohortMeta } from "@/lib/cohorts";
import type {
    ParticipantHistory,
    RiskLevel,
} from "@/lib/api/dropout";

const FILTERS: Array<RiskLevel | "all"> = ["all", "high", "medium", "low"];

function useMountTime(): number {
    const [t] = useState(() => Date.now());
    return t;
}

export function Queue({ cohort }: { cohort: CohortMeta }) {
    const bundle = useCohortBundle();
    const scoreAtWeek = useScoringStore((s) => s.scoreAtWeek);
    const scoreAt = scoreAtDayForWeek(scoreAtWeek);
    const histories: ParticipantHistory[] = useMemo(() => {
        if (bundle.data) {
            // Real bundle present — build histories from real events up to
            // the currently-selected programme week. programmeLengthDays
            // comes from the cohort bundle so the API gets cohort-true
            // metadata instead of a 42-day default.
            return bundleParticipantIds(bundle.data)
                .map((id) => bundleToHistory(bundle.data!, id, scoreAt))
                .filter((h): h is ParticipantHistory => h !== null);
        }
        // Fallback: synthetic stream so the dashboard still renders in CI /
        // fresh clones where the bundle file is absent. Pass the cohort's
        // declared length so synthetic histories stay consistent with the
        // queue's week selector.
        return syntheticBatch(
            cohort.demoParticipants,
            scoreAt,
            cohort.programmeLengthDays,
        );
    }, [
        bundle.data,
        cohort.demoParticipants,
        cohort.programmeLengthDays,
        scoreAt,
    ]);

    const histLookup = useMemo(() => {
        const m = new Map<string, ParticipantHistory>();
        for (const h of histories) m.set(h.participant_id, h);
        return m;
    }, [histories]);

    const { data, isLoading, error } = useCohortBatch(histories);
    const selectedId = useUiStore((s) => s.selectedParticipantId);
    const select = useUiStore((s) => s.selectParticipant);
    const snoozedUntil = useQueueStore((s) => s.snoozedUntil);
    const dismissedAt = useQueueStore((s) => s.dismissedAt);
    const undoSnooze = useQueueStore((s) => s.undoSnooze);
    const undoDismiss = useQueueStore((s) => s.undoDismiss);
    const now = useMountTime();

    const [filter, setFilter] = useState<RiskLevel | "all">("all");
    const [query, setQuery] = useState("");
    const [showHidden, setShowHidden] = useState(false);
    const [page, setPage] = useState(0);

    // Reset to page 0 whenever filter/query change so the user isn't
    // stuck on a page that no longer exists for the new result set.
    // Legitimate side-effect (sync external prop change to local state).
    useEffect(() => {
        /* eslint-disable react-hooks/set-state-in-effect */
        setPage(0);
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [filter, query]);

    const { visible, hidden } = useMemo(() => {
        const preds = data?.predictions ?? [];
        const q = query.trim().toLowerCase();
        const matchesFilter = preds.filter((p) =>
            filter === "all" ? true : p.risk_level === filter,
        );
        const matchesQuery = matchesFilter.filter((p) =>
            q ? p.participant_id.toLowerCase().includes(q) : true,
        );
        const visible: typeof matchesQuery = [];
        const hidden: typeof matchesQuery = [];
        for (const p of matchesQuery) {
            const isDismissed = Boolean(dismissedAt[p.participant_id]);
            const snoozed = snoozedUntil[p.participant_id];
            const isSnoozed = snoozed !== undefined && snoozed > now;
            if (isDismissed || isSnoozed) hidden.push(p);
            else visible.push(p);
        }
        return { visible, hidden };
    }, [data?.predictions, filter, query, snoozedUntil, dismissedAt, now]);

    // Paginate the visible list. With 51 cohort participants and a page
    // size of 10, you get 6 pages; smaller filtered sets land on a
    // single page. Currently active participant always lands on its
    // page when selected from elsewhere — clamp here so the nav never
    // points past the end.
    const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages - 1);
    const pageStart = safePage * PAGE_SIZE;
    const pageEnd = Math.min(pageStart + PAGE_SIZE, visible.length);
    const pageItems = visible.slice(pageStart, pageEnd);

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Follow-up queue</CardTitle>
                    <Badge variant="neutral">{visible.length}</Badge>
                </div>
                <div className="space-y-2 pt-2">
                    <Input
                        type="search"
                        placeholder="Search participants…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Search participants"
                    />
                    <div
                        className="flex flex-wrap gap-1"
                        role="group"
                        aria-label="Filter queue by status"
                    >
                        {FILTERS.map((f) => (
                            <Button
                                key={f}
                                size="sm"
                                variant={filter === f ? "primary" : "ghost"}
                                aria-pressed={filter === f}
                                onClick={() => setFilter(f)}
                            >
                                {QUEUE_PILL_LABELS[f]}
                            </Button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-1 overflow-y-auto">
                {isLoading && (
                    <div className="space-y-2">
                        {[0, 1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="h-14 w-full" />
                        ))}
                    </div>
                )}
                {error && (
                    <p className="text-xs text-risk-hi">
                        Failed to load: {String((error as Error).message)}
                    </p>
                )}
                {visible.length === 0 && !isLoading && !error && (
                    <p className="px-1 py-4 text-center text-xs text-muted">
                        No participants match the current filter.
                    </p>
                )}
                {pageItems.map((p) => {
                    const hist =
                        histLookup.get(p.participant_id) ??
                        syntheticHistory(
                            p.participant_id,
                            scoreAt,
                            cohort.programmeLengthDays,
                        );
                    return (
                        <QueueItem
                            key={p.participant_id}
                            participantId={p.participant_id}
                            riskLevel={p.risk_level}
                            riskScore={p.dropout_risk}
                            lastActiveLabel={lastActiveLabel(hist)}
                            selected={selectedId === p.participant_id}
                            onClick={() => select(p.participant_id)}
                        />
                    );
                })}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted">
                        <span>
                            Showing {pageStart + 1}–{pageEnd} of{" "}
                            {visible.length}
                        </span>
                        <div
                            className="inline-flex items-center gap-0.5"
                            role="group"
                            aria-label="Queue pagination"
                        >
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                                disabled={safePage === 0}
                                className="rounded px-2 py-1 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Previous page"
                            >
                                ←
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i).map(
                                (i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => setPage(i)}
                                        aria-current={
                                            i === safePage ? "page" : undefined
                                        }
                                        className={
                                            "min-w-7 rounded px-2 py-1 hover:bg-surface-2 " +
                                            (i === safePage
                                                ? "bg-surface-2 font-semibold text-text"
                                                : "")
                                        }
                                    >
                                        {i + 1}
                                    </button>
                                ),
                            )}
                            <button
                                type="button"
                                onClick={() =>
                                    setPage((p) =>
                                        Math.min(totalPages - 1, p + 1),
                                    )
                                }
                                disabled={safePage >= totalPages - 1}
                                className="rounded px-2 py-1 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Next page"
                            >
                                →
                            </button>
                        </div>
                    </div>
                )}
                {hidden.length > 0 && (
                    <div className="border-t border-border pt-2">
                        <button
                            type="button"
                            onClick={() => setShowHidden((v) => !v)}
                            className="w-full text-left text-xs text-muted hover:text-text-2"
                        >
                            {showHidden ? "Hide" : "Show"} {hidden.length}{" "}
                            snoozed / dismissed
                        </button>
                        {showHidden && (
                            <ul className="mt-2 space-y-1">
                                {hidden.map((p) => {
                                    const isDismissed = Boolean(
                                        dismissedAt[p.participant_id],
                                    );
                                    return (
                                        <li
                                            key={p.participant_id}
                                            className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-1.5"
                                        >
                                            <span className="truncate text-xs text-text-2">
                                                {displayName(p.participant_id)}
                                                <span className="ml-1.5 text-muted">
                                                    {isDismissed
                                                        ? "dismissed"
                                                        : "snoozed"}
                                                </span>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    isDismissed
                                                        ? undoDismiss(
                                                              p.participant_id,
                                                          )
                                                        : undoSnooze(
                                                              p.participant_id,
                                                          )
                                                }
                                                className="text-xs text-accent-ink hover:underline"
                                            >
                                                Undo
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

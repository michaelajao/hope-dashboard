"use client";

import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QueueItem } from "@/components/queue-item";
import { Skeleton } from "@/components/ui/skeleton";
import { useCohortBatch } from "@/lib/hooks/api";
import { syntheticBatch, syntheticHistory } from "@/lib/demo-events";
import { useUiStore } from "@/lib/store/uiStore";
import { useQueueStore } from "@/lib/store/queueStore";
import { QUEUE_PILL_LABELS } from "@/lib/risk";
import { lastActiveLabel, displayName } from "@/lib/signals";
import type { CohortMeta } from "@/lib/cohorts";
import type { RiskLevel } from "@/lib/api/dropout";

const FILTERS: Array<RiskLevel | "all"> = ["all", "high", "medium", "low"];

function useMountTime(): number {
    const [t] = useState(() => Date.now());
    return t;
}

export function Queue({ cohort }: { cohort: CohortMeta }) {
    const histories = useMemo(
        () => syntheticBatch(cohort.demoParticipants),
        [cohort.demoParticipants],
    );
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
                {visible.map((p) => (
                    <QueueItem
                        key={p.participant_id}
                        participantId={p.participant_id}
                        riskLevel={p.risk_level}
                        riskScore={p.dropout_risk}
                        lastActiveLabel={lastActiveLabel(
                            syntheticHistory(p.participant_id),
                        )}
                        selected={selectedId === p.participant_id}
                        onClick={() => select(p.participant_id)}
                    />
                ))}
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

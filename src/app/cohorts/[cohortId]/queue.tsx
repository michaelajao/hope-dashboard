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
import { QUEUE_PILL_LABELS } from "@/lib/risk";
import { lastActiveLabel } from "@/lib/signals";
import type { CohortMeta } from "@/lib/cohorts";
import type { RiskLevel } from "@/lib/api/dropout";

const FILTERS: Array<RiskLevel | "all"> = ["all", "high", "medium", "low"];

export function Queue({ cohort }: { cohort: CohortMeta }) {
    const histories = useMemo(
        () => syntheticBatch(cohort.demoParticipants),
        [cohort.demoParticipants],
    );
    const { data, isLoading, error } = useCohortBatch(histories);
    const selectedId = useUiStore((s) => s.selectedParticipantId);
    const select = useUiStore((s) => s.selectParticipant);
    const [filter, setFilter] = useState<RiskLevel | "all">("all");
    const [query, setQuery] = useState("");

    const visible = useMemo(() => {
        const preds = data?.predictions ?? [];
        const q = query.trim().toLowerCase();
        return preds
            .filter((p) =>
                filter === "all" ? true : p.risk_level === filter,
            )
            .filter((p) =>
                q ? p.participant_id.toLowerCase().includes(q) : true,
            );
    }, [data?.predictions, filter, query]);

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Follow-up queue</CardTitle>
                    <Badge variant="neutral">{data?.total ?? "—"}</Badge>
                </div>
                <div className="space-y-2 pt-2">
                    <Input
                        type="search"
                        placeholder="Search participants…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Search participants"
                    />
                    <div className="flex flex-wrap gap-1">
                        {FILTERS.map((f) => (
                            <Button
                                key={f}
                                size="sm"
                                variant={filter === f ? "primary" : "ghost"}
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
                    <p className="text-xs text-rose-600">
                        Failed to load: {String((error as Error).message)}
                    </p>
                )}
                {visible.length === 0 && !isLoading && !error && (
                    <p className="px-1 py-4 text-center text-xs text-slate-500">
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
            </CardContent>
        </Card>
    );
}

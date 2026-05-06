"use client";

import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QueueItem } from "@/components/queue-item";
import { Skeleton } from "@/components/ui/skeleton";
import { useCohortBatch } from "@/lib/hooks/api";
import { syntheticBatch } from "@/lib/demo-features";
import { useUiStore } from "@/lib/store/uiStore";
import type { CohortMeta } from "@/lib/cohorts";
import type { RiskLevel } from "@/lib/api/dropout";

const FILTERS: Array<RiskLevel | "all"> = ["all", "high", "medium", "low"];

export function Queue({ cohort }: { cohort: CohortMeta }) {
    const features = useMemo(
        () => syntheticBatch(cohort.demoParticipants),
        [cohort.demoParticipants],
    );
    const { data, isLoading, error } = useCohortBatch(features);
    const selectedId = useUiStore((s) => s.selectedParticipantId);
    const select = useUiStore((s) => s.selectParticipant);
    const [filter, setFilter] = useState<RiskLevel | "all">("all");

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Follow-up queue</CardTitle>
                    <Badge variant="neutral">{data?.total ?? "—"}</Badge>
                </div>
                <div className="flex flex-wrap gap-1 pt-2">
                    {FILTERS.map((f) => (
                        <Button
                            key={f}
                            size="sm"
                            variant={filter === f ? "primary" : "ghost"}
                            onClick={() => setFilter(f)}
                            className="capitalize"
                        >
                            {f}
                        </Button>
                    ))}
                </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-1 overflow-y-auto">
                {isLoading && (
                    <div className="space-y-2">
                        {[0, 1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </div>
                )}
                {error && (
                    <p className="text-xs text-rose-600">
                        Failed to load: {String((error as Error).message)}
                    </p>
                )}
                {data?.predictions
                    .filter((p) =>
                        filter === "all" ? true : p.risk_level === filter,
                    )
                    .map((p) => (
                        <QueueItem
                            key={p.participant_id}
                            participantId={p.participant_id}
                            riskLevel={p.risk_level}
                            riskScore={p.dropout_risk}
                            factor={p.contributing_factors[0]}
                            selected={selectedId === p.participant_id}
                            onClick={() => select(p.participant_id)}
                        />
                    ))}
            </CardContent>
        </Card>
    );
}

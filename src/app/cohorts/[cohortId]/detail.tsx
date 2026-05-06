"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { RiskGauge } from "@/components/risk-gauge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemory, useParticipantPrediction } from "@/lib/hooks/api";
import { syntheticFeatures } from "@/lib/demo-features";
import { useUiStore } from "@/lib/store/uiStore";

export function Detail({ cohortId }: { cohortId: number }) {
    const selectedId = useUiStore((s) => s.selectedParticipantId);
    const features = useMemo(
        () => (selectedId ? syntheticFeatures(selectedId) : null),
        [selectedId],
    );
    const prediction = useParticipantPrediction(features);
    const memory = useMemory(selectedId, cohortId);

    if (!selectedId) {
        return (
            <Card className="flex items-center justify-center">
                <CardContent>
                    <EmptyState
                        title="No participant selected"
                        description="Pick someone from the follow-up queue to see their dropout risk, recent activity, and contributing factors."
                    />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="flex flex-col gap-3">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Participant {selectedId}</CardTitle>
                    {prediction.data && (
                        <Badge variant={prediction.data.risk_level}>
                            {prediction.data.risk_level} risk
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-[200px_1fr]">
                    <div className="flex justify-center md:justify-start">
                        {prediction.isLoading ? (
                            <Skeleton className="h-24 w-40" />
                        ) : prediction.data ? (
                            <RiskGauge
                                value={prediction.data.dropout_risk}
                                level={prediction.data.risk_level}
                            />
                        ) : null}
                    </div>
                    <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Why highlighted
                        </h4>
                        {prediction.isLoading ? (
                            <div className="mt-2 space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                            </div>
                        ) : prediction.data?.contributing_factors?.length ? (
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                                {prediction.data.contributing_factors.map(
                                    (f, i) => (
                                        <li key={i}>{f}</li>
                                    ),
                                )}
                            </ul>
                        ) : (
                            <p className="mt-2 text-sm text-slate-500">
                                No contributing factors available.
                            </p>
                        )}

                        {prediction.data?.recommended_actions?.length ? (
                            <div className="mt-4">
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Recommended actions
                                </h4>
                                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                                    {prediction.data.recommended_actions.map(
                                        (a, i) => (
                                            <li key={i}>{a}</li>
                                        ),
                                    )}
                                </ul>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Recent activity
                    </h4>
                    {memory.isLoading ? (
                        <div className="mt-2 space-y-2">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : memory.data && memory.data.length > 0 ? (
                        <ul className="mt-2 space-y-2 text-sm">
                            {memory.data.slice(0, 5).map((m) => (
                                <li
                                    key={m.memory_id}
                                    className="rounded border border-slate-200 bg-slate-50 px-3 py-2"
                                >
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                        <span className="capitalize">
                                            {(m.role ?? "entry").replace("_", " ")}
                                            {m.activity_type
                                                ? ` · ${m.activity_type}`
                                                : ""}
                                        </span>
                                        {m.ts && (
                                            <span>
                                                {new Date(m.ts).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-1 line-clamp-3 text-slate-800">
                                        {m.text}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-2 text-sm text-slate-500">
                            No prior activity for this participant in this cohort.
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

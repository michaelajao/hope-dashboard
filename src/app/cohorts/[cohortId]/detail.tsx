"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { RiskGauge } from "@/components/risk-gauge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/avatar";
import { InfoCardRow } from "@/components/info-card-row";
import { AiSummaryCard } from "@/components/ai-summary-card";
import { MetricGrid, MetricTile } from "@/components/metric-tile";
import { useMemory, useParticipantPrediction } from "@/lib/hooks/api";
import { syntheticHistory } from "@/lib/demo-events";
import { useUiStore } from "@/lib/store/uiStore";
import { friendlyStatus } from "@/lib/risk";
import {
    activationLevel,
    daysSinceLastEvent,
    displayName,
    distinctActivityTypes,
    engagementTrend,
    eventsLastNDays,
    facilitatorContactCount,
} from "@/lib/signals";

export function Detail({ cohortId }: { cohortId: number }) {
    const selectedId = useUiStore((s) => s.selectedParticipantId);
    const history = useMemo(
        () => (selectedId ? syntheticHistory(selectedId) : null),
        [selectedId],
    );
    const prediction = useParticipantPrediction(history);
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

    const name = displayName(selectedId);
    const status = prediction.data
        ? friendlyStatus(prediction.data.risk_level)
        : null;

    return (
        <Card className="flex flex-col gap-3">
            <CardHeader>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Avatar participantId={selectedId} size="lg" />
                        <div>
                            <CardTitle>{name}</CardTitle>
                            <p className="text-xs text-slate-500">
                                Cohort {cohortId} ·{" "}
                                <span className="text-slate-700">
                                    {selectedId}
                                </span>
                            </p>
                        </div>
                    </div>
                    {status && (
                        <Badge variant={status.badgeVariant}>{status.label}</Badge>
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
                        {prediction.data ? (
                            <InfoCardRow prediction={prediction.data} />
                        ) : prediction.isLoading ? (
                            <Skeleton className="h-24 w-full" />
                        ) : null}
                    </div>
                </div>

                {prediction.data && history && (
                    <AiSummaryCard
                        history={history}
                        prediction={prediction.data}
                    />
                )}

                {history && prediction.data && (
                    <DetailMetrics
                        history={history}
                        factors={prediction.data.contributing_factors}
                    />
                )}

                {prediction.data?.contributing_factors?.length ? (
                    <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Why {name} is highlighted
                        </h4>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                            {prediction.data.contributing_factors.map((f, i) => (
                                <li key={i}>{f}</li>
                            ))}
                        </ul>
                    </div>
                ) : prediction.isLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                ) : null}

                {prediction.data?.recommended_actions?.length ? (
                    <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Recommended actions
                        </h4>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                            {prediction.data.recommended_actions.map((a, i) => (
                                <li key={i}>{a}</li>
                            ))}
                        </ul>
                    </div>
                ) : null}

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
                                            {(m.role ?? "entry").replace(
                                                "_",
                                                " ",
                                            )}
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

function DetailMetrics({
    history,
    factors,
}: {
    history: ReturnType<typeof syntheticHistory>;
    factors: string[];
}) {
    const lastActiveDays = daysSinceLastEvent(history);
    const discussion = eventsLastNDays(history, "discussion_post", 14);
    const types = distinctActivityTypes(history, 14);
    const facilitatorTouches = facilitatorContactCount(history);
    const trend = engagementTrend(history);
    const activation = activationLevel(factors);

    const lastActiveTone =
        lastActiveDays === 0
            ? "positive"
            : lastActiveDays >= 7
              ? "negative"
              : "neutral";
    const discussionTone =
        discussion.deltaPercent === null
            ? "neutral"
            : discussion.deltaPercent <= -30
              ? "negative"
              : discussion.deltaPercent >= 30
                ? "positive"
                : "neutral";
    const trendTone =
        trend === "Declining"
            ? "negative"
            : trend === "Improving"
              ? "positive"
              : "neutral";

    return (
        <MetricGrid>
            <MetricTile
                label="Last active"
                value={
                    lastActiveDays === 0
                        ? "Today"
                        : `${lastActiveDays} day${lastActiveDays === 1 ? "" : "s"} ago`
                }
                tone={lastActiveTone}
            />
            <MetricTile
                label="Discussion posts"
                value={discussion.count}
                delta={
                    discussion.deltaPercent === null
                        ? "vs prior 14d: n/a"
                        : `${discussion.deltaPercent >= 0 ? "+" : ""}${discussion.deltaPercent}% vs prior 14d`
                }
                tone={discussionTone}
            />
            <MetricTile
                label="Activity types"
                value={`${types} of 4`}
                delta="last 14d"
            />
            <MetricTile
                label="Facilitator contact"
                value={facilitatorTouches}
                delta={facilitatorTouches === 0 ? "no comments yet" : "to date"}
                tone={facilitatorTouches === 0 ? "negative" : "neutral"}
            />
            <MetricTile
                label="Engagement trend"
                value={trend}
                delta="vs prior 14d"
                tone={trendTone}
            />
            <MetricTile label="Activation level" value={activation} />
        </MetricGrid>
    );
}

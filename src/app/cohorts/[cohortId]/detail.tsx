"use client";

import { useMemo } from "react";
import { Clock, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { RiskGauge } from "@/components/risk-gauge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/avatar";
import { InfoCardRow } from "@/components/info-card-row";
import { AiSummaryCard } from "@/components/ai-summary-card";
import { MetricGrid, MetricTile } from "@/components/metric-tile";
import { DriverBars } from "@/components/driver-bars";
import { useMemory, useParticipantPrediction } from "@/lib/hooks/api";
import { useCohortBundle } from "@/lib/hooks/useCohortBundle";
import { syntheticHistory } from "@/lib/demo-events";
import { bundleToHistory } from "@/lib/realCohort";
import { useUiStore } from "@/lib/store/uiStore";
import { useQueueStore } from "@/lib/store/queueStore";
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
    const select = useUiStore((s) => s.selectParticipant);
    const snooze = useQueueStore((s) => s.snooze);
    const dismiss = useQueueStore((s) => s.dismiss);
    const bundle = useCohortBundle();
    const history = useMemo(() => {
        if (!selectedId) return null;
        if (bundle.data) {
            const real = bundleToHistory(bundle.data, selectedId);
            if (real) return real;
        }
        return syntheticHistory(selectedId);
    }, [selectedId, bundle.data]);
    const prediction = useParticipantPrediction(history);
    const memory = useMemory(selectedId, cohortId);

    function onSnooze() {
        if (!selectedId) return;
        snooze(selectedId, 7);
        select(null);
    }
    function onDismiss() {
        if (!selectedId) return;
        dismiss(selectedId);
        select(null);
    }

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
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Avatar participantId={selectedId} size="lg" />
                        <div>
                            <CardTitle>{name}</CardTitle>
                            <p className="text-xs text-muted">
                                Cohort {cohortId} ·{" "}
                                <span className="text-text-2">
                                    {selectedId}
                                </span>
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        {status && (
                            <Badge
                                variant={status.badgeVariant}
                                className="whitespace-nowrap"
                            >
                                {status.label}
                            </Badge>
                        )}
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onSnooze}
                            className="gap-1.5 whitespace-nowrap"
                        >
                            <Clock className="h-3.5 w-3.5" aria-hidden />
                            Snooze 7d
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onDismiss}
                            className="gap-1.5 whitespace-nowrap text-risk-hi hover:bg-risk-hi-bg"
                        >
                            <X className="h-3.5 w-3.5" aria-hidden />
                            Dismiss
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
                    <div className="shrink-0">
                        {prediction.isLoading ? (
                            <Skeleton className="h-24 w-40" />
                        ) : prediction.data ? (
                            <RiskGauge
                                value={prediction.data.dropout_risk}
                                level={prediction.data.risk_level}
                            />
                        ) : null}
                    </div>
                    {prediction.data?.contributing_factors?.length ? (
                        <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                                Why {name} is highlighted
                            </h4>
                            <div className="mt-3">
                                <DriverBars
                                    factors={
                                        prediction.data.contributing_factors
                                    }
                                    weights={
                                        prediction.data
                                            .contributing_factor_weights
                                    }
                                    tone={prediction.data.risk_level}
                                />
                            </div>
                        </div>
                    ) : prediction.isLoading ? (
                        <div className="min-w-0 flex-1 space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                        </div>
                    ) : null}
                </div>

                {prediction.data && (
                    <InfoCardRow prediction={prediction.data} />
                )}

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
                        riskLevel={prediction.data.risk_level}
                    />
                )}

                {prediction.data?.recommended_actions?.length ? (
                    <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                            Recommended actions
                        </h4>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-2">
                            {prediction.data.recommended_actions.map((a, i) => (
                                <li key={i}>{a}</li>
                            ))}
                        </ul>
                    </div>
                ) : null}

                <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
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
                                    className="rounded border border-border bg-surface-2 px-3 py-2"
                                >
                                    <div className="flex items-center justify-between text-xs text-muted">
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
                                    <p className="mt-1 line-clamp-3 text-text">
                                        {m.text}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-2 text-sm text-muted">
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
    riskLevel,
}: {
    history: ReturnType<typeof syntheticHistory>;
    factors: string[];
    riskLevel: "low" | "medium" | "high";
}) {
    const lastActiveDays = daysSinceLastEvent(history);
    const discussion = eventsLastNDays(history, "discussion_post", 14);
    const types = distinctActivityTypes(history, 14);
    const facilitatorTouches = facilitatorContactCount(history);
    const trend = engagementTrend(history);
    const activation = activationLevel(factors, riskLevel);

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

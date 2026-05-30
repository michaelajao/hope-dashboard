"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { RiskGauge } from "@/components/risk-gauge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/avatar";
import { ActivityTimeline } from "@/components/activity-timeline";
import { MetricGrid, MetricTile } from "@/components/metric-tile";
import { DriverBars } from "@/components/driver-bars";
import { useParticipantPrediction } from "@/lib/hooks/api";
import { useCohortBundle } from "@/lib/hooks/useCohortBundle";
import { bundleParticipantIds, bundleToHistory } from "@/lib/realCohort";
import {
    scoreAtDay as scoreAtDayForWeek,
    useScoringStore,
} from "@/lib/store/scoringStore";
import { useUiStore } from "@/lib/store/uiStore";
import { useQueueStore } from "@/lib/store/queueStore";
import { friendlyStatus } from "@/lib/risk";
import type { ParticipantHistory } from "@/lib/api/dropout";
import {
    daysSinceLastEvent,
    eventsLastNDays,
    facilitatorContactCount,
} from "@/lib/signals";
import { useBundleDisplayName } from "@/lib/hooks/displayName";

export function Detail({
    cohortId,
}: {
    cohortId: number;
}) {
    const selectedId = useUiStore((s) => s.selectedParticipantId);
    const select = useUiStore((s) => s.selectParticipant);
    const snooze = useQueueStore((s) => s.snooze);
    const dismiss = useQueueStore((s) => s.dismiss);
    const bundle = useCohortBundle(cohortId);
    const scoreAtWeek = useScoringStore((s) => s.scoreAtWeek);
    const scoreAt = scoreAtDayForWeek(scoreAtWeek);
    const history = useMemo(() => {
        if (!selectedId || !bundle.data) return null;
        return bundleToHistory(bundle.data, selectedId, scoreAt);
    }, [selectedId, bundle.data, scoreAt]);
    const prediction = useParticipantPrediction(history, cohortId);
    const aliasLabel = useBundleDisplayName(selectedId ?? "", cohortId);

    // Neighbour navigation: derive prev/next from the cohort bundle's
    // participant order. Falls back to no-op when the bundle hasn't
    // loaded yet (the arrows just disable in that case).
    const neighbours = useMemo(() => {
        if (!bundle.data || !selectedId) return { prev: null, next: null };
        const ids = bundleParticipantIds(bundle.data);
        const idx = ids.indexOf(selectedId);
        if (idx < 0) return { prev: null, next: null };
        return {
            prev: idx > 0 ? ids[idx - 1] : null,
            next: idx < ids.length - 1 ? ids[idx + 1] : null,
        };
    }, [bundle.data, selectedId]);

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

    const name = aliasLabel;
    const status = prediction.data
        ? friendlyStatus(prediction.data.risk_level)
        : null;

    return (
        <Card className="flex flex-col gap-3">
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Avatar
                            participantId={selectedId}
                            cohortId={cohortId}
                            size="lg"
                        />
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
                        <div className="flex items-center rounded-md border border-border">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                    neighbours.prev && select(neighbours.prev)
                                }
                                disabled={!neighbours.prev}
                                aria-label="Previous participant"
                                title="Previous participant"
                                className="h-8 w-8 rounded-r-none"
                            >
                                <ChevronLeft
                                    className="h-4 w-4"
                                    aria-hidden
                                />
                            </Button>
                            <span className="border-l border-border" />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                    neighbours.next && select(neighbours.next)
                                }
                                disabled={!neighbours.next}
                                aria-label="Next participant"
                                title="Next participant"
                                className="h-8 w-8 rounded-l-none"
                            >
                                <ChevronRight
                                    className="h-4 w-4"
                                    aria-hidden
                                />
                            </Button>
                        </div>
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
                                {/* The factors are SHAP drivers, each with its
                                    own direction (DriverBars shows ↑ raising /
                                    ↓ lowering). The top-3 mix directions even
                                    for a flagged participant, so a flat "why
                                    flagged" header would mislabel the
                                    protective ones — keep the header neutral
                                    for non-low and let the per-bar arrows
                                    carry the direction. */}
                                {prediction.data.risk_level === "low"
                                    ? `What's going well for ${name}`
                                    : `What's driving ${name}'s risk`}
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
                                    directions={
                                        prediction.data
                                            .contributing_factor_directions
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

                {history && (
                    <details className="group" open>
                        <summary className="flex cursor-pointer select-none items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
                            Engagement signals
                            <span className="text-[10px] text-muted/70 group-open:hidden">
                                expand
                            </span>
                            <span className="hidden text-[10px] text-muted/70 group-open:inline">
                                collapse
                            </span>
                        </summary>
                        <div className="mt-3">
                            <DetailMetrics history={history} />
                        </div>
                    </details>
                )}

                {history && <ActivityTimeline history={history} />}
            </CardContent>
        </Card>
    );
}

function DetailMetrics({
    history,
}: {
    history: ParticipantHistory;
}) {
    const lastActiveDays = daysSinceLastEvent(history);
    const discussion = eventsLastNDays(history, "discussion_post", 14);
    const facilitatorTouches = facilitatorContactCount(history);

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
                label="Facilitator contact"
                value={facilitatorTouches}
                delta={facilitatorTouches === 0 ? "no comments yet" : "to date"}
                tone={facilitatorTouches === 0 ? "negative" : "neutral"}
            />
        </MetricGrid>
    );
}

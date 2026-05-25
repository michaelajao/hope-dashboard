"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { DraftCard, type DraftContext } from "@/components/draft-card";
import { FollowUpActivity } from "@/components/follow-up-activity";
import {
    useEvent,
    useGenerate,
    useParticipantPrediction,
    useThumb,
} from "@/lib/hooks/api";
import {
    demoEngagementContext,
    syntheticHistory,
    weekNumber,
} from "@/lib/demo-events";
import { seedDemoMemory } from "@/lib/demo-memory";
import { getDemoProfile } from "@/lib/profile";
import { useUiStore } from "@/lib/store/uiStore";
import { RECOMMENDED_APPROACH_BULLETS } from "@/lib/risk";
import { daysSinceLastEvent } from "@/lib/signals";
import type { CohortMeta } from "@/lib/cohorts";
import type {
    ActivityType,
    GenerateRequest,
    GenerateResponse,
} from "@/lib/api/commentGen";

const ACTIVITY_OPTIONS: ActivityType[] = [
    "GoalSetting",
    "Gratitude",
    "Emotions",
    "MyHOPE",
];

const FACILITATOR_ID = "demo-facilitator";

export function Drafts({ cohort }: { cohort: CohortMeta }) {
    const selectedId = useUiStore((s) => s.selectedParticipantId);
    const history = useMemo(
        () => (selectedId ? syntheticHistory(selectedId) : null),
        [selectedId],
    );
    const prediction = useParticipantPrediction(history);

    const [activityType, setActivityType] = useState<ActivityType>("GoalSetting");
    const [postText, setPostText] = useState("");
    const [response, setResponse] = useState<GenerateResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const generate = useGenerate();
    const thumb = useThumb();
    const event = useEvent();

    // Best-effort: seed two plausible prior posts the first time we open
    // this participant's panel, so the next /generate has real memory to
    // retrieve. Idempotent (de-duped inside seedDemoMemory) and silent on
    // failure (comment-gen offline = no-op).
    useEffect(() => {
        if (!selectedId) return;
        seedDemoMemory(selectedId, cohort.id, cohort.moduleId);
    }, [selectedId, cohort.id, cohort.moduleId]);

    if (!selectedId) {
        return (
            <Card className="flex items-center justify-center">
                <CardContent>
                    <EmptyState
                        title="Drafts appear here"
                        description="Once you select a participant, paste their post and generate three persona drafts."
                    />
                </CardContent>
            </Card>
        );
    }

    function onGenerate() {
        if (!selectedId) return;
        setError(null);
        const profile = getDemoProfile(selectedId);
        const body: GenerateRequest = {
            participant_id: Number(
                String(selectedId).replace(/[^0-9]/g, "") || "0",
            ),
            cohort_id: cohort.id,
            module_id: cohort.moduleId,
            week_number: weekNumber(history),
            activity_type: activityType,
            post_text: postText,
            display_name: profile.displayName,
            engagement: prediction.data
                ? {
                      dropout_risk: prediction.data.dropout_risk,
                      risk_level: prediction.data.risk_level,
                      ...demoEngagementContext(history),
                  }
                : undefined,
        };
        generate.mutate(body, {
            onSuccess: (res) => setResponse(res),
            onError: (err) => setError((err as Error).message),
        });
    }

    function onThumb(draftId: string, label: "up" | "down") {
        thumb.mutate({ draft_id: draftId, label, facilitator_id: FACILITATOR_ID });
    }

    function onSend(
        draftId: string,
        sentText: string,
        action: "accept" | "edit",
    ) {
        if (!response) return;
        event.mutate({
            draft_set_id: response.draft_set_id,
            chosen_draft_id: draftId,
            action,
            sent_text: sentText,
            facilitator_id: FACILITATOR_ID,
        });
    }

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle>Suggested follow-up</CardTitle>
                {response?.model_version && (
                    <Badge variant="info" className="self-start">
                        {response.model_version}
                    </Badge>
                )}
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted">
                        Activity type
                    </label>
                    <Select
                        value={activityType}
                        onChange={(e) =>
                            setActivityType(e.target.value as ActivityType)
                        }
                    >
                        {ACTIVITY_OPTIONS.map((a) => (
                            <option key={a} value={a}>
                                {a}
                            </option>
                        ))}
                    </Select>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted">
                        Participant post
                    </label>
                    <Textarea
                        rows={4}
                        value={postText}
                        onChange={(e) => setPostText(e.target.value)}
                        placeholder="Paste the participant's most recent post here…"
                    />
                </div>
                <Button
                    onClick={onGenerate}
                    disabled={!postText.trim() || generate.isPending}
                    className="w-full"
                >
                    {generate.isPending ? "Generating…" : "Generate drafts"}
                </Button>

                {response?.safety_signposting && (
                    <div className="rounded-md border border-risk-md bg-risk-md-bg px-3 py-2 text-xs text-risk-md">
                        {response.safety_signposting}
                    </div>
                )}
                {error && (
                    <p className="text-xs text-risk-hi">{error}</p>
                )}

                {generate.isPending && (
                    <div className="space-y-3">
                        {[0, 1, 2].map((i) => (
                            <Skeleton key={i} className="h-32 w-full" />
                        ))}
                    </div>
                )}

                {response?.drafts.map((d) => {
                    const profile = selectedId
                        ? getDemoProfile(selectedId)
                        : null;
                    const ctx: DraftContext | undefined = response
                        ? {
                              topFactors: prediction.data?.contributing_factors ?? [],
                              lastActiveDays: history
                                  ? daysSinceLastEvent(history)
                                  : null,
                              memoryUsed: Boolean(response.memory_used),
                              engagementUsed: Boolean(response.engagement_used),
                              displayName: profile?.displayName,
                              bio: profile?.bio || undefined,
                          }
                        : undefined;
                    return (
                        <DraftCard
                            key={String(d.draft_id)}
                            draft={d}
                            onThumb={onThumb}
                            onSend={onSend}
                            pending={event.isPending}
                            context={ctx}
                        />
                    );
                })}
                {response && (
                    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
                            Recommended approach
                        </h4>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-text-2">
                            {RECOMMENDED_APPROACH_BULLETS.map((b) => (
                                <li key={b}>{b}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
            <div className="px-6 pb-6">
                <FollowUpActivity
                    participantId={selectedId}
                    cohortId={cohort.id}
                />
            </div>
        </Card>
    );
}

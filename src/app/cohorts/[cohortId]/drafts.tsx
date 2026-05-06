"use client";

import { useMemo, useState } from "react";

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
import { DraftCard } from "@/components/draft-card";
import {
    useEvent,
    useGenerate,
    useParticipantPrediction,
    useThumb,
} from "@/lib/hooks/api";
import { syntheticFeatures } from "@/lib/demo-features";
import { useUiStore } from "@/lib/store/uiStore";
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
    const features = useMemo(
        () => (selectedId ? syntheticFeatures(selectedId) : null),
        [selectedId],
    );
    const prediction = useParticipantPrediction(features);

    const [activityType, setActivityType] = useState<ActivityType>("GoalSetting");
    const [postText, setPostText] = useState("");
    const [response, setResponse] = useState<GenerateResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const generate = useGenerate();
    const thumb = useThumb();
    const event = useEvent();

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
        setError(null);
        const body: GenerateRequest = {
            participant_id: Number(
                String(selectedId).replace(/[^0-9]/g, "") || "0",
            ),
            cohort_id: cohort.id,
            module_id: cohort.moduleId,
            activity_type: activityType,
            post_text: postText,
            display_name: String(selectedId),
            engagement: prediction.data
                ? {
                      dropout_risk: prediction.data.dropout_risk,
                      risk_level: prediction.data.risk_level,
                      current_inactive_streak: features?.features
                          .current_inactive_streak as number | undefined,
                      days_since_last_login: features?.features
                          .days_since_last_login as number | undefined,
                      cum_login_count: features?.features
                          .cum_login_count as number | undefined,
                      engagement_slope: features?.features
                          .engagement_slope as number | undefined,
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
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {response.safety_signposting}
                    </div>
                )}
                {error && (
                    <p className="text-xs text-rose-600">{error}</p>
                )}

                {generate.isPending && (
                    <div className="space-y-3">
                        {[0, 1, 2].map((i) => (
                            <Skeleton key={i} className="h-32 w-full" />
                        ))}
                    </div>
                )}

                {response?.drafts.map((d) => (
                    <DraftCard
                        key={String(d.draft_id)}
                        draft={d}
                        onThumb={onThumb}
                        onSend={onSend}
                        pending={event.isPending}
                    />
                ))}
            </CardContent>
        </Card>
    );
}

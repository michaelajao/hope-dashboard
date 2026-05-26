"use client";

import { useEffect, useMemo, useState } from "react";

import { RefreshCcw, Sparkles } from "lucide-react";

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
import { getProfile } from "@/lib/profile";
import { useCohortBundle } from "@/lib/hooks/useCohortBundle";
import { bundleToHistory, findRealParticipant } from "@/lib/realCohort";
import {
    scoreAtDay as scoreAtDayForWeek,
    useScoringStore,
} from "@/lib/store/scoringStore";
import { useUiStore } from "@/lib/store/uiStore";
import { RECOMMENDED_APPROACH_BULLETS } from "@/lib/risk";
import { daysSinceLastEvent } from "@/lib/signals";
import type { CohortMeta } from "@/lib/cohorts";
import type {
    ActivityType,
    Draft,
    GenerateRequest,
    GenerateResponse,
    Persona,
} from "@/lib/api/commentGen";

const ACTIVITY_OPTIONS: ActivityType[] = [
    "GoalSetting",
    "Gratitude",
    "Emotions",
    "MyHOPE",
];

/**
 * Short, facilitator-friendly tab labels keyed by SLM persona. Replaces
 * the longer PersonaLabel ("Warm personal check-in") so the tabs stay
 * compact on the drafts column.
 */
const PERSONA_TAB_LABEL: Record<Persona, string> = {
    Empathetic: "Warm check-in",
    "Action-oriented": "Next-step nudge",
    "Goal-oriented": "Goal-focused",
};

const FACILITATOR_ID = "demo-facilitator";

export function Drafts({ cohort }: { cohort: CohortMeta }) {
    const selectedId = useUiStore((s) => s.selectedParticipantId);
    const bundle = useCohortBundle();
    const scoreAtWeek = useScoringStore((s) => s.scoreAtWeek);
    const scoreAt = scoreAtDayForWeek(scoreAtWeek);
    const history = useMemo(() => {
        if (!selectedId) return null;
        if (bundle.data) {
            const real = bundleToHistory(bundle.data, selectedId, scoreAt);
            if (real) return real;
        }
        return syntheticHistory(selectedId, scoreAt);
    }, [selectedId, bundle.data, scoreAt]);
    const prediction = useParticipantPrediction(history);

    const [activityType, setActivityType] = useState<ActivityType>("GoalSetting");
    const [postText, setPostText] = useState("");
    const [response, setResponse] = useState<GenerateResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    // Active persona tab — null means "first draft in response.drafts".
    // Reset whenever a new generation lands so the focus snaps to the
    // first persona for the new post.
    const [activePersona, setActivePersona] = useState<Persona | null>(null);
    // Provenance of the currently-loaded post. "auto" means the dashboard
    // populated it from the participant's most recent activity in the
    // bundle (mirrors the production flow where the platform feeds the
    // post automatically). "manual" means the facilitator edited or
    // pasted something; we then stop auto-populating until participant /
    // week changes.
    const [postSource, setPostSource] = useState<"auto" | "manual">("auto");
    // Cohort-relative day-of-post for the most recent activity, surfaced
    // as a small badge ("from 6d ago") so facilitators know they're
    // looking at the latest post and not a stale paste.
    const [autoPostDaysAgo, setAutoPostDaysAgo] = useState<number | null>(null);

    // Derive the participant's most recent post within the current
    // scoring window so the drafts column auto-loads instead of asking
    // the facilitator to paste. Production: platform fires /generate on
    // each new participant post. Dashboard mimics that by pulling the
    // newest `activity` event with a non-empty description.
    const recentPost = useMemo(() => {
        if (!history) return null;
        const acts = history.events
            .filter(
                (e) =>
                    e.event_type === "activity" &&
                    typeof e.description === "string" &&
                    e.description.trim().length > 0,
            )
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        const latest = acts[0];
        if (!latest) return null;
        const now = Date.now();
        const ageMs = now - new Date(latest.timestamp).getTime();
        const daysAgo = Math.max(0, Math.floor(ageMs / 86_400_000));
        const at: ActivityType =
            (latest.activity_type as ActivityType | undefined) ?? "GoalSetting";
        return {
            text: (latest.description ?? "").trim(),
            activityType: at,
            daysAgo,
        };
    }, [history]);

    // Auto-fill on participant/week change (only when the field is in
    // "auto" mode — we don't want to clobber a half-edited draft).
    useEffect(() => {
        if (postSource !== "auto") return;
        if (!recentPost) {
            setPostText("");
            setAutoPostDaysAgo(null);
            return;
        }
        setPostText(recentPost.text);
        setActivityType(recentPost.activityType);
        setAutoPostDaysAgo(recentPost.daysAgo);
    }, [recentPost, postSource]);

    // Switching participants resets the source back to auto so the next
    // participant's most-recent-post lands automatically.
    useEffect(() => {
        setPostSource("auto");
        setResponse(null);
        setActivePersona(null);
        setError(null);
    }, [selectedId]);

    const generate = useGenerate();
    const thumb = useThumb();
    const event = useEvent();

    // Best-effort: seed prior posts the first time we open this
    // participant's panel, so the next /generate has memory to retrieve.
    // When the real cohort bundle is present, seeds come from the actual
    // platform export (activity descriptions + facilitator replies); when
    // it isn't, falls back to the synthetic SEED_TEMPLATES so a fresh
    // clone still demos memory retrieval.
    //
    // Idempotent (de-duped inside seedDemoMemory) and silent on failure
    // (comment-gen offline = no-op via the proxy's degrade-to-skipped).
    useEffect(() => {
        if (!selectedId) return;
        const real = bundle.data
            ? findRealParticipant(bundle.data, selectedId)
            : null;
        seedDemoMemory(selectedId, cohort.id, cohort.moduleId, real ?? null);
    }, [selectedId, cohort.id, cohort.moduleId, bundle.data]);

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
        const profile = getProfile(selectedId, bundle.data ?? null);
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
            onSuccess: (res) => {
                setResponse(res);
                // Reset focus to the first draft on each new generation.
                setActivePersona(res.drafts[0]?.persona ?? null);
            },
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

    const profile = getProfile(selectedId, bundle.data ?? null);
    const displayName = profile.displayName;
    const firstName = displayName.split(/\s+/)[0] ?? displayName;

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <CardTitle className="text-base">
                        Outreach
                        <span className="ml-2 font-normal text-muted">
                            · {firstName}
                        </span>
                    </CardTitle>
                    {response?.model_version && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-accent-ink">
                            <Sparkles className="h-3.5 w-3.5" aria-hidden />
                            Drafted by SLM
                        </span>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted">
                            Participant post
                        </label>
                        {postSource === "auto" && autoPostDaysAgo !== null && (
                            <span className="text-xs text-muted">
                                from{" "}
                                {autoPostDaysAgo === 0
                                    ? "today"
                                    : `${autoPostDaysAgo}d ago`}
                                {" · "}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPostSource("manual");
                                        setPostText("");
                                    }}
                                    className="text-accent-ink hover:underline"
                                >
                                    clear
                                </button>
                            </span>
                        )}
                        {postSource === "manual" && recentPost && (
                            <button
                                type="button"
                                onClick={() => setPostSource("auto")}
                                className="text-xs text-accent-ink hover:underline"
                            >
                                Use most recent post
                            </button>
                        )}
                    </div>
                    <Textarea
                        rows={4}
                        value={postText}
                        onChange={(e) => {
                            setPostText(e.target.value);
                            setPostSource("manual");
                        }}
                        placeholder={
                            recentPost
                                ? "Auto-loaded from the most recent post. Edit if needed."
                                : "No recent post in this scoring window — paste one to generate drafts."
                        }
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Select
                        value={activityType}
                        onChange={(e) =>
                            setActivityType(e.target.value as ActivityType)
                        }
                        aria-label="Activity type"
                        className="w-auto flex-shrink-0"
                    >
                        {ACTIVITY_OPTIONS.map((a) => (
                            <option key={a} value={a}>
                                {a}
                            </option>
                        ))}
                    </Select>
                    <Button
                        onClick={onGenerate}
                        disabled={!postText.trim() || generate.isPending}
                        className="flex-1 gap-1.5"
                    >
                        {response ? (
                            <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
                        ) : null}
                        {generate.isPending
                            ? "Generating…"
                            : response
                              ? "Regenerate"
                              : "Generate drafts"}
                    </Button>
                </div>

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

                {response && (() => {
                    const drafts = response.drafts;
                    if (drafts.length === 0) return null;
                    const current: Draft =
                        drafts.find((d) => d.persona === activePersona) ??
                        drafts[0];
                    const ctx: DraftContext = {
                        topFactors: prediction.data?.contributing_factors ?? [],
                        lastActiveDays: history
                            ? daysSinceLastEvent(history)
                            : null,
                        memoryUsed: Boolean(response.memory_used),
                        engagementUsed: Boolean(response.engagement_used),
                        displayName: profile.displayName,
                        bio: profile.bio || undefined,
                    };
                    return (
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                                    Suggested tone
                                </span>
                                <div
                                    role="tablist"
                                    aria-label="Draft tone"
                                    className="flex flex-wrap gap-1 rounded-md bg-surface-2 p-1"
                                >
                                    {drafts.map((d) => {
                                        const isActive =
                                            d.persona === current.persona;
                                        const ariaSelected: "true" | "false" =
                                            isActive ? "true" : "false";
                                        return (
                                            <button
                                                key={String(d.draft_id)}
                                                role="tab"
                                                aria-selected={ariaSelected}
                                                type="button"
                                                onClick={() =>
                                                    setActivePersona(d.persona)
                                                }
                                                className={
                                                    "flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors " +
                                                    (isActive
                                                        ? "bg-surface text-text shadow-sm"
                                                        : "text-muted hover:text-text-2")
                                                }
                                            >
                                                {PERSONA_TAB_LABEL[d.persona] ??
                                                    d.persona}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <DraftCard
                                key={String(current.draft_id)}
                                draft={current}
                                onThumb={onThumb}
                                onSend={onSend}
                                onRegenerate={onGenerate}
                                regenerating={generate.isPending}
                                pending={event.isPending}
                                context={ctx}
                                recipientName={displayName}
                            />
                        </div>
                    );
                })()}
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

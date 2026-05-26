"use client";

import { useEffect, useMemo, useState } from "react";

import { RefreshCcw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
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

/**
 * Classify a /generate failure into a facilitator-friendly state.
 *
 * The dashboard sees three real failure modes:
 *  - comment-gen Space unreachable (HF 404, ECONNREFUSED, fetch failed)
 *  - session expired / not authenticated (401)
 *  - anything else — surface the raw detail so we can debug
 *
 * Returning a structured shape lets the UI render an actionable card
 * instead of a stack-trace string in front of facilitators.
 */
type GenerateErrorState = {
    tone: "offline" | "auth" | "error";
    title: string;
    body: string;
};

function classifyGenerateError(message: string): GenerateErrorState {
    const m = message.toLowerCase();
    if (
        m.includes("401") ||
        m.includes("unauthorized") ||
        m.includes("not authenticated")
    ) {
        return {
            tone: "auth",
            title: "Sign in again",
            body: "Your session expired. Refresh the page and sign in to generate drafts.",
        };
    }
    if (
        m.includes("404") ||
        m.includes("not found") ||
        m.includes("econnrefused") ||
        m.includes("fetch failed") ||
        m.includes("failed to fetch") ||
        m.includes("network") ||
        m.includes("etimedout") ||
        m.includes("500") ||
        m.includes("502") ||
        m.includes("503") ||
        m.includes("504") ||
        m.includes("internal server error") ||
        m.includes("bad gateway") ||
        m.includes("service unavailable") ||
        m.includes("gateway timeout")
    ) {
        return {
            tone: "offline",
            title: "Comment generation is offline",
            body: "The fine-tuned reply model isn't reachable right now. Risk scoring and activity views still work — try again once the Space is back.",
        };
    }
    return {
        tone: "error",
        title: "Couldn't generate drafts",
        body: message,
    };
}

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
        return syntheticHistory(
            selectedId,
            scoreAt,
            cohort.programmeLengthDays,
        );
    }, [selectedId, bundle.data, scoreAt, cohort.programmeLengthDays]);
    const prediction = useParticipantPrediction(history);

    // Capture "now" once at mount. Using Date.now() inside useMemo would
    // be impure (re-evaluating during a re-render could change the value
    // mid-render). Stable per-mount is what we want — recentPost.daysAgo
    // shouldn't tick mid-session.
    const [nowMs] = useState<number>(() => Date.now());

    const [response, setResponse] = useState<GenerateResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    // Active persona tab — null means "first draft in response.drafts".
    // Reset whenever a new generation lands so the focus snaps to the
    // first persona for the new post.
    const [activePersona, setActivePersona] = useState<Persona | null>(null);

    // Derive the participant's most recent post within the current
    // scoring window. The dashboard is read-only on the participant
    // side — production fires /generate via webhook when a participant
    // posts; here we mirror that by picking the newest `activity` event
    // with a non-empty description. Facilitators never paste; the
    // platform (or bundle stand-in) is the source.
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
        const ageMs = nowMs - new Date(latest.timestamp).getTime();
        const daysAgo = Math.max(0, Math.floor(ageMs / 86_400_000));
        const at: ActivityType =
            (latest.activity_type as ActivityType | undefined) ?? "GoalSetting";
        return {
            text: (latest.description ?? "").trim(),
            activityType: at,
            daysAgo,
        };
    }, [history, nowMs]);

    // Drafts column reads its inputs directly from the most recent
    // platform post — no facilitator pasting. activityType comes from
    // the post itself; postText is the post's description.
    const postText: string = recentPost?.text ?? "";
    const activityType: ActivityType =
        recentPost?.activityType ?? "GoalSetting";

    // Switching participants clears the response, active tab, and any
    // errors. These are legitimate side effects (not derived state) —
    // we're tearing down a previous-participant's generation result
    // when the user clicks a different participant.
    useEffect(() => {
        /* eslint-disable react-hooks/set-state-in-effect */
        setResponse(null);
        setActivePersona(null);
        setError(null);
        /* eslint-enable react-hooks/set-state-in-effect */
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

    // HITL signals: reject + flag. Both fire /event with the same
    // draft_set_id so comment-gen's DPO / KTO pipelines can join the
    // shown drafts with the facilitator's decision. Reject = "none of
    // these worked"; Flag = "this one is broken in a specific way"
    // (reason carries the canned-category + optional notes).
    function onReject(draftId: string) {
        if (!response) return;
        event.mutate({
            draft_set_id: response.draft_set_id,
            chosen_draft_id: draftId,
            action: "reject",
            facilitator_id: FACILITATOR_ID,
        });
    }

    function onFlag(draftId: string, reason: string) {
        if (!response) return;
        event.mutate({
            draft_set_id: response.draft_set_id,
            chosen_draft_id: draftId,
            action: "flag",
            flag_reason: reason,
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
                {recentPost ? (
                    <div className="space-y-2">
                        <div className="flex items-baseline justify-between gap-2">
                            <label className="text-xs font-semibold uppercase tracking-wide text-muted">
                                Participant post
                            </label>
                            <span className="text-xs text-muted">
                                from{" "}
                                {recentPost.daysAgo === 0
                                    ? "today"
                                    : `${recentPost.daysAgo}d ago`}
                            </span>
                        </div>
                        <div className="rounded-md border border-border bg-surface-2 px-3 py-2.5">
                            <div className="mb-1.5 flex items-center gap-1.5">
                                <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-medium text-accent-ink">
                                    {recentPost.activityType}
                                </span>
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                                {recentPost.text}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-md border border-border bg-surface-2 px-3 py-6 text-center">
                        <p className="text-sm font-medium text-text-2">
                            Waiting for {firstName}&apos;s next post
                        </p>
                        <p className="mt-1 text-xs text-muted">
                            No activity in the current scoring window — drafts
                            will appear here when {firstName} posts next.
                        </p>
                    </div>
                )}
                <Button
                    onClick={onGenerate}
                    disabled={!postText.trim() || generate.isPending}
                    className="w-full gap-1.5"
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

                {response?.safety_signposting && (
                    <div className="rounded-md border border-risk-md bg-risk-md-bg px-3 py-2 text-xs text-risk-md">
                        {response.safety_signposting}
                    </div>
                )}
                {error && (() => {
                    const state = classifyGenerateError(error);
                    const tone =
                        state.tone === "offline"
                            ? "border-muted bg-surface-2 text-text-2"
                            : state.tone === "auth"
                              ? "border-risk-md bg-risk-md-bg text-risk-md"
                              : "border-risk-hi bg-risk-hi-bg text-risk-hi";
                    return (
                        <div
                            role="status"
                            className={`rounded-md border px-3 py-2 text-xs ${tone}`}
                        >
                            <div className="font-medium">{state.title}</div>
                            <p className="mt-1 leading-relaxed">{state.body}</p>
                        </div>
                    );
                })()}

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
                                onReject={onReject}
                                onFlag={onFlag}
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
                    <details className="group rounded-lg border border-border bg-surface-2 px-3 py-2">
                        <summary className="flex cursor-pointer select-none items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
                            Recommended approach
                            <span className="text-[10px] text-muted/70 group-open:hidden">
                                show
                            </span>
                            <span className="hidden text-[10px] text-muted/70 group-open:inline">
                                hide
                            </span>
                        </summary>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-text-2">
                            {RECOMMENDED_APPROACH_BULLETS.map((b) => (
                                <li key={b}>{b}</li>
                            ))}
                        </ul>
                    </details>
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

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
import { DiscussionThread } from "@/components/discussion-thread";
import { FollowUpActivity } from "@/components/follow-up-activity";
import {
    useEvent,
    useGenerate,
    useParticipantPrediction,
    useThumb,
} from "@/lib/hooks/api";
import { demoEngagementContext, weekNumber } from "@/lib/demo-events";
import { seedDemoMemory } from "@/lib/demo-memory";
import { getProfile } from "@/lib/profile";
import { useCohortBundle } from "@/lib/hooks/useCohortBundle";
import {
    bundleToHistory,
    findRealParticipant,
    renderThreadContext,
} from "@/lib/realCohort";
import {
    scoreAtDay as scoreAtDayForWeek,
    useScoringStore,
} from "@/lib/store/scoringStore";
import { useUiStore } from "@/lib/store/uiStore";
import { DAY_MS, daysSinceLastEvent } from "@/lib/signals";
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

// Pure helpers extracted to ./drafts-helpers.ts so Vitest can import
// them in a Node environment without dragging in the React/Next tree.
import {
    classifyGenerateError,
    emailForDisengaged,
    firstContactTemplate,
    formatModelLabel,
} from "./drafts-helpers";

export function Drafts({ cohort }: { cohort: CohortMeta }) {
    const selectedId = useUiStore((s) => s.selectedParticipantId);
    const bundle = useCohortBundle(cohort.id);
    const scoreAtWeek = useScoringStore((s) => s.scoreAtWeek);
    const scoreAt = scoreAtDayForWeek(scoreAtWeek);
    const history = useMemo(() => {
        if (!selectedId || !bundle.data) return null;
        return bundleToHistory(bundle.data, selectedId, scoreAt);
    }, [selectedId, bundle.data, scoreAt]);
    const prediction = useParticipantPrediction(history, cohort.id);

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
    // "Write my own" mode: facilitator types from scratch and (optionally)
    // polishes with AI. Bypasses the persona generator entirely; the
    // existing DraftCard is reused with a synthesized blank draft so
    // Polish + Send wiring stays consistent.
    const [writeMode, setWriteMode] = useState(false);

    // Derive the participant's most recent post within the current
    // scoring window. The dashboard is read-only on the participant
    // side — production fires /generate via webhook when a participant
    // posts; here we mirror that by picking the newest `activity` event
    // with a non-empty description. Facilitators never paste; the
    // platform (or bundle stand-in) is the source.
    const selectedPostTs = useUiStore((s) => s.selectedPostTs);
    const recentPost = useMemo(() => {
        if (!history) return null;
        // Default auto-pick is the newest draftable ACTIVITY (the
        // primary flow). Discussion/forum posts are never auto-picked —
        // a facilitator opts into replying to one by clicking it in the
        // timeline (sets selectedPostTs).
        const acts = history.events
            .filter(
                (e) =>
                    e.event_type === "activity" &&
                    typeof e.description === "string" &&
                    e.description.trim().length > 0 &&
                    // Emotions removed 2026-05-27 — comment-gen rejects
                    // it (no training pairs). Skip so the auto-load picks
                    // the next-newest drafttable activity. The timeline
                    // still shows Emotions events; they just aren't AI-
                    // drafted. See RETRAIN.md §1.2.
                    e.activity_type !== "Emotions",
            )
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        // An explicit timeline pick may be an activity OR a forum post.
        const picked = selectedPostTs
            ? history.events.find(
                  (e) =>
                      e.timestamp === selectedPostTs &&
                      (e.event_type === "activity" ||
                          e.event_type === "discussion_post") &&
                      (e.description ?? "").trim().length > 0,
              )
            : undefined;
        const latest = picked ?? acts[0];
        if (!latest) return null;
        const ageMs = nowMs - new Date(latest.timestamp).getTime();
        const daysAgo = Math.max(0, Math.floor(ageMs / DAY_MS));
        const isDiscussion = latest.event_type === "discussion_post";
        // Forum posts are typed "Discussion" (server-side enum); cast
        // through unknown because the dashboard ActivityType union stays
        // narrow (GoalSetting/Gratitude/MyHOPE) by design.
        const at: ActivityType = isDiscussion
            ? ("Discussion" as unknown as ActivityType)
            : ((latest.activity_type as ActivityType | undefined) ??
              "GoalSetting");
        return {
            text: (latest.description ?? "").trim(),
            activityType: at,
            daysAgo,
            isDiscussion,
            topicId: latest.topic_id,
        };
    }, [history, nowMs, selectedPostTs]);

    // Drafts column reads its inputs directly from the most recent
    // platform post — no facilitator pasting. activityType comes from
    // the post itself; postText is the post's description.
    const postText: string = recentPost?.text ?? "";
    const activityType: ActivityType =
        recentPost?.activityType ?? "GoalSetting";
    const isDiscussionTarget = recentPost?.isDiscussion ?? false;
    const currentThread =
        isDiscussionTarget && recentPost?.topicId != null
            ? bundle.data?.discussionThreads?.[String(recentPost.topicId)]
            : undefined;

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

    // Best-effort: seed prior posts the first time this participant's panel
    // opens, so the next /generate has memory to retrieve. Seeds come from the
    // real cohort bundle (activity descriptions + facilitator replies). With no
    // bundle there's nothing to seed (the old synthetic-template path is
    // retired, SEED_TEMPLATES is empty).
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
        // For a forum-reply target, feed the reconstructed thread so the
        // model replies in context. Empty string for activity targets.
        const threadContext =
            isDiscussionTarget && bundle.data
                ? renderThreadContext(
                      bundle.data,
                      recentPost?.topicId,
                      postText,
                  )
                : "";
        const body: GenerateRequest & { thread_context?: string } = {
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
            ...(threadContext ? { thread_context: threadContext } : {}),
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
    const recipientEmail = emailForDisengaged(
        selectedId,
        cohort.id,
        prediction.data?.risk_level,
    );

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
                        <span
                            className="inline-flex items-center gap-1.5 text-xs text-accent-ink"
                            title={response.model_version}
                        >
                            <Sparkles className="h-3.5 w-3.5" aria-hidden />
                            Drafted by {formatModelLabel(response.model_version)}
                        </span>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {recentPost ? (
                    <div className="space-y-2">
                        <div className="flex items-baseline justify-between gap-2">
                            <label className="text-xs font-semibold uppercase tracking-wide text-muted">
                                {isDiscussionTarget ? "Forum post" : "Participant post"}
                            </label>
                            <span className="text-xs text-muted">
                                from{" "}
                                {recentPost.daysAgo === 0
                                    ? "today"
                                    : `${recentPost.daysAgo}d ago`}
                            </span>
                        </div>
                        {isDiscussionTarget && currentThread ? (
                            // Forum target: show the whole thread with the
                            // focal post highlighted, instead of the bare
                            // post card. The model gets the same thread as
                            // context via thread_context.
                            <DiscussionThread
                                thread={currentThread}
                                focalText={recentPost.text}
                            />
                        ) : (
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
                        )}
                    </div>
                ) : (
                    <div className="rounded-md border border-border bg-surface-2 px-3 py-6 text-center">
                        <p className="text-sm font-medium text-text-2">
                            {firstName} hasn&apos;t posted yet
                        </p>
                        <p className="mt-1 text-xs text-muted">
                            No activity in the current scoring window. For an
                            at-risk participant, a warm first check-in is the
                            highest-value early action — it&apos;s a
                            dropout-lowering signal in the model.
                        </p>
                        {!writeMode && (
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setWriteMode(true)}
                                className="mt-3 gap-1.5"
                            >
                                <Sparkles
                                    className="h-3.5 w-3.5"
                                    aria-hidden
                                />
                                Write a first check-in
                            </Button>
                        )}
                    </div>
                )}
                <div className="flex gap-2">
                    <Button
                        onClick={onGenerate}
                        disabled={
                            !postText.trim() ||
                            generate.isPending ||
                            writeMode
                        }
                        className="flex-1 gap-1.5"
                    >
                        {response ? (
                            <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
                        ) : null}
                        {generate.isPending
                            ? "Generating…"
                            : response
                              ? "Regenerate"
                              : isDiscussionTarget
                                ? "Generate reply"
                                : "Generate drafts"}
                    </Button>
                    <Button
                        type="button"
                        variant={writeMode ? "primary" : "secondary"}
                        onClick={() => setWriteMode((v) => !v)}
                        disabled={generate.isPending}
                        title={
                            writeMode
                                ? "Back to AI-drafted personas"
                                : "Write your own reply from scratch (still gets the Polish button)"
                        }
                        className="whitespace-nowrap gap-1.5"
                    >
                        {writeMode ? "Use AI drafts" : "Write my own"}
                    </Button>
                </div>

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

                {writeMode && (() => {
                    // Synthesize a blank Draft so DraftCard's existing
                    // textarea + Polish + Send wiring is reused as-is.
                    // The "AI persona" framing is hidden by giving the
                    // synthetic draft a neutral label and rendering
                    // without persona tabs above.
                    const blankDraft: Draft = {
                        persona: "Empathetic",
                        label: "Warm personal check-in",
                        // No post to reply to → seed a warm first-contact
                        // message the facilitator can edit (act on a silent
                        // at-risk participant). With a post, start blank —
                        // they're writing a custom reply to it.
                        body: recentPost
                            ? ""
                            : firstContactTemplate(firstName),
                        draft_id: ("00000000-0000-0000-0000-" +
                            String(selectedId)
                                .padStart(12, "0")
                                .slice(-12)) as unknown as Draft["draft_id"],
                    };
                    const ctx: DraftContext = {
                        topFactors: prediction.data?.contributing_factors ?? [],
                        lastActiveDays: history
                            ? daysSinceLastEvent(history)
                            : null,
                        memoryUsed: false,
                        engagementUsed: false,
                        displayName: profile.displayName,
                    };
                    return (
                        <div className="space-y-3">
                            <div className="flex items-center gap-1.5 text-xs text-muted">
                                <Sparkles
                                    className="h-3 w-3 text-accent-ink"
                                    aria-hidden
                                />
                                Write your reply below. Click the wand to
                                polish spelling, grammar, and tone.
                            </div>
                            <DraftCard
                                key={`writemode-${selectedId}`}
                                draft={blankDraft}
                                onThumb={() => {
                                    /* no AI to rate */
                                }}
                                onSend={onSend}
                                pending={event.isPending}
                                context={ctx}
                                recipientName={displayName}
                                recipientEmail={recipientEmail}
                                participantId={Number(
                                    String(selectedId).replace(/[^0-9]/g, "") ||
                                        "0",
                                )}
                            />
                        </div>
                    );
                })()}

                {!writeMode && response && (() => {
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
                            {/* Persona tabs only when the model returned
                                multiple drafts. Forum replies come back as
                                a single warm reply — no tone choice. */}
                            {drafts.length > 1 && (
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
                                            return (
                                                <button
                                                    key={String(d.draft_id)}
                                                    role="tab"
                                                    aria-selected={isActive}
                                                    type="button"
                                                    onClick={() =>
                                                        setActivePersona(
                                                            d.persona,
                                                        )
                                                    }
                                                    className={
                                                        "flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors " +
                                                        (isActive
                                                            ? "bg-surface text-text shadow-sm"
                                                            : "text-muted hover:text-text-2")
                                                    }
                                                >
                                                    {PERSONA_TAB_LABEL[
                                                        d.persona
                                                    ] ?? d.persona}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
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
                                recipientEmail={recipientEmail}
                                participantId={Number(
                                    String(selectedId).replace(/[^0-9]/g, "") || "0",
                                )}
                            />
                        </div>
                    );
                })()}
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

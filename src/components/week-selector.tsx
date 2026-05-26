"use client";

import {
    PROGRAMME_WEEKS,
    useScoringStore,
    type ProgrammeWeek,
} from "@/lib/store/scoringStore";

/**
 * Cohort-level scoring-week control.
 *
 * Engagement_ml ships per-horizon bundles for T ∈ {7, 14, 21, 28, 35, 42}
 * days — i.e. weeks 1..6. Default is week 6 (end of programme). Changing
 * the week causes the queue /batch + detail /predict + drafts engagement
 * context to refetch with the new score_at_day. Lets the facilitator
 * replay how the cohort looked at any earlier checkpoint, which is how
 * the real platform would call the API every Monday.
 */
export function WeekSelector() {
    const week = useScoringStore((s) => s.scoreAtWeek);
    const setWeek = useScoringStore((s) => s.setScoreAtWeek);

    return (
        <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Programme week to score at"
        >
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
                Score at week
            </span>
            <div
                className="inline-flex items-center rounded-md bg-surface-2 p-0.5"
                role="radiogroup"
                aria-label="Programme week"
            >
                {PROGRAMME_WEEKS.map((w: ProgrammeWeek) => {
                    const isActive = w === week;
                    return (
                        <button
                            key={w}
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            onClick={() => setWeek(w)}
                            className={
                                "min-w-[2rem] rounded px-2 py-1 text-xs font-medium transition-colors " +
                                (isActive
                                    ? "bg-surface text-text shadow-sm"
                                    : "text-muted hover:text-text-2")
                            }
                        >
                            W{w}
                        </button>
                    );
                })}
            </div>
            <span className="text-xs text-muted">
                ({week === 6 ? "end of programme" : `day ${week * 7}`})
            </span>
        </div>
    );
}

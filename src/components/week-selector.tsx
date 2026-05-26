"use client";

import { useEffect, useMemo } from "react";

import {
    availableWeeks,
    MODEL_MAX_HORIZON_DAYS,
    useScoringStore,
    type ProgrammeWeek,
} from "@/lib/store/scoringStore";

/**
 * Cohort-level scoring-week control.
 *
 * The set of selectable weeks comes from the cohort itself, not a fixed
 * 1..6 list. A 4-week pilot shows W1..W4 pills; a 12-week programme
 * shows W1..W6 (the model only ships trained bundles up to T=42) plus
 * a small note that longer programmes anchor at W6.
 *
 * Changing the week causes the queue's /batch call, every detail
 * /predict call, and the drafts column's engagement context to refire
 * with the new score_at_day — facilitators can replay how the cohort
 * looked at any earlier checkpoint.
 */
export function WeekSelector({
    programmeLengthDays,
}: {
    programmeLengthDays: number;
}) {
    const week = useScoringStore((s) => s.scoreAtWeek);
    const setWeek = useScoringStore((s) => s.setScoreAtWeek);
    const clamp = useScoringStore((s) => s.clampToProgrammeLength);

    const weeks = useMemo(
        () => availableWeeks(programmeLengthDays),
        [programmeLengthDays],
    );

    // If the cohort's length is shorter than the current selection (or
    // the user switches cohorts in a multi-cohort future), pull the
    // selection in to the nearest valid week so the slider never points
    // at a horizon the cohort doesn't have.
    useEffect(() => {
        clamp(programmeLengthDays);
    }, [programmeLengthDays, clamp]);

    const cappedByModel =
        programmeLengthDays > MODEL_MAX_HORIZON_DAYS;

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
                {weeks.map((w: ProgrammeWeek) => {
                    const isActive = w === week;
                    const ariaChecked: "true" | "false" = isActive
                        ? "true"
                        : "false";
                    return (
                        <button
                            key={w}
                            type="button"
                            role="radio"
                            aria-checked={ariaChecked}
                            onClick={() => setWeek(w)}
                            className={
                                "min-w-8 rounded px-2 py-1 text-xs font-medium transition-colors " +
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
                ({week === weeks[weeks.length - 1]
                    ? "end of programme"
                    : `day ${week * 7}`}
                {cappedByModel ? " · model capped at W6" : ""})
            </span>
        </div>
    );
}

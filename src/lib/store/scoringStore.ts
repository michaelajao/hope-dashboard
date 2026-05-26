"use client";

import { create } from "zustand";

/**
 * Programme week the cohort is currently being scored at. Maps directly
 * onto engagement_ml's `score_at_day = week * 7`.
 *
 * The model only ships trained horizons at T ∈ {7, 14, 21, 28, 35, 42}.
 * Cohorts longer than 6 weeks still work — the API anchors any
 * `score_at_day > 42` back to T=42 and discloses it in the response —
 * but the dashboard's week selector exposes the trained horizons
 * directly, so the user only picks values the model has bundles for.
 * `availableWeeks(programmeLengthDays)` returns the right pill set per
 * cohort.
 */

/** Set of horizons engagement_ml ships bundles for. */
export const MODEL_HORIZONS_DAYS = [7, 14, 21, 28, 35, 42] as const;
export const MODEL_MAX_HORIZON_DAYS = 42;
export const MODEL_MAX_WEEK = 6;

export type ProgrammeWeek = (typeof MODEL_HORIZONS_DAYS)[number] extends number
    ? 1 | 2 | 3 | 4 | 5 | 6
    : never;

export const DEFAULT_PROGRAMME_WEEK: ProgrammeWeek = 6;

const SCORE_AT_DAY_BY_WEEK: Record<ProgrammeWeek, number> = {
    1: 7,
    2: 14,
    3: 21,
    4: 28,
    5: 35,
    6: 42,
};

/** Convenience for callers that want the raw day for a given week. */
export function scoreAtDay(week: ProgrammeWeek): number {
    return SCORE_AT_DAY_BY_WEEK[week];
}

/**
 * Weeks selectable for a cohort of length `programmeLengthDays`.
 *
 *   4-week cohort  (28 days) → [1, 2, 3, 4]
 *   6-week cohort  (42 days) → [1, 2, 3, 4, 5, 6]
 *   12-week cohort (84 days) → [1, 2, 3, 4, 5, 6]  (capped at model max)
 *
 * Always returns at least [1] so the UI never renders an empty selector.
 */
export function availableWeeks(programmeLengthDays: number): ProgrammeWeek[] {
    const weeks = Math.floor(programmeLengthDays / 7);
    const cap = Math.min(weeks, MODEL_MAX_WEEK);
    const out: ProgrammeWeek[] = [];
    for (let w = 1; w <= cap; w++) {
        out.push(w as ProgrammeWeek);
    }
    return out.length > 0 ? out : [1 as ProgrammeWeek];
}

type ScoringState = {
    scoreAtWeek: ProgrammeWeek;
    setScoreAtWeek: (week: ProgrammeWeek) => void;
    /** Clamp the current selection to the cohort's available weeks. Call
     *  when the cohort changes (or the cohort meta refreshes) to make
     *  sure the slider isn't pointing at a week the cohort doesn't have. */
    clampToProgrammeLength: (programmeLengthDays: number) => void;
};

export const useScoringStore = create<ScoringState>((set, get) => ({
    scoreAtWeek: DEFAULT_PROGRAMME_WEEK,
    setScoreAtWeek: (week) => set({ scoreAtWeek: week }),
    clampToProgrammeLength: (programmeLengthDays: number) => {
        const weeks = availableWeeks(programmeLengthDays);
        const max = weeks[weeks.length - 1];
        if (get().scoreAtWeek > max) {
            set({ scoreAtWeek: max });
        }
    },
}));

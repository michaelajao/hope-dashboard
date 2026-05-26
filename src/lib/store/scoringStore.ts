"use client";

import { create } from "zustand";

/**
 * Programme week the cohort is currently being scored at. Maps directly
 * onto engagement_ml's `score_at_day = week * 7`. Per-horizon bundles
 * are trained for T ∈ {7, 14, 21, 28, 35, 42}, so the dashboard exposes
 * weeks 1..6.
 *
 * Default = 6 (end-of-programme). Changing the week causes the queue's
 * /batch call, every detail /predict call, and the drafts column's
 * engagement context to refire with the new score_at_day — facilitators
 * can replay how the cohort looked at any earlier checkpoint without
 * code changes.
 */

export const PROGRAMME_WEEKS = [1, 2, 3, 4, 5, 6] as const;
export type ProgrammeWeek = (typeof PROGRAMME_WEEKS)[number];

export const DEFAULT_PROGRAMME_WEEK: ProgrammeWeek = 6;

export const SCORE_AT_DAY_FOR_WEEK: Record<ProgrammeWeek, number> = {
    1: 7,
    2: 14,
    3: 21,
    4: 28,
    5: 35,
    6: 42,
};

type ScoringState = {
    scoreAtWeek: ProgrammeWeek;
    setScoreAtWeek: (week: ProgrammeWeek) => void;
};

export const useScoringStore = create<ScoringState>((set) => ({
    scoreAtWeek: DEFAULT_PROGRAMME_WEEK,
    setScoreAtWeek: (week) => set({ scoreAtWeek: week }),
}));

/** Convenience for callers that want the raw day. */
export function scoreAtDay(week: ProgrammeWeek): number {
    return SCORE_AT_DAY_FOR_WEEK[week];
}

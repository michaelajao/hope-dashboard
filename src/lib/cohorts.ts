/**
 * Known cohorts for the dashboard. v0 hardcodes the IIH demo cohort
 * (master plan §7); future versions can hydrate from
 * dropout_ml_v2/outputs/artifacts/cohort_meta.parquet via a server action.
 */

export type CohortMeta = {
    id: number;
    code: string;
    moduleId: number;
    moduleName: string;
    /** Synthetic participant ids and weeks for the demo. The dashboard's
     * dropout-API client expects `ParticipantFeatures` with a feature dict;
     * v0 generates a small synthetic feature set per participant so the
     * dashboard can render even without an active platform feed. */
    demoParticipants: string[];
};

export const COHORTS: CohortMeta[] = [
    {
        id: 1680,
        code: "IIH-COH12-110226",
        moduleId: 337,
        moduleName: "People living with IIH 2025 — V1",
        demoParticipants: [
            "iih-coh12-001",
            "iih-coh12-002",
            "iih-coh12-003",
            "iih-coh12-004",
            "iih-coh12-005",
            "iih-coh12-006",
        ],
    },
];

export function findCohort(id: number): CohortMeta | undefined {
    return COHORTS.find((c) => c.id === id);
}

"use client";

import { useMemo } from "react";

import { KpiTile } from "@/components/kpi-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { useCohortBatch } from "@/lib/hooks/api";
import { syntheticBatch } from "@/lib/demo-events";
import type { CohortMeta } from "@/lib/cohorts";

export function CohortHeader({ cohort }: { cohort: CohortMeta }) {
    const histories = useMemo(
        () => syntheticBatch(cohort.demoParticipants),
        [cohort.demoParticipants],
    );
    const { data, isLoading } = useCohortBatch(histories);

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24" />
                ))}
            </div>
        );
    }
    const total = data?.total ?? 0;
    const high = data?.high ?? 0;
    const med = data?.medium ?? 0;
    const low = data?.low ?? 0;

    return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiTile label="Total participants" value={total} />
            <KpiTile
                label="High risk"
                value={high}
                accent="high"
                hint={total ? `${((high / total) * 100).toFixed(0)}% of cohort` : ""}
            />
            <KpiTile
                label="Medium risk"
                value={med}
                accent="medium"
            />
            <KpiTile label="Low risk" value={low} accent="low" />
        </div>
    );
}

"use client";

import { useMemo, useState } from "react";
import { Flag, MessageCircle, TrendingUp, Users } from "lucide-react";
import { useQueries } from "@tanstack/react-query";

import { KpiTile } from "@/components/kpi-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { useCohortBatch } from "@/lib/hooks/api";
import { syntheticBatch } from "@/lib/demo-events";
import type { CohortMeta } from "@/lib/cohorts";
import type { MemoryEntry } from "@/lib/api/commentGen";

const WEEK_MS = 7 * 86_400_000;

// Captured once at mount; "this week" tolerates second-level drift, and
// React purity rules forbid Date.now() inside render/useMemo.
function useMountTime(): number {
    const [t] = useState(() => Date.now());
    return t;
}

async function getJSON<T>(path: string): Promise<T> {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
    return res.json() as Promise<T>;
}

export function CohortHeader({ cohort }: { cohort: CohortMeta }) {
    const histories = useMemo(
        () => syntheticBatch(cohort.demoParticipants),
        [cohort.demoParticipants],
    );
    const { data, isLoading } = useCohortBatch(histories);

    // Aggregate memory across all participants in the cohort to count how
    // many facilitator messages have landed in the last 7 days.
    const memoryQueries = useQueries({
        queries: cohort.demoParticipants.map((pid) => ({
            queryKey: ["memory", pid, cohort.id],
            queryFn: () =>
                getJSON<MemoryEntry[]>(
                    `/api/proxy/memory/${pid}?cohort_id=${cohort.id}&limit=10`,
                ),
            staleTime: 5 * 60 * 1000,
        })),
    });

    const mountTime = useMountTime();
    const contactedThisWeek = useMemo(() => {
        const since = mountTime - WEEK_MS;
        let n = 0;
        for (const q of memoryQueries) {
            const entries = q.data ?? [];
            for (const m of entries) {
                if (m.role !== "facilitator_reply") continue;
                if (m.ts && new Date(m.ts).getTime() >= since) n += 1;
            }
        }
        return n;
    }, [memoryQueries, mountTime]);

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24" />
                ))}
            </div>
        );
    }

    const high = data?.high ?? 0;
    const med = data?.medium ?? 0;
    const needsFollowUp = high + med;

    return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiTile
                label="Need follow-up"
                value={needsFollowUp}
                accent="neutral"
                icon={Users}
            />
            <KpiTile
                label="High priority"
                value={high}
                accent="high"
                icon={Flag}
            />
            <KpiTile
                label="Contacted this week"
                value={contactedThisWeek}
                accent="neutral"
                icon={MessageCircle}
            />
            <KpiTile
                label="Re-engaged"
                value="—"
                hint="tracking starts next week"
                accent="neutral"
                icon={TrendingUp}
            />
        </div>
    );
}

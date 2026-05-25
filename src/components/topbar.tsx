"use client";

import { useMemo } from "react";
import Link from "next/link";

import { useCohortBatch } from "@/lib/hooks/api";
import { syntheticBatch } from "@/lib/demo-events";
import { useSessionStatsStore } from "@/lib/store/sessionStatsStore";
import type { CohortMeta } from "@/lib/cohorts";

type TopbarProps = {
    cohort: CohortMeta;
};

export function Topbar({ cohort }: TopbarProps) {
    const histories = useMemo(
        () => syntheticBatch(cohort.demoParticipants),
        [cohort.demoParticipants],
    );
    const { data } = useCohortBatch(histories);
    const sentThisSession = useSessionStatsStore((s) => s.sentThisSession);

    const high = data?.high ?? 0;
    const medium = data?.medium ?? 0;
    const needsFollowUp = high + medium;

    return (
        <header className="flex items-center gap-4 border-b border-border bg-surface px-5 py-3">
            <Link
                href="/cohorts"
                className="flex items-center gap-2.5"
                aria-label="hope·move home"
            >
                <span className="grid h-6 w-6 place-items-center rounded-md bg-text text-[11px] font-bold text-surface">
                    h·
                </span>
                <span className="font-semibold tracking-tight text-text">
                    hope·move
                </span>
            </Link>
            <nav
                aria-label="breadcrumb"
                className="flex items-center gap-2 text-muted"
            >
                <span>Participant support</span>
                <span className="opacity-40" aria-hidden>
                    /
                </span>
                <span className="rounded border border-border px-1.5 py-0.5 text-xs text-text-2 font-mono">
                    {cohort.code}
                </span>
            </nav>
            <div className="ml-auto flex items-center gap-2">
                <StatPill value={needsFollowUp} label="need follow-up" />
                <StatPill value={high} label="high priority" />
                <StatPill value={sentThisSession} label="contacted this session" />
            </div>
        </header>
    );
}

function StatPill({ value, label }: { value: number; label: string }) {
    return (
        <div className="flex items-baseline gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5">
            <span className="text-sm font-semibold tracking-tight text-text tabular-nums">
                {value}
            </span>
            <span className="text-xs text-muted">{label}</span>
        </div>
    );
}

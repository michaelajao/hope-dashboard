"use client";

import { useMemo } from "react";
import Link from "next/link";

import { useCohortBatch } from "@/lib/hooks/api";
import { useCohortBundle } from "@/lib/hooks/useCohortBundle";
import { bundleParticipantIds, bundleToHistory } from "@/lib/realCohort";
import {
    scoreAtDay as scoreAtDayForWeek,
    useScoringStore,
} from "@/lib/store/scoringStore";
import { useSessionStatsStore } from "@/lib/store/sessionStatsStore";
import type { CohortMeta } from "@/lib/cohorts";
import type { ParticipantHistory } from "@/lib/api/dropout";

type TopbarProps = {
    cohort: CohortMeta;
};

export function Topbar({ cohort }: TopbarProps) {
    const bundle = useCohortBundle();
    const scoreAtWeek = useScoringStore((s) => s.scoreAtWeek);
    const scoreAt = scoreAtDayForWeek(scoreAtWeek);
    const histories = useMemo<ParticipantHistory[]>(() => {
        if (!bundle.data) return [];
        return bundleParticipantIds(bundle.data)
            .map((id) => bundleToHistory(bundle.data!, id, scoreAt))
            .filter((h): h is ParticipantHistory => h !== null);
    }, [bundle.data, scoreAt]);
    const { data } = useCohortBatch(histories, cohort.id);
    const sentThisSession = useSessionStatsStore((s) => s.sentThisSession);

    const high = data?.high ?? 0;
    const medium = data?.medium ?? 0;
    const needsFollowUp = high + medium;

    return (
        <header className="flex flex-col gap-3 border-b border-border bg-surface px-4 py-3 sm:px-5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-4">
            <div className="flex flex-wrap items-center gap-3">
                <Link
                    href="/cohorts"
                    className="flex shrink-0 items-center gap-2.5"
                    aria-label="hope·move home"
                >
                    <span className="grid h-6 w-6 place-items-center rounded-md bg-text text-[11px] font-bold text-surface">
                        h·
                    </span>
                    <span className="font-semibold tracking-tight text-text">
                        hope·move
                    </span>
                </Link>
                {process.env.NEXT_PUBLIC_AUTH_MODE === "open" && (
                    <span
                        title="AUTH_MODE=open — any email signs in. Flip to allowlist for production."
                        className="rounded-md border border-risk-md bg-risk-md-bg px-2 py-0.5 text-[11px] font-medium text-risk-md"
                    >
                        Testing mode
                    </span>
                )}
                <nav
                    aria-label="breadcrumb"
                    className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted"
                >
                    <span className="hidden sm:inline">Participant support</span>
                    <span
                        className="hidden opacity-40 sm:inline"
                        aria-hidden
                    >
                        /
                    </span>
                    <span className="truncate rounded border border-border px-1.5 py-0.5 text-xs text-text-2 font-mono">
                        {cohort.code}
                    </span>
                </nav>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
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

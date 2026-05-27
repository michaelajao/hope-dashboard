import { notFound } from "next/navigation";

import { findCohort } from "@/lib/cohorts";
import { CohortSessionReset } from "@/components/cohort-session-reset";
import { Topbar } from "@/components/topbar";
import { WeekSelector } from "@/components/week-selector";
import { Queue } from "./queue";
import { Detail } from "./detail";
import { Drafts } from "./drafts";
import { CohortGrid } from "./cohort-grid";

export default async function CohortDashboard({
    params,
}: {
    params: Promise<{ cohortId: string }>;
}) {
    const { cohortId } = await params;
    const cohort = findCohort(Number(cohortId));
    if (!cohort) notFound();

    return (
        <main className="flex w-full flex-1 flex-col">
            <CohortSessionReset cohortId={cohort.id} />
            <Topbar cohort={cohort} />
            <div className="border-b border-border bg-surface-2/40 px-4 py-2 sm:px-5">
                <WeekSelector programmeLengthDays={cohort.programmeLengthDays} />
            </div>
            <CohortGrid
                queue={<Queue cohort={cohort} />}
                detail={<Detail cohortId={cohort.id} />}
                drafts={<Drafts cohort={cohort} />}
            />
        </main>
    );
}

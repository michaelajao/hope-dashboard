import { notFound } from "next/navigation";

import { findCohort } from "@/lib/cohorts";
import { Topbar } from "@/components/topbar";
import { WeekSelector } from "@/components/week-selector";
import { Queue } from "./queue";
import { Detail } from "./detail";
import { Drafts } from "./drafts";

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
            <Topbar cohort={cohort} />
            <div className="border-b border-border bg-surface-2/40 px-4 py-2 sm:px-5">
                <WeekSelector />
            </div>
            <div className="grid flex-1 grid-cols-1 gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[18rem_1fr] xl:grid-cols-[18rem_1fr_22rem]">
                <Queue cohort={cohort} />
                <Detail cohortId={cohort.id} />
                <div className="lg:col-span-full xl:col-span-1">
                    <Drafts cohort={cohort} />
                </div>
            </div>
        </main>
    );
}

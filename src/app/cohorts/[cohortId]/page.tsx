import { notFound } from "next/navigation";

import { findCohort } from "@/lib/cohorts";
import { Topbar } from "@/components/topbar";
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
            <div className="grid flex-1 grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-[20rem_1fr_24rem]">
                <Queue cohort={cohort} />
                <Detail cohortId={cohort.id} />
                <Drafts cohort={cohort} />
            </div>
        </main>
    );
}

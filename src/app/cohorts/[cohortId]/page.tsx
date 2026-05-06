import { notFound } from "next/navigation";
import Link from "next/link";

import { findCohort } from "@/lib/cohorts";
import { Queue } from "./queue";
import { Detail } from "./detail";
import { Drafts } from "./drafts";
import { CohortHeader } from "./header";

export default async function CohortDashboard({
    params,
}: {
    params: Promise<{ cohortId: string }>;
}) {
    const { cohortId } = await params;
    const cohort = findCohort(Number(cohortId));
    if (!cohort) notFound();

    return (
        <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-6 py-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link
                        href="/cohorts"
                        className="text-xs text-slate-500 hover:text-slate-700"
                    >
                        ← All cohorts
                    </Link>
                    <h1 className="mt-1 text-xl font-semibold text-slate-900">
                        {cohort.code}
                    </h1>
                    <p className="text-sm text-slate-500">
                        {cohort.moduleName}
                    </p>
                </div>
            </div>
            <CohortHeader cohort={cohort} />
            <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr_24rem]">
                <Queue cohort={cohort} />
                <Detail cohortId={cohort.id} />
                <Drafts cohort={cohort} />
            </div>
        </main>
    );
}

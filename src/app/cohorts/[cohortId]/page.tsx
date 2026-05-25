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
            <section className="hope-header-band relative overflow-hidden rounded-xl border border-slate-200 bg-linear-to-br from-slate-50 to-slate-100 px-6 py-5 shadow-sm">
                <span
                    aria-hidden
                    className="hope-header-stripe absolute inset-y-0 left-0 w-1.5"
                />
                <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <Link
                                href="/cohorts"
                                className="text-xs text-slate-500 hover:text-slate-700"
                            >
                                ← All cohorts
                            </Link>
                            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                                Participant support
                            </h1>
                            <p className="mt-1 text-sm text-slate-600">
                                AI-supported participant follow-up for cohort{" "}
                                <span className="font-medium text-slate-800">
                                    {cohort.code}
                                </span>{" "}
                                · {cohort.moduleName}
                            </p>
                        </div>
                    </div>
                    <CohortHeader cohort={cohort} />
                </div>
            </section>
            <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr_24rem]">
                <Queue cohort={cohort} />
                <Detail cohortId={cohort.id} />
                <Drafts cohort={cohort} />
            </div>
        </main>
    );
}

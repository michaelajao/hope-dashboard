import Link from "next/link";

import { COHORTS } from "@/lib/cohorts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CohortsIndexPage() {
    return (
        <main className="mx-auto w-full max-w-5xl px-6 py-10">
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">
                        Cohorts
                    </h1>
                    <p className="text-sm text-slate-500">
                        Select a cohort to open the participant-support dashboard.
                    </p>
                </div>
            </header>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {COHORTS.map((c) => (
                    <Link key={c.id} href={`/cohorts/${c.id}`}>
                        <Card className="transition-shadow hover:shadow">
                            <CardHeader>
                                <CardTitle>{c.code}</CardTitle>
                                <CardDescription>
                                    {c.moduleName}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-slate-500">
                                    {c.demoParticipants.length} demo participants
                                </p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </main>
    );
}

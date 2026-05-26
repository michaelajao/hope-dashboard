import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { loadCohortBundle } from "@/lib/server/cohort-data";

/**
 * Returns the real Hope Move cohort bundle if `local/iih-coh12-110226.json`
 * is present, else 204. Client code (cohorts.ts, drafts.tsx, profile.ts)
 * falls back to the synthetic generators when the bundle is unavailable.
 *
 * Auth-gated so reviewers can't scrape real participant data via a bare
 * GET. AUTH_MODE=open still requires sign-in (any email).
 */
export async function GET() {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    const bundle = loadCohortBundle();
    if (!bundle) return new NextResponse(null, { status: 204 });
    return NextResponse.json(bundle);
}

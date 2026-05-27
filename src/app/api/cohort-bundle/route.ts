import { NextResponse } from "next/server";

import { loadCohortBundle } from "@/lib/server/cohort-data";

/**
 * Returns the real Hope Move cohort bundle if `local/iih-coh12-110226.json`
 * is present, else 204. Auth was previously enforced here so reviewers
 * couldn't scrape real participant data via a bare GET — gating is now
 * delegated to the platform layer that the Hope Move engineering team
 * will wire on the original platform, matching the prototype's
 * unauthenticated stance.
 */
export async function GET() {
    const bundle = loadCohortBundle();
    if (!bundle) return new NextResponse(null, { status: 204 });
    return NextResponse.json(bundle);
}

import { NextResponse, type NextRequest } from "next/server";

import { loadCohortBundle } from "@/lib/server/cohort-data";

/**
 * Returns the cohort bundle for `?cohortId=<id>` if present on disk, else
 * 204. Defaults to cohort 1680 (IIH-COH12) when the query param is missing
 * so prior single-cohort callers keep working without a code change.
 *
 * Auth is delegated to the platform layer that the Hope Move engineering
 * team will wire on the original platform, matching the prototype's
 * unauthenticated stance.
 */
export async function GET(req: NextRequest) {
    const raw = req.nextUrl.searchParams.get("cohortId");
    const cohortId = raw ? Number(raw) : 1680;
    if (!Number.isFinite(cohortId)) {
        return NextResponse.json(
            { detail: "cohortId must be a number" },
            { status: 400 },
        );
    }
    const bundle = loadCohortBundle(cohortId);
    if (!bundle) return new NextResponse(null, { status: 204 });
    return NextResponse.json(bundle);
}

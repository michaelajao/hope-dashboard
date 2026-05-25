import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import { commentGen } from "@/lib/api/server";

/**
 * Proxy → comment-gen `/memory/{participant_id}` for the activity feed.
 *
 * Degrades gracefully: when comment-gen is unreachable (laptop dev with
 * the SLM offline, network blip) we return `200 OK` with an empty list
 * instead of letting the upstream error bubble to the UI. The activity
 * feed then renders its "no follow-ups yet" empty state — facilitators
 * see a clean UI, not a console error.
 *
 * Real upstream errors (auth failures, malformed responses) still come
 * through with their original status so we don't paper over real bugs.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ participantId: string }> },
) {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    const { participantId } = await params;
    const cohort = req.nextUrl.searchParams.get("cohort_id");
    const limit = req.nextUrl.searchParams.get("limit");
    try {
        const data = await commentGen().debugMemory(
            Number(participantId),
            cohort != null ? Number(cohort) : undefined,
            limit != null ? Number(limit) : 10,
        );
        return NextResponse.json(data);
    } catch (err) {
        if (err instanceof ApiError) {
            // 404 from upstream = participant has no memory yet — return [].
            // 5xx / unreachable = treat as "comment-gen offline" — also [].
            if (err.status === 404 || err.status >= 500) {
                return NextResponse.json([]);
            }
            return NextResponse.json(
                { detail: err.detail, code: err.code },
                { status: err.status },
            );
        }
        // Fetch-layer failure (ECONNREFUSED etc.) — comment-gen unreachable.
        return NextResponse.json([]);
    }
}

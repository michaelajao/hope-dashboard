import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import { commentGen } from "@/lib/api/server";
import type { MemoryPostRequest } from "@/lib/api/commentGen";

/**
 * Proxy → comment-gen `/memory/post`.
 *
 * Writes a participant post (role=participant) into the memory store so
 * the next `/generate` call retrieves it. Used in two flows:
 *
 *  1. Demo seeding (`src/lib/demo-memory.ts`) — fills the store with
 *     plausible prior posts the first time a participant detail panel
 *     opens, so the SLM has context to draw from.
 *  2. Real-bundle seeding — when the cohort bundle is present, the
 *     participant's actual past activity descriptions are seeded the
 *     same way, mirroring what the platform webhook will do in prod.
 *
 * Degrades gracefully when comment-gen is offline so demo seeding never
 * blocks rendering.
 */
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    try {
        const body = (await req.json()) as MemoryPostRequest;
        const data = await commentGen().writeMemoryPost(body);
        return NextResponse.json(data);
    } catch (err) {
        if (err instanceof ApiError) {
            // 5xx / unreachable = comment-gen offline. Don't surface as a
            // dashboard error; demo seeding is best-effort.
            if (err.status >= 500) return NextResponse.json({ skipped: true });
            return NextResponse.json(
                { detail: err.detail, code: err.code },
                { status: err.status },
            );
        }
        // Fetch-layer failure (ECONNREFUSED etc.) — treat as offline.
        return NextResponse.json({ skipped: true });
    }
}

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import { commentGen } from "@/lib/api/server";
import type { MemoryReplyRequest } from "@/lib/api/commentGen";

/**
 * Proxy → comment-gen `/memory/reply`.
 *
 * Writes a facilitator reply (role=facilitator) into the memory store.
 * Mirror of `/memory/post` for the facilitator side of the conversation.
 * Used by real-bundle seeding to reconcile actual prior facilitator
 * comments — so the LLM's context includes the real conversational
 * back-and-forth, not just one side of it.
 */
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    try {
        const body = (await req.json()) as MemoryReplyRequest;
        const data = await commentGen().writeMemoryReply(body);
        return NextResponse.json(data);
    } catch (err) {
        if (err instanceof ApiError) {
            if (err.status >= 500) return NextResponse.json({ skipped: true });
            return NextResponse.json(
                { detail: err.detail, code: err.code },
                { status: err.status },
            );
        }
        return NextResponse.json({ skipped: true });
    }
}

import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api/client";
import { commentGen } from "@/lib/api/server";

// Auth removed — gating delegated to the Hope Move platform layer.
// Swaps the comment-gen Space's live LoRA adapter. Blocks until the
// new model is loaded (15–30s typical on the Space's free-tier GPU).
export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as { model_id: string };
        if (!body?.model_id) {
            return NextResponse.json(
                { detail: "model_id is required" },
                { status: 400 },
            );
        }
        const data = await commentGen().switchModel(body.model_id);
        return NextResponse.json(data);
    } catch (err) {
        if (err instanceof ApiError) {
            return NextResponse.json(
                { detail: err.detail, code: err.code },
                { status: err.status },
            );
        }
        return NextResponse.json(
            { detail: (err as Error).message },
            { status: 500 },
        );
    }
}

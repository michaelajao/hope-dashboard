import { NextResponse, type NextRequest } from "next/server";

import { commentGen } from "@/lib/api/server";
import { withApiErrors } from "../../_errors";

// Auth removed — gating delegated to the Hope Move platform layer.
// Swaps the comment-gen Space's live LoRA adapter. Blocks until the
// new model is loaded (15–30s typical on the Space's free-tier GPU).
export const POST = withApiErrors(async (req: NextRequest) => {
    const body = (await req.json()) as { model_id: string };
    if (!body?.model_id) {
        return NextResponse.json(
            { detail: "model_id is required" },
            { status: 400 },
        );
    }
    const data = await commentGen().switchModel(body.model_id);
    return NextResponse.json(data);
});

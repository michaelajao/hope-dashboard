import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api/client";
import { commentGen } from "@/lib/api/server";
import type { PolishRequest } from "@/lib/api/commentGen";

// Auth removed — gating delegated to the Hope Move platform layer.
// Forwards a facilitator-typed draft to comment-gen's /text/polish for
// grammar + spelling + rephrase. The Space's output filter runs
// `scrub_first_names` + `fill_name_slot` on the response so any
// memorised first names ("Sarah", "Sue") that leak from the LoRA are
// caught here too.
export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as PolishRequest;
        if (!body?.draft_text?.trim()) {
            return NextResponse.json(
                { detail: "draft_text is required" },
                { status: 400 },
            );
        }
        const data = await commentGen().polishText(body);
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

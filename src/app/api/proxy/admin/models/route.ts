import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/client";
import { commentGen } from "@/lib/api/server";

// Auth removed — gating delegated to the Hope Move platform layer.
// Lists the comment-gen adapters the Space knows about, surfaced as the
// dashboard's topbar model picker.
export async function GET() {
    try {
        const data = await commentGen().listModels();
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

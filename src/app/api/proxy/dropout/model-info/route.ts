import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/client";
import { dropoutApi } from "@/lib/api/server";

// Auth removed — gating delegated to the Hope Move platform layer.
// Surfaces the served risk-model metadata (family + per-horizon metrics
// from the engagement_ml deploy bundle) so the dashboard can show a
// "Risk: <family> @ T<horizon>" chip next to the week selector.
export async function GET() {
    try {
        const data = await dropoutApi().modelInfo();
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

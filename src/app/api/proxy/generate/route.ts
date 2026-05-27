import { NextResponse, type NextRequest } from "next/server";

import { commentGen } from "@/lib/api/server";
import { ApiError } from "@/lib/api/client";
import type { GenerateRequest } from "@/lib/api/commentGen";

// Auth removed — gating delegated to the Hope Move platform layer.
export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as GenerateRequest;
        const data = await commentGen().generate(body);
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

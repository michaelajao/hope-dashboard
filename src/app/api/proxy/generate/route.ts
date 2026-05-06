import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { commentGen } from "@/lib/api/server";
import { ApiError } from "@/lib/api/client";
import type { GenerateRequest } from "@/lib/api/commentGen";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
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

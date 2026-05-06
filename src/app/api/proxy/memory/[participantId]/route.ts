import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import { commentGen } from "@/lib/api/server";

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

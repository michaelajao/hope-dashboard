import { NextResponse, type NextRequest } from "next/server";

import { commentGen } from "@/lib/api/server";
import type { ThumbRequest } from "@/lib/api/commentGen";
import { withApiErrors } from "../_errors";

// Auth removed — gating delegated to the Hope Move platform layer.
export const POST = withApiErrors(async (req: NextRequest) => {
    const body = (await req.json()) as ThumbRequest;
    const data = await commentGen().thumb(body);
    return NextResponse.json(data);
});

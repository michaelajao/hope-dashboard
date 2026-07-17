import { NextResponse } from "next/server";

import { commentGen } from "@/lib/api/server";
import { withApiErrors } from "../../_errors";

// Auth removed — gating delegated to the Hope Move platform layer.
// Lists the comment-gen adapters the Space knows about, surfaced as the
// dashboard's topbar model picker.
export const GET = withApiErrors(async () => {
    const data = await commentGen().listModels();
    return NextResponse.json(data);
});

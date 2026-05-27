import { NextResponse } from "next/server";

// Auth is intentionally disabled for the dashboard prototype — the Hope Move
// engineering team will wire facilitator auth on the original platform. This
// middleware is a no-op so every route is reachable without a session.
export default function middleware() {
    return NextResponse.next();
}

export const config = {
    matcher: [],
};

import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
    const { nextUrl } = req;
    const isAuthed = Boolean(req.auth);
    const onLogin = nextUrl.pathname.startsWith("/login");

    if (onLogin) {
        if (isAuthed) {
            return NextResponse.redirect(new URL("/cohorts", nextUrl));
        }
        return NextResponse.next();
    }

    if (!isAuthed) {
        const url = new URL("/login", nextUrl);
        url.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
});

export const config = {
    matcher: ["/cohorts/:path*", "/admin/:path*", "/login"],
};

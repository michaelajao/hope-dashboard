/**
 * NextAuth v5 config.
 *
 * Edge-runtime safe: only Credentials provider is statically imported here,
 * so middleware (which runs in Edge) does not pull in Node-only modules.
 *
 * Magic-link via Nodemailer was previously imported eagerly and crashed
 * the Edge bundle ("stream module not supported"). When the workshop needs
 * magic-link, re-introduce Nodemailer behind the documented NextAuth v5
 * Edge/Node split — see https://authjs.dev/guides/edge-compatibility — by
 * adding a separate `auth.node.ts` for API routes and keeping this file
 * as the Edge-safe config.
 *
 * The `signIn` callback rejects emails not in `FACILITATOR_EMAILS`
 * (comma-separated env var). Keep that list short.
 */

import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

function allowlist(): Set<string> {
    const raw = process.env.FACILITATOR_EMAILS ?? "";
    return new Set(
        raw
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
    );
}

const isProd = process.env.NODE_ENV === "production";

const providers: NextAuthConfig["providers"] = [
    Credentials({
        id: "dev-allowlist",
        name: "Dev allowlist",
        credentials: {
            email: { label: "Email", type: "email" },
        },
        async authorize(input) {
            const email = String(input?.email ?? "").toLowerCase();
            if (!email) return null;
            if (!allowlist().has(email)) return null;
            return { id: email, email, name: email.split("@")[0] };
        },
    }),
];

export const config: NextAuthConfig = {
    trustHost: true,
    session: { strategy: "jwt" },
    pages: { signIn: "/login" },
    providers,
    callbacks: {
        async signIn({ user }) {
            const email = user?.email?.toLowerCase();
            if (!email) return false;
            const list = allowlist();
            if (list.size === 0) {
                // Empty allowlist in dev = allow anyone; tighten in prod.
                return !isProd;
            }
            return list.has(email);
        },
    },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);

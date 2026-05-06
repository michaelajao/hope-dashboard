/**
 * NextAuth v5 config.
 *
 * Production: nodemailer magic-link to allowlisted facilitator emails.
 * Dev (NODE_ENV !== "production"): credentials provider that accepts any
 * allowlisted email without an SMTP server — convenient for laptop work
 * where outbound mail is not configured.
 *
 * Either way, the `signIn` callback rejects emails not in
 * `FACILITATOR_EMAILS` (comma-separated env var). Keep that list short.
 */

import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Nodemailer from "next-auth/providers/nodemailer";

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
const hasSmtp = Boolean(
    process.env.EMAIL_SERVER_HOST ?? process.env.EMAIL_SERVER,
);

const providers: NextAuthConfig["providers"] = [];

if (hasSmtp) {
    providers.push(
        Nodemailer({
            server: {
                host: process.env.EMAIL_SERVER_HOST,
                port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
                auth: {
                    user: process.env.EMAIL_SERVER_USER,
                    pass: process.env.EMAIL_SERVER_PASSWORD,
                },
            },
            from: process.env.EMAIL_FROM ?? "no-reply@hope.local",
        }),
    );
}

if (!isProd) {
    providers.push(
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
    );
}

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

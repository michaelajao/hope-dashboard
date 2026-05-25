"use client";

import { signIn } from "next-auth/react";
import { useState, useTransition } from "react";

const AUTH_OPEN = process.env.NEXT_PUBLIC_AUTH_MODE === "open";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
            const provider =
                process.env.NEXT_PUBLIC_AUTH_PROVIDER === "nodemailer"
                    ? "nodemailer"
                    : "dev-allowlist";
            const result = await signIn(provider, {
                email,
                redirect: false,
                callbackUrl: "/cohorts",
            });
            if (result?.error) {
                setError(
                    AUTH_OPEN
                        ? "Sign-in failed. Try again."
                        : "Email is not on the facilitator allowlist.",
                );
            } else if (result?.url) {
                window.location.href = result.url;
            }
        });
    }

    return (
        <main className="flex flex-1 items-center justify-center px-4">
            <form
                onSubmit={onSubmit}
                className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-surface p-6 shadow-sm"
            >
                <div>
                    <h1 className="text-xl font-semibold text-text">
                        Hope Facilitator Assistant
                    </h1>
                    <p className="text-sm text-muted">
                        Sign in with your facilitator email.
                    </p>
                </div>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.org"
                    required
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent-2"
                />
                {error && (
                    <p className="text-sm text-risk-hi" role="alert">
                        {error}
                    </p>
                )}
                <button
                    type="submit"
                    disabled={pending}
                    className="w-full rounded-md bg-text px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
                >
                    {pending ? "Signing in…" : "Continue"}
                </button>
                <p className="text-xs text-muted">
                    {AUTH_OPEN
                        ? "Testing mode — any email works. The dashboard skips the allowlist gate so reviewers can sign in without prior whitelisting."
                        : "Only allowlisted facilitator emails can sign in. Ask the workshop admin to add yours."}
                </p>
            </form>
        </main>
    );
}

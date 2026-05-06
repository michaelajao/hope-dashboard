"use client";

import { signIn } from "next-auth/react";
import { useState, useTransition } from "react";

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
                setError("Email is not on the facilitator allowlist.");
            } else if (result?.url) {
                window.location.href = result.url;
            }
        });
    }

    return (
        <main className="flex flex-1 items-center justify-center px-4">
            <form
                onSubmit={onSubmit}
                className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
            >
                <div>
                    <h1 className="text-xl font-semibold">
                        Hope Facilitator Assistant
                    </h1>
                    <p className="text-sm text-slate-500">
                        Sign in with your facilitator email.
                    </p>
                </div>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.org"
                    required
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
                {error && (
                    <p className="text-sm text-rose-600" role="alert">
                        {error}
                    </p>
                )}
                <button
                    type="submit"
                    disabled={pending}
                    className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                    {pending ? "Signing in…" : "Continue"}
                </button>
                <p className="text-xs text-slate-500">
                    In dev mode any allowlisted email signs in immediately. With
                    SMTP configured, a magic link is emailed instead.
                </p>
            </form>
        </main>
    );
}

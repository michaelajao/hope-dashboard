"use client";

import { MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import type { RealDiscussionThread } from "@/lib/server/cohort-data";

/**
 * Renders a reconstructed forum topic — the title plus the ordered
 * back-and-forth — so the facilitator sees the conversation they're
 * replying into. The focal post (the one being drafted against) is
 * highlighted; facilitator posts and other participants are visually
 * distinguished.
 *
 * Authors outside the focal cohort are already aliased generically
 * ("Facilitator" / "A participant") in the bundle, so nothing here can
 * surface a real identity.
 */
export function DiscussionThread({
    thread,
    focalText,
}: {
    thread: RealDiscussionThread;
    focalText: string;
}) {
    const focal = focalText.trim();
    return (
        <div className="rounded-md border border-border bg-surface-2">
            <div className="flex items-center gap-1.5 border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                {thread.title}
            </div>
            <ol className="max-h-64 space-y-2 overflow-y-auto px-3 py-2.5">
                {thread.replies.map((r, i) => {
                    const isFocal = r.text.trim() === focal;
                    const isFacilitator = r.role === "facilitator";
                    return (
                        <li
                            key={`${r.recordedAt}-${i}`}
                            className={cn(
                                "rounded-md px-2.5 py-1.5 text-sm",
                                isFocal
                                    ? "bg-accent/15 ring-1 ring-accent"
                                    : isFacilitator
                                      ? "bg-risk-md-bg"
                                      : "bg-surface",
                            )}
                        >
                            <div className="mb-0.5 flex items-center gap-1.5">
                                <span
                                    className={cn(
                                        "text-xs font-medium",
                                        isFacilitator
                                            ? "text-risk-md"
                                            : "text-text-2",
                                    )}
                                >
                                    {r.alias}
                                </span>
                                {isFocal && (
                                    <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent-ink">
                                        replying to this
                                    </span>
                                )}
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed text-text">
                                {r.text}
                            </p>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}

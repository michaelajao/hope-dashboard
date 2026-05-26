"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
    Flag,
    Info,
    MoreVertical,
    RefreshCcw,
    Send,
    Sparkles,
    ThumbsDown,
    ThumbsUp,
    X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Draft } from "@/lib/api/commentGen";

/**
 * Prototype-style draft card.
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │ To: Jamie Cooper · in-app message    ⨂ Editable draft│
 *   ├──────────────────────────────────────────────────────┤
 *   │                                                      │
 *   │  Hi Jamie — your walking goal is still waiting on    │  ← directly
 *   │  its first step. Want to try one walk this week...   │     editable
 *   │                                                      │
 *   ├──────────────────────────────────────────────────────┤
 *   │ ↻  195 chars                              ⋮  ✈ Send  │
 *   └──────────────────────────────────────────────────────┘
 *
 *  - One card, one draft (the parent tabs switch which persona is active)
 *  - Body is a borderless inline textarea — no Edit button
 *  - Refresh icon at bottom-left → triggers regenerate via onRegenerate
 *  - Char counter next to it
 *  - Kebab menu hides the HITL controls (thumb up/down, reject, flag)
 *    so the default view is clean but training-data collection still
 *    happens. Click the kebab to expand.
 *  - "What this draft is based on" disclosure stays below (transparency)
 */

export type DraftContext = {
    topFactors: string[];
    lastActiveDays: number | null;
    memoryUsed: boolean;
    engagementUsed: boolean;
    displayName?: string;
    bio?: string;
    memorySnippets?: string[];
};

type DraftCardProps = {
    draft: Draft;
    onThumb: (draftId: string, label: "up" | "down") => void;
    onSend: (draftId: string, sentText: string, action: "accept" | "edit") => void;
    onReject?: (draftId: string) => void;
    onFlag?: (draftId: string, reason: string) => void;
    onRegenerate?: () => void;
    regenerating?: boolean;
    pending?: boolean;
    context?: DraftContext;
    /** Used in the "To: …" header. Falls back to "the participant" when
     *  the caller doesn't have a name. */
    recipientName?: string;
};

const FLAG_REASONS = [
    { id: "off-tone", label: "Off-tone or patronising" },
    { id: "factually-wrong", label: "Factually wrong" },
    { id: "unsafe", label: "Unsafe / triggering" },
    { id: "wrong-persona", label: "Wrong persona for this participant" },
    { id: "other", label: "Other — see notes" },
] as const;

function isPersonalised(ctx: DraftContext): boolean {
    return ctx.memoryUsed && Boolean(ctx.bio);
}

export function DraftCard({
    draft,
    onThumb,
    onSend,
    onReject,
    onFlag,
    onRegenerate,
    regenerating,
    pending,
    context,
    recipientName,
}: DraftCardProps) {
    const [text, setText] = useState(draft.body);
    const [edited, setEdited] = useState(false);
    const [thumb, setThumb] = useState<"up" | "down" | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [flagging, setFlagging] = useState(false);
    const [flagReason, setFlagReason] = useState<string>(FLAG_REASONS[0].id);
    const [flagNotes, setFlagNotes] = useState("");
    const [rejected, setRejected] = useState(false);

    // Reset local state when the parent feeds a new draft (e.g. tab swap
    // or regeneration). Without this, switching tabs would keep the old
    // edited text.
    useEffect(() => {
        setText(draft.body);
        setEdited(false);
        setThumb(null);
        setMenuOpen(false);
        setFlagging(false);
        setRejected(false);
    }, [draft.draft_id, draft.body]);

    // Close the kebab menu when clicking outside.
    const menuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!menuOpen) return;
        function onClick(e: MouseEvent) {
            if (
                menuRef.current &&
                !menuRef.current.contains(e.target as Node)
            ) {
                setMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, [menuOpen]);

    function clickThumb(label: "up" | "down") {
        setThumb(label);
        onThumb(String(draft.draft_id), label);
        setMenuOpen(false);
    }

    function submitFlag(e: FormEvent) {
        e.preventDefault();
        const reasonLabel =
            FLAG_REASONS.find((r) => r.id === flagReason)?.label ?? flagReason;
        const composed = flagNotes.trim()
            ? `${reasonLabel}: ${flagNotes.trim()}`
            : reasonLabel;
        onFlag?.(String(draft.draft_id), composed);
        setFlagging(false);
        setFlagNotes("");
    }

    function clickReject() {
        onReject?.(String(draft.draft_id));
        setRejected(true);
        setMenuOpen(false);
    }

    function clickSend() {
        const action = edited ? "edit" : "accept";
        onSend(String(draft.draft_id), text, action);
    }

    const toName = recipientName ?? context?.displayName ?? "the participant";
    const chars = text.length;

    if (rejected) {
        return (
            <div className="overflow-hidden rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-muted opacity-60">
                {draft.label} — rejected. Signal logged.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
                {/* Header: To: ... · in-app message  /  Editable draft */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs">
                    <div className="text-text-2">
                        <span className="text-muted">To:</span>{" "}
                        <span className="font-medium text-text">{toName}</span>
                        <span className="ml-1.5 text-muted">
                            · in-app message
                        </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-accent-ink">
                        <Sparkles className="h-3 w-3" aria-hidden />
                        Editable draft
                    </span>
                </div>

                {/* Body: directly editable */}
                <Textarea
                    rows={5}
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value);
                        if (e.target.value !== draft.body) setEdited(true);
                    }}
                    disabled={pending}
                    aria-label="Draft body"
                    className="rounded-none border-0 bg-transparent px-3 py-2.5 text-sm leading-relaxed text-text focus-visible:ring-0"
                />

                {/* Footer: refresh + chars  /  kebab + Send */}
                <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
                    <div className="flex items-center gap-2 text-xs text-muted">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onRegenerate}
                            disabled={!onRegenerate || pending || regenerating}
                            aria-label="Regenerate drafts"
                            title="Regenerate drafts"
                            className="h-7 w-7"
                        >
                            <RefreshCcw
                                className={cn(
                                    "h-3.5 w-3.5",
                                    regenerating && "animate-spin",
                                )}
                            />
                        </Button>
                        <span>{chars} chars</span>
                        {context && isPersonalised(context) && (
                            <span
                                className="inline-flex items-center gap-1 text-accent-ink"
                                title="Memory + profile context applied"
                            >
                                <Sparkles className="h-3 w-3" aria-hidden />
                                Personalised
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="relative" ref={menuRef}>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="More actions"
                                aria-haspopup="menu"
                                aria-expanded={menuOpen}
                                onClick={() => setMenuOpen((v) => !v)}
                                disabled={pending}
                                className="h-7 w-7 text-muted hover:text-text-2"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                            {menuOpen && (
                                <div
                                    role="menu"
                                    className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-md border border-border bg-surface shadow-md"
                                >
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => clickThumb("up")}
                                        className={cn(
                                            "flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-2",
                                            thumb === "up" && "text-risk-lo",
                                        )}
                                    >
                                        <ThumbsUp className="h-3.5 w-3.5" />
                                        Thumb up
                                    </button>
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => clickThumb("down")}
                                        className={cn(
                                            "flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-2",
                                            thumb === "down" && "text-risk-hi",
                                        )}
                                    >
                                        <ThumbsDown className="h-3.5 w-3.5" />
                                        Thumb down
                                    </button>
                                    {onReject && (
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={clickReject}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted hover:bg-surface-2 hover:text-risk-hi"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                            Reject draft
                                        </button>
                                    )}
                                    {onFlag && (
                                        <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => {
                                                setFlagging(true);
                                                setMenuOpen(false);
                                            }}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted hover:bg-surface-2 hover:text-risk-md"
                                        >
                                            <Flag className="h-3.5 w-3.5" />
                                            Flag for review
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        <Button
                            size="sm"
                            onClick={clickSend}
                            disabled={pending || !text.trim()}
                            className="gap-1.5"
                        >
                            <Send className="h-3.5 w-3.5" aria-hidden />
                            Send
                        </Button>
                    </div>
                </div>
            </div>

            {flagging && (
                <form
                    onSubmit={submitFlag}
                    className="space-y-2 rounded-md border border-risk-md bg-risk-md-bg p-3 text-xs"
                >
                    <label
                        htmlFor={`flag-reason-${draft.draft_id}`}
                        className="block font-medium text-text-2"
                    >
                        What&apos;s wrong with this draft?
                    </label>
                    <select
                        id={`flag-reason-${draft.draft_id}`}
                        value={flagReason}
                        onChange={(e) => setFlagReason(e.target.value)}
                        className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent-2"
                    >
                        {FLAG_REASONS.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.label}
                            </option>
                        ))}
                    </select>
                    <Textarea
                        rows={2}
                        value={flagNotes}
                        onChange={(e) => setFlagNotes(e.target.value)}
                        placeholder="Optional — specifics that would help training"
                        className="text-xs"
                    />
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => {
                                setFlagging(false);
                                setFlagNotes("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button size="sm" type="submit" disabled={pending}>
                            Submit flag
                        </Button>
                    </div>
                </form>
            )}

            {context && (
                <details className="text-xs text-muted">
                    <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 text-text-2">
                        <Info className="h-3 w-3" aria-hidden />
                        What this draft is based on
                    </summary>
                    <div className="mt-2 space-y-1.5 rounded-md border border-border bg-surface-2 p-2.5 leading-relaxed">
                        <div>
                            <span className="font-medium text-text-2">
                                Persona:
                            </span>{" "}
                            {draft.persona} — {draft.label}
                        </div>
                        {context.bio && (
                            <div>
                                <span className="font-medium text-text-2">
                                    Profile:
                                </span>{" "}
                                {context.bio}
                            </div>
                        )}
                        {context.topFactors.length > 0 && (
                            <div>
                                <span className="font-medium text-text-2">
                                    Top signals:
                                </span>{" "}
                                {context.topFactors.slice(0, 2).join("; ")}
                            </div>
                        )}
                        {context.lastActiveDays !== null && (
                            <div>
                                <span className="font-medium text-text-2">
                                    Last active:
                                </span>{" "}
                                {context.lastActiveDays === 0
                                    ? "today"
                                    : `${context.lastActiveDays} day${
                                          context.lastActiveDays === 1 ? "" : "s"
                                      } ago`}
                            </div>
                        )}
                        <div>
                            <span className="font-medium text-text-2">
                                Memory hit:
                            </span>{" "}
                            {context.memoryUsed
                                ? "yes — prior posts retrieved"
                                : "no — cold-start"}
                        </div>
                        {context.memoryUsed &&
                            context.memorySnippets &&
                            context.memorySnippets.length > 0 && (
                                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                                    {context.memorySnippets
                                        .slice(0, 3)
                                        .map((s, i) => (
                                            <li
                                                key={i}
                                                className="line-clamp-1 italic"
                                            >
                                                “{s}”
                                            </li>
                                        ))}
                                </ul>
                            )}
                        <div>
                            <span className="font-medium text-text-2">
                                Engagement context:
                            </span>{" "}
                            {context.engagementUsed
                                ? "applied"
                                : "not available"}
                        </div>
                        <p className="mt-1.5 italic">
                            Drafts are suggestions. Always review before sending.
                        </p>
                    </div>
                </details>
            )}
        </div>
    );
}

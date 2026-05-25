"use client";

import { useState, type FormEvent } from "react";
import { Flag, Info, Sparkles, ThumbsDown, ThumbsUp, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Draft } from "@/lib/api/commentGen";

export type DraftContext = {
    topFactors: string[];
    lastActiveDays: number | null;
    memoryUsed: boolean;
    engagementUsed: boolean;
    displayName?: string;
    /** Participant bio if a profile is available. Falsy when unknown. */
    bio?: string;
    /** Retrieved past posts the memory hop returned. Top-3 only,
     *  truncated at the call site. Empty array = nothing in memory. */
    memorySnippets?: string[];
};

type DraftCardProps = {
    draft: Draft;
    onThumb: (draftId: string, label: "up" | "down") => void;
    onSend: (draftId: string, sentText: string, action: "accept" | "edit") => void;
    onReject?: (draftId: string) => void;
    onFlag?: (draftId: string, reason: string) => void;
    pending?: boolean;
    context?: DraftContext;
};

const PERSONA_ACCENT: Record<string, string> = {
    Empathetic: "border-l-4 border-l-rose-400",
    "Action-oriented": "border-l-4 border-l-amber-500",
    "Goal-oriented": "border-l-4 border-l-emerald-500",
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
    pending,
    context,
}: DraftCardProps) {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(draft.body);
    const [thumb, setThumb] = useState<"up" | "down" | null>(null);
    const [flagging, setFlagging] = useState(false);
    const [flagReason, setFlagReason] = useState<string>(FLAG_REASONS[0].id);
    const [flagNotes, setFlagNotes] = useState("");
    const [rejected, setRejected] = useState(false);

    function clickThumb(label: "up" | "down") {
        setThumb(label);
        onThumb(String(draft.draft_id), label);
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
    }

    if (rejected) {
        return (
            <Card
                className={cn(
                    "overflow-hidden opacity-60",
                    PERSONA_ACCENT[draft.persona],
                )}
            >
                <CardContent className="text-sm text-muted">
                    {draft.label} — rejected. Signal logged.
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn("overflow-hidden", PERSONA_ACCENT[draft.persona])}>
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle>{draft.label}</CardTitle>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="info">{draft.persona}</Badge>
                        {context && isPersonalised(context) && (
                            <Badge
                                variant="low"
                                className="gap-1 whitespace-nowrap"
                                title="Memory + profile context applied"
                            >
                                <Sparkles
                                    className="h-3 w-3"
                                    aria-hidden
                                />
                                Personalised
                            </Badge>
                        )}
                    </div>
                </div>
                {draft.mi_signature && (
                    <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted">
                        <span>
                            open-Q {draft.mi_signature.open_question_ratio ?? 0}
                        </span>
                        <span>
                            reflect {draft.mi_signature.reflection_density ?? 0}
                        </span>
                        <span>
                            advise {draft.mi_signature.prescriptive_density ?? 0}
                        </span>
                    </div>
                )}
            </CardHeader>
            <CardContent className="space-y-3">
                {editing ? (
                    <Textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={4}
                    />
                ) : (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                        {draft.body}
                    </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Thumb up"
                            aria-pressed={thumb === "up"}
                            onClick={() => clickThumb("up")}
                            className={cn(
                                thumb === "up" && "text-risk-lo",
                            )}
                        >
                            <ThumbsUp className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Thumb down"
                            aria-pressed={thumb === "down"}
                            onClick={() => clickThumb("down")}
                            className={cn(
                                thumb === "down" && "text-risk-hi",
                            )}
                        >
                            <ThumbsDown className="h-4 w-4" />
                        </Button>
                        {onReject && (
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Reject draft"
                                onClick={clickReject}
                                disabled={pending}
                                className="text-muted hover:text-risk-hi"
                                title="Reject (none of these work)"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                        {onFlag && (
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Flag draft"
                                aria-pressed={flagging}
                                onClick={() => setFlagging((v) => !v)}
                                disabled={pending}
                                className={cn(
                                    "text-muted hover:text-risk-md",
                                    flagging && "text-risk-md",
                                )}
                                title="Flag — quality, safety, tone"
                            >
                                <Flag className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {!editing && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditing(true)}
                                disabled={pending}
                            >
                                Edit
                            </Button>
                        )}
                        {editing && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setText(draft.body);
                                        setEditing(false);
                                    }}
                                    disabled={pending}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        onSend(
                                            String(draft.draft_id),
                                            text,
                                            "edit",
                                        );
                                        setEditing(false);
                                    }}
                                    disabled={pending}
                                >
                                    Save & Send
                                </Button>
                            </>
                        )}
                        {!editing && (
                            <Button
                                size="sm"
                                onClick={() =>
                                    onSend(
                                        String(draft.draft_id),
                                        draft.body,
                                        "accept",
                                    )
                                }
                                disabled={pending}
                            >
                                Send
                            </Button>
                        )}
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
                                              context.lastActiveDays === 1
                                                  ? ""
                                                  : "s"
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
                                Drafts are suggestions. Always review before
                                sending.
                            </p>
                        </div>
                    </details>
                )}
            </CardContent>
        </Card>
    );
}

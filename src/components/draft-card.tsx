"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Draft } from "@/lib/api/commentGen";

type DraftCardProps = {
    draft: Draft;
    onThumb: (draftId: string, label: "up" | "down") => void;
    onSend: (draftId: string, sentText: string, action: "accept" | "edit") => void;
    pending?: boolean;
};

const PERSONA_ACCENT: Record<string, string> = {
    Empathetic: "border-l-4 border-l-sky-500",
    "Action-oriented": "border-l-4 border-l-amber-500",
    "Goal-oriented": "border-l-4 border-l-emerald-500",
};

export function DraftCard({ draft, onThumb, onSend, pending }: DraftCardProps) {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(draft.body);
    const [thumb, setThumb] = useState<"up" | "down" | null>(null);

    function clickThumb(label: "up" | "down") {
        setThumb(label);
        onThumb(String(draft.draft_id), label);
    }

    return (
        <Card className={cn("overflow-hidden", PERSONA_ACCENT[draft.persona])}>
            <CardHeader>
                <div className="flex items-center justify-between gap-2">
                    <CardTitle>{draft.label}</CardTitle>
                    <Badge variant="info">{draft.persona}</Badge>
                </div>
                {draft.mi_signature && (
                    <div className="flex flex-wrap gap-2 pt-1 text-xs text-slate-500">
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
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                        {draft.body}
                    </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Thumb up"
                            onClick={() => clickThumb("up")}
                            className={cn(
                                thumb === "up" && "text-emerald-600",
                            )}
                        >
                            <ThumbsUp className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Thumb down"
                            onClick={() => clickThumb("down")}
                            className={cn(
                                thumb === "down" && "text-rose-600",
                            )}
                        >
                            <ThumbsDown className="h-4 w-4" />
                        </Button>
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
            </CardContent>
        </Card>
    );
}

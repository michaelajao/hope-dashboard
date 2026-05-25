"use client";

import { useState } from "react";
import { StickyNote } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useMemory } from "@/lib/hooks/api";
import { useNotesStore } from "@/lib/store/notesStore";
import type { MemoryEntry } from "@/lib/api/commentGen";

type FollowUpActivityProps = {
    participantId: string;
    cohortId: number;
};

type ActivityEntry = {
    id: string;
    ts: string;
    label: string;
    text: string;
    badgeVariant: "neutral" | "info";
};

function memoryEntryToActivity(m: MemoryEntry): ActivityEntry | null {
    if (m.role !== "facilitator_reply") return null;
    return {
        id: String(m.memory_id ?? `${m.ts ?? ""}-${m.activity_id ?? ""}`),
        ts: m.ts ?? "",
        label: m.activity_type ? `Reply · ${m.activity_type}` : "Reply",
        text: m.text ?? "",
        badgeVariant: "info",
    };
}

export function FollowUpActivity({
    participantId,
    cohortId,
}: FollowUpActivityProps) {
    const memory = useMemory(participantId, cohortId);
    const notes = useNotesStore((s) =>
        (s.notes[participantId] ?? []).map<ActivityEntry>((n) => ({
            id: n.id,
            ts: n.ts,
            label: "Note",
            text: n.text,
            badgeVariant: "neutral",
        })),
    );
    const addNote = useNotesStore((s) => s.addNote);

    const [draftNote, setDraftNote] = useState("");

    function onAdd() {
        const text = draftNote.trim();
        if (!text) return;
        addNote(participantId, text);
        setDraftNote("");
    }

    const remoteActivity =
        memory.data
            ?.map(memoryEntryToActivity)
            .filter((x): x is ActivityEntry => x !== null) ?? [];
    const all = [...notes, ...remoteActivity].sort(
        (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
    );

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-2">
                    <CardTitle>Follow-up activity</CardTitle>
                    <StickyNote
                        className="h-4 w-4 text-slate-400"
                        aria-hidden
                    />
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {memory.isLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : all.length === 0 ? (
                    <p className="text-xs text-slate-500">
                        No follow-up activity yet. Send a draft or add a note
                        below.
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {all.slice(0, 6).map((entry) => (
                            <li
                                key={entry.id}
                                className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                            >
                                <div className="flex items-center justify-between gap-2 text-xs">
                                    <Badge variant={entry.badgeVariant}>
                                        {entry.label}
                                    </Badge>
                                    {entry.ts && (
                                        <span className="text-slate-500">
                                            {new Date(entry.ts).toLocaleString()}
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1 line-clamp-3 text-slate-800">
                                    {entry.text}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="space-y-2">
                    <label
                        htmlFor="follow-up-note"
                        className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                        Add a note
                    </label>
                    <Textarea
                        id="follow-up-note"
                        rows={2}
                        value={draftNote}
                        onChange={(e) => setDraftNote(e.target.value)}
                        placeholder="What did you observe or decide?"
                    />
                    <div className="flex justify-end">
                        <Button
                            size="sm"
                            onClick={onAdd}
                            disabled={!draftNote.trim()}
                        >
                            Add note
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

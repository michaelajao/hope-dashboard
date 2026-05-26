import { create } from "zustand";

import { DAY_MS } from "@/lib/signals";

/**
 * Session-local snooze + dismiss state for the follow-up queue.
 *
 * Persistence: in-memory only — resets on page reload. Mirrors the
 * notesStore approach: works for v1 demos without needing a backend
 * roundtrip. When real persistence lands, swap for a useMutation that
 * POSTs to a `/api/proxy/queue/snooze` route and invalidates the queue
 * batch query.
 */

type QueueState = {
    snoozedUntil: Record<string, number>; // participantId → epoch ms
    dismissedAt: Record<string, number>; // participantId → epoch ms

    snooze: (participantId: string, days: number) => void;
    dismiss: (participantId: string) => void;
    undoSnooze: (participantId: string) => void;
    undoDismiss: (participantId: string) => void;
    isHidden: (participantId: string, now: number) => boolean;
    hiddenCount: (participantIds: string[], now: number) => number;
    /** Wipe all snooze/dismiss state. Called on cohort route change so
     *  one cohort's session state never leaks into another's (same
     *  participantId can appear across cohorts when a participant
     *  re-enrols). */
    clear: () => void;
};

export const useQueueStore = create<QueueState>((set, get) => ({
    snoozedUntil: {},
    dismissedAt: {},

    snooze: (participantId, days) =>
        set((s) => ({
            snoozedUntil: {
                ...s.snoozedUntil,
                [participantId]: Date.now() + days * DAY_MS,
            },
        })),

    dismiss: (participantId) =>
        set((s) => ({
            dismissedAt: { ...s.dismissedAt, [participantId]: Date.now() },
        })),

    undoSnooze: (participantId) =>
        set((s) => {
            const next = { ...s.snoozedUntil };
            delete next[participantId];
            return { snoozedUntil: next };
        }),

    undoDismiss: (participantId) =>
        set((s) => {
            const next = { ...s.dismissedAt };
            delete next[participantId];
            return { dismissedAt: next };
        }),

    isHidden: (participantId, now) => {
        const s = get();
        if (s.dismissedAt[participantId]) return true;
        const until = s.snoozedUntil[participantId];
        return until !== undefined && until > now;
    },

    hiddenCount: (participantIds, now) => {
        const s = get();
        let n = 0;
        for (const pid of participantIds) {
            if (s.dismissedAt[pid]) {
                n += 1;
                continue;
            }
            const until = s.snoozedUntil[pid];
            if (until !== undefined && until > now) n += 1;
        }
        return n;
    },

    clear: () => set({ snoozedUntil: {}, dismissedAt: {} }),
}));

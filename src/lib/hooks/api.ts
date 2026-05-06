"use client";

import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import type {
    Draft,
    EventRequest,
    GenerateRequest,
    GenerateResponse,
    MemoryEntry,
    ThumbRequest,
} from "@/lib/api/commentGen";
import type {
    BatchRequest,
    BatchResponse,
    ParticipantFeatures,
    PredictionResponse,
} from "@/lib/api/dropout";

const ONE_DAY = 24 * 60 * 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;

async function postJSON<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const detail = await res.text().catch(() => res.statusText);
        throw new Error(`${path} failed: ${res.status} ${detail}`);
    }
    return res.json() as Promise<T>;
}

async function getJSON<T>(path: string): Promise<T> {
    const res = await fetch(path);
    if (!res.ok) {
        const detail = await res.text().catch(() => res.statusText);
        throw new Error(`${path} failed: ${res.status} ${detail}`);
    }
    return res.json() as Promise<T>;
}

export function useCohortBatch(participants: ParticipantFeatures[]) {
    const body: BatchRequest = { participants };
    return useQuery({
        queryKey: ["cohort-batch", participants.map((p) => p.participant_id)],
        queryFn: () => postJSON<BatchResponse>("/api/proxy/dropout/batch", body),
        staleTime: ONE_DAY,
        enabled: participants.length > 0,
    });
}

export function useParticipantPrediction(features: ParticipantFeatures | null) {
    return useQuery({
        queryKey: ["predict", features?.participant_id ?? null],
        queryFn: () => postJSON<PredictionResponse>("/api/proxy/dropout/predict", features!),
        staleTime: ONE_DAY,
        enabled: features !== null,
    });
}

export function useMemory(participantId: string | null, cohortId: number | null) {
    return useQuery({
        queryKey: ["memory", participantId, cohortId],
        queryFn: () => {
            const url = new URL(
                `/api/proxy/memory/${participantId}`,
                window.location.origin,
            );
            if (cohortId != null) url.searchParams.set("cohort_id", String(cohortId));
            url.searchParams.set("limit", "10");
            return getJSON<MemoryEntry[]>(url.pathname + url.search);
        },
        staleTime: FIVE_MIN,
        enabled: participantId !== null,
    });
}

export function useGenerate() {
    return useMutation({
        mutationFn: (body: GenerateRequest) =>
            postJSON<GenerateResponse>("/api/proxy/generate", body),
    });
}

export function useThumb() {
    return useMutation({
        mutationFn: (body: ThumbRequest) =>
            postJSON("/api/proxy/thumb", body),
    });
}

export function useEvent() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: EventRequest) =>
            postJSON("/api/proxy/event", body),
        onSuccess: (_data, variables) => {
            // Invalidate memory so the freshly-sent reply appears next render.
            qc.invalidateQueries({ queryKey: ["memory"] });
        },
    });
}

export type { Draft };

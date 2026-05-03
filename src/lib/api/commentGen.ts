/**
 * Typed client for the comment_generation FastAPI service.
 *
 * Spec: ../comment_generation/docs/openapi.yaml
 * Default base URL: http://localhost:8001
 */

import { createClient, type ApiClientOptions, type Schemas } from "./client";

const DEFAULT_BASE_URL =
    process.env.NEXT_PUBLIC_COMMENT_GEN_URL ?? "http://localhost:8001";

export type GenerateRequest =
    | Schemas["RichGenerateRequest"]
    | Schemas["LegacyGenerateRequest"];
export type GenerateResponse = Schemas["GenerateResponse"];
export type Draft = Schemas["Draft"];
export type Persona = Schemas["Persona"];
export type ActivityType = Schemas["ActivityType"];

export type ThumbRequest = Schemas["ThumbRequest"];
export type EventRequest = Schemas["EventRequest"];
export type EventAction = Schemas["EventAction"];

export type MemoryPostRequest = Schemas["MemoryPostRequest"];
export type MemoryReplyRequest = Schemas["MemoryReplyRequest"];
export type MemoryEntry = Schemas["MemoryEntry"];
export type MemoryWriteResponse = Schemas["MemoryWriteResponse"];

export type HealthResponse = Schemas["HealthResponse"];
export type VersionResponse = Schemas["VersionResponse"];

export function createCommentGenClient(
    opts: Partial<ApiClientOptions> = {},
) {
    const { request } = createClient({
        baseUrl: opts.baseUrl ?? DEFAULT_BASE_URL,
        sign: opts.sign,
        cookie: opts.cookie,
        fetchImpl: opts.fetchImpl,
    });

    return {
        health: () => request<HealthResponse>({ path: "/health" }),
        version: () => request<VersionResponse>({ path: "/version" }),

        generate: (body: GenerateRequest) =>
            request<GenerateResponse>({
                method: "POST",
                path: "/generate",
                body,
                signed: true,
            }),

        thumb: (body: ThumbRequest) =>
            request<Schemas["AckResponse"]>({
                method: "POST",
                path: "/thumb",
                body,
                signed: true,
            }),

        event: (body: EventRequest) =>
            request<Schemas["AckResponse"]>({
                method: "POST",
                path: "/event",
                body,
                signed: true,
            }),

        writeMemoryPost: (body: MemoryPostRequest) =>
            request<MemoryWriteResponse>({
                method: "POST",
                path: "/memory/post",
                body,
                signed: true,
            }),

        writeMemoryReply: (body: MemoryReplyRequest) =>
            request<MemoryWriteResponse>({
                method: "POST",
                path: "/memory/reply",
                body,
                signed: true,
            }),

        debugMemory: (
            participantId: number,
            cohortId?: number,
            limit = 10,
        ) =>
            request<MemoryEntry[]>({
                path: `/memory/${participantId}`,
                query: { cohort_id: cohortId, limit },
                signed: true,
            }),
    };
}

export type CommentGenClient = ReturnType<typeof createCommentGenClient>;

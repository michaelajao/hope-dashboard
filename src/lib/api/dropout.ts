/**
 * Typed client for the dropout_ml_v2 FastAPI service.
 *
 * Source: dropout_ml_v2/deploy/api/main.py
 * Default base URL: http://localhost:8000
 *
 * Note: dropout predictions are recomputed on a weekly cadence
 * per (participant, week_number); cached by the service for the week.
 * Do not poll this client every render — cache by participant_id at the
 * dashboard layer (TanStack Query staleTime: 1 day).
 */

import { createClient, type ApiClientOptions } from "./client";

const DEFAULT_BASE_URL =
    process.env.NEXT_PUBLIC_DROPOUT_API_URL ?? "http://localhost:8000";

export type RiskLevel = "low" | "medium" | "high";

export type ParticipantFeatures = {
    participant_id: string;
    features: Record<string, number>;
};

export type PredictionResponse = {
    participant_id: string;
    dropout_risk: number;
    risk_level: RiskLevel;
    contributing_factors: string[];
    recommended_actions: string[];
    scored_at: string;
};

export type BatchRequest = {
    participants: ParticipantFeatures[];
};

export type BatchResponse = {
    total: number;
    high_risk_count: number;
    medium_risk_count: number;
    low_risk_count: number;
    predictions: PredictionResponse[];
    scored_at: string;
};

export type DropoutHealth = {
    status: string;
    model_loaded: boolean;
    shap_available: boolean;
    timestamp: string;
};

export type ModelInfo = {
    model_type: string;
    loaded_at: string;
    file: string;
    n_features: number;
    features: string[];
};

export function createDropoutClient(opts: Partial<ApiClientOptions> = {}) {
    const { request } = createClient({
        baseUrl: opts.baseUrl ?? DEFAULT_BASE_URL,
        sign: opts.sign,
        cookie: opts.cookie,
        fetchImpl: opts.fetchImpl,
    });

    return {
        health: () => request<DropoutHealth>({ path: "/health" }),
        modelInfo: () => request<ModelInfo>({ path: "/model/info" }),

        predict: (body: ParticipantFeatures) =>
            request<PredictionResponse>({
                method: "POST",
                path: "/predict",
                body,
            }),

        batch: (body: BatchRequest) =>
            request<BatchResponse>({
                method: "POST",
                path: "/batch",
                body,
            }),
    };
}

export type DropoutClient = ReturnType<typeof createDropoutClient>;

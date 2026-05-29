import { describe, expect, it } from "vitest";

import {
    classifyGenerateError,
    emailForDisengaged,
    formatModelLabel,
    placeholderEmail,
} from "./drafts-helpers";

describe("formatModelLabel", () => {
    it("strips namespace + -lora + -hope-only from HF Hub ids", () => {
        expect(formatModelLabel("michaelajao/qwen3-1.7b-hope-only-lora")).toBe(
            "Qwen3 1.7B",
        );
    });

    it("preserves version segments (v5) and pretty-prints sizes", () => {
        expect(
            formatModelLabel("michaelajao/qwen3-4b-hope-only-v5-lora"),
        ).toBe("Qwen3 4B v5");
    });

    it("handles the smallest model id", () => {
        expect(formatModelLabel("michaelajao/qwen3-0.6b-hope-only-lora")).toBe(
            "Qwen3 0.6B",
        );
    });

    it("handles Llama 3.2 3B Instruct with decimal version + instruct suffix", () => {
        expect(
            formatModelLabel(
                "michaelajao/llama-3.2-3b-instruct-hope-only-lora",
            ),
        ).toBe("Llama 3.2 3B Instruct");
    });

    it("preserves SmolLM canonical capitalisation via family override", () => {
        expect(
            formatModelLabel("michaelajao/smollm3-3b-hope-only-lora"),
        ).toBe("SmolLM3 3B");
    });

    it("maps stub-disabled to a friendly label", () => {
        expect(formatModelLabel("stub-disabled")).toBe("stub (kill-switch)");
    });

    it("maps safety-block to a friendly label", () => {
        expect(formatModelLabel("safety-block")).toBe("safety block");
    });

    it("maps the historical error-fallback string", () => {
        expect(formatModelLabel("error-fallback")).toBe("fallback");
    });

    it("also strips -hope-only from a local registry id (no slash)", () => {
        expect(formatModelLabel("qwen3-1.7b-hope-only")).toBe("Qwen3 1.7B");
    });

    it("handles an id that has a slash but no -lora suffix", () => {
        expect(formatModelLabel("acme/my-custom-model")).toBe(
            "My Custom Model",
        );
    });
});

describe("classifyGenerateError", () => {
    it("auth: 401 → 'Sign in again' card", () => {
        const res = classifyGenerateError("/api/proxy/generate failed: 401");
        expect(res.tone).toBe("auth");
        expect(res.title).toBe("Sign in again");
    });

    it("auth: 'unauthorized' (case-insensitive) → auth card", () => {
        expect(classifyGenerateError("Unauthorized").tone).toBe("auth");
    });

    it("auth: 'not authenticated' → auth card", () => {
        expect(
            classifyGenerateError("Not authenticated for this resource").tone,
        ).toBe("auth");
    });

    it("offline: 5xx is bucketed as offline (added during Space rebuild)", () => {
        for (const code of [500, 502, 503, 504]) {
            const res = classifyGenerateError(`upstream returned ${code}`);
            expect(res.tone, `code ${code}`).toBe("offline");
            expect(res.title).toBe("Comment generation is offline");
        }
    });

    it("offline: HF Space 404 is bucketed as offline (Space asleep)", () => {
        expect(classifyGenerateError("HTTP 404 not found").tone).toBe("offline");
    });

    it("offline: ECONNREFUSED / fetch failed / network errors", () => {
        for (const msg of [
            "fetch failed: ECONNREFUSED 127.0.0.1:8001",
            "TypeError: Failed to fetch",
            "Network request failed",
            "ETIMEDOUT after 30s",
        ]) {
            expect(classifyGenerateError(msg).tone, msg).toBe("offline");
        }
    });

    it("offline: human-readable upstream messages", () => {
        for (const msg of [
            "Internal Server Error",
            "Bad Gateway",
            "Service Unavailable",
            "Gateway Timeout",
        ]) {
            expect(classifyGenerateError(msg).tone, msg).toBe("offline");
        }
    });

    it("error: anything unclassified surfaces the raw detail", () => {
        const res = classifyGenerateError("RuntimeError: unexpected dtype");
        expect(res.tone).toBe("error");
        expect(res.title).toBe("Couldn't generate drafts");
        expect(res.body).toBe("RuntimeError: unexpected dtype");
    });

    it("auth wins over offline when both substrings match (401 in a 500 message)", () => {
        // Defensive: if upstream ever wraps a 401 in a 5xx wrapper, the
        // dashboard should still show the auth card so the facilitator
        // knows to re-sign-in, not bang on the regenerate button.
        const res = classifyGenerateError("500: nested 401 unauthorized");
        expect(res.tone).toBe("auth");
    });
});

describe("placeholderEmail", () => {
    it("returns null when participantId is null", () => {
        expect(placeholderEmail(null, 1680)).toBeNull();
    });

    it("uses the .invalid TLD so a stray Send can't reach a real inbox", () => {
        const email = placeholderEmail("101731", 1680);
        expect(email).not.toBeNull();
        expect(email!.endsWith(".invalid")).toBe(true);
    });

    it("scopes by participant + cohort", () => {
        expect(placeholderEmail("101731", 1680)).toBe(
            "participant-101731@cohort-1680.hope-test.invalid",
        );
    });

    it("handles cohortId as string or number identically", () => {
        expect(placeholderEmail("P1", "1680")).toBe(
            placeholderEmail("P1", 1680),
        );
    });
});

describe("emailForDisengaged", () => {
    it("returns an email for high-risk (Needs attention) participants", () => {
        const email = emailForDisengaged("101731", 1680, "high");
        expect(email).not.toBeNull();
        expect(email!.endsWith(".invalid")).toBe(true);
    });

    it("returns an email for medium-risk (Check in soon) participants", () => {
        expect(emailForDisengaged("101731", 1680, "medium")).not.toBeNull();
    });

    it("hides the email channel for low-risk (On track) participants", () => {
        expect(emailForDisengaged("101731", 1680, "low")).toBeNull();
    });

    it("hides the email channel when risk level is unknown (prediction loading)", () => {
        expect(emailForDisengaged("101731", 1680, undefined)).toBeNull();
    });

    it("returns null even for high-risk if participantId is missing", () => {
        expect(emailForDisengaged(null, 1680, "high")).toBeNull();
    });
});

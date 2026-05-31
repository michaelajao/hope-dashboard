import { describe, it, expect } from "vitest";

import { renderThreadContext } from "@/lib/realCohort";
import type { CohortBundle } from "@/lib/server/cohort-data";

// renderThreadContext only touches `bundle.discussionThreads`; the rest of the
// CohortBundle shape is irrelevant here, so we build a minimal stub and cast.
type Role = "facilitator" | "participant";

function bundleWith(
    replies: Array<{ alias: string; role: Role; text: string }>,
    opts: { title?: string; topicId?: string } = {},
): CohortBundle {
    const title = opts.title ?? "The IIH journey";
    const topicId = opts.topicId ?? "100";
    const thread = {
        title,
        replies: replies.map((r, i) => ({
            ...r,
            recordedAt: `2025-09-${String(10 + i).padStart(2, "0")}T10:00:00Z`,
        })),
    };
    return {
        discussionThreads: { [topicId]: thread },
    } as unknown as CohortBundle;
}

// 10 replies R0..R9 with distinct, greppable bodies. R0/R1 are facilitator
// framing posts; the rest are participants.
function tenReplies(): Array<{ alias: string; role: Role; text: string }> {
    return Array.from({ length: 10 }, (_, i) => ({
        alias: i < 2 ? "Facilitator" : `P${i}`,
        role: (i < 2 ? "facilitator" : "participant") as Role,
        text: `R${i}-body`,
    }));
}

describe("renderThreadContext", () => {
    it("returns '' when topicId is null/undefined", () => {
        expect(renderThreadContext(bundleWith(tenReplies()), undefined, "R7-body")).toBe("");
    });

    it("returns '' when the topic isn't in the bundle", () => {
        expect(renderThreadContext(bundleWith(tenReplies()), 999, "R7-body")).toBe("");
    });

    it("returns '' when the topic title is blank", () => {
        const b = bundleWith(tenReplies(), { title: "   " });
        expect(renderThreadContext(b, 100, "R7-body")).toBe("");
    });

    it("returns '' when the thread has no replies", () => {
        expect(renderThreadContext(bundleWith([]), 100, "R7-body")).toBe("");
    });

    it("includes the opening, a gap marker, and the preceding window — but NOT the focal", () => {
        const out = renderThreadContext(bundleWith(tenReplies()), 100, "R7-body");
        expect(out).toContain('Forum topic: "The IIH journey"');
        expect(out).toContain("Earlier in the thread:");
        expect(out).toContain("R0-body"); // opening
        expect(out).toContain("R1-body"); // opening
        expect(out).toContain("…"); // gap between opening (0,2) and preceding (3,7)
        expect(out).toContain("Just before this post:");
        expect(out).toContain("R3-body"); // preceding
        expect(out).toContain("R6-body"); // preceding (just before focal)
        // focal + everything after it + the gap reply are excluded
        expect(out).not.toContain("R7-body"); // focal — carried by post_text instead
        expect(out).not.toContain("R8-body");
        expect(out).not.toContain("R9-body");
        expect(out).not.toContain("R2-body"); // skipped (lives in the gap)
    });

    it("emits no gap marker when the opening abuts the preceding window", () => {
        // focal at index 6: opening [0,2), preceding [2,6) — they touch, no hole.
        const out = renderThreadContext(bundleWith(tenReplies()), 100, "R6-body");
        expect(out).toContain("R1-body"); // opening
        expect(out).toContain("R2-body"); // preceding starts right after opening
        expect(out).toContain("R5-body");
        expect(out).not.toContain("\n…"); // no gap marker
        expect(out).not.toContain("R6-body"); // focal excluded
        // each reply appears at most once
        expect(out.match(/R2-body/g)?.length).toBe(1);
    });

    it("handles a focal among the first replies (preceding empty)", () => {
        // focal at index 1: opening [0,1), preceding [1,1) (empty).
        const out = renderThreadContext(bundleWith(tenReplies()), 100, "R1-body");
        expect(out).toContain("R0-body");
        expect(out).not.toContain("Just before this post:");
        expect(out).not.toContain("R1-body"); // focal excluded
    });

    it("returns header-only when the focal is the very first reply", () => {
        const out = renderThreadContext(bundleWith(tenReplies()), 100, "R0-body");
        expect(out).toBe('Forum topic: "The IIH journey"');
    });

    it("falls back to a tail window when the focal text isn't found", () => {
        const out = renderThreadContext(bundleWith(tenReplies()), 100, "not-in-thread");
        expect(out).toContain("Recent replies in the thread:");
        expect(out).toContain("R9-body"); // tail includes the most recent
        expect(out).not.toContain("Earlier in the thread:");
    });

    it("uses the LAST occurrence when the focal text is duplicated", () => {
        // R2 and R7 share the focal text; the live one is the later (R7).
        const replies = tenReplies();
        replies[2] = { alias: "P2", role: "participant", text: "DUP-body" };
        replies[7] = { alias: "P7", role: "participant", text: "DUP-body" };
        const out = renderThreadContext(bundleWith(replies), 100, "DUP-body");
        // window is built around index 7: preceding [3,7) = R3..R6
        expect(out).toContain("R6-body");
        expect(out).toContain("R3-body");
        // the duplicate text never appears (neither occurrence is in a window)
        expect(out).not.toContain("DUP-body");
    });

    it("clips an over-long reply to the per-post budget", () => {
        const replies = tenReplies();
        const long = "x".repeat(600);
        replies[6] = { alias: "P6", role: "participant", text: long }; // in preceding window
        const out = renderThreadContext(bundleWith(replies), 100, "R7-body");
        expect(out).toContain("x".repeat(279) + "…"); // clipped to 280 chars
        expect(out).not.toContain(long); // full 600 never present
    });

    it("skips whitespace-only replies in a window", () => {
        const replies = tenReplies();
        replies[5] = { alias: "P5", role: "participant", text: "   " }; // in preceding window
        const out = renderThreadContext(bundleWith(replies), 100, "R7-body");
        expect(out).not.toContain("P5:"); // the blank reply produces no line
        expect(out).toContain("R6-body"); // its neighbours still render
    });

    it("never exceeds the overall char budget", () => {
        const out = renderThreadContext(bundleWith(tenReplies()), 100, "R7-body");
        expect(out.length).toBeLessThanOrEqual(2000);
    });
});

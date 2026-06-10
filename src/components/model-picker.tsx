"use client";

import { useState } from "react";
import { Cpu, Loader2 } from "lucide-react";

import {
    useCommentGenModels,
    useSwitchCommentGenModel,
} from "@/lib/hooks/api";

/**
 * Topbar dropdown for swapping the comment-gen LoRA at runtime.
 *
 * Reads the available adapters from `/api/proxy/admin/models` (a passthrough
 * of comment-gen's `GET /admin/models`). When the facilitator picks a new
 * adapter, posts to `/api/proxy/admin/model` and the Space unloads the
 * current model and loads the new one. The button stays in a loading
 * state for the ~15–30s swap cost so the facilitator gets clear feedback.
 *
 * Selection is server-side state (whichever model the Space has loaded),
 * not per-facilitator preference — there's only one model in memory at a
 * time and switching affects every concurrent caller. Treat the picker
 * like an A/B-comparison knob for the workshop demo, not a personal
 * preference.
 */
/**
 * Facilitator-facing label. The service tags each adapter with an internal
 * training-corpus note — "(forum)", "(activities)", "(forum, experimental)" —
 * which means nothing to a facilitator. Strip it so the picker shows just the
 * model family + size (e.g. "Qwen3 4B").
 */
function cleanModelLabel(label: string): string {
    return label
        .replace(/\s*\((?:forum|activities)(?:,\s*experimental)?\)/gi, "")
        .replace(/\s*\(experimental\)/gi, "")
        .trim();
}

/**
 * Map each adapter id to its display label. Labels are cleaned (no corpus
 * jargon) — but two distinct adapters can clean to the SAME name (e.g. the
 * 4B "(forum)" keeper and the 4B "(activities)" model both → "Qwen3 4B"),
 * which would show two identical picker entries. On collision, keep the
 * corpus tag back so each option is distinguishable.
 */
function buildLabelMap(
    options: { model_id: string; label: string }[],
): Map<string, string> {
    const cleaned = options.map((o) => cleanModelLabel(o.label));
    const counts = new Map<string, number>();
    for (const c of cleaned) counts.set(c, (counts.get(c) ?? 0) + 1);
    const map = new Map<string, string>();
    options.forEach((o, i) => {
        const base = cleaned[i];
        if ((counts.get(base) ?? 0) > 1) {
            const tag = o.label.match(/\((?:forum|activities)[^)]*\)/i)?.[0];
            map.set(o.model_id, tag ? `${base} ${tag}` : o.label);
        } else {
            map.set(o.model_id, base);
        }
    });
    return map;
}

export function ModelPicker() {
    const models = useCommentGenModels();
    const switchModel = useSwitchCommentGenModel();
    const [error, setError] = useState<string | null>(null);

    const current = models.data?.current ?? "—";
    const options = models.data?.options ?? [];

    function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const next = e.target.value;
        if (!next || next === current) return;
        setError(null);
        switchModel.mutate(next, {
            onError: (err) => setError((err as Error).message),
        });
    }

    const busy = switchModel.isPending;
    const labelMap = buildLabelMap(options);
    const labelFor = (id: string) => labelMap.get(id) ?? cleanModelLabel(id);

    return (
        <div className="flex items-center gap-2">
            <label
                htmlFor="model-picker"
                className="hidden items-center gap-1.5 text-xs text-muted sm:flex"
            >
                {busy ? (
                    <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden
                    />
                ) : (
                    <Cpu className="h-3.5 w-3.5" aria-hidden />
                )}
                Model
            </label>
            <select
                id="model-picker"
                value={current}
                onChange={onChange}
                disabled={busy || models.isLoading || options.length === 0}
                title={
                    busy
                        ? `Loading ${labelFor(switchModel.variables ?? current)}…`
                        : `Currently serving: ${labelFor(current)}`
                }
                className="max-w-[14rem] truncate rounded-md border border-border bg-surface px-2 py-1 text-xs text-text disabled:cursor-wait disabled:opacity-60"
            >
                {options.length === 0 && (
                    <option value={current}>{current}</option>
                )}
                {options.map((o) => (
                    <option key={o.model_id} value={o.model_id}>
                        {labelMap.get(o.model_id) ?? cleanModelLabel(o.label)}
                    </option>
                ))}
            </select>
            {error && (
                <span
                    role="status"
                    title={error}
                    className="text-xs text-risk-hi"
                >
                    swap failed
                </span>
            )}
        </div>
    );
}

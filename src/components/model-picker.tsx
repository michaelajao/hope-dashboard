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
    const labelFor = (id: string) =>
        options.find((o) => o.model_id === id)?.label ?? id;

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
                        {o.label}
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

import { cn } from "@/lib/utils";

type DriverBarsProps = {
    factors: string[];
    /** Aligned 1:1 with `factors`. When absent, synthetic decaying weights
     *  are used so the visual ranking still reads. */
    weights?: number[];
    /** Tier-derived bar accent. Defaults to text. */
    tone?: "high" | "medium" | "low";
};

const TONE_BAR: Record<NonNullable<DriverBarsProps["tone"]>, string> = {
    high: "bg-risk-hi",
    medium: "bg-risk-md",
    low: "bg-risk-lo",
};

function syntheticWeights(n: number): number[] {
    // Decaying: 1.0, 0.78, 0.61, 0.48, ... — keeps the bar ladder reading
    // even when the backend hasn't shipped real magnitudes yet.
    return Array.from({ length: n }, (_, i) => 0.78 ** i);
}

export function DriverBars({ factors, weights, tone }: DriverBarsProps) {
    if (factors.length === 0) {
        return (
            <p className="text-xs text-muted">
                No contributing factors available.
            </p>
        );
    }
    const w = weights ?? syntheticWeights(factors.length);
    const max = Math.max(...w);
    const total = w.reduce((a, b) => a + b, 0);
    const estimated = !weights;
    const barTone = tone ? TONE_BAR[tone] : "bg-text";

    return (
        <div className="space-y-2.5">
            {factors.map((f, i) => {
                const pct = max > 0 ? Math.round((w[i] / max) * 100) : 0;
                const share = total > 0 ? Math.round((w[i] / total) * 100) : 0;
                return (
                    <div
                        key={i}
                        className="grid grid-cols-[1fr_auto] items-end gap-3"
                    >
                        <div>
                            <div className="text-xs text-text-2">{f}</div>
                            <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                                <div
                                    className={cn("h-full rounded-full", barTone)}
                                    style={{ width: `${pct}%` }}
                                    aria-hidden
                                />
                            </div>
                        </div>
                        <div className="text-xs text-muted tabular-nums">
                            +{share}%
                        </div>
                    </div>
                );
            })}
            {estimated && (
                <p className="pt-1 text-[10.5px] italic text-muted">
                    Bar widths are estimates until the model emits per-factor
                    magnitudes.
                </p>
            )}
        </div>
    );
}

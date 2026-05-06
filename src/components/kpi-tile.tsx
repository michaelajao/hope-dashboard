import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiTileProps = {
    label: string;
    value: number | string;
    hint?: string;
    accent?: "neutral" | "low" | "medium" | "high";
};

const ACCENT: Record<NonNullable<KpiTileProps["accent"]>, string> = {
    neutral: "text-slate-900",
    low: "text-emerald-600",
    medium: "text-amber-600",
    high: "text-rose-600",
};

export function KpiTile({
    label,
    value,
    hint,
    accent = "neutral",
}: KpiTileProps) {
    return (
        <Card>
            <CardContent>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                    {label}
                </div>
                <div
                    className={cn(
                        "mt-1 text-2xl font-semibold tabular-nums",
                        ACCENT[accent],
                    )}
                >
                    {value}
                </div>
                {hint && (
                    <div className="mt-1 text-xs text-slate-500">{hint}</div>
                )}
            </CardContent>
        </Card>
    );
}

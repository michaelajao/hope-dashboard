import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiTileProps = {
    label: string;
    value: number | string;
    hint?: string;
    accent?: "neutral" | "low" | "medium" | "high";
    icon?: LucideIcon;
};

const ACCENT: Record<NonNullable<KpiTileProps["accent"]>, string> = {
    neutral: "text-slate-900",
    low: "text-emerald-600",
    medium: "text-amber-600",
    high: "text-rose-600",
};

const ICON_BG: Record<NonNullable<KpiTileProps["accent"]>, string> = {
    neutral: "bg-slate-100 text-slate-600",
    low: "bg-emerald-100 text-emerald-600",
    medium: "bg-amber-100 text-amber-600",
    high: "bg-rose-100 text-rose-600",
};

export function KpiTile({
    label,
    value,
    hint,
    accent = "neutral",
    icon: Icon,
}: KpiTileProps) {
    return (
        <Card>
            <CardContent>
                <div className="flex items-start gap-3">
                    {Icon && (
                        <span
                            className={cn(
                                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                                ICON_BG[accent],
                            )}
                        >
                            <Icon className="h-5 w-5" aria-hidden />
                        </span>
                    )}
                    <div className="min-w-0">
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
                            <div className="mt-1 text-xs text-slate-500">
                                {hint}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

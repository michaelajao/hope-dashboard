import { Activity, HandHeart, Lightbulb } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { WELLBEING_CUE } from "@/lib/risk";
import { activationLevel } from "@/lib/signals";
import type { PredictionResponse } from "@/lib/api/dropout";

type InfoCardRowProps = {
    prediction: PredictionResponse;
};

const ACTIVATION_HINT: Record<"Low" | "Medium" | "High", string> = {
    Low: "May benefit from simple next steps and guided support.",
    Medium: "Engagement is mixed — a focused nudge often helps.",
    High: "Steady momentum — keep the touch light.",
};

export function InfoCardRow({ prediction }: InfoCardRowProps) {
    const activation = activationLevel(prediction.contributing_factors);
    const approach =
        prediction.recommended_actions?.slice(0, 2).join(" — ") ||
        "Acknowledge their last contribution and invite one small next step.";

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
                <CardContent>
                    <div className="flex items-start gap-3">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                            <Activity className="h-5 w-5" aria-hidden />
                        </span>
                        <div className="min-w-0">
                            <div className="text-xs uppercase tracking-wide text-slate-500">
                                Activation level
                            </div>
                            <div className="mt-0.5 text-sm font-semibold text-slate-900">
                                {activation}
                            </div>
                            <p className="mt-1 text-xs text-slate-600">
                                {ACTIVATION_HINT[activation]}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardContent>
                    <div className="flex items-start gap-3">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                            <Lightbulb className="h-5 w-5" aria-hidden />
                        </span>
                        <div className="min-w-0">
                            <div className="text-xs uppercase tracking-wide text-slate-500">
                                Recommended approach
                            </div>
                            <p className="mt-1 line-clamp-3 text-xs text-slate-700">
                                {approach}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardContent>
                    <div className="flex items-start gap-3">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                            <HandHeart className="h-5 w-5" aria-hidden />
                        </span>
                        <div className="min-w-0">
                            <div className="text-xs uppercase tracking-wide text-slate-500">
                                Wellbeing support cue
                            </div>
                            <p className="mt-1 line-clamp-3 text-xs text-slate-700">
                                {WELLBEING_CUE[prediction.risk_level]}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

import { Activity, HandHeart, Lightbulb } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

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

type IconTone = "accent" | "warn" | "support";

const ICON_BG: Record<IconTone, string> = {
    accent: "bg-accent-2 text-accent-ink",
    warn: "bg-risk-md-bg text-risk-md",
    support: "bg-risk-hi-bg text-risk-hi",
};

type InfoCardProps = {
    Icon: ComponentType<SVGProps<SVGSVGElement>>;
    iconTone: IconTone;
    label: string;
    title?: string;
    body: string;
};

function InfoCard({ Icon, iconTone, label, title, body }: InfoCardProps) {
    return (
        <Card>
            <CardContent>
                <div className="flex items-start gap-3">
                    <span
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ICON_BG[iconTone]}`}
                    >
                        <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                        <div className="text-xs uppercase tracking-wide text-muted">
                            {label}
                        </div>
                        {title && (
                            <div className="mt-0.5 text-sm font-semibold text-text">
                                {title}
                            </div>
                        )}
                        <p className="mt-1 line-clamp-3 text-xs text-text-2">
                            {body}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function InfoCardRow({ prediction }: InfoCardRowProps) {
    const activation = activationLevel(
        prediction.contributing_factors,
        prediction.risk_level,
    );
    const approach =
        prediction.recommended_actions?.slice(0, 2).join(" — ") ||
        "Acknowledge their last contribution and invite one small next step.";

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <InfoCard
                Icon={Activity}
                iconTone="accent"
                label="Activation level"
                title={activation}
                body={ACTIVATION_HINT[activation]}
            />
            <InfoCard
                Icon={Lightbulb}
                iconTone="warn"
                label="Recommended approach"
                body={approach}
            />
            <InfoCard
                Icon={HandHeart}
                iconTone="support"
                label="Wellbeing support cue"
                body={WELLBEING_CUE[prediction.risk_level]}
            />
        </div>
    );
}

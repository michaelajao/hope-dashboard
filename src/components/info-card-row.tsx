import { Activity, ArrowRight, HandHeart, Lightbulb } from "lucide-react";
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
    body?: string;
    /** Rendered as a short, un-truncated checklist (used for the
     * recommended-approach actions so each step stays readable). */
    items?: string[];
    /** Visually anchor the card — used for the actionable "approach". */
    highlight?: boolean;
};

function InfoCard({
    Icon,
    iconTone,
    label,
    title,
    body,
    items,
    highlight,
}: InfoCardProps) {
    return (
        <Card className={highlight ? "border-l-4 border-l-accent" : undefined}>
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
                        {body && (
                            <p className="mt-1 text-xs leading-relaxed text-text-2">
                                {body}
                            </p>
                        )}
                        {items && items.length > 0 && (
                            <ul className="mt-1.5 space-y-1.5">
                                {items.map((it, i) => (
                                    <li
                                        key={i}
                                        className="flex items-start gap-1.5 text-xs leading-relaxed text-text-2"
                                    >
                                        <ArrowRight
                                            className="mt-0.5 h-3 w-3 shrink-0 text-accent-ink"
                                            aria-hidden
                                        />
                                        <span>{it}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
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
    // Show the model's top 1–2 recommended actions as discrete steps rather
    // than one run-on, truncated sentence — so the actual "what to do" is
    // legible at a glance.
    const actions = (prediction.recommended_actions ?? []).slice(0, 2);
    const fallback = [
        "Acknowledge their last contribution",
        "Invite one small next step",
    ];

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
                items={actions.length ? actions : fallback}
                highlight
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

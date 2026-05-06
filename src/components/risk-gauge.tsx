import { cn } from "@/lib/utils";

type RiskGaugeProps = {
    value: number; // 0..1
    level: "low" | "medium" | "high";
    size?: number;
};

const COLOR: Record<RiskGaugeProps["level"], string> = {
    low: "stroke-emerald-500",
    medium: "stroke-amber-500",
    high: "stroke-rose-600",
};

export function RiskGauge({ value, level, size = 160 }: RiskGaugeProps) {
    const clamped = Math.max(0, Math.min(1, value));
    const radius = size / 2 - 12;
    const cx = size / 2;
    const cy = size / 2 + 8;
    const arcLength = Math.PI * radius;
    const filled = arcLength * clamped;
    return (
        <div className="flex flex-col items-center">
            <svg
                width={size}
                height={size / 2 + 24}
                viewBox={`0 0 ${size} ${size / 2 + 24}`}
                aria-label={`Dropout risk ${(clamped * 100).toFixed(0)} percent`}
                role="img"
            >
                <path
                    d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
                    className="fill-none stroke-slate-200"
                    strokeWidth={12}
                    strokeLinecap="round"
                />
                <path
                    d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
                    className={cn("fill-none", COLOR[level])}
                    strokeWidth={12}
                    strokeLinecap="round"
                    strokeDasharray={`${filled} ${arcLength}`}
                />
                <text
                    x={cx}
                    y={cy - 4}
                    textAnchor="middle"
                    className="fill-slate-900 text-2xl font-semibold"
                >
                    {(clamped * 100).toFixed(0)}%
                </text>
            </svg>
            <div className="text-xs uppercase tracking-wide text-slate-500">
                {level} risk
            </div>
        </div>
    );
}

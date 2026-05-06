import { cva, type VariantProps } from "class-variance-authority";
import { type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
    {
        variants: {
            variant: {
                neutral: "bg-slate-100 text-slate-700",
                low: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
                medium: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
                high: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
                info: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
            },
        },
        defaultVariants: { variant: "neutral" },
    },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
    VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <span
            className={cn(badgeVariants({ variant }), className)}
            {...props}
        />
    );
}

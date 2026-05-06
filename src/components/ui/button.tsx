import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                primary: "bg-slate-900 text-white hover:bg-slate-800",
                secondary:
                    "bg-white text-slate-900 border border-slate-200 hover:bg-slate-100",
                ghost: "text-slate-700 hover:bg-slate-100",
                danger: "bg-rose-600 text-white hover:bg-rose-700",
            },
            size: {
                sm: "h-8 px-3",
                md: "h-9 px-4",
                lg: "h-10 px-5",
                icon: "h-8 w-8 p-0",
            },
        },
        defaultVariants: { variant: "primary", size: "md" },
    },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
    VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, ...props }, ref) => (
        <button
            ref={ref}
            className={cn(buttonVariants({ variant, size }), className)}
            {...props}
        />
    ),
);
Button.displayName = "Button";

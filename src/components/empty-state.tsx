import { type ReactNode } from "react";

export function EmptyState({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children?: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            {description && (
                <p className="mt-1 max-w-sm text-xs text-slate-500">
                    {description}
                </p>
            )}
            {children && <div className="mt-3">{children}</div>}
        </div>
    );
}

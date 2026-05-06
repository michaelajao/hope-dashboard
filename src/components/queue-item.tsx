import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type QueueItemProps = {
    participantId: string;
    riskLevel: "low" | "medium" | "high";
    riskScore: number;
    factor?: string;
    selected?: boolean;
    onClick?: () => void;
};

export function QueueItem({
    participantId,
    riskLevel,
    riskScore,
    factor,
    selected,
    onClick,
}: QueueItemProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "w-full rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:bg-slate-50",
                selected && "border-slate-300 bg-slate-100",
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-900">
                    Participant {participantId}
                </span>
                <Badge variant={riskLevel}>{(riskScore * 100).toFixed(0)}%</Badge>
            </div>
            {factor && (
                <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                    {factor}
                </p>
            )}
        </button>
    );
}

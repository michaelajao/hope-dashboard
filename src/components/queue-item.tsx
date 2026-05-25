import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { friendlyStatus } from "@/lib/risk";
import { displayName } from "@/lib/signals";
import type { RiskLevel } from "@/lib/api/dropout";

type QueueItemProps = {
    participantId: string;
    riskLevel: RiskLevel;
    riskScore: number;
    lastActiveLabel?: string;
    selected?: boolean;
    onClick?: () => void;
};

export function QueueItem({
    participantId,
    riskLevel,
    riskScore,
    lastActiveLabel,
    selected,
    onClick,
}: QueueItemProps) {
    const status = friendlyStatus(riskLevel);
    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={selected ? "true" : undefined}
            className={cn(
                "flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left transition-colors hover:bg-surface-2",
                selected && "border-border-2 bg-surface-2",
            )}
        >
            <Avatar participantId={participantId} size="md" />
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-text">
                        {displayName(participantId)}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted">
                        {(riskScore * 100).toFixed(0)}%
                    </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge
                        variant={status.badgeVariant}
                        className="whitespace-nowrap"
                    >
                        {status.label}
                    </Badge>
                    {lastActiveLabel && (
                        <span className="truncate text-xs text-muted">
                            {lastActiveLabel}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
}

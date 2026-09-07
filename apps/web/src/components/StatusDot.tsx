import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@flowdesk/ui";
import { cn } from "@flowdesk/ui";

export type StatusDotState = "active" | "degraded" | "disconnected" | "inactive";

const stateLabels: Record<StatusDotState, string> = {
  active: "Active",
  degraded: "Degraded — reconnect needed",
  disconnected: "Disconnected",
  inactive: "Inactive"
};

const stateClasses: Record<StatusDotState, string> = {
  active: "bg-success",
  degraded: "bg-warning",
  disconnected: "bg-destructive",
  inactive: "bg-muted-foreground"
};

export function StatusDot({ state, label }: { state: StatusDotState; label?: string }) {
  const accessibleLabel = label ?? stateLabels[state];
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn("inline-block size-2 shrink-0 rounded-full", stateClasses[state])}
            aria-label={accessibleLabel}
            role="img"
          />
        </TooltipTrigger>
        <TooltipContent>{accessibleLabel}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

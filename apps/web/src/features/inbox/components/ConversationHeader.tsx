import type { Conversation } from "@flowdesk/contracts";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

interface ConversationHeaderProps {
  conversation: Conversation;
  sessionUserId: string;
  canAssign: boolean;
  canResolve: boolean;
  onAssignToMe: () => void;
  contextCollapsed?: boolean;
  onToggleContext?: () => void;
  onResolve: () => void;
  onReopen: () => void;
}

export function ConversationHeader({
  conversation: conv,
  sessionUserId,
  canAssign,
  canResolve,
  onAssignToMe,
  contextCollapsed = false,
  onToggleContext,
  onResolve,
  onReopen
}: ConversationHeaderProps) {
  const isOpen = conv.status === "open" || conv.status === "pending";
  const isResolved = conv.status === "resolved" || conv.status === "closed";
  const isAssignedToMe = conv.assignedToUserId === sessionUserId;

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-3">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-foreground">
          {conv.customerName ?? `+${conv.customerPhone}`}
        </h3>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>+{conv.customerPhone}</span>
          <span aria-hidden="true">•</span>
          <span>WhatsApp Cloud</span>
          <span aria-hidden="true">•</span>
          <span className="capitalize">{conv.status}</span>
        </div>
      </div>
      <div className="ml-2 flex max-w-[56%] shrink-0 flex-wrap items-center justify-end gap-1.5 sm:ml-3 sm:gap-2">
        {!isAssignedToMe && canAssign && (
          <button
            type="button"
            className="rounded border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
            onClick={onAssignToMe}
            data-testid="btn-assign-me"
          >
            Assign to Me
          </button>
        )}
        {onToggleContext && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onToggleContext}
            aria-label={contextCollapsed ? "Expand context panel" : "Collapse context panel"}
            data-testid="context-panel-toggle"
          >
            {contextCollapsed ? (
              <PanelRightOpen className="size-3.5" />
            ) : (
              <PanelRightClose className="size-3.5" />
            )}
            <span className="hidden xl:inline">{contextCollapsed ? "Context" : "Collapse"}</span>
          </button>
        )}
        {canResolve && isOpen && (
          <button
            type="button"
            className="rounded bg-primary px-2.5 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
            onClick={onResolve}
            data-testid="btn-resolve"
          >
            Resolve
          </button>
        )}
        {canResolve && isResolved && (
          <button
            type="button"
            className="rounded border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
            onClick={onReopen}
            data-testid="btn-reopen"
          >
            Reopen
          </button>
        )}
      </div>
    </header>
  );
}

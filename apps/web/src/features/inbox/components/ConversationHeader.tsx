import type { Conversation } from "@flowdesk/contracts";
import { cn } from "@flowdesk/ui";

interface ConversationHeaderProps {
  conversation: Conversation;
  sessionUserId: string;
  canAssign: boolean;
  canResolve: boolean;
  onAssignToMe: () => void;
  onResolve: () => void;
  onReopen: () => void;
}

export function ConversationHeader({
  conversation: conv,
  sessionUserId,
  canAssign,
  canResolve,
  onAssignToMe,
  onResolve,
  onReopen
}: ConversationHeaderProps) {
  const isOpen = conv.status === "open" || conv.status === "pending";
  const isResolved = conv.status === "resolved" || conv.status === "closed";
  const isAssignedToMe = conv.assignedToUserId === sessionUserId;

  return (
    <header className="thread-header flex items-center justify-between px-4 py-3 border-b border-border bg-background flex-shrink-0">
      {/* Customer info */}
      <div className="thread-customer-info min-w-0">
        <h3 className="text-sm font-semibold text-foreground truncate">
          {conv.customerName ?? `+${conv.customerPhone}`}
        </h3>
        <div className="thread-sub-info flex items-center flex-wrap gap-1.5 mt-0.5">
          <span className="text-xs text-muted-foreground">+{conv.customerPhone}</span>
          <span className="text-muted-foreground/40">•</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            WhatsApp Cloud
          </span>
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium",
              `badge-status badge-${conv.status}`,
              conv.status === "open" &&
                "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
              conv.status === "pending" &&
                "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
              conv.status === "resolved" &&
                "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
              conv.status === "closed" &&
                "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
              conv.status === "new" &&
                "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
            )}
          >
            {conv.status}
          </span>
          {/* Service window badge */}
          {conv.serviceWindow &&
            (conv.serviceWindow.isOpen ? (
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                data-testid="service-window-badge"
                title={`Customer service window open. Expires: ${conv.serviceWindow.expiresAt ? new Date(conv.serviceWindow.expiresAt).toLocaleTimeString() : "in 24h"}`}
              >
                ⏱️ 24h Window Active
              </span>
            ) : (
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                data-testid="service-window-badge"
                title="24h service window expired. Freeform messaging blocked."
              >
                ⚠️ 24h Window Expired
              </span>
            ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="thread-actions flex items-center gap-2 flex-shrink-0 ml-3">
        {!isAssignedToMe && canAssign && (
          <button
            type="button"
            className="px-2.5 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors"
            onClick={onAssignToMe}
            data-testid="btn-assign-me"
          >
            Assign to Me
          </button>
        )}

        {canResolve && isOpen && (
          <button
            type="button"
            className="px-2.5 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
            onClick={onResolve}
            data-testid="btn-resolve"
          >
            Resolve
          </button>
        )}

        {canResolve && isResolved && (
          <button
            type="button"
            className="px-2.5 py-1.5 text-xs rounded border border-border hover:bg-muted transition-colors"
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

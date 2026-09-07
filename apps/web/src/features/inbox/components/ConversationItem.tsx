import type { Conversation } from "@flowdesk/contracts";
import { cn } from "@flowdesk/ui";

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  sessionUserId: string;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  tabIndex: number;
  buttonRef?: (el: HTMLButtonElement | null) => void;
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function ConversationItem({
  conversation: conv,
  isSelected,
  sessionUserId,
  onClick,
  onKeyDown,
  tabIndex,
  buttonRef
}: ConversationItemProps) {
  const initials = (conv.customerName ?? conv.customerPhone).slice(0, 2).toUpperCase();

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      data-testid={`conv-item-${conv.id}`}
      tabIndex={tabIndex}
      ref={buttonRef}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        "inbox-conv-item w-full text-left px-3 py-2.5 flex items-start gap-3 transition-colors",
        "border-b border-border/50 hover:bg-muted/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        isSelected && "selected bg-muted border-l-2 border-l-primary"
      )}
    >
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center mt-0.5"
        aria-hidden="true"
      >
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span className="text-sm font-medium truncate text-foreground">
            {conv.customerName ?? `+${conv.customerPhone}`}
          </span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatTime(conv.lastMessageAt)}
          </span>
        </div>

        {conv.customerName && (
          <p className="text-xs text-muted-foreground truncate mb-1">+{conv.customerPhone}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-muted-foreground">WhatsApp</span>
          <span
            className={cn(
              "capitalize",
              conv.status === "resolved"
                ? "text-success"
                : conv.status === "closed"
                  ? "text-muted-foreground"
                  : "text-foreground"
            )}
          >
            {conv.status}
          </span>
          {conv.assignedToUserId === sessionUserId && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
              Me
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

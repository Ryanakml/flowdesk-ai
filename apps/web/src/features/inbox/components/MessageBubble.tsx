import type { Message } from "@flowdesk/contracts";
import { cn } from "@flowdesk/ui";

type AuthorType = "customer" | "agent" | "system" | "ai-draft";

interface MessageBubbleProps {
  message: Message;
  onRetry?: (content: string) => void;
  onRemove?: () => void;
}

function renderStatusCheckmark(msg: Message) {
  if (msg.direction !== "outbound") return null;

  switch (msg.status) {
    case "queued":
      return (
        <span
          className="msg-check queued text-xs text-muted-foreground"
          title="Queued for dispatch"
          aria-label="Queued"
        >
          ⏱
        </span>
      );
    case "sent":
      return (
        <span
          className="msg-check sent text-xs text-muted-foreground"
          title="Sent to WhatsApp"
          aria-label="Sent"
        >
          ✓
        </span>
      );
    case "delivered":
      return (
        <span
          className="msg-check delivered text-xs text-muted-foreground"
          title="Delivered to customer"
          aria-label="Delivered"
        >
          ✓✓
        </span>
      );
    case "read":
      return (
        <span
          className="msg-check read text-xs text-primary"
          title="Read by customer"
          aria-label="Read"
        >
          ✓✓
        </span>
      );
    case "failed":
      return (
        <span
          className="msg-check failed text-xs text-destructive"
          title={`Failed: ${msg.errorDetail ?? "Unknown error"}`}
          aria-label="Failed"
        >
          ⚠️
        </span>
      );
    default:
      return null;
  }
}

function getAuthorType(msg: Message): AuthorType {
  if (msg.senderType === "system" || msg.senderType === "bot") return "system";
  if (msg.direction === "inbound") return "customer";
  if (msg.senderType === "agent") return "agent";
  return "agent";
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function MessageBubble({ message: msg, onRetry, onRemove }: MessageBubbleProps) {
  const authorType = getAuthorType(msg);
  const isInbound = authorType === "customer";
  const isSystem = authorType === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center my-2" data-testid={`msg-bubble-${msg.id}`}>
        <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs">
          {msg.content}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex mb-2",
        "message-bubble-wrapper",
        isInbound ? "justify-start inbound" : "justify-end outbound"
      )}
      data-testid={`msg-bubble-${msg.id}`}
    >
      <div className={cn("max-w-[75%] flex flex-col", isInbound ? "items-start" : "items-end")}>
        <div
          className={cn(
            "message-bubble px-3 py-2 rounded-2xl text-sm",
            isInbound
              ? "bg-muted text-foreground rounded-tl-sm"
              : "bg-primary text-primary-foreground rounded-tr-sm"
          )}
        >
          <div className="message-text whitespace-pre-wrap break-words">{msg.content}</div>
          <div className="message-meta flex items-center gap-1 mt-1">
            <span className="message-time text-xs opacity-70">{formatTime(msg.createdAt)}</span>
            {renderStatusCheckmark(msg)}
          </div>
        </div>

        {/* Failed message retry/remove actions */}
        {msg.status === "failed" && (
          <div className="failed-message-actions flex gap-2 mt-1">
            {onRetry && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => onRetry(msg.content)}
              >
                Retry
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-destructive"
                onClick={onRemove}
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

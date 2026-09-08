import type { Message } from "@flowdesk/contracts";
import { cn } from "@flowdesk/ui";
import { MarkdownContent } from "./MarkdownContent.js";

type AuthorType = "customer" | "agent" | "system" | "ai-draft";

interface MessageBubbleProps {
  message: Message;
  grouped?: boolean;
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
  if (msg.senderType === "system") return "system";
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

export function MessageBubble({
  message: msg,
  grouped = false,
  onRetry,
  onRemove
}: MessageBubbleProps) {
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
        "flex w-full min-w-0",
        grouped ? "mb-1" : "mb-3",
        "message-bubble-wrapper",
        isInbound ? "justify-start inbound" : "justify-end outbound"
      )}
      data-testid={`msg-bubble-${msg.id}`}
    >
      <div
        className={cn(
          "flex min-w-0 max-w-[min(70%,36rem)] flex-col max-[640px]:max-w-[85%]",
          isInbound ? "items-start" : "items-end"
        )}
      >
        <div
          className={cn(
            "message-bubble w-fit min-w-0 max-w-full px-3.5 py-2 rounded-md text-sm shadow-xs",
            isInbound
              ? cn("bg-muted text-foreground rounded-tl-xs shadow-sm", grouped && "rounded-tl-md")
              : cn("bg-primary text-primary-foreground shadow-sm", grouped && "rounded-tr-md")
          )}
        >
          <div className="message-text min-w-0 [overflow-wrap:anywhere] leading-relaxed">
            <MarkdownContent content={msg.content} />
          </div>
          <div
            className={cn(
              "message-meta flex items-center gap-1 mt-1 text-xs",
              isInbound ? "text-muted-foreground" : "text-primary-foreground/80"
            )}
          >
            <span className="message-time">{formatTime(msg.createdAt)}</span>
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

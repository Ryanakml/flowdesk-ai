import { useRef, useEffect } from "react";
import type { Message } from "@flowdesk/contracts";
import { Skeleton } from "@flowdesk/ui";
import { MessageBubble } from "./MessageBubble.js";

interface MessageTimelineProps {
  messages: Message[];
  loading: boolean;
  onRetry: (content: string) => void;
  onRemoveMessage: (msg: Message) => void;
}

export function MessageTimeline({
  messages,
  loading,
  onRetry,
  onRemoveMessage
}: MessageTimelineProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (typeof endRef.current?.scrollIntoView === "function") {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div
      className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
      role="log"
      aria-live="polite"
      aria-label="Message history"
      data-testid="thread-timeline"
    >
      {loading ? (
        <div className="space-y-4 pt-4" data-testid="timeline-loading">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
              <Skeleton
                className={`h-12 w-48 rounded-2xl ${i % 2 === 0 ? "rounded-tr-sm" : "rounded-tl-sm"}`}
              />
            </div>
          ))}
          <p className="text-center text-sm text-muted-foreground">Loading message history...</p>
        </div>
      ) : messages.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center h-full text-muted-foreground"
          data-testid="timeline-empty"
        >
          <p className="text-sm">No messages in this conversation yet.</p>
        </div>
      ) : (
        messages.map((msg, index) => (
          <MessageBubble
            key={msg.id !== "00000000-0000-0000-0000-000000000000" ? msg.id : `msg-${index}`}
            message={msg}
            onRetry={(content) => onRetry(content)}
            onRemove={() => onRemoveMessage(msg)}
          />
        ))
      )}
      <div ref={endRef} />
    </div>
  );
}

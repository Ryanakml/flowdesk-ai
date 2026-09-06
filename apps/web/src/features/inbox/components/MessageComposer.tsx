import { useRef, useId } from "react";
import { cn, Button } from "@flowdesk/ui";
import { Send, Paperclip, Layout } from "lucide-react";

type ConnectionState = "connecting" | "connected" | "reconnecting" | "offline";

interface MessageComposerProps {
  conversationStatus: string;
  serviceWindowOpen: boolean | null; // null means no service window concept
  canSend: boolean;
  connectionState: ConnectionState;
  composerText: string;
  isSending: boolean;
  mediaState: string | null;
  onComposerChange: (text: string) => void;
  onSend: () => void;
  onOpenTemplate: () => void;
  onMediaSelected: (file: File | undefined) => void;
}

export function MessageComposer({
  conversationStatus,
  serviceWindowOpen,
  canSend,
  connectionState,
  composerText,
  isSending,
  mediaState,
  onComposerChange,
  onSend,
  onOpenTemplate,
  onMediaSelected
}: MessageComposerProps) {
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const textareaId = useId();

  const isOffline = connectionState === "offline";
  const isClosed = conversationStatus === "closed";
  const isWindowExpired = serviceWindowOpen === false;

  // Disabled states
  if (isOffline) {
    return (
      <div
        className="composer-disabled-banner px-4 py-3 bg-muted/50 border-t border-border text-sm text-muted-foreground"
        data-testid="composer-offline"
      >
        You are offline. Check your connection.
      </div>
    );
  }

  if (!canSend) {
    return (
      <div
        className="composer-disabled-banner px-4 py-3 bg-muted/50 border-t border-border text-sm text-muted-foreground"
        data-testid="composer-disabled"
      >
        You need the Agent or Administrator role to send WhatsApp messages.
      </div>
    );
  }

  if (isClosed) {
    return (
      <div
        className="composer-disabled-banner px-4 py-3 bg-muted/50 border-t border-border text-sm text-muted-foreground"
        data-testid="composer-closed"
      >
        This conversation is closed. Reopen it to send a reply.
      </div>
    );
  }

  if (isWindowExpired) {
    return (
      <div
        className="composer-window-expired-banner px-4 py-3 bg-orange-50 dark:bg-orange-950/20 border-t border-border flex items-center justify-between gap-3"
        data-testid="composer-window-expired"
      >
        <div className="banner-text text-sm text-muted-foreground">
          <strong className="text-foreground">24-hour service window expired.</strong> Free-form
          messaging is blocked by WhatsApp policy. You must use an approved template to contact this
          customer.
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onOpenTemplate}
          data-testid="btn-open-template-composer"
          className="flex-shrink-0"
        >
          📋 Select WhatsApp Template
        </Button>
      </div>
    );
  }

  return (
    <footer className="thread-composer-wrapper border-t border-border bg-background">
      <form
        className="thread-composer px-3 py-2 flex flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
        data-testid="thread-composer-form"
      >
        <label htmlFor={textareaId} className="sr-only">
          Reply message
        </label>
        <textarea
          id={textareaId}
          className={cn(
            "composer-textarea w-full resize-none rounded-md border border-input bg-background px-3 py-2",
            "text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
            "min-h-[64px] max-h-[160px]"
          )}
          rows={2}
          placeholder="Type a WhatsApp reply... (Cmd+Enter to send)"
          value={composerText}
          onChange={(e) => onComposerChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              onSend();
            }
          }}
          disabled={isSending}
          aria-label="Reply message"
          data-testid="composer-input"
        />

        <div className="composer-actions flex items-center gap-2 mt-2">
          {/* Hidden file input */}
          <input
            ref={mediaInputRef}
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,image/webp,application/pdf,audio/ogg,audio/mpeg,video/mp4"
            onChange={(e) => onMediaSelected(e.target.files?.[0])}
            data-testid="media-input"
            aria-label="Attach media"
          />

          {/* Attach button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => mediaInputRef.current?.click()}
            disabled={mediaState !== null}
            aria-label="Attach"
            data-testid="btn-attach-media"
            className="h-8 text-xs px-2.5"
          >
            <Paperclip className="w-3.5 h-3.5" />
            {mediaState ? (mediaState === "scanning" ? "Scanning…" : "Sending…") : "Attach"}
          </Button>

          {/* Template button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenTemplate}
            data-testid="btn-open-template-composer"
            title="Send WhatsApp Template"
            className="h-8 text-xs px-2.5"
          >
            <Layout className="w-3.5 h-3.5" />
            Template
          </Button>

          <div className="flex-1" />

          {/* Send button */}
          <Button
            type="submit"
            size="sm"
            disabled={!composerText.trim() || isSending}
            data-testid="composer-send-btn"
            className="h-8 text-xs px-3"
          >
            <Send className="w-3.5 h-3.5" />
            {isSending ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
    </footer>
  );
}

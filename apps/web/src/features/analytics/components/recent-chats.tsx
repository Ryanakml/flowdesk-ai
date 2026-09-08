import { useEffect, useState } from "react";
import type { Conversation } from "@flowdesk/contracts";
import { Skeleton } from "@flowdesk/ui";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Card } from "../../../components/ui/card.js";
import { getConversation, listConversations } from "../../../api.js";

interface RecentChat {
  conversation: Conversation;
  preview: string;
}

interface RecentChatsProps {
  orgId: string;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function initials(conversation: Conversation): string {
  return conversation.customerName?.trim()
    ? conversation.customerName.trim().slice(0, 1).toUpperCase()
    : conversation.customerPhone.slice(0, 2);
}

export function RecentChats({ orgId }: RecentChatsProps) {
  const [chats, setChats] = useState<RecentChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRecentChats() {
      setLoading(true);
      setError(null);
      try {
        const response = await listConversations(orgId, { limit: 10 });
        const latest = [...response.items]
          .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt))
          .slice(0, 10);
        const details = await Promise.allSettled(
          latest.map((conversation) => getConversation(orgId, conversation.id))
        );
        if (cancelled) return;

        setChats(
          latest.map((conversation, index) => {
            const detail = details[index];
            const preview =
              detail?.status === "fulfilled"
                ? detail.value.messages.at(-1)?.content.trim() || "No messages yet"
                : "Latest activity available in Inbox";
            return { conversation, preview };
          })
        );
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Failed to load recent chats");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadRecentChats();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  return (
    <Card
      className="flex h-[380px] min-w-0 flex-col gap-0 rounded-xl p-4 shadow-none sm:p-5"
      data-testid="recent-chats"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <MessageCircle className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">Recent Chats</h3>
            <p className="mt-1 text-xs text-muted-foreground">Latest conversation activity</p>
          </div>
        </div>
        <a
          href="/inbox"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-sm text-[11px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View all <ArrowRight className="size-3.5" />
        </a>
      </header>
      <div
        className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto"
        tabIndex={0}
        role="region"
        aria-label="Recent conversation list"
      >
        {loading ? (
          <div className="space-y-1" role="status" aria-label="Loading recent chats">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="flex items-center gap-3 px-1 py-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="py-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : chats.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No recent conversations.</p>
        ) : (
          <div className="divide-y divide-border/70">
            {chats.map(({ conversation, preview }) => (
              <a
                key={conversation.id}
                href={`/inbox/${conversation.id}`}
                className="flex min-w-0 items-center gap-3 rounded-sm px-1 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-medium text-foreground">
                  {initials(conversation)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-card-foreground">
                      {conversation.customerName ?? `+${conversation.customerPhone}`}
                    </span>
                    <time
                      dateTime={conversation.lastMessageAt}
                      className="shrink-0 text-[10px] text-muted-foreground"
                    >
                      {formatTime(conversation.lastMessageAt)}
                    </time>
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                    {preview}
                  </span>
                </span>
                <span
                  role="img"
                  aria-label={`Conversation status: ${conversation.status}`}
                  title={`Conversation status: ${conversation.status}`}
                  className={`size-2 shrink-0 rounded-full ${conversation.status === "open" || conversation.status === "pending" ? "bg-success" : "bg-muted-foreground/50"}`}
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

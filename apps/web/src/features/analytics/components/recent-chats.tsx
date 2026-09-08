import { useEffect, useState } from "react";
import type { Conversation } from "@flowdesk/contracts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@flowdesk/ui";
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
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(conversation: Conversation): string {
  return (conversation.customerName ?? conversation.customerPhone).slice(0, 2).toUpperCase();
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
    <Card className="flex h-full min-h-[360px] min-w-0 flex-col overflow-hidden">
      <CardHeader className="shrink-0 px-4 pb-3">
        <CardTitle className="text-base">Recent Chats</CardTitle>
        <CardDescription className="text-xs">Latest conversation activity</CardDescription>
      </CardHeader>
      <CardContent className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="space-y-1" role="status" aria-label="Loading recent chats">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="flex items-center gap-3 px-2 py-2.5">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="p-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : chats.length === 0 ? (
          <p className="p-3 text-sm italic text-muted-foreground">No recent conversations.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {chats.map(({ conversation, preview }) => (
              <a
                key={conversation.id}
                href={`/inbox/${conversation.id}`}
                className="flex w-full min-w-0 items-center gap-3 px-2 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {initials(conversation)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {conversation.customerName ?? `+${conversation.customerPhone}`}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatTime(conversation.lastMessageAt)}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {preview}
                  </span>
                </span>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

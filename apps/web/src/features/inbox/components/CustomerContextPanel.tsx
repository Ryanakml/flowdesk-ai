import type {
  Conversation,
  GenerateBotDraftResponse,
  ConversationDetailResponse
} from "@flowdesk/contracts";
import { Skeleton } from "@flowdesk/ui";
import { User, Phone, Clock, Tag } from "lucide-react";

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

interface CustomerContextPanelProps {
  conversation: Conversation | null;
  notes?: ConversationDetailResponse["notes"];
  tags?: ConversationDetailResponse["tags"];
  allTags?: Array<{ id: string; name: string; color: string }>;
  copilotDraft?: GenerateBotDraftResponse | null;
  showCitations?: boolean;
  loading?: boolean;
  onToggleTag?: (tagId: string, applied: boolean) => void;
  onAddNote?: (body: string) => void;
}

export function CustomerContextPanel({
  conversation: conv,
  notes = [],
  tags = [],
  allTags = [],
  copilotDraft,
  showCitations = false,
  loading = false,
  onToggleTag,
  onAddNote
}: CustomerContextPanelProps) {
  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-4 space-y-4 bg-background border-l border-border">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-16 w-full rounded" />
      </div>
    );
  }

  if (!conv) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4 bg-background border-l border-border">
        <p>Select a conversation</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background border-l border-border">
      {/* Customer Profile */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center flex-shrink-0">
            {(conv.customerName ?? conv.customerPhone).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {conv.customerName ?? `+${conv.customerPhone}`}
            </p>
            {conv.customerName && (
              <p className="text-xs text-muted-foreground truncate">+{conv.customerPhone}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-foreground">+{conv.customerPhone}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 text-xs">📱</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              WhatsApp
            </span>
          </div>
        </div>
      </div>

      {/* Conversation Attributes */}
      <div className="p-4 border-b border-border space-y-2.5">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Conversation
        </h4>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Status</span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium badge-status badge-${conv.status}`}
          >
            {conv.status}
          </span>
        </div>

        {conv.assignedToUserId ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Assigned to</span>
            <div className="flex items-center gap-1">
              <User className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-foreground">Agent</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Assigned to</span>
            <span className="text-xs text-muted-foreground italic">Unassigned</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Created</span>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-foreground">{formatDate(conv.createdAt)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Last message</span>
          <span className="text-xs text-foreground">{formatDate(conv.lastMessageAt)}</span>
        </div>

        {conv.serviceWindow && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Service window</span>
            <span
              className={`text-xs font-medium ${conv.serviceWindow.isOpen ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}`}
            >
              {conv.serviceWindow.isOpen ? "Active" : "Expired"}
            </span>
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-1.5 mb-2">
          <Tag className="w-3.5 h-3.5 text-muted-foreground" />
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Tags
          </h4>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allTags.length > 0
            ? allTags.map((t) => {
                const applied = tags.some(
                  (it: NonNullable<ConversationDetailResponse["tags"]>[number]) => it.id === t.id
                );
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onToggleTag?.(t.id, applied)}
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                      applied
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })
            : tags.map((tag: NonNullable<ConversationDetailResponse["tags"]>[number]) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-foreground"
                >
                  {tag.name}
                </span>
              ))}
        </div>
      </div>

      {/* Citations Context */}
      {copilotDraft &&
        copilotDraft.status === "drafted" &&
        copilotDraft.citations.length > 0 &&
        showCitations && (
          <div className="p-4 border-b border-border">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              AI Citations
            </h4>
            <ul className="space-y-2">
              {copilotDraft.citations.map((cit, idx) => (
                <li key={cit.chunkId} className="text-xs">
                  <p className="font-medium text-foreground">
                    {idx + 1}. {cit.documentTitle}
                  </p>
                  <p className="text-muted-foreground line-clamp-2 mt-0.5">{cit.snippet}</p>
                  <p className="text-muted-foreground/70 mt-0.5">
                    {Math.round(cit.score * 100)}% match
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

      {/* Private Notes */}
      <div className="p-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Internal Notes {notes.length > 0 && `(${notes.length})`}
        </h4>
        {onAddNote && (
          <form
            className="mb-3 flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const input = form.elements.namedItem("noteInput") as HTMLInputElement;
              if (input && input.value.trim()) {
                onAddNote(input.value.trim());
                input.value = "";
              }
            }}
          >
            <input
              name="noteInput"
              placeholder="Add private note..."
              className="flex-1 h-7 px-2 text-xs rounded border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="submit"
              className="px-2 py-1 text-xs rounded border border-border bg-muted hover:bg-muted/80 text-foreground"
            >
              Add
            </button>
          </form>
        )}
        {notes.length > 0 && (
          <ol className="space-y-1.5">
            {notes.map((note: NonNullable<ConversationDetailResponse["notes"]>[number]) => (
              <li
                key={note.id}
                className="text-xs text-foreground bg-yellow-50 dark:bg-yellow-950/20 rounded p-2 border border-yellow-200 dark:border-yellow-900"
              >
                {note.body}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

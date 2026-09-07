import type { GenerateBotDraftResponse } from "@flowdesk/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn
} from "@flowdesk/ui";
import { RefreshCw, Send, Sparkles } from "lucide-react";
import { MarkdownContent } from "./MarkdownContent.js";

interface ConfidenceMeterProps {
  value: number;
}

function ConfidenceMeter({ value }: ConfidenceMeterProps) {
  const pct = Math.round(value * 100);
  const level = pct >= 75 ? "high" : pct >= 50 ? "medium" : "low";
  const barColor =
    level === "high" ? "bg-success" : level === "medium" ? "bg-warning" : "bg-destructive";
  const textColor =
    level === "high"
      ? "text-success"
      : level === "medium"
        ? "text-warning-foreground"
        : "text-destructive";

  return (
    <div className="flex items-center gap-2" aria-label={`Confidence ${pct}%`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("w-8 text-right text-xs font-medium", textColor)}>{pct}%</span>
    </div>
  );
}

interface AiDraftCardProps {
  draft: GenerateBotDraftResponse;
  loading: boolean;
  error: string | null;
  showCitations: boolean;
  isApproving: boolean;
  canSend: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onGenerate: () => void;
  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
  onToggleCitations: () => void;
}

const FALLBACK_STATUSES = [
  "no_evidence",
  "safety_blocked",
  "budget_exceeded",
  "provider_failed",
  "stale",
  "cancelled"
] as const;

export function AiDraftCard({
  draft,
  loading,
  error,
  showCitations,
  isApproving,
  canSend,
  open = true,
  onOpenChange,
  onGenerate,
  onApprove,
  onEdit,
  onReject,
  onToggleCitations
}: AiDraftCardProps) {
  const hasDraft = draft.status === "drafted" && draft.sendable;
  const isFallback = FALLBACK_STATUSES.includes(draft.status as (typeof FALLBACK_STATUSES)[number]);
  const fallbackMessage =
    draft.status === "safety_blocked"
      ? "Draft blocked by safety filter."
      : draft.status === "budget_exceeded"
        ? "AI budget limit reached."
        : draft.status === "provider_failed"
          ? "AI provider failed. Please try again."
          : draft.status === "stale" || draft.status === "cancelled"
            ? "Draft is stale. Generate a new one."
            : "No relevant knowledge found for this conversation.";
  const handleOpenChange = onOpenChange ?? (() => {});

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto scrollbar-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            AI Draft
          </DialogTitle>
          <DialogDescription>
            Review the generated response and the knowledge used before sending.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4" data-testid="copilot-panel">
          {loading && (
            <div
              className="flex items-center gap-2 text-sm text-muted-foreground"
              data-testid="copilot-loading"
            >
              <span className="size-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Generating draft…
            </div>
          )}
          {error && !loading && (
            <div
              className="flex items-center justify-between text-sm text-destructive"
              role="alert"
              data-testid="copilot-error"
            >
              <span>AI draft error</span>
              <Button type="button" variant="link" size="sm" onClick={onGenerate}>
                Retry
              </Button>
            </div>
          )}
          {!loading && !error && isFallback && (
            <p className="text-sm text-muted-foreground" data-testid="copilot-fallback">
              {fallbackMessage}
            </p>
          )}
          {!loading && !error && hasDraft && !isFallback && (
            <div className="space-y-4" data-testid="copilot-draft-card">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Confidence</p>
                <ConfidenceMeter value={draft.confidence} />
              </div>
              <div
                className="rounded-md border border-border bg-muted/30 p-3 text-sm"
                data-testid="copilot-draft-text"
              >
                <MarkdownContent content={draft.suggestedContent} className="break-words" />
              </div>
              {draft.reasoning && (
                <p className="text-xs text-muted-foreground">{draft.reasoning}</p>
              )}
              {draft.citations.length > 0 && (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-0 text-xs"
                    onClick={onToggleCitations}
                    aria-expanded={showCitations}
                    data-testid="copilot-citations-toggle"
                  >
                    Sources / knowledge used ({draft.citations.length})
                  </Button>
                  {showCitations && (
                    <ul
                      className="space-y-2 rounded-md border border-border p-3 text-xs"
                      data-testid="copilot-citations-list"
                    >
                      {draft.citations.map((citation, index) => (
                        <li key={citation.chunkId}>
                          <p className="font-medium text-foreground">
                            {index + 1}. {citation.documentTitle}
                          </p>
                          <p className="text-muted-foreground">{citation.snippet}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="flex-wrap sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onGenerate}
            disabled={loading || isApproving}
          >
            <RefreshCw className="size-4" />
            Regenerate
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onEdit}
              disabled={!hasDraft || isApproving}
              data-testid="copilot-edit-btn"
            >
              Edit Draft
            </Button>
            {canSend && (
              <Button
                type="button"
                onClick={onApprove}
                disabled={!hasDraft || isApproving}
                data-testid="copilot-approve-btn"
              >
                <Send className="size-4" />
                {isApproving ? "Sending…" : "Send"}
              </Button>
            )}
            {!canSend && (
              <Button type="button" variant="ghost" onClick={onReject} disabled={isApproving}>
                Close
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

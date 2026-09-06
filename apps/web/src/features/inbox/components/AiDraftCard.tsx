import type { GenerateBotDraftResponse } from "@flowdesk/contracts";
import { cn } from "@flowdesk/ui";
import { Sparkles } from "lucide-react";

interface ConfidenceMeterProps {
  value: number;
}

function ConfidenceMeter({ value }: ConfidenceMeterProps) {
  const pct = Math.round(value * 100);
  const level = pct >= 75 ? "high" : pct >= 50 ? "medium" : "low";
  const barColor =
    level === "high" ? "bg-green-500" : level === "medium" ? "bg-yellow-500" : "bg-red-500";
  const textColor =
    level === "high"
      ? "text-green-600 dark:text-green-400"
      : level === "medium"
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";

  return (
    <div className="copilot-confidence flex items-center gap-2" aria-label={`Confidence ${pct}%`}>
      <div className="copilot-confidence-bar-track flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "copilot-confidence-bar-fill h-full rounded-full transition-all",
            barColor,
            `confidence-${level}`
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={cn(
          `copilot-confidence-pct confidence-${level}`,
          "text-xs font-medium w-8 text-right",
          textColor
        )}
      >
        {pct}%
      </span>
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
  onGenerate,
  onApprove,
  onEdit,
  onReject,
  onToggleCitations
}: AiDraftCardProps) {
  const hasDraft = draft.status === "drafted" && draft.sendable;
  const isOff = draft.status === "off";
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

  return (
    <section
      className="copilot-panel border-t border-border bg-muted/30 px-4 py-3"
      aria-label="AI Copilot"
      data-testid="copilot-panel"
    >
      <div className="copilot-header flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
          <span className="copilot-label text-xs font-semibold text-foreground">AI Copilot</span>
        </div>
        <div className="flex gap-1">
          {!loading && !hasDraft && !error && (
            <button
              type="button"
              className="btn btn-sm btn-copilot-generate px-2 py-1 text-xs rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              onClick={onGenerate}
              disabled={loading}
              data-testid="copilot-generate-btn"
              aria-label="✨ Generate Draft"
            >
              ✨ Generate Draft
            </button>
          )}
          {hasDraft && (
            <button
              type="button"
              className="btn btn-sm btn-ghost copilot-refresh-btn p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
              onClick={onGenerate}
              disabled={loading || isApproving}
              title="Regenerate draft"
              aria-label="Regenerate draft"
              data-testid="copilot-refresh-btn"
            >
              🔄
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="copilot-loading flex items-center gap-2 py-2" data-testid="copilot-loading">
          <span className="inline-block w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground">Generating draft…</span>
        </div>
      )}

      {error && !loading && (
        <div
          className="copilot-error flex items-center justify-between py-1"
          role="alert"
          data-testid="copilot-error"
        >
          <span className="text-xs text-destructive">⚠️ AI draft error</span>
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={onGenerate}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && isOff && (
        <p className="copilot-off-msg text-xs text-muted-foreground py-1" data-testid="copilot-off">
          AI Copilot is off for this conversation.
        </p>
      )}

      {!loading && !error && isFallback && (
        <p
          className="copilot-fallback-msg text-xs text-muted-foreground py-1"
          data-testid="copilot-fallback"
        >
          {fallbackMessage}
        </p>
      )}

      {!loading && !error && hasDraft && !isFallback && !isOff && (
        <div className="copilot-draft-card" data-testid="copilot-draft-card">
          {/* Confidence */}
          <div className="copilot-draft-meta flex items-center gap-2 mb-2">
            <span className="copilot-meta-label text-xs text-muted-foreground">Confidence</span>
            <div className="flex-1">
              <ConfidenceMeter value={draft.confidence} />
            </div>
          </div>

          {/* Draft text */}
          <div className="copilot-draft-body mb-2">
            <p
              className="copilot-draft-text text-sm text-foreground bg-background rounded border border-border px-2.5 py-2 whitespace-pre-wrap"
              data-testid="copilot-draft-text"
            >
              {draft.suggestedContent}
            </p>
          </div>

          {/* Reasoning */}
          {draft.reasoning && (
            <details className="copilot-reasoning mb-2">
              <summary className="copilot-reasoning-summary text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                Reasoning
              </summary>
              <p className="copilot-reasoning-text text-xs text-muted-foreground mt-1 pl-2">
                {draft.reasoning}
              </p>
            </details>
          )}

          {/* Citations */}
          {draft.citations.length > 0 && (
            <div className="copilot-citations-section mb-2">
              <button
                type="button"
                className="btn btn-sm btn-ghost copilot-citations-toggle text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={onToggleCitations}
                aria-expanded={showCitations}
                data-testid="copilot-citations-toggle"
              >
                📚 Citations ({draft.citations.length})
                <span aria-hidden="true">{showCitations ? " ▲" : " ▼"}</span>
              </button>
              {showCitations && (
                <ul
                  className="copilot-citations-list mt-1.5 space-y-1.5"
                  aria-label="Citations"
                  data-testid="copilot-citations-list"
                >
                  {draft.citations.map((cit, idx) => (
                    <li key={cit.chunkId} className="copilot-citation-item flex gap-2 text-xs">
                      <span className="citation-index text-muted-foreground font-medium flex-shrink-0">
                        {idx + 1}.
                      </span>
                      <div className="citation-content">
                        <p className="citation-title font-medium text-foreground">
                          {cit.documentTitle}
                        </p>
                        <blockquote className="citation-snippet text-muted-foreground border-l-2 border-border pl-2 my-0.5 italic">
                          {cit.snippet}
                        </blockquote>
                        <span className="citation-score text-muted-foreground">
                          {Math.round(cit.score * 100)}% match
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Actions */}
          <div
            className="copilot-actions flex items-center gap-2"
            role="group"
            aria-label="Copilot draft actions"
          >
            {canSend && draft.sendable && (
              <button
                type="button"
                className="btn btn-sm btn-copilot-approve px-2.5 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                onClick={onApprove}
                disabled={isApproving}
                data-testid="copilot-approve-btn"
              >
                {isApproving ? "Sending…" : "✅ Approve & Send"}
              </button>
            )}
            <button
              type="button"
              className="px-2.5 py-1 text-xs rounded border border-border hover:bg-muted transition-colors disabled:opacity-50"
              onClick={onEdit}
              disabled={isApproving}
              data-testid="copilot-edit-btn"
            >
              ✏️ Edit
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost copilot-reject-btn px-2 py-1 text-xs rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
              onClick={onReject}
              disabled={isApproving}
              data-testid="copilot-reject-btn"
            >
              ✕ Discard
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

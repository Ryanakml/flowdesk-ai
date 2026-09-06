import type { Conversation, TemplatePreviewResponse } from "@flowdesk/contracts";
import type { ConversationTemplateItem } from "../../../api.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@flowdesk/ui";

interface TemplateDialogProps {
  open: boolean;
  onClose: () => void;
  conversation: Conversation;
  templates: ConversationTemplateItem[];
  loading: boolean;
  selectedTemplateKey: string;
  templateVariables: Record<string, string>;
  templatePreview: TemplatePreviewResponse | null;
  previewError: string | null;
  isSending: boolean;
  onTemplateKeyChange: (key: string) => void;
  onVariableChange: (varNum: string, value: string) => void;
  onSend: () => void;
}

export function TemplateDialog({
  open,
  onClose,
  templates,
  loading,
  selectedTemplateKey,
  templateVariables,
  templatePreview,
  previewError,
  isSending,
  onTemplateKeyChange,
  onVariableChange,
  onSend
}: TemplateDialogProps) {
  const activeTemplate = templates.find((t) => `${t.name}:${t.language}` === selectedTemplateKey);

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent
        className="max-w-lg"
        data-testid="template-modal"
        aria-labelledby="template-modal-title"
      >
        <DialogHeader>
          <DialogTitle id="template-modal-title">Send WhatsApp Template</DialogTitle>
        </DialogHeader>

        <div className="modal-body space-y-4 py-2">
          {loading ? (
            <div
              className="text-center py-4 text-sm text-muted-foreground"
              data-testid="modal-loading"
            >
              Loading approved templates...
            </div>
          ) : templates.length === 0 ? (
            <div
              className="text-center py-4 text-sm text-muted-foreground"
              data-testid="modal-empty"
            >
              No approved templates found for this channel.
            </div>
          ) : (
            <div className="template-form space-y-4">
              {/* Template selector */}
              <div className="space-y-1">
                <label htmlFor="template-select" className="text-sm font-medium text-foreground">
                  Select Approved Template
                </label>
                <select
                  id="template-select"
                  className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  value={selectedTemplateKey}
                  onChange={(e) => onTemplateKeyChange(e.target.value)}
                  data-testid="template-select"
                >
                  {templates.map((t) => (
                    <option key={`${t.name}:${t.language}`} value={`${t.name}:${t.language}`}>
                      {t.name} ({t.language}) - {t.category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Variable inputs */}
              {activeTemplate && activeTemplate.variableCount > 0 && (
                <div className="template-variables-section space-y-2">
                  <h4 className="text-sm font-medium text-foreground">Template Variables</h4>
                  {Array.from({ length: activeTemplate.variableCount }, (_, i) => i + 1).map(
                    (varNum) => (
                      <div key={varNum} className="space-y-1">
                        <label
                          htmlFor={`var-input-${varNum}`}
                          className="text-xs font-medium text-muted-foreground"
                        >
                          {`Variable {{${varNum}}}`}
                        </label>
                        <input
                          id={`var-input-${varNum}`}
                          type="text"
                          className="w-full h-8 px-2.5 text-sm rounded border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder={`Value for {{${varNum}}}`}
                          value={templateVariables[String(varNum)] ?? ""}
                          onChange={(e) => onVariableChange(String(varNum), e.target.value)}
                          data-testid={`var-input-${varNum}`}
                        />
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Preview card */}
              <div
                className="template-preview-card rounded-lg border border-border bg-muted/30 p-3"
                data-testid="template-preview-card"
              >
                <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                  Rendered Preview
                </h4>
                {templatePreview ? (
                  <div className="preview-bubble space-y-1.5">
                    {templatePreview.renderedHeader && (
                      <div className="preview-header text-xs font-semibold text-foreground">
                        {templatePreview.renderedHeader}
                      </div>
                    )}
                    <div className="preview-body text-sm text-foreground">
                      {templatePreview.renderedBody}
                    </div>
                    <div className="preview-meta">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        ✓ Verified & Approved
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="preview-placeholder text-xs text-muted-foreground">
                    {activeTemplate && activeTemplate.variableCount > 0
                      ? "Fill in all variables above to generate preview."
                      : "Generating preview..."}
                  </div>
                )}
              </div>

              {/* Error */}
              {previewError && (
                <div
                  className="error-banner text-xs text-destructive bg-destructive/10 rounded p-2"
                  data-testid="template-error-banner"
                >
                  {previewError}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            disabled={!templatePreview || !templatePreview.isEligible || isSending}
            onClick={onSend}
            data-testid="btn-submit-template-send"
          >
            {isSending ? "Sending..." : "Send Template"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

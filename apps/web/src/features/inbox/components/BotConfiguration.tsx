import { useEffect, useState } from "react";
import type { BotConfigResponse } from "@flowdesk/contracts";
import { Button, Label } from "@flowdesk/ui";
import { getBotConfig, updateBotConfig } from "../../../api.js";
import { setAutomationEmergencyStop } from "../../../automation-api.js";

interface BotConfigurationProps {
  orgId: string;
  canManage: boolean;
  fetcher?: typeof fetch | undefined;
  showToast?: (message: string, type?: "success" | "error") => void;
}

export function BotConfiguration({
  orgId,
  canManage,
  fetcher = fetch,
  showToast: notify
}: BotConfigurationProps) {
  const [botConfig, setBotConfig] = useState<BotConfigResponse | null>(null);
  const [selectedMode, setSelectedMode] = useState<"off" | "draft" | "auto">("draft");
  const [savingMode, setSavingMode] = useState(false);
  const [savingEmergencyStop, setSavingEmergencyStop] = useState(false);

  const [feedback, setFeedback] = useState<{ message: string; type?: "success" | "error" } | null>(
    null
  );
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const showToast = (message: string, type?: "success" | "error") => {
    setFeedback({ message, type: type ?? "success" });
    notify?.(message, type);
  };

  useEffect(() => {
    let active = true;
    setBotConfig(null);
    setLoadError("");
    setFeedback(null);
    void getBotConfig(orgId, fetcher)
      .then((config) => {
        if (!active) return;
        setBotConfig(config);
        setSelectedMode(config.mode);
      })
      .catch((error: unknown) => {
        if (active)
          setLoadError(error instanceof Error ? error.message : "Failed to load bot configuration");
      });
    return () => {
      active = false;
    };
  }, [orgId, fetcher, retry]);

  const saveMode = async () => {
    try {
      setSavingMode(true);
      const updated = await updateBotConfig(orgId, { mode: selectedMode }, fetcher);
      setBotConfig(updated);
      showToast(
        selectedMode === "auto"
          ? "AUTO enabled. Eligible grounded inbound replies may now send automatically."
          : `Bot mode changed to ${selectedMode.toUpperCase()}.`,
        "success"
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to update bot mode", "error");
    } finally {
      setSavingMode(false);
    }
  };

  const toggleEmergencyStop = async () => {
    if (!botConfig) return;
    const nextDisabled = !botConfig.emergencyDisabled;
    try {
      setSavingEmergencyStop(true);
      const updated = await setAutomationEmergencyStop(orgId, nextDisabled, fetcher);
      setBotConfig((current) =>
        current ? { ...current, emergencyDisabled: updated.emergencyDisabled } : current
      );
      showToast(
        updated.emergencyDisabled
          ? "Emergency stop engaged. Pending and new automated sends are halted."
          : "Emergency stop cleared. Automation resumed.",
        "success"
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to update emergency stop",
        "error"
      );
    } finally {
      setSavingEmergencyStop(false);
    }
  };

  return (
    <div
      className="min-w-0 space-y-3 text-xs [overflow-wrap:anywhere]"
      data-testid="inbox-bot-configuration"
    >
      <p className="text-muted-foreground">Applies to all conversations in this workspace.</p>
      {loadError ? (
        <div role="alert" className="space-y-2 text-destructive">
          <p>{loadError}</p>
          <Button variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>
            Retry configuration
          </Button>
        </div>
      ) : (
        <>
          {botConfig ? (
            <div className="space-y-3">
              <div className="space-y-2 min-w-0">
                <Label htmlFor="bot-mode">Bot mode</Label>
                <select
                  id="bot-mode"
                  value={selectedMode}
                  disabled={
                    !canManage || savingMode || savingEmergencyStop || botConfig.emergencyDisabled
                  }
                  onChange={(e) => setSelectedMode(e.target.value as "off" | "draft" | "auto")}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  <option value="off">Off</option>
                  <option value="draft">Draft</option>
                  <option value="auto">Auto</option>
                </select>
              </div>

              {selectedMode === "auto" && !botConfig.emergencyDisabled && (
                <p role="alert" className="text-xs text-muted-foreground font-medium">
                  AUTO is opt-in. Low-confidence, stale, paused, assigned, disabled, or
                  out-of-window conversations remain blocked.
                </p>
              )}
              {botConfig.emergencyDisabled && (
                <p role="alert" className="text-xs text-destructive font-medium">
                  Emergency stop is active. Pending and new automated sends are blocked while manual
                  agent replies remain available.
                </p>
              )}

              {canManage && (
                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    type="button"
                    disabled={
                      savingMode ||
                      savingEmergencyStop ||
                      botConfig.emergencyDisabled ||
                      selectedMode === botConfig.mode
                    }
                    onClick={() => void saveMode()}
                    size="sm"
                    className="w-full cursor-pointer"
                  >
                    {savingMode ? "Saving…" : `Save ${selectedMode.toUpperCase()} mode`}
                  </Button>
                  <Button
                    type="button"
                    variant={botConfig.emergencyDisabled ? "default" : "destructive"}
                    data-testid="automation-emergency-stop"
                    disabled={savingEmergencyStop || savingMode}
                    onClick={() => void toggleEmergencyStop()}
                    size="sm"
                    className="w-full cursor-pointer"
                  >
                    {savingEmergencyStop
                      ? "Updating…"
                      : botConfig.emergencyDisabled
                        ? "Resume automation"
                        : "Emergency stop"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p role="status" className="text-sm text-muted-foreground">
              Loading bot configuration…
            </p>
          )}
        </>
      )}
      {feedback && (
        <p
          role={feedback.type === "error" ? "alert" : "status"}
          className={feedback.type === "error" ? "text-destructive" : "text-success"}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}

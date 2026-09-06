import { useCallback, useEffect, useState } from "react";
import type {
  BotConfigResponse,
  KnowledgeSourceResponse,
  AutomationPolicyResponse,
  SimulatePolicyResponse
} from "@flowdesk/contracts";
import { Brain, Cpu, Plus, Sliders, Play } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea
} from "@flowdesk/ui";
import {
  createKnowledgeSourceApi,
  getBotConfig,
  listKnowledgeSourcesApi,
  updateBotConfig
} from "./api.js";
import {
  setAutomationEmergencyStop,
  fetchAutomationPolicies,
  publishAutomationPolicy,
  simulateAutomationPolicy
} from "./automation-api.js";

export interface KnowledgeViewProps {
  orgId: string;
  canManage: boolean;
  showToast: (message: string, type?: "success" | "error") => void;
}

export function KnowledgeView({ orgId, canManage, showToast }: KnowledgeViewProps) {
  const [sources, setSources] = useState<KnowledgeSourceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState<"text" | "url">("text");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [botConfig, setBotConfig] = useState<BotConfigResponse | null>(null);
  const [selectedMode, setSelectedMode] = useState<"off" | "draft" | "auto">("draft");
  const [savingMode, setSavingMode] = useState(false);
  const [savingEmergencyStop, setSavingEmergencyStop] = useState(false);

  // Policy & Simulator state
  const [policies, setPolicies] = useState<AutomationPolicyResponse[]>([]);
  const [activePolicy, setActivePolicy] = useState<AutomationPolicyResponse | null>(null);
  const [draftPolicy, setDraftPolicy] = useState<AutomationPolicyResponse | null>(null);
  const [publishingPolicy, setPublishingPolicy] = useState(false);
  const [simIntent, setSimIntent] = useState("");
  const [simTag, setSimTag] = useState("");
  const [simHours, setSimHours] = useState(true);
  const [simConsent, setSimConsent] = useState(true);
  const [simulationResult, setSimulationResult] = useState<SimulatePolicyResponse | null>(null);
  const [simulating, setSimulating] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const result = await listKnowledgeSourcesApi(orgId);
      setSources(result.sources);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to load knowledge sources",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [orgId, showToast]);

  const refreshPolicies = useCallback(async () => {
    try {
      const list = await fetchAutomationPolicies(orgId);
      setPolicies(list);
      setActivePolicy(list.find((p) => p.status === "published") ?? null);
      setDraftPolicy(list.find((p) => p.status === "draft") ?? null);
    } catch {
      // ignore
    }
  }, [orgId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    void refreshPolicies();
  }, [refresh, refreshPolicies]);

  useEffect(() => {
    void getBotConfig(orgId)
      .then((config) => {
        setBotConfig(config);
        setSelectedMode(config.mode);
      })
      .catch((error: unknown) =>
        showToast(
          error instanceof Error ? error.message : "Failed to load bot configuration",
          "error"
        )
      );
  }, [orgId, showToast]);

  const saveMode = async () => {
    try {
      setSavingMode(true);
      const updated = await updateBotConfig(orgId, { mode: selectedMode });
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
      const updated = await setAutomationEmergencyStop(orgId, nextDisabled);
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

  const handlePublishDraft = async () => {
    if (!draftPolicy) return;
    try {
      setPublishingPolicy(true);
      await publishAutomationPolicy(orgId, draftPolicy.id, "Published from web dashboard");
      showToast("Automation policy published successfully.", "success");
      void refreshPolicies();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to publish policy", "error");
    } finally {
      setPublishingPolicy(false);
    }
  };

  const handleRunSimulation = async () => {
    try {
      setSimulating(true);
      const res = await simulateAutomationPolicy(orgId, {
        context: {
          intent: simIntent.trim() || undefined,
          tags: simTag.trim() ? [simTag.trim()] : undefined,
          isWithinBusinessHours: simHours,
          customerConsentGiven: simConsent
        }
      });
      setSimulationResult(res);
      showToast("Policy simulation completed.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Simulation failed", "error");
    } finally {
      setSimulating(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      if (type === "text") {
        await createKnowledgeSourceApi(orgId, {
          type: "text",
          name: name.trim(),
          content: content.trim()
        });
      } else {
        await createKnowledgeSourceApi(orgId, {
          type: "url",
          name: name.trim(),
          url: content.trim()
        });
      }
      setName("");
      setContent("");
      showToast("Knowledge source queued for indexing", "success");
      void refresh();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to create knowledge source",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8" data-testid="knowledge-view">
      {/* 1. AI Automation Bot Configuration Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Cpu className="size-5 text-primary" />
              <CardTitle className="text-xl font-bold">AI Automation</CardTitle>
            </div>
            <CardDescription>
              OFF disables AI, DRAFT requires human approval, and AUTO may send only grounded,
              policy-eligible replies through the standard WhatsApp delivery queue.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {botConfig ? (
            <div className="space-y-3">
              <div className="space-y-2 max-w-md">
                <Label htmlFor="bot-mode">Bot mode</Label>
                <select
                  id="bot-mode"
                  value={selectedMode}
                  disabled={!canManage || savingMode || botConfig.emergencyDisabled}
                  onChange={(e) => setSelectedMode(e.target.value as "off" | "draft" | "auto")}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  <option value="off">OFF — no AI generation</option>
                  <option value="draft">DRAFT — human review required</option>
                  <option value="auto">AUTO — eligible replies send automatically</option>
                </select>
              </div>

              {selectedMode === "auto" && !botConfig.emergencyDisabled && (
                <p role="alert" className="text-xs text-amber-600 dark:text-amber-400 font-medium">
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
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    type="button"
                    disabled={
                      savingMode || botConfig.emergencyDisabled || selectedMode === botConfig.mode
                    }
                    onClick={() => void saveMode()}
                    className="cursor-pointer"
                  >
                    {savingMode ? "Saving…" : `Save ${selectedMode.toUpperCase()} mode`}
                  </Button>
                  <Button
                    type="button"
                    variant={botConfig.emergencyDisabled ? "default" : "destructive"}
                    data-testid="automation-emergency-stop"
                    disabled={savingEmergencyStop}
                    onClick={() => void toggleEmergencyStop()}
                    className="cursor-pointer"
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
        </CardContent>
      </Card>

      {/* 2. Automation Policy Configuration & Simulator */}
      <Card data-testid="automation-policy-section">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sliders className="size-5 text-primary" />
              <CardTitle className="text-xl font-bold">
                Automation Policy Engine & Simulator
              </CardTitle>
            </div>
            <CardDescription>
              Configure deterministic routing and auto-send policies with fail-closed safety,
              conflict detection, and versioned promotion.
            </CardDescription>
          </div>
          {draftPolicy && canManage && (
            <Button
              type="button"
              disabled={publishingPolicy}
              onClick={() => void handlePublishDraft()}
              className="cursor-pointer"
              size="sm"
            >
              {publishingPolicy ? "Publishing…" : `Publish Draft v${draftPolicy.version}`}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <h3 className="text-sm font-semibold text-foreground">Policy Status</h3>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Active Version:</strong>{" "}
                  {activePolicy
                    ? `v${activePolicy.version} (${activePolicy.rules.length} rules)`
                    : "No active policy"}
                </p>
                {draftPolicy && (
                  <p>
                    <strong className="text-foreground">Draft Version:</strong> v
                    {draftPolicy.version} ({draftPolicy.rules.length} rules)
                  </p>
                )}
                <p>
                  <strong className="text-foreground">Total Versions:</strong> {policies.length}
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <h3 className="text-sm font-semibold text-foreground">Policy Simulator</h3>
              <div className="space-y-3">
                <Input
                  placeholder="Test Intent (e.g. support, billing)"
                  value={simIntent}
                  onChange={(e) => setSimIntent(e.target.value)}
                />
                <Input
                  placeholder="Test Tag (e.g. vip, urgent)"
                  value={simTag}
                  onChange={(e) => setSimTag(e.target.value)}
                />
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simHours}
                      onChange={(e) => setSimHours(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-ring"
                    />
                    Within Business Hours
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simConsent}
                      onChange={(e) => setSimConsent(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-ring"
                    />
                    Customer Consent Confirmed
                  </label>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="policy-simulator-btn"
                  disabled={simulating}
                  onClick={() => void handleRunSimulation()}
                  className="cursor-pointer"
                >
                  <Play className="mr-1.5 size-3.5" />
                  {simulating ? "Simulating…" : "Run Simulation"}
                </Button>
              </div>
            </div>
          </div>

          {simulationResult && (
            <div
              data-testid="policy-simulator-results"
              className="rounded-lg border border-border bg-card p-4 space-y-3"
            >
              <h4 className="text-sm font-semibold text-foreground">Simulation Output</h4>
              <div className="text-sm flex items-center gap-1.5 flex-wrap">
                <strong className="text-foreground">Decision:</strong>{" "}
                <Badge variant="outline" className="mr-1 font-mono">
                  {simulationResult.action.toUpperCase()}
                </Badge>{" "}
                — {simulationResult.reason}
              </div>
              {simulationResult.matchedRule && (
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">Matched Rule:</strong>{" "}
                  {simulationResult.matchedRule.name} (Priority{" "}
                  {simulationResult.matchedRule.priority})
                </p>
              )}
              {simulationResult.conflicts.length > 0 && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  <strong className="font-semibold">Detected Conflicts:</strong>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">
                    {simulationResult.conflicts.map((c, i) => (
                      <li key={i}>
                        [{c.type}] {c.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="space-y-1 pt-1">
                <strong className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Decision Trace ({simulationResult.decisionTrace.length} rules evaluated):
                </strong>
                <ul className="space-y-1 text-xs">
                  {simulationResult.decisionTrace.map((t) => (
                    <li key={t.ruleId} className="flex items-center gap-2">
                      <span
                        className={
                          t.matched ? "text-emerald-500 font-bold" : "text-muted-foreground"
                        }
                      >
                        {t.matched ? "✓" : "✗"}
                      </span>
                      <strong className="text-foreground">{t.ruleName}</strong> (priority{" "}
                      {t.priority}): <span className="text-muted-foreground">{t.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Knowledge Sources Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Brain className="size-5 text-primary" />
              <CardTitle className="text-xl font-bold">AI Knowledge</CardTitle>
            </div>
            <CardDescription>
              Add trusted text or a public website. Drafts use only ready tenant-scoped sources.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {canManage && (
            <form
              onSubmit={(event) => void submit(event)}
              className="space-y-4 rounded-lg border border-border p-4 bg-muted/20"
            >
              <div className="space-y-2 max-w-xs">
                <Label htmlFor="knowledge-type">Source type</Label>
                <Select
                  value={type}
                  onValueChange={(val) => {
                    setType(val as "text" | "url");
                    setContent("");
                  }}
                >
                  <SelectTrigger id="knowledge-type" className="cursor-pointer">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="url">Public URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="knowledge-name">Name</Label>
                <Input
                  id="knowledge-name"
                  value={name}
                  maxLength={200}
                  required
                  placeholder="e.g. Return Policy FAQ"
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="knowledge-content">
                  {type === "text" ? "Knowledge text" : "Public URL"}
                </Label>
                {type === "text" ? (
                  <Textarea
                    id="knowledge-content"
                    rows={6}
                    value={content}
                    required
                    placeholder="Enter grounding knowledge content here..."
                    onChange={(event) => setContent(event.target.value)}
                  />
                ) : (
                  <Input
                    id="knowledge-content"
                    type="url"
                    placeholder="https://docs.example.com/help"
                    value={content}
                    required
                    onChange={(event) => setContent(event.target.value)}
                  />
                )}
              </div>

              <Button type="submit" disabled={submitting} size="sm" className="cursor-pointer">
                <Plus className="mr-1.5 size-3.5" />
                {submitting ? "Queueing…" : "Add knowledge"}
              </Button>
            </form>
          )}

          <div>
            {loading ? (
              <p role="status" className="py-8 text-center text-sm text-muted-foreground">
                Loading knowledge…
              </p>
            ) : sources.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No knowledge sources yet.
              </p>
            ) : (
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sources.map((source) => (
                      <TableRow key={source.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-semibold text-foreground">
                          {source.name}
                        </TableCell>
                        <TableCell className="uppercase text-xs font-mono text-muted-foreground">
                          {source.type}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              source.status === "ready"
                                ? "secondary"
                                : source.status === "failed"
                                  ? "destructive"
                                  : "outline"
                            }
                            data-status={source.status}
                            className={`capitalize text-xs ${
                              source.status === "ready"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200"
                                : ""
                            }`}
                          >
                            {source.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {source.statusReason ??
                            (source.lastIndexedAt
                              ? new Date(source.lastIndexedAt).toLocaleString()
                              : "—")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

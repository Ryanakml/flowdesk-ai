import { useState, useEffect, useCallback } from "react";
import type {
  Conversation,
  Message,
  ConversationDetailResponse,
  InboxWorkspaceResourcesResponse,
  GenerateBotDraftResponse,
  TemplatePreviewResponse,
  RealtimeHint
} from "@flowdesk/contracts";
import { type RoleKey, hasPermission } from "@flowdesk/domain";
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
  useDefaultLayout
} from "react-resizable-panels";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@flowdesk/ui";
import { PanelRightOpen, ArrowLeft } from "lucide-react";

import {
  listConversations,
  getConversation,
  sendOutboundMessage,
  performConversationOperation,
  getInboxWorkspaceResources,
  saveInboxFilter,
  deleteInboxFilter,
  createAttachmentUploadSession,
  uploadAttachmentBytes,
  completeAttachmentUpload,
  getAttachment,
  listConversationTemplates,
  previewTemplate,
  type ConversationTemplateItem,
  ApiError,
  generateBotDraft,
  getLatestBotDraft,
  applyBotDraftAction
} from "../../api.js";
import { useRealtimeSync } from "../../realtime.js";

import { useConversationFilters } from "./hooks/useConversationFilters.js";
import { ConversationList } from "./components/ConversationList.js";
import { ConversationHeader } from "./components/ConversationHeader.js";
import { MessageTimeline } from "./components/MessageTimeline.js";
import { MessageComposer } from "./components/MessageComposer.js";
import { AiDraftCard } from "./components/AiDraftCard.js";
import { CustomerContextPanel } from "./components/CustomerContextPanel.js";
import { TemplateDialog } from "./components/TemplateDialog.js";

export interface InboxWorkspaceProps {
  organizationId: string;
  userRole: RoleKey;
  sessionUserId: string;
  fetcher?: typeof fetch;
  initialConversations?: Conversation[];
  initialActiveConversation?: Conversation;
  activeConversationId?: string | null;
  onSelectConversation?: (id: string) => void;
  initialMessages?: Message[];
  onRealtimeHint?: (hint: RealtimeHint) => void;
  onRealtimeReconcile?: () => void;
}

type ConnectionState = "connecting" | "connected" | "reconnecting" | "offline";

export function InboxWorkspace({
  organizationId,
  userRole,
  sessionUserId,
  fetcher = fetch,
  initialConversations,
  initialActiveConversation,
  activeConversationId,
  onSelectConversation,
  initialMessages,
  onRealtimeHint,
  onRealtimeReconcile
}: InboxWorkspaceProps) {
  // 1. Filter State
  const {
    filters,
    setStatusFilter,
    setAssigneeFilter,
    setQueueFilter,
    setSearchQuery,
    filterName,
    setFilterName,
    selectedSavedFilterId,
    setSelectedSavedFilterId,
    applySavedFilter
  } = useConversationFilters();

  const [locale, setLocale] = useState<"en" | "id">("en");

  // 2. Conversations State
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations ?? []);
  const [loadingConversations, setLoadingConversations] = useState(
    initialConversations === undefined
  );
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    activeConversationId ?? initialActiveConversation?.id ?? initialConversations?.[0]?.id ?? null
  );

  const [resources, setResources] = useState<InboxWorkspaceResourcesResponse>({
    queues: [],
    tags: [],
    savedFilters: []
  });

  // 3. Thread Detail State
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(
    initialActiveConversation ?? null
  );
  const [messages, setMessages] = useState<Message[]>(initialMessages ?? []);
  const [notes, setNotes] = useState<ConversationDetailResponse["notes"]>([]);
  const [conversationTags, setConversationTags] = useState<ConversationDetailResponse["tags"]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // 4. Composer & Media State
  const [composerText, setComposerText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "connecting"
  );
  const [hasConflict, setHasConflict] = useState(false);
  const [mediaState, setMediaState] = useState<string | null>(null);

  // 5. Template Modal State
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [channelTemplates, setChannelTemplates] = useState<ConversationTemplateItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("");
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [templatePreview, setTemplatePreview] = useState<TemplatePreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isSendingTemplate, setIsSendingTemplate] = useState(false);

  // 6. AI Copilot State
  const [copilotDraft, setCopilotDraft] = useState<GenerateBotDraftResponse | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [showCitations, setShowCitations] = useState(false);
  const [isApprovingSend, setIsApprovingSend] = useState(false);
  const [copilotEditingRunId, setCopilotEditingRunId] = useState<string | null>(null);

  // 7. Responsive Layout / Sheet State
  const [tabletContextOpen, setTabletContextOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const [isTablet, setIsTablet] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 && window.innerWidth < 1024 : false
  );

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setIsMobile(w < 768);
      setIsTablet(w >= 768 && w < 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 8. Desktop 3-pane layout persistence
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "flowdesk-inbox-panels",
    ...(typeof window !== "undefined" && window.localStorage
      ? { storage: window.localStorage }
      : {})
  });

  // Permissions
  const canSend = hasPermission(userRole, "message:send");
  const canResolve = hasPermission(userRole, "conversation:resolve");
  const canAssign = hasPermission(userRole, "conversation:assign");

  // Load conversations
  const loadConversations = useCallback(
    async (preserveSelection = true) => {
      try {
        setLoadingConversations(true);
        setActionError(null);

        const query: { status?: string; assignedTo?: string; queueId?: string } = {};
        if (filters.status !== "all") query.status = filters.status;
        if (filters.assignee !== "all") query.assignedTo = filters.assignee;
        if (filters.queue !== "all") query.queueId = filters.queue;

        const res = await listConversations(organizationId, query, fetcher);
        setConversations(res.items);

        if (res.items.length > 0) {
          const targetId = activeConversationId ?? selectedConversationId;
          if (!preserveSelection && !activeConversationId) {
            setSelectedConversationId(res.items[0]!.id);
          } else if (targetId) {
            const exists = res.items.some((c) => c.id === targetId);
            if (exists) {
              setSelectedConversationId(targetId);
            } else if (!activeConversationId) {
              setSelectedConversationId(res.items[0]!.id);
            } else {
              setSelectedConversationId(targetId);
            }
          } else {
            setSelectedConversationId(res.items[0]!.id);
          }
        } else {
          setSelectedConversationId(activeConversationId ?? null);
          if (!activeConversationId) {
            setActiveConversation(null);
            setMessages([]);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load conversations";
        setActionError(msg);
      } finally {
        setLoadingConversations(false);
      }
    },
    [
      organizationId,
      filters.status,
      filters.assignee,
      filters.queue,
      selectedConversationId,
      activeConversationId,
      fetcher
    ]
  );

  useEffect(() => {
    if (activeConversationId !== undefined) {
      setSelectedConversationId(activeConversationId);
    }
  }, [activeConversationId]);

  // Load thread detail
  const loadThread = useCallback(
    async (conversationId: string) => {
      try {
        setLoadingThread(true);
        setActionError(null);
        const detail = await getConversation(organizationId, conversationId, fetcher);
        setActiveConversation(detail.conversation);
        setMessages(detail.messages);
        setNotes(detail.notes);
        setConversationTags(detail.tags);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load thread";
        setActionError(msg);
      } finally {
        setLoadingThread(false);
      }
    },
    [organizationId, fetcher]
  );

  // Load Copilot Draft
  const loadCopilotDraft = useCallback(
    async (conversationId: string, clearWhenMissing = false) => {
      try {
        const draft = await getLatestBotDraft(organizationId, conversationId, fetcher);
        setCopilotDraft(draft);
        setCopilotLoading(draft.status === "queued" || draft.status === "processing");
        setCopilotError(null);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          if (clearWhenMissing) setCopilotDraft(null);
          setCopilotLoading(false);
          return;
        }
        setCopilotLoading(false);
        setCopilotError(error instanceof Error ? error.message : "draft_error");
      }
    },
    [organizationId, fetcher]
  );

  // Initial load on filters change
  useEffect(() => {
    void loadConversations(false);
  }, [organizationId, filters.status, filters.assignee, filters.queue]);

  // Load workspace resources
  const loadResources = useCallback(async () => {
    try {
      setResources(await getInboxWorkspaceResources(organizationId, fetcher));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to load workspace filters");
    }
  }, [organizationId, fetcher]);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  // Selection change triggers thread and draft load
  useEffect(() => {
    if (selectedConversationId) {
      // If we already have initialActiveConversation and initialMessages matching this conversation, don't clear/re-fetch immediately with empty state
      if (
        initialActiveConversation &&
        initialActiveConversation.id === selectedConversationId &&
        initialMessages
      ) {
        // Keep initial state, but still fetch latest draft
        void loadCopilotDraft(selectedConversationId, true);
        return;
      }
      void loadThread(selectedConversationId);
      void loadCopilotDraft(selectedConversationId, true);
    }
  }, [
    selectedConversationId,
    loadThread,
    loadCopilotDraft,
    initialActiveConversation,
    initialMessages
  ]);

  // Copilot polling
  useEffect(() => {
    if (!selectedConversationId) return;
    const isPending = copilotDraft?.status === "queued" || copilotDraft?.status === "processing";
    if (!isPending && copilotDraft !== null && copilotDraft !== undefined) {
      return;
    }
    const timer = window.setInterval(
      () => {
        void loadCopilotDraft(selectedConversationId);
      },
      isPending ? 1_000 : 10_000
    );
    return () => window.clearInterval(timer);
  }, [selectedConversationId, copilotDraft?.status, loadCopilotDraft]);

  // Realtime sync via Socket.IO
  useRealtimeSync({
    organizationId,
    activeConversationId: selectedConversationId,
    enabled: typeof window !== "undefined",
    onReconcile: () => {
      setHasConflict(false);
      void loadConversations(true);
      if (selectedConversationId) void loadThread(selectedConversationId);
      if (selectedConversationId) void loadCopilotDraft(selectedConversationId);
      onRealtimeReconcile?.();
    },
    onHint: (hint) => {
      if (hint.resourceType === "conversation" || hint.resourceType === "organization") {
        void loadConversations(true);
        if (selectedConversationId) void loadCopilotDraft(selectedConversationId);
      }
      if (hint.resourceType === "message" || hint.resourceId === selectedConversationId) {
        if (selectedConversationId) void loadThread(selectedConversationId);
      }
      onRealtimeHint?.(hint);
    },
    onAccessRevoked: (reason) => {
      setActionError(`Realtime access revoked (${reason.code})`);
    },
    onConnectionState: setConnectionState
  });

  // Online / Offline listeners
  useEffect(() => {
    const online = () => {
      setConnectionState("reconnecting");
      void loadConversations(true);
      if (selectedConversationId) void loadThread(selectedConversationId);
    };
    const offline = () => setConnectionState("offline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [loadConversations, loadThread, selectedConversationId]);

  // Handlers for Conversation status transitions
  const handleUpdateStatus = async (newStatus: "open" | "resolved") => {
    if (!activeConversation) return;
    try {
      setActionError(null);
      const updated = await performConversationOperation(
        organizationId,
        activeConversation.id,
        {
          version: activeConversation.version,
          action: newStatus === "resolved" ? "resolve" : "reopen"
        },
        fetcher
      );
      setActiveConversation(updated);
      setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setActionSuccess(`Conversation marked as ${newStatus}`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        setHasConflict(true);
      } else {
        setActionError(err instanceof Error ? err.message : "Failed to update conversation");
      }
    }
  };

  const handleAssignToMe = async () => {
    if (!activeConversation) return;
    try {
      setActionError(null);
      const updated = await performConversationOperation(
        organizationId,
        activeConversation.id,
        { version: activeConversation.version, action: "claim" },
        fetcher
      );
      setActiveConversation(updated);
      setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setActionSuccess("Conversation assigned to you");
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        setHasConflict(true);
      } else {
        setActionError(err instanceof Error ? err.message : "Failed to assign conversation");
      }
    }
  };

  const handleConflictReload = async () => {
    if (!activeConversation) return;
    await Promise.all([loadThread(activeConversation.id), loadConversations(true)]);
    setHasConflict(false);
  };

  // Notes and Tags
  const handleAddNote = async (body: string) => {
    if (!activeConversation || !body.trim()) return;
    try {
      const updated = await performConversationOperation(
        organizationId,
        activeConversation.id,
        { version: activeConversation.version, action: "note", body: body.trim() },
        fetcher
      );
      setActiveConversation(updated);
      await loadThread(updated.id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setHasConflict(true);
      else setActionError(error instanceof Error ? error.message : "Failed to add note");
    }
  };

  const handleToggleTag = async (tagId: string, applied: boolean) => {
    if (!activeConversation) return;
    try {
      const updated = await performConversationOperation(
        organizationId,
        activeConversation.id,
        { version: activeConversation.version, action: applied ? "tag.remove" : "tag.add", tagId },
        fetcher
      );
      setActiveConversation(updated);
      await loadThread(updated.id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setHasConflict(true);
      else setActionError(error instanceof Error ? error.message : "Failed to update tag");
    }
  };

  // Saved Filters
  const handleSaveFilter = async () => {
    if (!filterName.trim()) return;
    await saveInboxFilter(
      organizationId,
      {
        name: filterName.trim(),
        definition: {
          ...(filters.status === "all" ? {} : { status: filters.status }),
          ...(filters.assignee === "all" ? {} : { assignedTo: filters.assignee }),
          ...(filters.queue === "all" ? {} : { queueId: filters.queue }),
          ...(filters.search.trim() ? { search: filters.search.trim() } : {})
        },
        isDefault: false
      },
      fetcher
    );
    setFilterName("");
    await loadResources();
  };

  const handleDeleteFilter = async () => {
    if (!selectedSavedFilterId) return;
    await deleteInboxFilter(organizationId, selectedSavedFilterId, fetcher);
    setSelectedSavedFilterId("");
    await loadResources();
  };

  // Messaging & Send
  const handleSendMessage = async () => {
    const text = composerText.trim();
    if (!text || !activeConversation || isSending || connectionState === "offline") return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: "00000000-0000-0000-0000-000000000000",
      organizationId,
      conversationId: activeConversation.id,
      channelId: activeConversation.channelId,
      direction: "outbound",
      senderType: "agent",
      senderUserId: sessionUserId,
      providerMessageId: null,
      content: text,
      status: "queued",
      errorDetail: null,
      sentAt: new Date().toISOString(),
      deliveredAt: null,
      readAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setComposerText("");
    setIsSending(true);
    setActionError(null);

    try {
      const sent = copilotEditingRunId
        ? await applyBotDraftAction(
            organizationId,
            copilotEditingRunId,
            { action: "edited", editedContent: text },
            fetcher
          )
        : await sendOutboundMessage(
            organizationId,
            activeConversation.id,
            { content: text },
            `client-msg-${tempId}`,
            fetcher
          );
      if (!sent) throw new Error("The AI draft action did not create an outbound message.");
      if (copilotEditingRunId) {
        setCopilotEditingRunId(null);
        setCopilotDraft(null);
      }
      setMessages((prev) => prev.map((m) => (m === optimisticMessage ? sent : m)));
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id ? { ...c, lastMessageAt: sent.createdAt } : c
        )
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send message";
      setActionError(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m === optimisticMessage ? { ...m, status: "failed", errorDetail: msg } : m
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  // Media Attachment Send
  const handleMediaSelected = async (file: File | undefined) => {
    if (!file || !activeConversation || connectionState === "offline") return;
    try {
      setMediaState("uploading");
      const session = await createAttachmentUploadSession(
        organizationId,
        { fileName: file.name, contentType: file.type, byteSize: file.size },
        fetcher
      );
      await uploadAttachmentBytes(session, file, fetcher);
      await completeAttachmentUpload(organizationId, session.attachmentId, fetcher);
      setMediaState("scanning");
      let attachment = await getAttachment(organizationId, session.attachmentId, fetcher);
      for (let attempt = 0; attachment.status === "quarantine" && attempt < 20; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        attachment = await getAttachment(organizationId, session.attachmentId, fetcher);
      }
      if (attachment.status !== "clean") {
        throw new Error(
          attachment.status === "rejected"
            ? "Attachment rejected by malware scanning"
            : "Attachment scan is still pending; try again shortly"
        );
      }
      setMediaState("sending");
      const sent = await sendOutboundMessage(
        organizationId,
        activeConversation.id,
        {
          type: "media",
          attachmentId: attachment.id,
          ...(composerText.trim() ? { caption: composerText.trim() } : {})
        },
        `media-${attachment.id}`,
        fetcher
      );
      setMessages((current) => [...current, sent]);
      setComposerText("");
      setMediaState(null);
    } catch (error) {
      setMediaState(null);
      setActionError(error instanceof Error ? error.message : "Failed to send attachment");
    }
  };

  // Templates
  const handleOpenTemplateModal = useCallback(async () => {
    if (!activeConversation) return;
    setShowTemplateModal(true);
    setLoadingTemplates(true);
    setPreviewError(null);
    setTemplatePreview(null);
    try {
      const res = await listConversationTemplates(organizationId, activeConversation.id, fetcher);
      const approved = res.items.filter((t) => t.status === "APPROVED");
      setChannelTemplates(approved);
      if (approved.length > 0) {
        setSelectedTemplateKey(`${approved[0]!.name}:${approved[0]!.language}`);
        setTemplateVariables({});
      }
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoadingTemplates(false);
    }
  }, [activeConversation, organizationId, fetcher]);

  const activeTemplate = channelTemplates.find(
    (t) => `${t.name}:${t.language}` === selectedTemplateKey
  );

  useEffect(() => {
    if (!showTemplateModal || !activeConversation || !activeTemplate) {
      setTemplatePreview(null);
      return;
    }
    let cancelled = false;
    const runPreview = async () => {
      try {
        const res = await previewTemplate(
          organizationId,
          activeConversation.id,
          {
            templateName: activeTemplate.name,
            language: activeTemplate.language,
            variables: templateVariables
          },
          fetcher
        );
        if (!cancelled) {
          setTemplatePreview(res);
          setPreviewError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setTemplatePreview(null);
          if (Object.keys(templateVariables).length > 0) {
            setPreviewError(err instanceof Error ? err.message : "Preview error");
          }
        }
      }
    };
    void runPreview();
    return () => {
      cancelled = true;
    };
  }, [
    showTemplateModal,
    activeConversation,
    activeTemplate,
    templateVariables,
    organizationId,
    fetcher
  ]);

  const handleSendTemplate = async () => {
    if (!activeConversation || !activeTemplate) return;
    try {
      setIsSendingTemplate(true);
      setPreviewError(null);
      const key = `tpl-send-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const sentMsg = await sendOutboundMessage(
        organizationId,
        activeConversation.id,
        {
          type: "template",
          templateName: activeTemplate.name,
          language: activeTemplate.language,
          variables: templateVariables
        },
        key,
        fetcher
      );
      setMessages((prev) => [...prev, sentMsg]);
      setShowTemplateModal(false);
      setTemplateVariables({});
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : "Failed to send template message");
    } finally {
      setIsSendingTemplate(false);
    }
  };

  // Copilot Handlers
  const handleGenerateDraft = useCallback(async () => {
    if (!activeConversation || copilotLoading) return;
    setCopilotLoading(true);
    setCopilotError(null);
    setShowCitations(false);
    try {
      const draft = await generateBotDraft(organizationId, activeConversation.id, fetcher);
      setCopilotDraft(draft);
      setCopilotLoading(draft.status === "queued" || draft.status === "processing");
    } catch (err: unknown) {
      setCopilotError(err instanceof Error ? err.message : "draft_error");
      setCopilotLoading(false);
    }
  }, [activeConversation, organizationId, fetcher, copilotLoading]);

  const handleCopilotApprove = async () => {
    if (!copilotDraft?.suggestedContent || !activeConversation || isApprovingSend) return;
    setIsApprovingSend(true);
    try {
      const sent = await applyBotDraftAction(
        organizationId,
        copilotDraft.runId,
        { action: "approved" },
        fetcher
      );
      if (!sent) throw new Error("Approval did not create an outbound message.");
      setMessages((prev) => [...prev.filter((message) => message.id !== sent.id), sent]);
      setCopilotDraft(null);
      setShowCitations(false);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id ? { ...c, lastMessageAt: sent.createdAt } : c
        )
      );
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setIsApprovingSend(false);
    }
  };

  const handleCopilotEdit = () => {
    if (!copilotDraft?.suggestedContent) return;
    setComposerText(copilotDraft.suggestedContent);
    setCopilotEditingRunId(copilotDraft.runId);
    setShowCitations(false);
  };

  const handleCopilotReject = async () => {
    if (!copilotDraft || isApprovingSend) return;
    setIsApprovingSend(true);
    try {
      await applyBotDraftAction(
        organizationId,
        copilotDraft.runId,
        { action: "rejected" },
        fetcher
      );
      setCopilotDraft(null);
      setCopilotEditingRunId(null);
      setCopilotError(null);
      setShowCitations(false);
    } catch (error) {
      setCopilotError(error instanceof Error ? error.message : "draft_error");
    } finally {
      setIsApprovingSend(false);
    }
  };

  // Reset copilot draft on conversation change
  useEffect(() => {
    setCopilotDraft(null);
    setCopilotEditingRunId(null);
    setCopilotError(null);
    setShowCitations(false);
  }, [selectedConversationId]);

  const onSelectConv = (id: string) => {
    setSelectedConversationId(id);
    onSelectConversation?.(id);
  };

  // Center Thread & Stream Section
  const renderCenterPane = () => {
    if (!selectedConversationId || !activeConversation) {
      return (
        <div
          className="flex-1 flex flex-col items-center justify-center h-full text-muted-foreground p-8 bg-background"
          data-testid="no-conv-selected"
        >
          <div className="text-4xl mb-3">💬</div>
          <h3 className="text-base font-semibold text-foreground">No conversation selected</h3>
          <p className="text-sm mt-1 text-center max-w-sm">
            Select a conversation from the list to review message history and reply.
          </p>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        {/* Header */}
        <div className="flex items-center">
          {isMobile && (
            <button
              type="button"
              className="p-2.5 text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedConversationId(null)}
              aria-label="Back to conversations"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <ConversationHeader
              conversation={activeConversation}
              sessionUserId={sessionUserId}
              canAssign={canAssign}
              canResolve={canResolve}
              onAssignToMe={() => void handleAssignToMe()}
              onResolve={() => void handleUpdateStatus("resolved")}
              onReopen={() => void handleUpdateStatus("open")}
            />
          </div>
          {isTablet && (
            <button
              type="button"
              className="px-3 py-2 text-muted-foreground hover:text-foreground border-b border-border"
              onClick={() => setTabletContextOpen(true)}
              aria-label="Open context panel"
            >
              <PanelRightOpen className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Message Stream */}
        <MessageTimeline
          messages={messages}
          loading={loadingThread}
          onRetry={(text) => setComposerText(text)}
          onRemoveMessage={(msg) =>
            setMessages((current) => current.filter((item) => item !== msg))
          }
        />

        {/* AI Copilot Card */}
        {copilotDraft && (
          <AiDraftCard
            draft={copilotDraft}
            loading={copilotLoading}
            error={copilotError}
            showCitations={showCitations}
            isApproving={isApprovingSend}
            canSend={canSend}
            onGenerate={() => void handleGenerateDraft()}
            onApprove={() => void handleCopilotApprove()}
            onEdit={handleCopilotEdit}
            onReject={() => void handleCopilotReject()}
            onToggleCitations={() => setShowCitations((prev) => !prev)}
          />
        )}

        {/* Message Composer */}
        <MessageComposer
          conversationStatus={activeConversation.status}
          serviceWindowOpen={
            activeConversation.serviceWindow ? activeConversation.serviceWindow.isOpen : null
          }
          canSend={canSend}
          connectionState={connectionState}
          composerText={composerText}
          isSending={isSending}
          mediaState={mediaState}
          onComposerChange={setComposerText}
          onSend={() => void handleSendMessage()}
          onOpenTemplate={() => void handleOpenTemplateModal()}
          onMediaSelected={(f) => void handleMediaSelected(f)}
        />
      </div>
    );
  };

  return (
    <div
      className="inbox-container flex flex-col h-full w-full overflow-hidden bg-background"
      data-testid="inbox-container"
    >
      {/* Offline/Reconnecting Alert Banner */}
      {connectionState !== "connected" && (
        <div
          className={`px-3 py-1 text-xs text-center font-medium ${
            connectionState === "offline"
              ? "bg-destructive text-destructive-foreground"
              : "bg-yellow-500 text-white"
          }`}
          role="status"
          aria-live="polite"
          data-testid="connection-state"
        >
          {connectionState === "offline" ? "Offline" : "Reconnecting…"}
        </div>
      )}

      {/* Conflict Banner */}
      {hasConflict && (
        <div
          className="px-3 py-1.5 bg-yellow-50 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-200 border-b border-yellow-200 dark:border-yellow-900 flex items-center justify-between text-xs"
          role="alert"
          data-testid="conflict-state"
        >
          <span>This conversation was updated elsewhere. Reload to view the latest version.</span>
          <button
            type="button"
            className="px-2 py-0.5 rounded bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 hover:bg-yellow-300 font-medium"
            onClick={() => void handleConflictReload()}
          >
            Reload
          </button>
        </div>
      )}

      {/* Action Error Banner */}
      {actionError && (
        <div
          className="px-3 py-1.5 bg-destructive/10 text-destructive border-b border-destructive/20 flex items-center justify-between text-xs"
          role="alert"
        >
          <span>{actionError}</span>
          <button
            type="button"
            className="text-xs hover:underline ml-2"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Action Success Toast */}
      {actionSuccess && (
        <div
          className="px-3 py-1.5 bg-green-500/10 text-green-700 dark:text-green-300 border-b border-green-500/20 text-xs text-center"
          role="status"
        >
          {actionSuccess}
        </div>
      )}

      {/* Main Workspace Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Mobile View: 1-pane drill down */}
        {isMobile ? (
          <div className="h-full w-full">
            {!selectedConversationId ? (
              <ConversationList
                conversations={conversations}
                loading={loadingConversations}
                selectedConversationId={selectedConversationId}
                sessionUserId={sessionUserId}
                statusFilter={filters.status}
                assigneeFilter={filters.assignee}
                queueFilter={filters.queue}
                searchQuery={filters.search}
                resources={resources}
                filterName={filterName}
                selectedSavedFilterId={selectedSavedFilterId}
                locale={locale}
                onSelectConversation={onSelectConv}
                onStatusFilterChange={setStatusFilter}
                onAssigneeFilterChange={setAssigneeFilter}
                onQueueFilterChange={setQueueFilter}
                onSearchChange={setSearchQuery}
                onFilterNameChange={setFilterName}
                onSavedFilterSelect={(id) => {
                  setSelectedSavedFilterId(id);
                  const f = resources.savedFilters.find((it) => it.id === id);
                  if (f) applySavedFilter(f.definition);
                }}
                onSaveFilter={() => void handleSaveFilter()}
                onDeleteFilter={() => void handleDeleteFilter()}
                onRefresh={() => void loadConversations(true)}
                onLocaleToggle={() => setLocale((c) => (c === "en" ? "id" : "en"))}
              />
            ) : (
              renderCenterPane()
            )}
          </div>
        ) : isTablet ? (
          /* Tablet View: 2-pane (Queue + Center) with Right Context Sheet */
          <div className="flex h-full w-full">
            <div className="w-80 flex-shrink-0 border-r border-border h-full">
              <ConversationList
                conversations={conversations}
                loading={loadingConversations}
                selectedConversationId={selectedConversationId}
                sessionUserId={sessionUserId}
                statusFilter={filters.status}
                assigneeFilter={filters.assignee}
                queueFilter={filters.queue}
                searchQuery={filters.search}
                resources={resources}
                filterName={filterName}
                selectedSavedFilterId={selectedSavedFilterId}
                locale={locale}
                onSelectConversation={onSelectConv}
                onStatusFilterChange={setStatusFilter}
                onAssigneeFilterChange={setAssigneeFilter}
                onQueueFilterChange={setQueueFilter}
                onSearchChange={setSearchQuery}
                onFilterNameChange={setFilterName}
                onSavedFilterSelect={(id) => {
                  setSelectedSavedFilterId(id);
                  const f = resources.savedFilters.find((it) => it.id === id);
                  if (f) applySavedFilter(f.definition);
                }}
                onSaveFilter={() => void handleSaveFilter()}
                onDeleteFilter={() => void handleDeleteFilter()}
                onRefresh={() => void loadConversations(true)}
                onLocaleToggle={() => setLocale((c) => (c === "en" ? "id" : "en"))}
              />
            </div>
            <div className="flex-1 h-full min-w-0">{renderCenterPane()}</div>

            {/* Tablet Slide-out Sheet for Right Context */}
            <Sheet open={tabletContextOpen} onOpenChange={setTabletContextOpen}>
              <SheetContent side="right" className="w-80 p-0 sm:max-w-md">
                <SheetHeader className="px-4 py-3 border-b border-border">
                  <SheetTitle className="text-sm font-semibold">Customer Context</SheetTitle>
                </SheetHeader>
                <div className="h-[calc(100%-49px)]">
                  <CustomerContextPanel
                    conversation={activeConversation}
                    notes={notes}
                    tags={conversationTags}
                    allTags={resources.tags}
                    copilotDraft={copilotDraft}
                    showCitations={showCitations}
                    loading={loadingThread}
                    onToggleTag={(tagId, applied) => void handleToggleTag(tagId, applied)}
                    onAddNote={(body) => void handleAddNote(body)}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        ) : typeof window !== "undefined" && !window.ResizeObserver ? (
          /* Fallback Desktop View when ResizeObserver is unavailable (e.g. standard JSDOM test suites) */
          <div className="flex h-full w-full">
            <div className="w-80 flex-shrink-0 border-r border-border h-full">
              <ConversationList
                conversations={conversations}
                loading={loadingConversations}
                selectedConversationId={selectedConversationId}
                sessionUserId={sessionUserId}
                statusFilter={filters.status}
                assigneeFilter={filters.assignee}
                queueFilter={filters.queue}
                searchQuery={filters.search}
                resources={resources}
                filterName={filterName}
                selectedSavedFilterId={selectedSavedFilterId}
                locale={locale}
                onSelectConversation={onSelectConv}
                onStatusFilterChange={setStatusFilter}
                onAssigneeFilterChange={setAssigneeFilter}
                onQueueFilterChange={setQueueFilter}
                onSearchChange={setSearchQuery}
                onFilterNameChange={setFilterName}
                onSavedFilterSelect={(id) => {
                  setSelectedSavedFilterId(id);
                  const f = resources.savedFilters.find((it) => it.id === id);
                  if (f) applySavedFilter(f.definition);
                }}
                onSaveFilter={() => void handleSaveFilter()}
                onDeleteFilter={() => void handleDeleteFilter()}
                onRefresh={() => void loadConversations(true)}
                onLocaleToggle={() => setLocale((c) => (c === "en" ? "id" : "en"))}
              />
            </div>
            <div className="flex-1 h-full min-w-0">{renderCenterPane()}</div>
            <div className="w-80 flex-shrink-0 border-l border-border h-full">
              <CustomerContextPanel
                conversation={activeConversation}
                notes={notes}
                tags={conversationTags}
                allTags={resources.tags}
                copilotDraft={copilotDraft}
                showCitations={showCitations}
                loading={loadingThread}
                onToggleTag={(tagId, applied) => void handleToggleTag(tagId, applied)}
                onAddNote={(body) => void handleAddNote(body)}
              />
            </div>
          </div>
        ) : (
          /* Desktop View: 3-pane resizable layout */
          <PanelGroup
            orientation="horizontal"
            defaultLayout={defaultLayout}
            onLayoutChanged={onLayoutChanged}
            className="h-full w-full"
          >
            {/* Left Panel: Conversation Queue */}
            <Panel defaultSize={25} minSize={18} maxSize={35} className="h-full">
              <ConversationList
                conversations={conversations}
                loading={loadingConversations}
                selectedConversationId={selectedConversationId}
                sessionUserId={sessionUserId}
                statusFilter={filters.status}
                assigneeFilter={filters.assignee}
                queueFilter={filters.queue}
                searchQuery={filters.search}
                resources={resources}
                filterName={filterName}
                selectedSavedFilterId={selectedSavedFilterId}
                locale={locale}
                onSelectConversation={onSelectConv}
                onStatusFilterChange={setStatusFilter}
                onAssigneeFilterChange={setAssigneeFilter}
                onQueueFilterChange={setQueueFilter}
                onSearchChange={setSearchQuery}
                onFilterNameChange={setFilterName}
                onSavedFilterSelect={(id) => {
                  setSelectedSavedFilterId(id);
                  const f = resources.savedFilters.find((it) => it.id === id);
                  if (f) applySavedFilter(f.definition);
                }}
                onSaveFilter={() => void handleSaveFilter()}
                onDeleteFilter={() => void handleDeleteFilter()}
                onRefresh={() => void loadConversations(true)}
                onLocaleToggle={() => setLocale((c) => (c === "en" ? "id" : "en"))}
              />
            </Panel>

            <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize focus:outline-none" />

            {/* Center Panel: Stream & Composer */}
            <Panel defaultSize={50} minSize={30} className="h-full">
              {renderCenterPane()}
            </Panel>

            <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize focus:outline-none" />

            {/* Right Panel: Customer & Operational Context */}
            <Panel defaultSize={25} minSize={20} maxSize={35} className="h-full">
              <CustomerContextPanel
                conversation={activeConversation}
                notes={notes}
                tags={conversationTags}
                allTags={resources.tags}
                copilotDraft={copilotDraft}
                showCitations={showCitations}
                loading={loadingThread}
                onToggleTag={(tagId, applied) => void handleToggleTag(tagId, applied)}
                onAddNote={(body) => void handleAddNote(body)}
              />
            </Panel>
          </PanelGroup>
        )}
      </div>

      {/* WhatsApp Template Dialog */}
      {showTemplateModal && activeConversation && (
        <TemplateDialog
          open={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          conversation={activeConversation}
          templates={channelTemplates}
          loading={loadingTemplates}
          selectedTemplateKey={selectedTemplateKey}
          templateVariables={templateVariables}
          templatePreview={templatePreview}
          previewError={previewError}
          isSending={isSendingTemplate}
          onTemplateKeyChange={(k) => {
            setSelectedTemplateKey(k);
            setTemplateVariables({});
          }}
          onVariableChange={(varNum, val) =>
            setTemplateVariables((prev) => ({ ...prev, [varNum]: val }))
          }
          onSend={() => void handleSendTemplate()}
        />
      )}
    </div>
  );
}

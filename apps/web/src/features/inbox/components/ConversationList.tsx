import { useRef } from "react";
import type { Conversation, InboxWorkspaceResourcesResponse } from "@flowdesk/contracts";
import { Skeleton } from "@flowdesk/ui";
import { RefreshCw, Search } from "lucide-react";
import { ConversationItem } from "./ConversationItem.js";
import type { StatusFilter, AssigneeFilter } from "../hooks/useConversationFilters.js";

interface ConversationListProps {
  conversations: Conversation[];
  loading: boolean;
  selectedConversationId: string | null;
  sessionUserId: string;
  // Filter state
  statusFilter: StatusFilter;
  assigneeFilter: AssigneeFilter;
  queueFilter: string;
  searchQuery: string;
  // Resources
  resources: InboxWorkspaceResourcesResponse;
  filterName: string;
  selectedSavedFilterId: string;
  // Locale
  locale: "en" | "id";
  // Callbacks
  onSelectConversation: (id: string) => void;
  onStatusFilterChange: (s: StatusFilter) => void;
  onAssigneeFilterChange: (a: AssigneeFilter) => void;
  onQueueFilterChange: (q: string) => void;
  onSearchChange: (q: string) => void;
  onFilterNameChange: (n: string) => void;
  onSavedFilterSelect: (id: string) => void;
  onSaveFilter: () => void;
  onDeleteFilter: () => void;
  onRefresh: () => void;
  onLocaleToggle: () => void;
}

const STATUS_TABS: StatusFilter[] = ["all", "new", "open", "pending", "resolved", "closed"];

export function ConversationList({
  conversations,
  loading,
  selectedConversationId,
  sessionUserId,
  statusFilter,
  assigneeFilter,
  queueFilter,
  searchQuery,
  resources,
  filterName,
  selectedSavedFilterId,
  locale,
  onSelectConversation,
  onStatusFilterChange,
  onAssigneeFilterChange,
  onQueueFilterChange,
  onSearchChange,
  onFilterNameChange,
  onSavedFilterSelect,
  onSaveFilter,
  onDeleteFilter,
  onRefresh,
  onLocaleToggle
}: ConversationListProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const isInbox = locale === "en";
  const heading = isInbox ? "Inbox" : "Kotak Masuk";
  const searchPlaceholder = isInbox ? "Search phone or name..." : "Cari nomor atau nama...";

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.customerPhone.toLowerCase().includes(q) || (c.customerName ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background border-r border-border">
      {/* Header */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-foreground">{heading}</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="p-1.5 rounded hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={onLocaleToggle}
              aria-label={`Switch language: ${locale.toUpperCase()}`}
              data-testid="locale-toggle"
            >
              {locale.toUpperCase()}
            </button>
            <button
              type="button"
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              onClick={onRefresh}
              title="Refresh inbox"
              aria-label="Refresh conversations"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            className="w-full h-8 pl-8 pr-2.5 text-xs rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search conversations"
          />
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div
        className="flex-shrink-0 px-3 py-1.5 border-b border-border flex gap-1 overflow-x-auto scrollbar-none"
        role="tablist"
        aria-label="Status filters"
      >
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={statusFilter === tab}
            className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === tab
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            onClick={() => onStatusFilterChange(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Assignee + Queue Filters */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-border flex flex-col gap-1.5">
        <select
          className="w-full h-7 px-2 text-xs rounded border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          value={assigneeFilter}
          onChange={(e) => onAssigneeFilterChange(e.target.value as AssigneeFilter)}
          aria-label="Filter by assignee"
        >
          <option value="all">All Assignees</option>
          <option value="me">Assigned to Me</option>
          <option value="unassigned">Unassigned</option>
        </select>

        <select
          className="w-full h-7 px-2 text-xs rounded border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          value={queueFilter}
          onChange={(e) => onQueueFilterChange(e.target.value)}
          aria-label="Filter by queue"
          data-testid="queue-filter"
        >
          <option value="all">All Queues</option>
          {resources.queues.map((queue) => (
            <option key={queue.id} value={queue.id}>
              {queue.name}
            </option>
          ))}
        </select>

        {/* Saved filters */}
        {resources.savedFilters.length > 0 && (
          <div className="flex gap-1">
            <select
              id="saved-filter-select"
              className="flex-1 h-7 px-2 text-xs rounded border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={selectedSavedFilterId}
              onChange={(e) => onSavedFilterSelect(e.target.value)}
            >
              <option value="">Saved Filters</option>
              {resources.savedFilters.map((filter) => (
                <option key={filter.id} value={filter.id}>
                  {filter.name}
                </option>
              ))}
            </select>
            {selectedSavedFilterId && (
              <button
                type="button"
                className="px-2 py-1 text-xs rounded border border-input hover:bg-destructive/10 hover:text-destructive transition-colors"
                onClick={onDeleteFilter}
                aria-label="Delete saved filter"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Save current filter */}
        <div className="flex gap-1">
          <input
            className="flex-1 h-7 px-2 text-xs rounded border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            value={filterName}
            onChange={(e) => onFilterNameChange(e.target.value)}
            placeholder="Filter name..."
            aria-label="Filter name"
          />
          <button
            type="button"
            className="px-2 py-1 text-xs rounded border border-input hover:bg-muted transition-colors disabled:opacity-40"
            disabled={!filterName.trim()}
            onClick={onSaveFilter}
            aria-label="Save filter"
          >
            +
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto" role="listbox" aria-label="Conversations">
        {loading && conversations.length === 0 ? (
          <div className="p-3 space-y-3" data-testid="inbox-loading">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
            <p className="sr-only">Loading conversations...</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm"
            data-testid="inbox-empty"
          >
            <p>No conversations found</p>
          </div>
        ) : (
          filteredConversations.map((conv, index) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isSelected={conv.id === selectedConversationId}
              sessionUserId={sessionUserId}
              tabIndex={
                conv.id === selectedConversationId ||
                (!selectedConversationId && conv === filteredConversations[0])
                  ? 0
                  : -1
              }
              buttonRef={(el) => {
                buttonRefs.current[index] = el;
              }}
              onClick={() => onSelectConversation(conv.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectConversation(conv.id);
                }
                const target =
                  e.key === "ArrowDown"
                    ? index + 1
                    : e.key === "ArrowUp"
                      ? index - 1
                      : e.key === "Home"
                        ? 0
                        : e.key === "End"
                          ? filteredConversations.length - 1
                          : null;
                if (target !== null) {
                  e.preventDefault();
                  const next = Math.max(0, Math.min(filteredConversations.length - 1, target));
                  buttonRefs.current[next]?.focus();
                }
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

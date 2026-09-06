/**
 * useConversationFilters
 *
 * Centralizes filter state for the inbox workspace (status, assignee, queue, search, saved filters).
 * Kept separate from data-fetching so individual panels can consume filter state without coupling.
 */

import { useState, useCallback } from "react";
import type { InboxWorkspaceResourcesResponse } from "@flowdesk/contracts";

export type StatusFilter = "all" | "new" | "open" | "pending" | "resolved" | "closed";
export type AssigneeFilter = "all" | "me" | "unassigned";

export interface ConversationFilters {
  status: StatusFilter;
  assignee: AssigneeFilter;
  queue: string;
  search: string;
}

export interface UseConversationFiltersReturn {
  filters: ConversationFilters;
  setStatusFilter: (s: StatusFilter) => void;
  setAssigneeFilter: (a: AssigneeFilter) => void;
  setQueueFilter: (q: string) => void;
  setSearchQuery: (q: string) => void;
  filterName: string;
  setFilterName: (n: string) => void;
  selectedSavedFilterId: string;
  setSelectedSavedFilterId: (id: string) => void;
  applySavedFilter: (
    definition: InboxWorkspaceResourcesResponse["savedFilters"][number]["definition"]
  ) => void;
}

export function useConversationFilters(): UseConversationFiltersReturn {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [assignee, setAssignee] = useState<AssigneeFilter>("all");
  const [queue, setQueue] = useState("all");
  const [search, setSearch] = useState("");
  const [filterName, setFilterName] = useState("");
  const [selectedSavedFilterId, setSelectedSavedFilterId] = useState("");

  const applySavedFilter = useCallback(
    (definition: InboxWorkspaceResourcesResponse["savedFilters"][number]["definition"]) => {
      setStatus(definition.status ?? "all");
      const assigned = definition.assignedTo;
      setAssignee(assigned === "me" || assigned === "unassigned" ? assigned : "all");
      setQueue(definition.queueId ?? "all");
      setSearch(definition.search ?? "");
    },
    []
  );

  return {
    filters: { status, assignee, queue, search },
    setStatusFilter: setStatus,
    setAssigneeFilter: setAssignee,
    setQueueFilter: setQueue,
    setSearchQuery: setSearch,
    filterName,
    setFilterName,
    selectedSavedFilterId,
    setSelectedSavedFilterId,
    applySavedFilter
  };
}

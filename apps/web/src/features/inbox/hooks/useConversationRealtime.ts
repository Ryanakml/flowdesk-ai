/**
 * useConversationRealtime
 *
 * Bridges useRealtimeSync from realtime.ts with TanStack Query invalidations.
 * Maintains 100% of Socket.IO connection and event handling semantics:
 * - projection.changed → targeted query invalidation
 * - reconcileRequired → broad conversation invalidation
 * - access.revoked → surface error callback
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeSync } from "../../../realtime.js";
import { conversationsKeys } from "../query-keys.js";

export interface UseConversationRealtimeOptions {
  organizationId: string;
  activeConversationId: string | null;
  enabled?: boolean;
  onAccessRevoked?: (code: string) => void;
  onConnectionState?: (state: "connecting" | "connected" | "reconnecting" | "offline") => void;
}

export function useConversationRealtime({
  organizationId,
  activeConversationId,
  enabled = true,
  onAccessRevoked,
  onConnectionState
}: UseConversationRealtimeOptions) {
  const queryClient = useQueryClient();

  const handleHint = useCallback(
    (hint: { resourceType: string; resourceId: string; organizationId: string }) => {
      const orgId = hint.organizationId;
      switch (hint.resourceType) {
        case "conversation":
          void queryClient.invalidateQueries({
            queryKey: conversationsKeys.detail(orgId, hint.resourceId)
          });
          void queryClient.invalidateQueries({
            queryKey: conversationsKeys.lists(orgId)
          });
          break;
        case "message":
          void queryClient.invalidateQueries({
            queryKey: conversationsKeys.details(orgId)
          });
          void queryClient.invalidateQueries({
            queryKey: conversationsKeys.lists(orgId)
          });
          break;
        case "queue":
          void queryClient.invalidateQueries({
            queryKey: conversationsKeys.workspaceResources(orgId)
          });
          void queryClient.invalidateQueries({
            queryKey: conversationsKeys.lists(orgId)
          });
          break;
        default:
          void queryClient.invalidateQueries({
            queryKey: conversationsKeys.all(orgId)
          });
      }
    },
    [queryClient]
  );

  const handleReconcile = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: conversationsKeys.all(organizationId)
    });
  }, [queryClient, organizationId]);

  return useRealtimeSync({
    organizationId,
    activeConversationId,
    enabled: enabled && typeof window !== "undefined",
    onHint: handleHint,
    onReconcile: handleReconcile,
    ...(onAccessRevoked ? { onAccessRevoked: (reason) => onAccessRevoked(reason.code) } : {}),
    ...(onConnectionState ? { onConnectionState } : {})
  });
}

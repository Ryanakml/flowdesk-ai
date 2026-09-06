import { useState, useEffect, useCallback } from "react";
import type { AuditLogEntry, PageInfo } from "@flowdesk/contracts";
import { ChevronRight, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@flowdesk/ui";
import { listAuditLogs } from "../../api.js";
import { useAuth } from "../auth/context.js";

export function AuditView() {
  const { selectedOrgId, activeOrg, checkPermission, showToast } = useAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditPageInfo, setAuditPageInfo] = useState<PageInfo | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const canViewAudit = checkPermission("audit:view");

  const loadAudit = useCallback(
    async (orgId: string, cursor?: string) => {
      try {
        setLoadingAudit(true);
        const res = await listAuditLogs(orgId, { cursor });
        setAuditLogs(res.items);
        setAuditPageInfo(res.pageInfo);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to load audit logs", true);
      } finally {
        setLoadingAudit(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (selectedOrgId && canViewAudit) {
      void loadAudit(selectedOrgId);
    }
  }, [selectedOrgId, canViewAudit, loadAudit]);

  if (!canViewAudit) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center" data-testid="audit-forbidden">
        <Card className="border-destructive/30 bg-destructive/5 py-12">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl font-bold text-destructive">
            403 — Access Forbidden
          </CardTitle>
          <CardDescription className="mt-2 text-muted-foreground">
            You do not have permission to view the audit log.
          </CardDescription>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8" data-testid="audit-view">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <CardTitle className="text-xl font-bold">Audit Trail</CardTitle>
            </div>
            <CardDescription>Tamper-evident event log for {activeOrg?.name}.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAudit ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading audit records…
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No audit events recorded yet.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.occurredAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono font-medium text-foreground">
                            {log.action}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm font-medium text-foreground">
                          {log.targetType}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={log.result === "allowed" ? "secondary" : "destructive"}
                            className={`capitalize text-xs ${
                              log.result === "allowed"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200"
                                : ""
                            }`}
                          >
                            {log.result}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {auditPageInfo?.hasNextPage && auditPageInfo.endCursor && (
                <div className="flex justify-end pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      selectedOrgId &&
                      void loadAudit(selectedOrgId, auditPageInfo.endCursor ?? undefined)
                    }
                    className="cursor-pointer"
                  >
                    Next page
                    <ChevronRight className="ml-1 size-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

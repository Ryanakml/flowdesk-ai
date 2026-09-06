import React, { useState, useEffect, useCallback, useId } from "react";
import type { MembershipMember } from "@flowdesk/contracts";
import { type RoleKey, hasPermission } from "@flowdesk/domain";
import { Plus, UserX } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  TableRow
} from "@flowdesk/ui";
import { listMembers, inviteMember, updateMemberRole, revokeMember } from "../../api.js";
import { useAuth } from "../auth/context.js";

export interface TeamViewProps {
  initialShowInviteModal?: boolean;
}

export function TeamView({ initialShowInviteModal = false }: TeamViewProps = {}) {
  const { selectedOrgId, activeOrg, currentRole, showToast } = useAuth();
  const [members, setMembers] = useState<MembershipMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(initialShowInviteModal);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<RoleKey>("agent");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (initialShowInviteModal) {
      setShowInviteModal(true);
    }
  }, [initialShowInviteModal]);

  const inviteEmailId = useId();
  const inviteRoleId = useId();

  const canInvite = hasPermission(currentRole, "membership:invite");
  const canModifyRole = hasPermission(currentRole, "membership:modify");
  const canRevokeMember = hasPermission(currentRole, "membership:revoke");

  const loadMembers = useCallback(
    async (orgId: string) => {
      try {
        setLoadingMembers(true);
        const res = await listMembers(orgId);
        setMembers(res.members);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to load members", true);
      } finally {
        setLoadingMembers(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (selectedOrgId) {
      void loadMembers(selectedOrgId);
    }
  }, [selectedOrgId, loadMembers]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !inviteEmail.trim()) return;

    try {
      setInviting(true);
      const idempotencyKey = `invite-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await inviteMember(
        selectedOrgId,
        { email: inviteEmail.trim(), role: inviteRole },
        idempotencyKey
      );
      showToast(`Invitation sent to ${inviteEmail}!`);
      setShowInviteModal(false);
      setInviteEmail("");
      setInviteRole("agent");
      void loadMembers(selectedOrgId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to invite member", true);
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: RoleKey) => {
    if (!selectedOrgId) return;
    try {
      const idempotencyKey = `role-${memberId}-${Date.now()}`;
      await updateMemberRole(selectedOrgId, memberId, newRole, idempotencyKey);
      showToast("Role updated successfully!");
      void loadMembers(selectedOrgId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update role", true);
    }
  };

  const handleRevoke = async (memberId: string, displayName: string) => {
    if (!selectedOrgId) return;
    if (!window.confirm(`Are you sure you want to remove ${displayName} from the team?`)) return;

    try {
      const idempotencyKey = `revoke-${memberId}-${Date.now()}`;
      await revokeMember(selectedOrgId, memberId, idempotencyKey);
      showToast(`${displayName} was removed from the team.`);
      void loadMembers(selectedOrgId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to remove member", true);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default";
      case "admin":
        return "secondary";
      case "supervisor":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8" data-testid="team-view">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold">Team Members</CardTitle>
            <CardDescription>
              Manage members and role permissions for {activeOrg?.name}.
            </CardDescription>
          </div>
          {canInvite && (
            <Button
              onClick={() => setShowInviteModal(true)}
              size="sm"
              id="invite-member-btn"
              data-testid="invite-member-btn"
              className="cursor-pointer"
            >
              <Plus className="mr-1.5 size-4" />
              Invite Member
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loadingMembers ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading team…</div>
          ) : members.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No members found.</div>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    {canRevokeMember && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-semibold text-foreground">
                        {member.displayName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{member.email}</TableCell>
                      <TableCell>
                        {canModifyRole ? (
                          <Select
                            value={member.roleKey}
                            onValueChange={(val) =>
                              void handleRoleChange(member.id, val as RoleKey)
                            }
                          >
                            <SelectTrigger
                              className="h-8 w-36 text-xs cursor-pointer"
                              aria-label={`Change role for ${member.displayName}`}
                            >
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">Owner</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="supervisor">Supervisor</SelectItem>
                              <SelectItem value="agent">Agent</SelectItem>
                              <SelectItem value="analyst">Analyst</SelectItem>
                              <SelectItem value="billing_admin">Billing Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            variant={getRoleBadgeVariant(member.roleKey)}
                            className="capitalize font-mono text-xs"
                          >
                            {member.roleKey.replace("_", " ")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={member.status === "active" ? "secondary" : "outline"}
                          className={`capitalize text-xs ${
                            member.status === "active"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200"
                              : "text-muted-foreground"
                          }`}
                        >
                          {member.status}
                        </Badge>
                      </TableCell>
                      {canRevokeMember && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleRevoke(member.id, member.displayName)}
                            className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                            aria-label={`Remove ${member.displayName}`}
                          >
                            <UserX className="mr-1 size-3.5" />
                            Remove
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Member Dialog */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to a colleague to collaborate in {activeOrg?.name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleInviteSubmit(e)} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor={inviteEmailId}>Email Address</Label>
              <Input
                id={inviteEmailId}
                type="email"
                required
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={inviteRoleId}>Role</Label>
              <Select value={inviteRole} onValueChange={(val) => setInviteRole(val as RoleKey)}>
                <SelectTrigger id={inviteRoleId} className="w-full cursor-pointer">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="analyst">Analyst</SelectItem>
                  <SelectItem value="billing_admin">Billing Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="gap-2 sm:gap-0 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowInviteModal(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={inviting}
                id="send-invitation-btn"
                className="cursor-pointer"
              >
                {inviting ? "Sending…" : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

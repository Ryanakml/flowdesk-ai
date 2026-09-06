import React, { useState, useEffect, useCallback, useId } from "react";
import type { MembershipMember } from "@flowdesk/contracts";
import { type RoleKey, hasPermission } from "@flowdesk/domain";
import { Plus, UserX, Users, UserCheck, Shield, Search } from "lucide-react";
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

  const totalMembers = members.length;
  const activeMembers = members.filter((m) => m.status === "active").length;
  const adminMembers = members.filter((m) => m.roleKey === "owner" || m.roleKey === "admin").length;
  const agentMembers = members.filter(
    (m) => m.roleKey === "agent" || m.roleKey === "supervisor"
  ).length;

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      !searchQuery.trim() ||
      member.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || member.roleKey === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8" data-testid="team-view">
      {/* Donor-transplanted User Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <Users className="text-muted-foreground size-6" />
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"
              >
                Team
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm font-medium">Total Members</p>
              <div className="text-2xl font-bold">{totalMembers}</div>
              <p className="text-xs text-muted-foreground">
                in {activeOrg?.name ?? "organization"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <UserCheck className="text-muted-foreground size-6" />
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"
              >
                Active
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm font-medium">Active Seats</p>
              <div className="text-2xl font-bold">{activeMembers}</div>
              <p className="text-xs text-muted-foreground">currently active</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <Shield className="text-muted-foreground size-6" />
              <Badge
                variant="outline"
                className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-400"
              >
                Admin
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm font-medium">Administrators</p>
              <div className="text-2xl font-bold">{adminMembers}</div>
              <p className="text-xs text-muted-foreground">owners & admins</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <UserCheck className="text-muted-foreground size-6" />
              <Badge
                variant="outline"
                className="border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/20 dark:text-purple-400"
              >
                Support
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm font-medium">Agents & Supervisors</p>
              <div className="text-2xl font-bold">{agentMembers}</div>
              <p className="text-xs text-muted-foreground">handling inbox</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
        <CardContent className="space-y-4">
          {/* Donor Search and Role Filter Toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-36 h-9 text-xs cursor-pointer">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="analyst">Analyst</SelectItem>
                  <SelectItem value="billing_admin">Billing Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loadingMembers ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading team…</div>
          ) : filteredMembers.length === 0 ? (
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
                  {filteredMembers.map((member) => (
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

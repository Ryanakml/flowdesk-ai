import React, { useState, useEffect, useCallback, useId } from "react";
import type { MembershipMember } from "@flowdesk/contracts";
import { type RoleKey, hasPermission } from "@flowdesk/domain";
import { UserPlus, Users, Search, Info, ArrowUpRight } from "lucide-react";
import {
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
  Skeleton
} from "@flowdesk/ui";
import { listMembers, inviteMember, updateMemberRole, revokeMember } from "../../api.js";
import { useAuth } from "../auth/context.js";
import { ConfirmDialog } from "../../components/ConfirmDialog.js";

import { TeamSummary } from "./TeamSummary.js";
import { TeamMembersTable, teamRoles } from "./TeamMembersTable.js";

export interface TeamViewProps {
  initialShowInviteModal?: boolean;
}

export function TeamView({ initialShowInviteModal = false }: TeamViewProps = {}) {
  const { selectedOrgId, activeOrg, currentRole, showToast } = useAuth();
  const [members, setMembers] = useState<MembershipMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingMember, setUpdatingMember] = useState<string | null>(null);
  const [showRoles, setShowRoles] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(initialShowInviteModal);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<RoleKey>("agent");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (initialShowInviteModal) {
      setShowInviteModal(true);
    }
  }, [initialShowInviteModal]);

  useEffect(() => {
    if (!showInviteModal) setInviteError(null);
  }, [showInviteModal]);

  const inviteEmailId = useId();
  const inviteRoleId = useId();

  const canInvite = hasPermission(currentRole, "membership:invite");
  const canModifyRole = hasPermission(currentRole, "membership:modify");
  const canRevokeMember = hasPermission(currentRole, "membership:revoke");

  const loadMembers = useCallback(
    async (orgId: string) => {
      try {
        setLoadingMembers(true);
        setLoadError(null);
        const res = await listMembers(orgId);
        setMembers(res.members);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load members";
        setLoadError(message);
        showToast(message, true);
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
      setInviteError(null);
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
      const message = err instanceof Error ? err.message : "Failed to invite member";
      setInviteError(message);
      showToast(message, true);
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: RoleKey) => {
    if (!selectedOrgId) return;
    try {
      setUpdatingMember(memberId);
      const idempotencyKey = `role-${memberId}-${Date.now()}`;
      await updateMemberRole(selectedOrgId, memberId, newRole, idempotencyKey);
      showToast("Role updated successfully!");
      await loadMembers(selectedOrgId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update role", true);
    } finally {
      setUpdatingMember(null);
    }
  };

  const handleRevoke = async () => {
    if (!memberToRemove) return;
    if (!selectedOrgId) return;

    try {
      setRemoving(true);
      setRemoveError(null);
      const idempotencyKey = `revoke-${memberToRemove.id}-${Date.now()}`;
      await revokeMember(selectedOrgId, memberToRemove.id, idempotencyKey);
      showToast(`${memberToRemove.name} was removed from the team.`);
      setMemberToRemove(null);
      void loadMembers(selectedOrgId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove member";
      setRemoveError(message);
      showToast(message, true);
    } finally {
      setRemoving(false);
    }
  };

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
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Team &amp; Members</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage members, roles, and permissions for {activeOrg?.name ?? "your organization"}.
          </p>
        </div>
        {canInvite && (
          <Button
            onClick={() => setShowInviteModal(true)}
            id="invite-member-btn"
            data-testid="invite-member-btn"
          >
            <UserPlus className="size-4" />
            Invite Member
          </Button>
        )}
      </header>
      <TeamSummary members={members} loading={loadingMembers} unavailable={loadError !== null} />
      <Card className="min-w-0 shadow-none">
        <CardHeader className="gap-4 p-4 sm:p-6 xl:flex-row xl:items-center xl:justify-between xl:space-y-0">
          <div className="space-y-2">
            <CardTitle className="text-xl font-bold">Team Members</CardTitle>
            <CardDescription>
              Invite, manage, and set role permissions for your team.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                aria-label="Search members"
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 sm:w-60"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-36" aria-label="Filter by role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {teamRoles.map((role) => (
                  <SelectItem key={role.key} value={role.key}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 space-y-5 px-4 pb-4 sm:px-6 sm:pb-6">
          {loadingMembers ? (
            <div className="space-y-3" role="status" aria-label="Loading team">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : loadError ? (
            <div className="rounded-lg border border-destructive/30 p-6 text-center" role="alert">
              <p className="text-sm text-destructive">{loadError}</p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => selectedOrgId && void loadMembers(selectedOrgId)}
              >
                Try again
              </Button>
            </div>
          ) : filteredMembers.length > 0 ? (
            <TeamMembersTable
              members={filteredMembers}
              canModifyRole={canModifyRole}
              canRevokeMember={canRevokeMember}
              updatingMember={updatingMember}
              onRoleChange={(id, role) => void handleRoleChange(id, role)}
              onRemove={(member) => {
                setRemoveError(null);
                setMemberToRemove({ id: member.id, name: member.displayName });
              }}
            />
          ) : members.length > 0 || searchQuery || roleFilter !== "all" ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="font-medium">No members match your filters.</p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => {
                  setSearchQuery("");
                  setRoleFilter("all");
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : null}

          {!loadingMembers &&
            !loadError &&
            members.length <= 1 &&
            !searchQuery &&
            roleFilter === "all" && (
              <section className="flex flex-col items-center rounded-lg border border-dashed border-border px-4 py-6 text-center">
                <span className="mb-3 flex size-14 items-center justify-center rounded-xl border border-border bg-muted">
                  <Users className="size-6" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-semibold">
                  {members.length ? "No more team members yet" : "No team members yet"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {canInvite
                    ? "Invite your team to collaborate on customer conversations."
                    : "Ask a workspace owner or admin to invite your team."}
                </p>
                {canInvite && (
                  <Button className="mt-4" onClick={() => setShowInviteModal(true)}>
                    <UserPlus className="size-4" />
                    Invite Member
                  </Button>
                )}
              </section>
            )}

          <aside className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Info className="size-5" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">About roles and permissions</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Owners have full access to all workspace settings. Agents and supervisors can handle
                conversations based on their permissions.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowRoles(true)}>
              Learn more
              <ArrowUpRight className="size-4" />
            </Button>
          </aside>
        </CardContent>
      </Card>
      <Dialog open={showRoles} onOpenChange={setShowRoles}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Roles and permissions</DialogTitle>
            <DialogDescription>
              Workspace roles determine which actions each member can perform.
            </DialogDescription>
          </DialogHeader>
          <dl className="space-y-4">
            {teamRoles.map((role) => (
              <div key={role.key}>
                <dt className="text-sm font-semibold">{role.label}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{role.description}</dd>
              </div>
            ))}
          </dl>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoles(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog
        open={showInviteModal}
        onOpenChange={(open) => {
          if (!inviting) setShowInviteModal(open);
        }}
      >
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
                disabled={inviting}
                type="email"
                required
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={inviteRoleId}>Role</Label>
              <Select
                disabled={inviting}
                value={inviteRole}
                onValueChange={(val) => setInviteRole(val as RoleKey)}
              >
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
            {inviteError && (
              <p role="alert" className="text-sm text-destructive">
                {inviteError}
              </p>
            )}
            <DialogFooter className="gap-2 sm:gap-0 pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={inviting}
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
      <ConfirmDialog
        open={memberToRemove !== null}
        onOpenChange={(open) => {
          if (!open && !removing) setMemberToRemove(null);
        }}
        title={`Remove ${memberToRemove?.name ?? "this member"}?`}
        description={
          removeError ?? "This member will lose access to the organization and its workspace data."
        }
        confirmLabel="Remove Member"
        pending={removing}
        onConfirm={handleRevoke}
      />
    </div>
  );
}

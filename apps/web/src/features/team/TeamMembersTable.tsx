import type { MembershipMember } from "@flowdesk/contracts";
import type { RoleKey } from "@flowdesk/domain";
import { MoreHorizontal, UserX } from "lucide-react";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@flowdesk/ui";

export const teamRoles = [
  {
    key: "owner",
    label: "Owner",
    description:
      "Full workspace access, including security, members, channels, conversations, automation, analytics, audit logs and billing."
  },
  {
    key: "admin",
    label: "Admin",
    description:
      "Manage workspace security, members, channels, conversations and automation; view analytics and audit logs. No billing management."
  },
  {
    key: "supervisor",
    label: "Supervisor",
    description:
      "View members and channels, assign and resolve conversations, send messages and view analytics."
  },
  {
    key: "agent",
    label: "Agent",
    description: "View members, channels and conversations, and send messages."
  },
  {
    key: "analyst",
    label: "Analyst",
    description:
      "View members, channels, conversations, analytics and audit logs. No message sending or member management."
  },
  {
    key: "billing_admin",
    label: "Billing Admin",
    description: "View the member list and manage billing."
  }
] as const;

const statusStyles = {
  active: "bg-success/10 text-success border-success/30",
  invited: "bg-warning/10 text-warning border-warning/30",
  suspended: "bg-warning/10 text-warning border-warning/30",
  revoked: "bg-destructive/10 text-destructive border-destructive/30"
};

export function TeamMembersTable({
  members,
  canModifyRole,
  canRevokeMember,
  updatingMember,
  onRoleChange,
  onRemove
}: {
  members: MembershipMember[];
  canModifyRole: boolean;
  canRevokeMember: boolean;
  updatingMember: string | null;
  onRoleChange: (id: string, role: RoleKey) => void;
  onRemove: (member: MembershipMember) => void;
}) {
  return (
    <div
      className="min-w-0 overflow-auto rounded-lg border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      tabIndex={0}
      role="region"
      aria-label="Team members table"
    >
      <table className="w-full min-w-[720px] text-sm">
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="px-4">Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead title="Date the membership record was created, including invitation creation.">
              Joined
            </TableHead>
            {canRevokeMember && <TableHead className="px-4 text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.id} className="hover:bg-muted/40">
              <TableCell className="px-4 py-3">
                <div className="flex items-center gap-4">
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-primary/10 text-sm font-medium"
                    aria-hidden="true"
                  >
                    {(member.displayName || member.email)
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <div className="min-w-0 max-w-64">
                    <p className="truncate text-sm font-semibold" title={member.displayName}>
                      {member.displayName}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground" title={member.email}>
                      {member.email}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {canModifyRole ? (
                  <Select
                    value={member.roleKey}
                    disabled={updatingMember !== null || member.status === "revoked"}
                    onValueChange={(value) => onRoleChange(member.id, value as RoleKey)}
                  >
                    <SelectTrigger
                      className="h-8 w-32 text-xs"
                      aria-label={`Change role for ${member.displayName}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {teamRoles.map((role) => (
                        <SelectItem key={role.key} value={role.key}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-sm">{member.roleLabel}</span>
                )}
                {updatingMember === member.id && (
                  <span role="status" className="mt-1 block text-xs text-muted-foreground">
                    Updating…
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={`gap-1.5 rounded-md capitalize ${statusStyles[member.status]}`}
                >
                  <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                  {member.status}
                </Badge>
              </TableCell>
              <TableCell className="text-xs" title="Membership created at">
                <time dateTime={member.createdAt}>
                  {new Date(member.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })}
                  <span className="mt-1 block text-muted-foreground">
                    {new Date(member.createdAt).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit"
                    })}
                  </span>
                </time>
              </TableCell>
              {canRevokeMember && (
                <TableCell className="px-4 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-9"
                        disabled={member.status === "revoked"}
                        aria-label={`Actions for ${member.displayName}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => onRemove(member)}
                      >
                        <UserX className="size-4" />
                        Remove member
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </table>
    </div>
  );
}

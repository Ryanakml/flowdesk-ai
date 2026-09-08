import type { MembershipMember } from "@flowdesk/contracts";
import { ArrowUp, Shield, UserCheck, Users } from "lucide-react";
import { Card, Skeleton } from "@flowdesk/ui";

function ShareRing({ value, label }: { value: number; label: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className="size-12 shrink-0"
      role="img"
      aria-label={`${label}: ${value}% of team`}
    >
      <circle cx="24" cy="24" r="20" fill="none" stroke="var(--border)" strokeWidth="5" />
      <circle
        cx="24"
        cy="24"
        r="20"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="5"
        pathLength="100"
        strokeDasharray={`${value} 100`}
        transform="rotate(-90 24 24)"
      />
    </svg>
  );
}

export function TeamSummary({
  members,
  loading,
  unavailable
}: {
  members: MembershipMember[];
  loading: boolean;
  unavailable: boolean;
}) {
  const total = members.length;
  const active = members.filter((m) => m.status === "active").length;
  const admins = members.filter((m) => m.roleKey === "owner" || m.roleKey === "admin").length;
  const agents = members.filter((m) => m.roleKey === "agent" || m.roleKey === "supervisor").length;
  const now = new Date();
  const added = members.filter((m) => {
    const date = new Date(m.createdAt);
    return (
      date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date <= now
    );
  }).length;
  const share = (count: number) => (total ? Math.round((count / total) * 100) : 0);
  const stats = [
    { label: "Total Members", count: total, icon: Users, tone: "bg-primary/10 text-primary" },
    { label: "Active Seats", count: active, icon: UserCheck, tone: "bg-primary/10 text-primary" },
    { label: "Administrators", count: admins, icon: Shield, tone: "bg-success/10 text-success" },
    {
      label: "Agents & Supervisors",
      count: agents,
      icon: UserCheck,
      tone: "bg-muted text-muted-foreground"
    }
  ];
  return (
    <div
      className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4"
      aria-label="Team summary"
    >
      {stats.map(({ label, count, icon: Icon, tone }, index) => (
        <Card key={label} className="min-w-0 p-5 shadow-none" data-testid="team-stat">
          <div className="mb-3 flex items-center gap-4">
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}
            >
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-sm font-medium">{label}</h2>
          </div>
          {loading ? (
            <Skeleton className="h-20 w-full" />
          ) : unavailable ? (
            <p className="py-4 text-sm text-muted-foreground">Unavailable</p>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-4xl font-semibold tracking-tight tabular-nums">{count}</p>
                {index === 0 ? (
                  <p
                    className="mt-2 flex items-center gap-1 text-xs text-success"
                    title="Membership records created this calendar month; not net team growth."
                  >
                    <ArrowUp className="size-3.5" aria-hidden="true" />+{added} added this month
                  </p>
                ) : index === 1 ? (
                  <>
                    <p
                      className="mt-1 text-xs text-muted-foreground"
                      title="Active memberships out of all listed memberships, not a billing seat limit."
                    >
                      of {total} total seats
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <div
                        className="h-2 flex-1 rounded-full bg-muted"
                        role="progressbar"
                        aria-label="Active membership share"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={share(active)}
                      >
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${share(active)}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums">{share(active)}%</span>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">{share(count)}% of team</p>
                )}
              </div>
              {index > 1 && <ShareRing value={share(count)} label={label} />}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

import { Link, useRouterState } from "@tanstack/react-router";
import { activeNavClassName } from "./nav-styles.js";
import {
  Avatar,
  AvatarFallback,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@flowdesk/ui";
import { useAuth } from "../../features/auth/context.js";

interface UserNavProps {
  collapsed?: boolean;
  onNavigate?: (() => void) | undefined;
}

export function UserNav({ collapsed = false, onNavigate }: UserNavProps) {
  const { sessionUser, currentRole, handleLogout } = useAuth();
  const active = useRouterState({ select: (state) => state.location.pathname === "/profile" });
  if (!sessionUser) return null;

  const initials = sessionUser.displayName
    ? sessionUser.displayName
        .split(" ")
        .map((name) => name[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  const profileLink = (
    <Button
      asChild
      variant="ghost"
      className={`flex items-center gap-2 text-foreground font-normal hover:bg-muted/60 transition-colors ${active ? activeNavClassName : ""} ${
        collapsed
          ? "h-10 w-10 p-0 justify-center rounded-lg"
          : "w-full h-10 p-2 justify-start rounded-lg"
      }`}
      data-testid="user-nav-trigger"
    >
      <Link
        to="/profile"
        aria-label="Profile"
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
      >
        <Avatar className="h-8 w-8 rounded-full border border-border text-xs font-semibold shrink-0">
          <AvatarFallback
            className={`bg-primary/10 ${active ? "text-primary" : "text-foreground"}`}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <span className="truncate text-xs font-medium">{sessionUser.displayName}</span>
        )}
        {!collapsed && sessionUser.email && <span className="sr-only">{sessionUser.email}</span>}
        <span id="user-role-badge" data-testid="user-role-badge" className="sr-only">
          {currentRole.replace("_", " ")}
        </span>
      </Link>
    </Button>
  );

  if (!collapsed) {
    return (
      <>
        {profileLink}
        <button
          type="button"
          className="hidden"
          data-testid="logout-btn"
          onClick={() => void handleLogout()}
        >
          Sign out
        </button>
      </>
    );
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{profileLink}</TooltipTrigger>
        <TooltipContent side="right">Profile</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { TeamView } from "../features/team/TeamView.js";

export interface TeamSearch {
  openInvite?: boolean;
}

export const Route = createFileRoute("/team")({
  validateSearch: (search: Record<string, unknown>): TeamSearch => ({
    openInvite: search["openInvite"] === true || search["openInvite"] === "true"
  }),
  component: TeamRouteComponent
});

function TeamRouteComponent() {
  const search = Route.useSearch();
  const shouldOpenInvite = Boolean(search.openInvite);
  return <TeamView initialShowInviteModal={shouldOpenInvite} />;
}

import { createFileRoute } from "@tanstack/react-router";
import { ProfileView } from "../features/profile/ProfileView.js";

export const Route = createFileRoute("/profile")({
  component: ProfileView
});

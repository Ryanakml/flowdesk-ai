import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "../features/landing/LandingPage.js";

export const Route = createFileRoute("/")({
  component: LandingPage
});

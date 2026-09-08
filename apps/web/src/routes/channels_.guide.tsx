import { createFileRoute } from "@tanstack/react-router";
import { WhatsAppGuide } from "../features/channels/WhatsAppGuide.js";

export const Route = createFileRoute("/channels_/guide")({ component: WhatsAppGuide });

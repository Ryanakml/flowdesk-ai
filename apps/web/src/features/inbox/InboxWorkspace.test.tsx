// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import type { Conversation, Message } from "@flowdesk/contracts";
import { InboxWorkspace } from "./InboxWorkspace.js";

vi.mock("../../realtime.js", () => ({ useRealtimeSync: vi.fn() }));

const mockOrgId = "a0000000-0000-4000-8000-000000000001";
const mockUserId = "a0000000-0000-4000-8000-000000000012";

const sampleConv1: Conversation = {
  id: "conv-001",
  organizationId: mockOrgId,
  channelId: "chan-001",
  customerPhone: "6281234567890",
  customerName: "Budi Santoso",
  status: "open",
  priority: "medium",
  assignedToUserId: null,
  queueId: null,
  teamId: null,
  waitingReason: null,
  botPaused: false,
  firstResponseDueAt: null,
  resolutionDueAt: null,
  resolvedAt: null,
  firstRespondedAt: null,
  slaPausedAt: null,
  firstResponseRemainingSeconds: null,
  resolutionRemainingSeconds: null,
  version: 1,
  lastMessageAt: "2026-09-06T10:00:00.000Z",
  createdAt: "2026-09-06T09:00:00.000Z",
  updatedAt: "2026-09-06T10:00:00.000Z"
};

const sampleConv2: Conversation = {
  ...sampleConv1,
  id: "conv-002",
  customerPhone: "6289876543210",
  customerName: "Sari Dewi",
  status: "pending"
};

const sampleMessages: Message[] = [
  {
    id: "msg-001",
    organizationId: mockOrgId,
    conversationId: "conv-001",
    channelId: "chan-001",
    direction: "inbound",
    senderType: "customer",
    senderUserId: null,
    providerMessageId: "wamid-001",
    content: "Can you help me with my order?",
    status: "delivered",
    errorDetail: null,
    sentAt: "2026-09-06T09:05:00.000Z",
    deliveredAt: "2026-09-06T09:05:02.000Z",
    readAt: null,
    createdAt: "2026-09-06T09:05:00.000Z",
    updatedAt: "2026-09-06T09:05:02.000Z"
  }
];

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => cleanup());

describe("InboxWorkspace Operational Cockpit (UI-04)", () => {
  it("renders 3-pane operational workspace with conversation queue and timeline", () => {
    const mockFetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));

    render(
      <InboxWorkspace
        organizationId={mockOrgId}
        userRole="agent"
        sessionUserId={mockUserId}
        fetcher={mockFetcher}
        initialConversations={[sampleConv1, sampleConv2]}
        initialActiveConversation={sampleConv1}
        initialMessages={sampleMessages}
      />
    );

    expect(screen.getByTestId("inbox-container")).toBeDefined();
    expect(screen.getByTestId("conv-item-conv-001")).toBeDefined();
    expect(screen.getByTestId("conv-item-conv-002")).toBeDefined();
    expect(screen.getAllByText("Budi Santoso").length).toBeGreaterThan(0);
    expect(screen.getByText("Sari Dewi")).toBeDefined();
    expect(screen.getByTestId("thread-timeline")).toBeDefined();
    expect(screen.getByText("Can you help me with my order?")).toBeDefined();
  });

  it("updates conversation selection on item click", async () => {
    const onSelectConversation = vi.fn();
    const mockFetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));

    render(
      <InboxWorkspace
        organizationId={mockOrgId}
        userRole="agent"
        sessionUserId={mockUserId}
        fetcher={mockFetcher}
        initialConversations={[sampleConv1, sampleConv2]}
        initialActiveConversation={sampleConv1}
        onSelectConversation={onSelectConversation}
      />
    );

    const sariItem = screen.getByTestId("conv-item-conv-002");
    fireEvent.click(sariItem);

    expect(onSelectConversation).toHaveBeenCalledWith("conv-002");
    await waitFor(() => {
      expect(sariItem.classList.contains("selected")).toBe(true);
    });
  });

  it("filters conversations by search input", () => {
    const mockFetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));

    render(
      <InboxWorkspace
        organizationId={mockOrgId}
        userRole="agent"
        sessionUserId={mockUserId}
        fetcher={mockFetcher}
        initialConversations={[sampleConv1, sampleConv2]}
      />
    );

    const searchInput = screen.getByPlaceholderText("Search phone or name...");
    fireEvent.change(searchInput, { target: { value: "Sari" } });

    expect(screen.queryByText("Budi Santoso")).toBeNull();
    expect(screen.getByText("Sari Dewi")).toBeDefined();
  });

  it("shows empty state when no conversation is selected", () => {
    const mockFetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));

    render(
      <InboxWorkspace
        organizationId={mockOrgId}
        userRole="agent"
        sessionUserId={mockUserId}
        fetcher={mockFetcher}
        initialConversations={[]}
      />
    );

    const emptyStates = screen.getAllByTestId("no-conv-selected");
    expect(emptyStates.length).toBeGreaterThan(0);
    expect(screen.getAllByText("No conversation selected").length).toBeGreaterThan(0);
  });
});

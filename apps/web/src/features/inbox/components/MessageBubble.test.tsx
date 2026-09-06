// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Message } from "@flowdesk/contracts";
import { MessageBubble } from "./MessageBubble.js";

const mockMsgBase: Message = {
  id: "msg-001",
  organizationId: "org-001",
  conversationId: "conv-001",
  channelId: "chan-001",
  direction: "inbound",
  senderType: "customer",
  senderUserId: null,
  providerMessageId: "wamid-001",
  content: "Hello, I need help with my account",
  status: "delivered",
  errorDetail: null,
  sentAt: "2026-09-06T10:00:00.000Z",
  deliveredAt: "2026-09-06T10:00:02.000Z",
  readAt: null,
  createdAt: "2026-09-06T10:00:00.000Z",
  updatedAt: "2026-09-06T10:00:02.000Z"
};

describe("MessageBubble Component (UI-04)", () => {
  it("renders customer (inbound) messages with left-aligned neutral styling", () => {
    render(<MessageBubble message={mockMsgBase} />);

    const bubble = screen.getByTestId("msg-bubble-msg-001");
    expect(bubble).toBeDefined();
    expect(bubble.classList.contains("inbound")).toBe(true);
    expect(screen.getByText("Hello, I need help with my account")).toBeDefined();
  });

  it("renders agent (outbound) messages with right-aligned accent styling and checkmarks", () => {
    const outboundMsg: Message = {
      ...mockMsgBase,
      id: "msg-002",
      direction: "outbound",
      senderType: "agent",
      senderUserId: "user-001",
      status: "read",
      content: "Hi there! I would be happy to assist."
    };

    render(<MessageBubble message={outboundMsg} />);

    const bubble = screen.getByTestId("msg-bubble-msg-002");
    expect(bubble.classList.contains("outbound")).toBe(true);
    expect(screen.getByText("Hi there! I would be happy to assist.")).toBeDefined();
    expect(screen.getByLabelText("Read")).toBeDefined();
  });

  it("renders system events as discreet centered pills", () => {
    const systemMsg: Message = {
      ...mockMsgBase,
      id: "msg-003",
      senderType: "system",
      content: "Conversation status changed to resolved"
    };

    render(<MessageBubble message={systemMsg} />);

    const bubble = screen.getByTestId("msg-bubble-msg-003");
    expect(bubble.classList.contains("justify-center")).toBe(true);
    expect(screen.getByText("Conversation status changed to resolved")).toBeDefined();
  });

  it("renders failed outbound messages with error indicator and retry/remove actions", () => {
    const onRetry = vi.fn();
    const onRemove = vi.fn();
    const failedMsg: Message = {
      ...mockMsgBase,
      id: "msg-004",
      direction: "outbound",
      senderType: "agent",
      status: "failed",
      errorDetail: "Rate limit exceeded",
      content: "Sorry, this message failed"
    };

    render(<MessageBubble message={failedMsg} onRetry={onRetry} onRemove={onRemove} />);

    expect(screen.getByLabelText("Failed")).toBeDefined();
    const retryBtn = screen.getByText("Retry");
    const removeBtn = screen.getByText("Remove");

    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledWith("Sorry, this message failed");

    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalled();
  });
});

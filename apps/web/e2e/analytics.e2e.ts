import { expect, test, type Page } from "@playwright/test";

const orgId = "b0000000-0000-4000-8000-000000000001";
const channelId = "c0000000-0000-4000-8000-000000000001";
const series = [
  { date: "2026-09-02", inbound: 0, outbound: 0, bot: 0 },
  { date: "2026-09-03", inbound: 7, outbound: 4, bot: 4 },
  { date: "2026-09-04", inbound: 8, outbound: 4, bot: 4 },
  { date: "2026-09-05", inbound: 6, outbound: 3, bot: 3 },
  { date: "2026-09-06", inbound: 12, outbound: 8, bot: 7 }
];
const overview = {
  totalConversations: 5,
  openConversations: 3,
  assignedConversations: 1,
  resolvedConversations: 2,
  totalMessages: 52,
  inboundMessages: 33,
  outboundMessages: 19,
  botMessages: 18,
  humanMessages: 1,
  botAutomationRate: 34.6,
  slaMetPercentage: 100,
  avgFirstResponseTimeSeconds: 533,
  avgResolutionTimeSeconds: 1200
};
const conversations = ["Ryan Akmal", null, "Yan", null, "Andi"].map((name, i) => ({
  id: `d0000000-0000-4000-8000-00000000000${i + 1}`,
  organizationId: orgId,
  channelId,
  customerName: name,
  customerPhone: `628138383887${i}`,
  status: i % 2 ? "resolved" : "open",
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
  lastMessageAt: `2026-09-0${7 - i}T12:31:00Z`,
  createdAt: "2026-09-02T00:00:00Z",
  updatedAt: "2026-09-07T00:00:00Z"
}));

async function mockAnalytics(page: Page, mode: "normal" | "empty" | "single" = "normal") {
  const requests: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    requests.push(`${url.pathname}${url.search}`);
    if (url.pathname.endsWith("/auth/session"))
      await route.fulfill({
        json: {
          user: {
            id: "a0000000-0000-4000-8000-000000000001",
            email: "owner@example.test",
            displayName: "Owner"
          },
          expiresAt: "2099-01-01T00:00:00Z"
        }
      });
    else if (url.pathname === "/api/v1/organizations")
      await route.fulfill({
        json: {
          organizations: [
            {
              id: orgId,
              name: "flowdesk",
              slug: "flowdesk",
              role: "owner",
              membershipId: "b0000000-0000-4000-8000-000000000003"
            }
          ]
        }
      });
    else if (url.pathname.endsWith("/analytics/metrics"))
      await route.fulfill({
        json: {
          overview,
          volumeSeries:
            mode === "empty"
              ? []
              : mode === "single"
                ? series.slice(0, 1)
                : url.searchParams.get("days") === "365"
                  ? [
                      { ...series[1], date: "2026-01-01" },
                      { ...series[2], date: "2026-01-02" },
                      { ...series[3], date: "2026-02-01" }
                    ]
                  : series
        }
      });
    else if (url.pathname.endsWith("/analytics/export"))
      await route.fulfill({ body: "Date,Inbound\n2026-09-03,7", contentType: "text/csv" });
    else if (url.pathname.endsWith("/conversations"))
      await route.fulfill({
        json: { items: mode === "empty" ? [] : conversations, nextCursor: null }
      });
    else {
      const conversation = conversations.find((item) =>
        url.pathname.endsWith(`/conversations/${item.id}`)
      );
      if (conversation)
        await route.fulfill({
          json: {
            conversation,
            messages: [
              {
                id: "e0000000-0000-4000-8000-000000000001",
                organizationId: orgId,
                channelId,
                conversationId: conversation.id,
                direction: "inbound",
                senderType: "customer",
                senderUserId: null,
                providerMessageId: null,
                content: "Halo, saya mau tanya tentang layanan ini dan cara menggunakannya.",
                status: "delivered",
                errorDetail: null,
                sentAt: null,
                deliveredAt: null,
                readAt: null,
                createdAt: conversation.lastMessageAt,
                updatedAt: conversation.lastMessageAt
              }
            ]
          }
        });
      else await route.fulfill({ status: 404, json: {} });
    }
  });
  return requests;
}

async function capture(page: Page, name: string) {
  expect(
    await page
      .getByTestId("main-content")
      .evaluate((element) => element.scrollWidth <= element.clientWidth)
  ).toBe(true);
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path });
  await test.info().attach(name, { path, contentType: "image/png" });
}

test("analytics layout preserves metrics, requests, range aggregation and exports", async ({
  page
}) => {
  const requests = await mockAnalytics(page);
  await page.goto("/analytics");
  const cards = page.getByTestId("analytics-metric");
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0)).toContainText("5");
  await expect(cards.nth(1)).toContainText("34.6%");
  await expect(cards.nth(2)).toContainText("100%");
  await expect(cards.nth(3)).toContainText("20m");
  await expect(
    page.getByTestId("recent-chats").getByRole("link", { name: /Ryan Akmal/ })
  ).toBeVisible();
  await expect(page.getByTestId("analytics-metrics").locator(".recharts-area")).toHaveCount(3);
  await expect(page.getByRole("img", { name: "Current SLA compliance: 100%" })).toBeVisible();
  await capture(page, "analytics-overview");
  const chart = page.getByTestId("throughput-chart");
  const recent = page.getByTestId("recent-chats");
  if (page.viewportSize()!.width >= 1280) {
    const a = (await chart.boundingBox())!;
    const b = (await recent.boundingBox())!;
    expect(Math.abs(a.y - b.y)).toBeLessThan(2);
    expect(a.width / b.width).toBeGreaterThan(1.8);
    expect(Math.abs(a.height - b.height)).toBeLessThan(2);
  }
  await chart.scrollIntoViewIfNeeded();
  await capture(page, "analytics-chart-and-chats");
  const plot = chart.locator(".recharts-surface");
  await plot.hover({ position: { x: 55, y: 80 } });
  const tooltip = chart.locator(".recharts-tooltip-wrapper");
  await expect(tooltip).toBeVisible();
  const tooltipBox = (await tooltip.boundingBox())!;
  const chartBox = (await chart.boundingBox())!;
  expect(tooltipBox.x).toBeGreaterThanOrEqual(chartBox.x);
  expect(tooltipBox.x + tooltipBox.width).toBeLessThanOrEqual(chartBox.x + chartBox.width);
  await page.getByRole("combobox", { name: "Chart date range" }).click();
  await page.getByRole("option", { name: "Last 12 months" }).click();
  await expect(page.getByRole("combobox", { name: "Analytics date range" })).toContainText(
    "Last 12 months"
  );
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(2);
  await expect(page.getByRole("table")).toContainText("2026-01");
  await expect(page.getByRole("table").locator("tbody tr").first()).toContainText("15");
  await page.getByRole("combobox", { name: "Analytics date range" }).click();
  await page.getByRole("option", { name: "Last 7 days" }).click();
  await expect(page.getByRole("combobox", { name: "Chart date range" })).toContainText(
    "Last 7 days"
  );
  await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(5);
  expect(requests.filter((url) => url.includes("/analytics/metrics"))).toEqual(
    [30, 365, 7].map((days) => `/api/v1/organizations/${orgId}/analytics/metrics?days=${days}`)
  );
  expect(requests.filter((url) => url.includes("/conversations?"))).toHaveLength(1);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Compliance CSV" }).click();
  expect((await download).suggestedFilename()).toBe(`flowdesk-analytics-${orgId}.csv`);
  await expect(recent.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/inbox");
});

test("empty and single-point histories do not invent trends or break the layout", async ({
  page
}) => {
  await mockAnalytics(page, "empty");
  await page.goto("/analytics");
  await expect(page.getByText("No message activity in this period.")).toBeVisible();
  await expect(page.getByText("No recent conversations.")).toBeVisible();
  await capture(page, "analytics-empty");
  await page.unrouteAll({ behavior: "wait" });
  await mockAnalytics(page, "single");
  await page.reload();
  await expect(page.getByTestId("analytics-metrics").locator(".recharts-area-dot")).toHaveCount(3);
  await capture(page, "analytics-single-point");
});

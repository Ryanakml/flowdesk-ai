import { expect, test, type Locator, type Page } from "@playwright/test";

const orgId = "b0000000-0000-4000-8000-000000000001";

test.beforeEach(async ({ context }) => {
  // Exercise the production UI/CSS without a real session, provider, or logout.
  await context.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/auth/session") {
      await route.fulfill({
        json: {
          user: {
            id: "a0000000-0000-4000-8000-000000000001",
            email: "owner@example.test",
            displayName: "Owner"
          },
          expiresAt: "2099-01-01T00:00:00.000Z"
        }
      });
    } else if (path === "/api/v1/organizations") {
      await route.fulfill({
        json: {
          organizations: [
            {
              id: orgId,
              name: "Test Workspace",
              slug: "test-workspace",
              role: "owner",
              membershipId: "b0000000-0000-4000-8000-000000000003"
            }
          ]
        }
      });
    } else if (path === `/api/v1/organizations/${orgId}/channels`) {
      await route.fulfill({ json: [] });
    } else {
      await route.fulfill({ status: 404, json: { message: "Unexpected test request" } });
    }
  });
});

async function expectUsableDialog(page: Page, dialog: Locator) {
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeInViewport({ ratio: 1 });
  await expect(dialog).toHaveCSS("position", "fixed");
  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds).not.toBeNull();
  expect(Math.abs(bounds!.x + bounds!.width / 2 - viewport.width / 2)).toBeLessThan(2);
  expect(Math.abs(bounds!.y + bounds!.height / 2 - viewport.height / 2)).toBeLessThan(2);
  // A DOM-only assertion misses a dialog behind its blocking overlay.
  expect(
    await dialog.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return target !== null && element.contains(target);
    })
  ).toBe(true);
  const screenshotPath = test.info().outputPath("visible-dialog.png");
  await page.screenshot({ path: screenshotPath });
  await test.info().attach("visible-dialog", {
    path: screenshotPath,
    contentType: "image/png"
  });
}

async function expectUnlocked(page: Page) {
  await expect(page.locator("body")).not.toHaveCSS("pointer-events", "none");
}

async function capturePage(page: Page, name: string) {
  expect(
    await page
      .getByTestId("main-content")
      .evaluate((element) => element.scrollWidth <= element.clientWidth)
  ).toBe(true);
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path });
  await test.info().attach(name, { path, contentType: "image/png" });
}

const connectedChannel = {
  id: "c0000000-0000-4000-8000-000000000001",
  organizationId: orgId,
  type: "whatsapp",
  name: "flowdesk",
  phoneNumberId: "1100041206524835",
  wabaId: "2088901722795472",
  status: "active",
  statusReason: null,
  createdAt: "2026-09-03T00:34:00Z",
  updatedAt: "2026-09-03T00:34:00Z"
};

test("loading, connection errors, retry and pending fields stay interactive", async ({ page }) => {
  let releaseLoad = () => {};
  let releasePost = () => {};
  const loadGate = new Promise<void>((resolve) => {
    releaseLoad = resolve;
  });
  const postGate = new Promise<void>((resolve) => {
    releasePost = resolve;
  });
  let loads = 0;
  let submissions = 0;
  let connected = false;
  await page.route(`**/api/v1/organizations/${orgId}/channels`, async (route) => {
    if (route.request().method() === "POST") {
      submissions += 1;
      if (submissions === 1) {
        await postGate;
        await route.fulfill({ status: 400, json: { detail: "The access token has expired." } });
      } else {
        connected = true;
        await route.fulfill({
          status: 201,
          json: {
            channel: { ...connectedChannel, metadata: {} },
            displayPhoneNumber: null,
            verifiedName: null
          }
        });
      }
    } else {
      loads += 1;
      if (loads === 1) {
        await loadGate;
        await route.fulfill({
          status: 503,
          json: { detail: "Channels are temporarily unavailable." }
        });
      } else await route.fulfill({ json: connected ? [connectedChannel] : [] });
    }
  });
  await page.goto("/channels");
  await expect(page.getByRole("status", { name: "Loading connected channels" })).toBeVisible();
  releaseLoad();
  await expect(page.getByRole("alert")).toContainText("Channels are temporarily unavailable.");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("channels-empty-state")).toBeVisible();
  await page.getByRole("button", { name: "Connect your first channel" }).click();
  const dialog = page.getByRole("dialog");
  for (const [label, value] of [
    ["Channel name", "Support"],
    ["Phone Number ID", connectedChannel.phoneNumberId],
    ["WABA ID", connectedChannel.wabaId],
    ["Access token", "test-token"]
  ])
    await dialog.getByLabel(label!, { exact: true }).fill(value!);
  await dialog.getByRole("button", { name: "Verify and connect", exact: true }).click();
  await expect(dialog.getByLabel("Access token", { exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Verifying and connecting..." })).toBeDisabled();
  releasePost();
  await expect(dialog.getByRole("alert")).toContainText("The access token has expired.");
  await expect(dialog.getByLabel("Access token", { exact: true })).toBeEnabled();
  await dialog.getByLabel("Access token", { exact: true }).fill("replacement-test-token");
  await dialog.getByRole("button", { name: "Verify and connect", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("channel-card")).toBeVisible();
  expect(submissions).toBe(2);
});

test("Meta Signup remains available directly from the connection modal", async ({ page }) => {
  await page.route("**/embedded-signup/start", (route) =>
    route.fulfill({ status: 503, json: { detail: "Meta Signup is temporarily unavailable." } })
  );
  await page.goto("/channels");
  await page.getByRole("button", { name: "Connect WhatsApp", exact: true }).click();
  const request = page.waitForRequest(
    (req) => req.url().endsWith("/embedded-signup/start") && req.method() === "POST"
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Connect with Meta Signup/ })
    .click();
  await request;
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("Meta Signup is temporarily unavailable.");
  await expectUnlocked(page);
  await expect(page.getByRole("button", { name: "Connect WhatsApp", exact: true })).toBeEnabled();
});

test("channel card copies IDs, reconnects, verifies and confirms disconnect", async ({
  page,
  context
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  let disconnected = false;
  let verified = 0;
  await page.route(`**/api/v1/organizations/${orgId}/channels**`, async (route) => {
    if (route.request().method() === "DELETE") {
      disconnected = true;
      await route.fulfill({ json: { status: "disconnected" } });
    } else if (route.request().method() === "POST") {
      verified += 1;
      await route.fulfill({ json: { verified: true } });
    } else await route.fulfill({ json: disconnected ? [] : [connectedChannel] });
  });
  await page.goto("/channels");
  const card = page.getByTestId("channel-card");
  await expect(card.getByText("Connected", { exact: true })).toBeVisible();
  await capturePage(page, "connected-channel");
  for (const [label, value] of [
    ["Phone Number ID", connectedChannel.phoneNumberId],
    ["WABA ID", connectedChannel.wabaId]
  ]) {
    await card.getByRole("button", { name: `Copy ${label}` }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(value);
  }
  await card.getByRole("button", { name: "More actions for flowdesk" }).click();
  await page.getByRole("menuitem", { name: "Reconnect with token" }).click();
  const dialog = page.getByRole("dialog");
  await expectUsableDialog(page, dialog);
  await expect(dialog.getByLabel("Phone Number ID", { exact: true })).toHaveValue(
    connectedChannel.phoneNumberId
  );
  await expect(dialog.getByLabel("Access token", { exact: true })).toHaveValue("");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expectUnlocked(page);
  await card.getByRole("button", { name: "Test connection" }).click();
  await expect.poll(() => verified).toBe(1);
  await expect(
    page.getByRole("status").filter({ hasText: "WhatsApp API connection is healthy." })
  ).toBeVisible();
  await card.getByRole("button", { name: "Disconnect", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel", exact: true }).click();
  expect(disconnected).toBe(false);
  await card.getByRole("button", { name: "Disconnect", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Disconnect", exact: true })
    .click();
  await expect(page.getByTestId("channels-empty-state")).toBeVisible();
});

test("empty state and credential guide remain usable without losing the form", async ({
  page,
  context
}) => {
  await page.goto("/channels");
  await expect(page.getByTestId("channels-empty-state")).toBeVisible();
  await capturePage(page, "empty-channels");
  await page.getByRole("button", { name: "Connect your first channel" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Channel name", { exact: true }).fill("Customer Support");
  const popup = context.waitForEvent("page");
  await dialog.getByRole("link", { name: /View guide/ }).click();
  const guide = await popup;
  await expect(guide).toHaveURL(/\/channels\/guide$/);
  await expect(
    guide.getByRole("heading", { name: "Connect your WhatsApp Business account" })
  ).toBeVisible();
  await guide.close();
  await expect(dialog.getByLabel("Channel name", { exact: true })).toHaveValue("Customer Support");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.goto("/channels/guide");
  await expect(
    page.getByRole("heading", { name: "Connect your WhatsApp Business account" })
  ).toBeVisible();
  await capturePage(page, "credential-guide");
  await page
    .getByRole("navigation", { name: "Guide steps" })
    .getByRole("link", { name: /Prepare an access token/ })
    .click();
  await expect(page.getByRole("heading", { name: "Prepare an access token" })).toBeInViewport();
  await page.getByRole("link", { name: "Back to WhatsApp Channels" }).click();
  await expect(page.getByTestId("channels-empty-state")).toBeVisible();
});

test("active sidebar rail follows every page on desktop and drawer navigation", async ({
  page
}) => {
  const mobile = page.viewportSize()!.width < 1024;
  await page.goto("/channels");
  for (const path of [
    "/analytics",
    "/knowledge",
    "/channels",
    "/team",
    "/developer/api-keys",
    "/developer/webhooks",
    "/audit",
    "/settings/workspace",
    "/inbox"
  ]) {
    if (mobile) await page.getByRole("button", { name: "Open navigation menu" }).click();
    const sidebar = mobile
      ? page.getByTestId("mobile-sheet-content").getByTestId("app-sidebar")
      : page.getByTestId("app-sidebar").first();
    await sidebar.getByTestId(`nav-link-${path}`).click();
    await expect(page).toHaveURL((url) => url.pathname === path);
    if (mobile) await page.getByRole("button", { name: "Open navigation menu" }).click();
    const active = sidebar.getByTestId(`nav-link-${path}`);
    await expect(active).toHaveAttribute("aria-current", "page");
    await expect
      .poll(() =>
        active.evaluate((element) => {
          const rail = getComputedStyle(element, "::before");
          return (
            rail.width === "2px" &&
            rail.backgroundColor === getComputedStyle(element.querySelector("svg")!).color
          );
        })
      )
      .toBe(true);
    await expect(sidebar.locator('[aria-current="page"]')).toHaveCount(1);
    if (mobile) await page.keyboard.press("Escape");
  }
  if (!mobile) {
    await page.getByRole("button", { name: "Toggle sidebar collapse" }).click();
    const active = page.getByTestId("nav-link-/inbox");
    await expect(active).toHaveAccessibleName("Inbox");
    await expect(active).toHaveAttribute("aria-current", "page");
  }
  if (mobile) await page.getByRole("button", { name: "Open navigation menu" }).click();
  const sidebar = mobile
    ? page.getByTestId("mobile-sheet-content").getByTestId("app-sidebar")
    : page.getByTestId("app-sidebar").first();
  await sidebar.getByRole("link", { name: "Profile" }).click();
  if (mobile) await page.getByRole("button", { name: "Open navigation menu" }).click();
  await expect(sidebar.getByRole("link", { name: "Profile" })).toHaveAttribute(
    "aria-current",
    "page"
  );
});

test("Connect WhatsApp stays visible, accepts input, and closes/reopens", async ({ page }) => {
  await page.goto("/channels");
  const trigger = page.getByRole("button", { name: "Connect WhatsApp", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expectUsableDialog(page, dialog);
  for (const [label, value] of [
    ["Channel name", "Support"],
    ["Phone Number ID", "10987654321"],
    ["WABA ID", "9876543210"],
    ["Access token", "test-token"]
  ]) {
    await dialog.getByLabel(label!, { exact: true }).fill(value!);
    await expect(dialog.getByLabel(label!, { exact: true })).toHaveValue(value!);
  }
  await dialog.getByRole("button", { name: "Show access token" }).click();
  await expect(dialog.getByLabel("Access token", { exact: true })).toHaveAttribute("type", "text");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expectUnlocked(page);
  await trigger.click();
  await expectUsableDialog(page, dialog);
  await expect(dialog.getByLabel("Access token", { exact: true })).toHaveAttribute(
    "type",
    "password"
  );
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expectUnlocked(page);
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expectUnlocked(page);
});

test("Logout confirmation is visible and cancel restores page interaction", async ({ page }) => {
  await page.goto("/profile");
  const trigger = page.getByTestId("profile-logout-button");
  await trigger.click();
  const dialog = page.getByRole("alertdialog");
  await expectUsableDialog(page, dialog);
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expectUnlocked(page);
  await trigger.click();
  await expectUsableDialog(page, dialog);
  const logoutRequest = page.waitForRequest(
    (request) => request.url().endsWith("/api/v1/auth/logout") && request.method() === "POST"
  );
  await dialog.getByRole("button", { name: "Logout", exact: true }).click();
  await logoutRequest;
  await expect(dialog).toHaveCount(0);
  await expectUnlocked(page);
});
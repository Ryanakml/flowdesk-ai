import { expect, test, type Locator, type Page } from "@playwright/test";

const orgId = "b0000000-0000-4000-8000-000000000001";

test.beforeEach(async ({ page }) => {
  // Exercise the production UI/CSS without a real session, provider, or logout.
  await page.route("**/api/v1/**", async (route) => {
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
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expectUnlocked(page);
  await trigger.click();
  await expectUsableDialog(page, dialog);
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

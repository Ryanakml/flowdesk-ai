import { expect, test, type Page } from "@playwright/test";

const orgId = "b0000000-0000-4000-8000-000000000001";
const owner = {
  id: "c0000000-0000-4000-8000-000000000001",
  userId: "a0000000-0000-4000-8000-000000000001",
  email: "ryan@example.test",
  displayName: "RYAN AKMAL PASYA",
  roleKey: "owner",
  roleLabel: "Owner",
  status: "active",
  createdAt: "2026-09-03T00:34:00Z"
};
async function setup(
  page: Page,
  options: { role?: string; members?: (typeof owner)[]; fail?: boolean } = {}
) {
  const state = {
    members: options.members ?? [owner],
    fail: options.fail ?? false,
    writes: [] as { method: string; body: unknown; key: string | undefined }[]
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/auth/session"))
      return route.fulfill({
        json: {
          user: { id: owner.userId, email: owner.email, displayName: owner.displayName },
          expiresAt: "2099-01-01T00:00:00Z"
        }
      });
    if (path === "/api/v1/organizations")
      return route.fulfill({
        json: {
          organizations: [
            {
              id: orgId,
              name: "ryanakml",
              slug: "ryanakml",
              role: options.role ?? "owner",
              membershipId: owner.id
            }
          ]
        }
      });
    if (path.endsWith("/members") && request.method() === "GET")
      return route.fulfill(
        state.fail
          ? { status: 500, json: { detail: "Unable to load team" } }
          : { json: { members: state.members } }
      );
    if (request.method() !== "GET") {
      state.writes.push({
        method: request.method(),
        body: request.postData() ? request.postDataJSON() : null,
        key: request.headers()["idempotency-key"]
      });
      if (request.method() === "PATCH") {
        const body = request.postDataJSON() as { role: string };
        state.members = state.members.map((member) =>
          member.id === path.split("/").at(-1)
            ? { ...member, roleKey: body.role, roleLabel: "Admin" }
            : member
        );
        return route.fulfill({ json: { membershipId: owner.id, role: "admin" } });
      }
      if (request.method() === "DELETE") {
        state.members = state.members.map((member) =>
          member.id === path.split("/").at(-1) ? { ...member, status: "revoked" } : member
        );
        return route.fulfill({ json: { status: "ok" } });
      }
      if (path.endsWith("/invitations"))
        return route.fulfill({
          status: 400,
          json: { detail: "This email already has an invitation." }
        });
    }
    return route.fulfill({ status: 404, json: { detail: "Unexpected request" } });
  });
  await page.goto("/team");
  await expect(page.getByTestId("team-view")).toBeVisible();
  return state;
}

async function screenshot(page: Page, name: string) {
  expect(
    await page.getByTestId("main-content").evaluate((el) => el.scrollWidth <= el.clientWidth)
  ).toBe(true);
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path });
  await test.info().attach(name, { path, contentType: "image/png" });
}

test("reference layout, truthful indicators, filters, roles help and invitation remain usable", async ({
  page
}) => {
  const state = await setup(page);
  await expect(page.getByRole("heading", { name: "Team & Members" })).toBeVisible();
  await expect(page.getByTestId("team-stat")).toHaveCount(4);
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  await expect(page.getByRole("img", { name: "Administrators: 100% of team" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Joined" })).toBeAttached();
  await expect(page.getByRole("columnheader", { name: "Email", exact: true })).toHaveCount(0);
  await expect(page.getByText("No more team members yet")).toBeVisible();
  await screenshot(page, "team-overview");
  await page.getByRole("region", { name: "Team members table" }).scrollIntoViewIfNeeded();
  await screenshot(page, "team-members");
  const region = page.getByRole("region", { name: "Team members table" });
  if (page.viewportSize()!.width < 768) {
    await region.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  }
  await page.getByRole("textbox", { name: "Search members" }).fill("no-match");
  await expect(page.getByText("No members match your filters.")).toBeVisible();
  await expect(page.getByText("No more team members yet")).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("combobox", { name: "Filter by role" }).click();
  await page.getByRole("option", { name: "Agent", exact: true }).click();
  await expect(page.getByText("No members match your filters.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("button", { name: "Learn more" }).click();
  const help = page.getByRole("dialog");
  await expect(help).toBeInViewport({ ratio: 1 });
  await expect(help.getByText("Billing Admin", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("invite-member-btn").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeInViewport({ ratio: 1 });
  await dialog.getByLabel("Email Address").fill("colleague@example.test");
  await dialog.getByRole("button", { name: "Send Invitation" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("This email already has an invitation.");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  expect(state.writes[0]).toMatchObject({
    method: "POST",
    body: { email: "colleague@example.test", role: "agent" }
  });
  expect(state.writes[0]?.key).toBeTruthy();
});

test("role updates and remove menu preserve permissions and confirmation", async ({ page }) => {
  const colleague = {
    ...owner,
    id: "c0000000-0000-4000-8000-000000000002",
    userId: "a0000000-0000-4000-8000-000000000002",
    displayName: "Team Agent",
    email: "agent@example.test",
    roleKey: "agent",
    roleLabel: "Agent"
  };
  const state = await setup(page, { members: [owner, colleague] });
  await page.getByRole("combobox", { name: `Change role for ${colleague.displayName}` }).click();
  await page.getByRole("option", { name: "Admin", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: `Change role for ${colleague.displayName}` })
  ).toContainText("Admin");
  await page.getByRole("button", { name: `Actions for ${colleague.displayName}` }).click();
  await page.getByRole("menuitem", { name: "Remove member" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeInViewport({ ratio: 1 });
  await confirm.getByRole("button", { name: "Cancel" }).click();
  expect(state.writes.filter((w) => w.method === "DELETE")).toHaveLength(0);
  await page.getByRole("button", { name: `Actions for ${colleague.displayName}` }).click();
  await page.getByRole("menuitem", { name: "Remove member" }).click();
  await confirm.getByRole("button", { name: "Remove Member" }).click();
  await expect(confirm).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: `Actions for ${colleague.displayName}` })
  ).toBeDisabled();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  expect(state.writes.map((w) => w.method)).toEqual(["PATCH", "DELETE"]);
  expect(state.writes.every((w) => w.key)).toBe(true);
});

test("load errors retry, empty data and restricted members do not expose management", async ({
  page
}) => {
  const state = await setup(page, { role: "agent", fail: true, members: [] });
  await expect(page.getByTestId("team-view").getByRole("alert")).toContainText(
    "Unable to load team"
  );
  await expect(page.getByTestId("team-stat").getByText("Unavailable")).toHaveCount(4);
  state.fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("No team members yet", { exact: true })).toBeVisible();
  await expect(
    page.getByTestId("team-view").getByRole("button", { name: "Invite Member" })
  ).toHaveCount(0);
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  state.members = [owner];
  await page.reload();
  await expect(page.getByRole("cell", { name: "Owner", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: /Change role/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Actions for/ })).toHaveCount(0);
  await screenshot(page, "team-readonly");
});

test("direct invite links, loading and pending invitation recover with success", async ({
  page
}) => {
  const state = await setup(page);
  let releaseLoad = () => {};
  const loadGate = new Promise<void>((resolve) => {
    releaseLoad = resolve;
  });
  await page.route("**/api/v1/organizations/*/members", async (route) => {
    await loadGate;
    await route.fulfill({ json: { members: state.members } });
  });
  await page.goto("/team?openInvite=true");
  await expect(page.getByRole("dialog", { name: "Invite Team Member" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("status", { name: "Loading team" })).toBeVisible();
  releaseLoad();
  await expect(page.getByRole("cell", { name: /ryan@example.test/ })).toBeVisible();
  let releaseInvite = () => {};
  const inviteGate = new Promise<void>((resolve) => {
    releaseInvite = resolve;
  });
  await page.route("**/api/v1/organizations/*/invitations", async (route) => {
    await inviteGate;
    await route.fulfill({
      json: {
        invitation: {
          id: "d0000000-0000-4000-8000-000000000001",
          organizationId: orgId,
          email: "new@example.test",
          role: "agent",
          status: "pending",
          expiresAt: "2099-01-01T00:00:00Z",
          inviteToken: "fixture-only-token"
        }
      }
    });
  });
  await page.getByTestId("invite-member-btn").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email Address").fill("new@example.test");
  await dialog.getByRole("button", { name: "Send Invitation" }).click();
  await expect(dialog.getByLabel("Email Address")).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Sending…" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  releaseInvite();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Invitation sent to new@example.test!")).toBeVisible();
});

test("server role and last-owner errors retain the member and keep dialogs usable", async ({
  page
}) => {
  await setup(page);
  await page.route("**/api/v1/organizations/*/members/*", async (route) => {
    await route.fulfill({
      status: 400,
      json: { detail: "The last active owner cannot be removed or demoted." }
    });
  });
  await page.getByRole("combobox", { name: `Change role for ${owner.displayName}` }).click();
  await page.getByRole("option", { name: "Agent", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: `Change role for ${owner.displayName}` })
  ).toContainText("Owner");
  await expect(page.getByText("The last active owner cannot be removed or demoted.")).toBeVisible();
  await page.getByRole("button", { name: `Actions for ${owner.displayName}` }).click();
  await page.getByRole("menuitem", { name: "Remove member" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "Remove Member" }).click();
  await expect(dialog).toContainText("The last active owner cannot be removed or demoted.");
  await expect(dialog.getByRole("button", { name: "Remove Member" })).toBeEnabled();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("cell", { name: /ryan@example.test/ })).toBeVisible();
});

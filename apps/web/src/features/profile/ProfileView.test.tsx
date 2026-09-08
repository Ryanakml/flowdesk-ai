// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileView } from "./ProfileView.js";

const handleLogout = vi.fn<() => Promise<void>>();

vi.mock("../auth/context.js", () => ({
  useAuth: () => ({
    sessionUser: {
      id: "10000000-0000-4000-8000-000000000001",
      displayName: "Ryan Akmal Pasya",
      email: "ryan@example.com"
    },
    currentRole: "owner",
    handleLogout
  })
}));

describe("ProfileView logout", () => {
  afterEach(() => {
    cleanup();
    handleLogout.mockReset();
  });

  it("closes the confirmation overlay before a slow logout request resolves", async () => {
    let resolveLogout!: () => void;
    handleLogout.mockReturnValue(new Promise<void>((resolve) => (resolveLogout = resolve)));
    render(<ProfileView />);

    fireEvent.click(screen.getByTestId("profile-logout-button"));
    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    expect(handleLogout).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    resolveLogout();
  });
});

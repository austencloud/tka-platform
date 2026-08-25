import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lastMethod: null as null | "google" | "password" | "magic-link",
}));

vi.mock("./EmailLinkAuth.svelte", async () => ({
  default: (await import("./__test-stubs__/EmailAuthMethodStub.svelte"))
    .default,
}));

vi.mock("./EmailPasswordAuth.svelte", async () => ({
  default: (await import("./__test-stubs__/EmailAuthMethodStub.svelte"))
    .default,
}));

vi.mock("./LastUsedBadge.svelte", async () => ({
  default: (await import("./__test-stubs__/EmailAuthMethodStub.svelte"))
    .default,
}));

vi.mock("$lib/shared/i18n/i18n.svelte", () => ({
  t: (key: string) => (key === "auth_password" ? "Password" : key),
}));

vi.mock("$lib/shared/auth/services/last-auth-method.svelte", () => ({
  getLastAuthMethod: () => mocks.lastMethod,
}));

import EmailAuthTabs from "./EmailAuthTabs.svelte";

describe("EmailAuthTabs", () => {
  beforeEach(() => {
    mocks.lastMethod = null;
  });

  it("starts new users on the email-code path", async () => {
    render(EmailAuthTabs);

    await expect
      .element(page.getByRole("tab", { name: "Email code" }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(page.getByRole("tab", { name: "Password" }))
      .toHaveAttribute("aria-selected", "false");
  });

  it("remembers a returning password user's method", async () => {
    mocks.lastMethod = "password";
    render(EmailAuthTabs);

    await expect
      .element(page.getByRole("tab", { name: /Password, last used/ }))
      .toHaveAttribute("aria-selected", "true");
  });
});

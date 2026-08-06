import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentSheet } from "$lib/shared/navigation/services/sheet-router";
import { SheetRouter } from "$lib/shared/navigation/services/sheet-router-service";

vi.mock("$app/environment", () => ({ browser: true }));
vi.mock("$app/navigation", () => ({
  pushState: vi.fn(),
  replaceState: vi.fn(),
}));

describe("Inbox sheet deep links", () => {
  beforeEach(() => {
    history.replaceState({}, "", "/browse/library?sheet=inbox");
  });

  it("is recognized by both sheet-router entry points", () => {
    expect(getCurrentSheet()).toBe("inbox");
    expect(new SheetRouter().getCurrentSheet()).toBe("inbox");
  });
});

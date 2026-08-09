import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeAll,
  closeSheet,
  getCurrentSheet,
  openSheet,
} from "$lib/shared/navigation/services/sheet-router";
import { page } from "$app/state";
import { pushState, replaceState } from "$app/navigation";

vi.mock("$app/environment", () => ({ browser: true }));
vi.mock("$app/navigation", () => ({
  pushState: vi.fn(),
  replaceState: vi.fn(),
}));

describe("Inbox sheet deep links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    page.state = {};
    history.replaceState({}, "", "/browse/library?sheet=inbox");
  });

  it("is recognized by the sheet router", () => {
    expect(getCurrentSheet()).toBe("inbox");
  });

  it("preserves module history when opening a sheet", () => {
    page.state = { moduleId: "browse", sectionId: "library" };
    history.replaceState({}, "", "/browse/library?keep=yes#saved");

    openSheet("inbox");

    const [destination, state] = vi.mocked(pushState).mock.calls[0] ?? [];
    expect(new URL(String(destination)).href).toBe(
      "http://localhost:3000/browse/library?keep=yes&sheet=inbox#saved"
    );
    expect(state).toEqual({
      moduleId: "browse",
      sectionId: "library",
      sheet: "inbox",
      urlOverlay: "sheet",
    });
  });

  it("replaces a directly loaded sheet URL when closing", () => {
    page.state = {
      moduleId: "browse",
      sectionId: "library",
      sheet: "inbox",
    };

    closeSheet();

    const [destination, state] = vi.mocked(replaceState).mock.calls[0] ?? [];
    expect(new URL(String(destination)).href).toBe(
      "http://localhost:3000/browse/library"
    );
    expect(state).toEqual({ moduleId: "browse", sectionId: "library" });
  });

  it("returns through history when closing a sheet opened in-app", () => {
    page.state = {
      moduleId: "browse",
      sectionId: "library",
      sheet: "inbox",
      urlOverlay: "sheet",
    };
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});

    closeSheet();

    expect(back).toHaveBeenCalledOnce();
    expect(replaceState).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it("does not carry animation state into another sheet", () => {
    page.state = {
      moduleId: "browse",
      sectionId: "library",
      sheet: "animation",
      animationPanel: { sequenceId: "sequence-1", speed: 2 },
    };
    history.replaceState(
      {},
      "",
      "/browse/library?sheet=animation&animSeqId=sequence-1&animSpeed=2"
    );

    openSheet("auth");

    const [destination, state] = vi.mocked(pushState).mock.calls[0] ?? [];
    expect(new URL(String(destination)).search).toBe("?sheet=auth");
    expect(state).toEqual({
      moduleId: "browse",
      sectionId: "library",
      sheet: "auth",
      urlOverlay: "sheet",
    });
  });

  it("removes overlay markers when closing every direct route", () => {
    page.state = {
      moduleId: "browse",
      sectionId: "library",
      sheet: "inbox",
      urlOverlay: "spotlight",
    };
    history.replaceState(
      {},
      "",
      "/browse/library?sheet=inbox&spotlight=sequence-1"
    );

    closeAll();

    const [, state] = vi.mocked(replaceState).mock.calls[0] ?? [];
    expect(state).toEqual({ moduleId: "browse", sectionId: "library" });
  });
});

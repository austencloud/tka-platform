import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  pushState: vi.fn(),
  replaceState: vi.fn(),
}));

const appPage = vi.hoisted(() => ({
  state: {} as App.PageState,
}));

vi.mock("$app/environment", () => ({ browser: true }));
vi.mock("$app/navigation", () => navigation);
vi.mock("$app/state", () => ({ page: appPage }));

import {
  mutateCurrentUrl,
  removeCurrentUrlParams,
  writeUrl,
} from "$lib/shared/navigation/services/url-state";

describe("URL state writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appPage.state = {};
    window.history.replaceState(
      {},
      "",
      "/browse/library?fresh=123&keep=yes#result"
    );
  });

  it("preserves unrelated URL parts and existing page state", () => {
    appPage.state = { moduleId: "browse", sectionId: "library" };

    removeCurrentUrlParams(["fresh"]);

    const [destination, state] = navigation.replaceState.mock.calls[0] ?? [];
    expect(new URL(String(destination)).href).toBe(
      "http://localhost:3000/browse/library?keep=yes#result"
    );
    expect(state).toEqual({ moduleId: "browse", sectionId: "library" });
  });

  it("removes only explicitly retired page-state keys", () => {
    appPage.state = {
      moduleId: "browse",
      sectionId: "library",
      sequenceOverlay: true,
    };

    mutateCurrentUrl(
      (url) => {
        url.searchParams.delete("fresh");
      },
      { removeState: ["sequenceOverlay"] }
    );

    expect(navigation.replaceState).toHaveBeenCalledWith(expect.any(URL), {
      moduleId: "browse",
      sectionId: "library",
    });
  });

  it("pushes a merged state without erasing navigation metadata", () => {
    appPage.state = { moduleId: "create", sectionId: "construct" };

    writeUrl("?sheet=inbox", {
      mode: "push",
      state: { sheet: "inbox", urlOverlay: "sheet" },
    });

    expect(navigation.pushState).toHaveBeenCalledWith("?sheet=inbox", {
      moduleId: "create",
      sectionId: "construct",
      sheet: "inbox",
      urlOverlay: "sheet",
    });
  });

  it("does not write when neither the URL nor page state changed", () => {
    removeCurrentUrlParams(["missing"]);

    expect(navigation.replaceState).not.toHaveBeenCalled();
  });
});

describe("URL writes issued before the router is initialized", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appPage.state = {};
    window.history.replaceState({}, "", "/learn/concepts/unknown");
  });

  function routerNotReadyOnce(spy: typeof navigation.replaceState) {
    spy.mockImplementationOnce(() => {
      throw new Error(
        "Cannot call replaceState(...) before router is initialized"
      );
    });
  }

  it("swallows the early failure and retries on the next task", async () => {
    routerNotReadyOnce(navigation.replaceState);

    expect(() => writeUrl("/learn/concepts")).not.toThrow();
    expect(navigation.replaceState).toHaveBeenCalledTimes(1);

    await vi.waitFor(() =>
      expect(navigation.replaceState).toHaveBeenCalledTimes(2)
    );
    expect(navigation.replaceState.mock.calls[1]?.[0]).toBe("/learn/concepts");
  });

  it("drops a stale deferred write when a newer one supersedes it", async () => {
    routerNotReadyOnce(navigation.replaceState);
    writeUrl("/learn/concepts");

    writeUrl("/learn/concepts/grid");

    await vi.waitFor(() =>
      expect(navigation.replaceState).toHaveBeenCalledTimes(2)
    );
    expect(navigation.replaceState.mock.calls[1]?.[0]).toBe(
      "/learn/concepts/grid"
    );
    expect(navigation.replaceState).toHaveBeenCalledTimes(2);
  });

  it("still surfaces failures that are not router-readiness", () => {
    navigation.replaceState.mockImplementationOnce(() => {
      throw new Error("Could not serialize state");
    });

    expect(() => writeUrl("/learn/concepts")).toThrow(
      "Could not serialize state"
    );
  });
});

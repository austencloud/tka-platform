import { describe, expect, it, vi } from "vitest";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";
import {
  createWorkspaceShareReadiness,
  getWorkspaceCardMenuAction,
  shouldPrewarmWorkspaceShareCard,
} from "../../src/lib/features/create/shared/workspace-panel/shared/state/workspace-share-readiness.svelte";

function makeSequence(word: string): SequenceData {
  return {
    id: word,
    word,
    name: word,
    steps: [{ letter: "A" }],
  } as unknown as SequenceData;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("Create workspace share readiness", () => {
  it("deduplicates a cold card preparation and exposes it only when ready", async () => {
    const pending = deferred<{ blob: Blob; filename: string }>();
    const renderCard = vi.fn(() => pending.promise);
    const state = createWorkspaceShareReadiness({
      renderCard,
      createLink: vi.fn(),
    });
    const sequence = makeSequence("COLD");
    const options = { darkMode: false };

    const first = state.prepareCard("card-key", sequence, options);
    const concurrent = state.prepareCard("card-key", sequence, options);

    expect(first).toBe(concurrent);
    expect(state.getCardPhase("card-key")).toBe("preparing");
    expect(state.getPreparedCard("card-key")).toBeNull();

    const card = {
      blob: new Blob(["card"], { type: "image/png" }),
      filename: "card.png",
    };
    pending.resolve(card);
    await first;

    expect(renderCard).toHaveBeenCalledOnce();
    expect(state.getCardPhase("card-key")).toBe("ready");
    expect(state.getPreparedCard("card-key")).toEqual(card);
  });

  it("cleans up a rejected card request so a later gesture can retry", async () => {
    const card = {
      blob: new Blob(["retry"], { type: "image/png" }),
      filename: "retry.png",
    };
    const renderCard = vi
      .fn()
      .mockRejectedValueOnce(new Error("render failed"))
      .mockResolvedValueOnce(card);
    const state = createWorkspaceShareReadiness({
      renderCard,
      createLink: vi.fn(),
    });
    const sequence = makeSequence("RETRY");
    const options = { darkMode: false };

    await expect(
      state.prepareCard("retry-key", sequence, options)
    ).rejects.toThrow("render failed");
    expect(state.getCardPhase("retry-key")).toBe("failed");

    await expect(
      state.prepareCard("retry-key", sequence, options)
    ).resolves.toBe(card);
    expect(renderCard).toHaveBeenCalledTimes(2);
    expect(state.getCardPhase("retry-key")).toBe("ready");
  });

  it("does not publish a stale preparation over the current card", async () => {
    const firstPending = deferred<{ blob: Blob; filename: string }>();
    const secondPending = deferred<{ blob: Blob; filename: string }>();
    const renderCard = vi
      .fn()
      .mockReturnValueOnce(firstPending.promise)
      .mockReturnValueOnce(secondPending.promise);
    const state = createWorkspaceShareReadiness({
      renderCard,
      createLink: vi.fn(),
    });
    const options = { darkMode: false };

    const first = state.prepareCard("first", makeSequence("FIRST"), options);
    const second = state.prepareCard("second", makeSequence("SECOND"), options);
    firstPending.resolve({
      blob: new Blob(["first"]),
      filename: "first.png",
    });
    await first;

    expect(state.getCardPhase("second")).toBe("preparing");
    expect(state.getPreparedCard("first")).toBeNull();

    const current = {
      blob: new Blob(["second"]),
      filename: "second.png",
    };
    secondPending.resolve(current);
    await second;

    expect(state.getPreparedCard("second")).toEqual(current);
  });

  it("prepares a link ahead of the clipboard gesture and clears it on sign-out", async () => {
    const createLink = vi.fn().mockResolvedValue("https://tka.run/ABCD");
    const state = createWorkspaceShareReadiness({
      renderCard: vi.fn(),
      createLink,
    });
    const sequence = makeSequence("LINK");

    await state.prepareLink("link-key", sequence);
    expect(state.getLinkPhase("link-key")).toBe("ready");
    expect(state.getPreparedLink("link-key")).toEqual({
      url: "https://tka.run/ABCD",
    });

    state.setLinkKey(null);
    expect(state.getLinkPhase("link-key")).toBe("idle");
    expect(state.getPreparedLink("link-key")).toBeNull();
  });
});

describe("Create workspace share presentation", () => {
  it("prewarms share cards only where native file handoff is available", () => {
    expect(
      shouldPrewarmWorkspaceShareCard({
        isMobileTarget: true,
        nativeFileShareSupported: false,
      })
    ).toBe(false);
    expect(
      shouldPrewarmWorkspaceShareCard({
        isMobileTarget: true,
        nativeFileShareSupported: true,
      })
    ).toBe(true);
    expect(
      shouldPrewarmWorkspaceShareCard({
        isMobileTarget: false,
        nativeFileShareSupported: true,
      })
    ).toBe(false);
  });

  it("keeps a stable first menu action through every readiness state", () => {
    expect(getWorkspaceCardMenuAction("idle", false)).toBe("preparing");
    expect(getWorkspaceCardMenuAction("preparing", false)).toBe("preparing");
    expect(getWorkspaceCardMenuAction("ready", true)).toBe("share");
    expect(getWorkspaceCardMenuAction("ready", false)).toBe("unavailable");
    expect(getWorkspaceCardMenuAction("failed", false)).toBe("retry");
  });
});

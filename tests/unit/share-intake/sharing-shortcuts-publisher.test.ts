import { describe, it, expect, vi, beforeEach } from "vitest";

const { publish, clear, isNativePlatform } = vi.hoisted(() => ({
  publish: vi.fn(async () => ({ published: 0 })),
  clear: vi.fn(async () => undefined),
  isNativePlatform: vi.fn(() => true),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform },
  registerPlugin: () => ({ publish, clear }),
}));

import {
  publishShareTargets,
  clearShareTargets,
  __resetPublisherForTests,
} from "$lib/shared/share-intake/services/sharing-shortcuts-publisher";
import type { ShareTarget } from "$lib/shared/share-intake/domain/share-target-selection";

function target(id: string, name: string, avatarUrl: string | null = null): ShareTarget {
  return { id, name, avatarUrl };
}

/** A 1x1 png, enough for the fetch path to produce bytes. */
const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

beforeEach(() => {
  publish.mockClear();
  clear.mockClear();
  isNativePlatform.mockReturnValue(true);
  __resetPublisherForTests();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => PNG_BYTES.buffer.slice(0) as ArrayBuffer,
    }))
  );
});

describe("publishShareTargets", () => {
  it("publishes targets with base64 icons", async () => {
    await publishShareTargets([target("c1", "Paul", "https://cdn/paul.webp")]);

    expect(publish).toHaveBeenCalledTimes(1);
    const arg = publish.mock.calls[0]?.[0] as { targets: Array<Record<string, unknown>> };
    expect(arg.targets[0]).toMatchObject({ id: "c1", name: "Paul" });
    expect(arg.targets[0]?.iconBase64).toBeTruthy();
  });

  it("skips a republish when the target set is unchanged", async () => {
    const targets = [target("c1", "Paul")];

    await publishShareTargets(targets);
    await publishShareTargets(targets);

    // The conversation subscription fires on every message. Re-pushing an
    // identical set burns the system's shortcut rate limit for nothing.
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("republishes when a name changes", async () => {
    await publishShareTargets([target("c1", "Paul")]);
    await publishShareTargets([target("c1", "Paul C")]);

    expect(publish).toHaveBeenCalledTimes(2);
  });

  it("republishes when the order changes", async () => {
    await publishShareTargets([target("c1", "Paul"), target("c2", "Nina")]);
    await publishShareTargets([target("c2", "Nina"), target("c1", "Paul")]);

    // Order IS the ranking, so a reorder is a real change.
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it("still publishes the person when the avatar fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));

    await publishShareTargets([target("c1", "Paul", "https://cdn/paul.webp")]);

    const arg = publish.mock.calls[0]?.[0] as { targets: Array<Record<string, unknown>> };
    // A nameless gap in the sheet is worse than a generic icon. The icon falls
    // back to generated initials; jsdom has no canvas, so it is "" HERE only.
    // The canvas case is covered by the next test.
    expect(arg.targets[0]).toMatchObject({ id: "c1" });
  });

  it("still publishes the person when the avatar response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) })));

    await publishShareTargets([target("c1", "Paul", "https://cdn/paul.webp")]);

    const arg = publish.mock.calls[0]?.[0] as { targets: Array<Record<string, unknown>> };
    expect(arg.targets[0]).toMatchObject({ id: "c1" });
  });

  it("generates an initials icon when there is no avatar", async () => {
    // Verified on device 2026-07-30: Firestore participantInfo carries no avatar
    // for these conversations, so EVERY target published icon=null and the sheet
    // would show four identical app icons. jsdom has no canvas, so the drawing
    // path is unreachable without this stub - which is exactly why the two tests
    // above cannot be the only coverage.
    const fillText = vi.fn();
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag !== "canvas") return realCreate(tag);
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          fillStyle: "",
          font: "",
          textAlign: "",
          textBaseline: "",
          fillRect: vi.fn(),
          fillText,
        }),
        toDataURL: () => "data:image/png;base64,SU5JVElBTFM=",
      } as unknown as HTMLElement;
    });

    await publishShareTargets([target("c1", "Paul Bunyan", null)]);

    const arg = publish.mock.calls[0]?.[0] as { targets: Array<Record<string, unknown>> };
    expect(arg.targets[0]?.iconBase64).toBe("SU5JVElBTFM=");
    // Two initials from first and last word, not the whole name.
    expect(fillText).toHaveBeenCalledWith("PB", expect.any(Number), expect.any(Number));

    vi.mocked(document.createElement).mockRestore();
  });

  it("does nothing off native", async () => {
    isNativePlatform.mockReturnValue(false);

    await publishShareTargets([target("c1", "Paul")]);

    expect(publish).not.toHaveBeenCalled();
  });

  it("never throws when the plugin rejects", async () => {
    publish.mockRejectedValueOnce(new Error("rate limited"));

    // This runs inside a Svelte $effect over the inbox subscription. Throwing
    // would take the subscription down with it.
    await expect(publishShareTargets([target("c1", "Paul")])).resolves.toBeUndefined();
  });
});

describe("clearShareTargets", () => {
  it("clears and forgets the last published set", async () => {
    await publishShareTargets([target("c1", "Paul")]);
    await clearShareTargets();
    await publishShareTargets([target("c1", "Paul")]);

    expect(clear).toHaveBeenCalledTimes(1);
    // Sign-out then sign-in as the same user must republish, not dedup away.
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it("never throws when the plugin rejects", async () => {
    clear.mockRejectedValueOnce(new Error("boom"));

    await expect(clearShareTargets()).resolves.toBeUndefined();
  });
});

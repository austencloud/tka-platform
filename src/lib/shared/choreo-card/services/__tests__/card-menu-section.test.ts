import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

// The columns submenu reads the image-composition singleton; fake it so the
// test never touches $state/localStorage.
const getColumnCountForStepCount = vi.fn<(n: number) => number | null>(() => null);
const setColumnCountForStepCount = vi.fn();
vi.mock("$lib/shared/share/state/image-composition-state.svelte", () => ({
  getImageCompositionManager: () => ({
    getColumnCountForStepCount,
    setColumnCountForStepCount,
  }),
}));

import { buildCardMenuSection } from "../card-menu-section";

const SEQ = { name: "TEST", word: "TEST", steps: [] } as unknown as SequenceData;

const ids = (entries: ReturnType<typeof buildCardMenuSection>) =>
  entries.map((e) => ("id" in e ? e.id : e.type));

beforeEach(() => {
  getColumnCountForStepCount.mockClear();
  setColumnCountForStepCount.mockClear();
});

describe("buildCardMenuSection", () => {
  it("returns [] with no deps", () => {
    expect(buildCardMenuSection({})).toEqual([]);
  });

  it("entries appear only for wired deps, in canonical order", () => {
    const entries = buildCardMenuSection({
      onRerender: () => {},
      onSendTo: () => {},
      onSendToStickerLab: () => {},
    });
    expect(ids(entries)).toEqual(["rerender", "send-to", "send-to-sticker-lab"]);
  });

  it("columns submenu appears for stepCount >= 4 with Auto + even choices", () => {
    const entries = buildCardMenuSection({ stepCount: 8, onRerender: () => {} });
    expect(ids(entries)).toEqual(["columns-submenu", "rerender"]);
    const submenu = entries[0]!;
    if (!("children" in submenu) || !submenu.children) throw new Error("no children");
    expect(submenu.children.map((c) => c.id)).toEqual([
      "cols-auto",
      "cols-2",
      "cols-4",
      "cols-6",
      "cols-8",
    ]);
  });

  it("no columns submenu below 4 steps", () => {
    expect(ids(buildCardMenuSection({ stepCount: 3, onRerender: () => {} }))).toEqual([
      "rerender",
    ]);
  });

  it("admin image actions require BOTH isAdmin and a sequence", () => {
    expect(buildCardMenuSection({ isAdmin: true })).toEqual([]);
    expect(buildCardMenuSection({ sequenceForImageActions: SEQ })).toEqual([]);

    const entries = buildCardMenuSection({
      isAdmin: true,
      sequenceForImageActions: SEQ,
      onRerender: () => {},
    });
    expect(ids(entries)).toEqual([
      "rerender",
      "separator",
      "copy-sequence-data",
      "save-image",
      "copy-image",
      "copy-for-claude",
    ]);
  });

  it("admin-only menu has no leading separator", () => {
    const entries = buildCardMenuSection({
      isAdmin: true,
      sequenceForImageActions: SEQ,
    });
    expect(ids(entries)).toEqual([
      "copy-sequence-data",
      "save-image",
      "copy-image",
      "copy-for-claude",
    ]);
  });

  it("copy-sequence-data is admin-gated like the image actions", () => {
    // Non-admin never sees it, even with a sequence.
    expect(ids(buildCardMenuSection({ sequenceForImageActions: SEQ }))).not.toContain(
      "copy-sequence-data",
    );
    // Admin + sequence surfaces it first in the admin block.
    expect(
      ids(buildCardMenuSection({ isAdmin: true, sequenceForImageActions: SEQ }))[0],
    ).toBe("copy-sequence-data");
  });

  it("column choice action writes through the composition manager", () => {
    const onColumnCountChange = vi.fn();
    const entries = buildCardMenuSection({ stepCount: 4, onColumnCountChange });
    const submenu = entries[0]!;
    if (!("children" in submenu) || !submenu.children) throw new Error("no children");
    const cols2 = submenu.children.find((c) => c.id === "cols-2")!;
    cols2.action!();
    expect(setColumnCountForStepCount).toHaveBeenCalledWith(4, 2);
    expect(onColumnCountChange).toHaveBeenCalled();
  });
});

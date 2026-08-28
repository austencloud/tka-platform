import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import type { CollectedTunnel } from "$lib/features/tunnel-collection/domain/tunnel-collection-types";
import { DEFAULT_CONFIG } from "$lib/shared/sequence-viewer/tunnel/tunnel-config";
import TunnelLibraryPicker from "./TunnelLibraryPicker.svelte";

function tunnel(
  id: string,
  name: string,
  savedAt: number,
  performers = 1
): CollectedTunnel {
  return {
    id,
    name,
    steps: [],
    poster: "data:image/webp;base64,AA",
    createdAt: savedAt - 10,
    currentRevisionCreatedAt: savedAt,
    posterRenderVersion: 1,
    composition: {
      version: 1,
      id,
      name,
      performers: Array.from({ length: performers }, (_, index) => ({
        id: `${id}-performer-${index}`,
        label: `Performer ${index + 1}`,
        source: {
          kind: "independent" as const,
          sequence: {
            id: `${id}-sequence-${index}`,
            name: "A",
            word: "A",
            steps: [],
          },
        },
        timing: { stepOffset: 0, speed: 1 },
      })),
      formation: { ...DEFAULT_CONFIG, fold: 4 },
      createdAt: savedAt - 10,
      updatedAt: savedAt,
    },
    snapshot: {
      version: 2,
      tunnel: {
        config: { ...DEFAULT_CONFIG, fold: 4 },
        gridVisible: false,
        spectrum: false,
        section: "tunnel",
        presetRecipe: null,
      },
      effects: { activeEffect: "none" },
      effort: "continuous",
      paths: {
        pathShape: "arc",
        motionAwarePaths: false,
        bluePathLines: true,
        redPathLines: true,
      },
      playback: { bpm: 60, playbackMode: "continuous" },
      props: { bluePropType: "staff", redPropType: "staff" },
      trailRender: { mode: "off" },
    },
  } as unknown as CollectedTunnel;
}

describe("TunnelLibraryPicker", () => {
  it("shows recent tunnels first with truthful authored and rendered counts", () => {
    const older = tunnel("old", "Older weave", 100, 1);
    const newer = tunnel("new", "Newest orbit", 200, 3);
    render(TunnelLibraryPicker, {
      items: [older, newer],
      activeTunnelId: "new",
      onSelect: vi.fn(),
      onNew: vi.fn(),
      onManage: vi.fn(),
      onClose: vi.fn(),
    });

    const cards = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".tunnel-card")
    );
    expect(cards[0]?.getAttribute("aria-label")).toMatch(
      /Currently editing Newest orbit; 3 authored performers, 4 rendered instances/i
    );
    expect(cards[1]?.getAttribute("aria-label")).toMatch(
      /Edit Older weave; 1 authored performers, 4 rendered instances/i
    );
  });

  it("filters locally and returns the selected complete artifact", async () => {
    const orbit = tunnel("orbit", "Orbit study", 200);
    const weave = tunnel("weave", "Weave study", 100);
    const onSelect = vi.fn();
    render(TunnelLibraryPicker, {
      items: [orbit, weave],
      onSelect,
      onNew: vi.fn(),
      onManage: vi.fn(),
      onClose: vi.fn(),
    });

    await page.getByPlaceholder("Search tunnels").fill("weave");

    await expect
      .element(page.getByRole("button", { name: /Edit Orbit study/i }))
      .not.toBeInTheDocument();
    await page.getByRole("button", { name: /Edit Weave study/i }).click();
    expect(onSelect).toHaveBeenCalledWith(weave);
  });

  it("routes new and Browse management through explicit buttons", async () => {
    const onNew = vi.fn();
    const onManage = vi.fn();
    render(TunnelLibraryPicker, {
      items: [],
      onSelect: vi.fn(),
      onNew,
      onManage,
      onClose: vi.fn(),
    });

    await page.getByRole("button", { name: "Start a new tunnel" }).click();
    await page
      .getByRole("button", { name: "Manage tunnels in Browse" })
      .click();
    expect(onNew).toHaveBeenCalledOnce();
    expect(onManage).toHaveBeenCalledOnce();
  });
});

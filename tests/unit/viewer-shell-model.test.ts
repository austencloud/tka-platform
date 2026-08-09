import { describe, expect, it } from "vitest";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  buildCardExportAnalyticsConfig,
  buildPracticeConfigProperties,
  buildVideoExportAnalyticsConfig,
  buildViewerShareActions,
  resolveExportSidebarMinWidth,
} from "$lib/shared/sequence-viewer/services/viewer-shell-model";

describe("viewer shell model", () => {
  it("uses only valid persisted rail widths in the export threshold", () => {
    expect(resolveExportSidebarMinWidth(null)).toBe(1340);
    expect(resolveExportSidebarMinWidth("72")).toBe(1232);
    expect(resolveExportSidebarMinWidth("300")).toBe(1460);
    expect(resolveExportSidebarMinWidth("71")).toBe(1340);
    expect(resolveExportSidebarMinWidth("301")).toBe(1340);
    expect(resolveExportSidebarMinWidth("wide")).toBe(1340);
  });

  it("keeps copied-link feedback in the open share menu", () => {
    const idle = buildViewerShareActions(false);
    const copied = buildViewerShareActions(true);

    expect(idle.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "share-sequence", label: "Share Sequence…" },
      { id: "send-sequence", label: "Send in TKA" },
      { id: "copy-link", label: "Copy Link" },
    ]);
    expect(copied[2]).toMatchObject({
      label: "Copied",
      icon: "fa-check",
      tone: "success",
      closeOnSelect: false,
    });
  });

  it("preserves video and card export attribution fields", () => {
    expect(
      buildVideoExportAnalyticsConfig({
        fps: 60,
        loopCount: 3,
        resolution: 2160,
        includeStartPosition: true,
        includeEndHold: false,
        renderMode: "3d",
        playbackMode: "continuous",
        bluePropType: PropType.STAFF,
        redPropType: PropType.FAN,
      })
    ).toEqual({
      fps: 60,
      loop_count: 3,
      resolution: "2160",
      include_start_position: true,
      include_end_hold: false,
      render_mode: "3d",
      playback_mode: "continuous",
      blue_prop: "staff",
      red_prop: "fan",
      mixed_props: true,
    });

    expect(
      buildCardExportAnalyticsConfig({
        stepCount: 16,
        darkMode: true,
        includeStartPosition: false,
        handPath: true,
        bluePropType: PropType.STAFF,
        redPropType: PropType.STAFF,
      })
    ).toEqual({
      step_count: 16,
      dark_mode: true,
      include_start_position: false,
      hand_path: true,
      blue_prop: "staff",
      red_prop: "staff",
      mixed_props: false,
    });
  });

  it("keeps missing practice settings explicit in analytics", () => {
    expect(
      buildPracticeConfigProperties({ startBpm: 80, increment: 5 })
    ).toEqual({
      start_bpm: 80,
      max_bpm: null,
      increment: 5,
      rounds_per_level: null,
      target_enabled: null,
      target_bpm: null,
    });
  });
});

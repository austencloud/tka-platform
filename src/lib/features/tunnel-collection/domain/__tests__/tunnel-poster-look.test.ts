import { describe, expect, it } from "vitest";
import { SNAPSHOT_VERSION } from "$lib/shared/sequence-viewer/tunnel/tunnel-snapshot";
import { DEFAULT_CONFIG } from "$lib/shared/sequence-viewer/tunnel/tunnel-config";
import {
  DEFAULT_TRAIL_SETTINGS,
  TAIL_LENGTH_MAX,
  TrailEffect,
  TrailMode,
} from "$lib/shared/animation-engine/domain/types/trail-types";
import type { CollectedTunnel } from "../tunnel-collection-types";
import {
  POSTER_NO_DECAY_FADE_MS,
  posterTrailSettings,
  tunnelForPoster,
} from "../tunnel-poster-look";

function tunnel(): CollectedTunnel {
  return {
    id: "tunnel-1",
    name: "BBBA Duo",
    steps: [],
    poster: "data:image/webp;base64,stored",
    createdAt: 1,
    snapshot: {
      version: SNAPSHOT_VERSION,
      tunnel: {
        config: { ...DEFAULT_CONFIG },
        gridVisible: true,
        spectrum: true,
        section: "tunnel",
      },
      effects: { tipEffectMap: { "*": { effect: "fire" } } },
      effort: "medium",
      paths: {
        pathShape: "arc",
        motionAwarePaths: false,
        bluePathLines: false,
        redPathLines: false,
      },
      playback: { bpm: 60, playbackMode: "continuous" },
      props: { bluePropType: "staff", redPropType: "staff" },
      trailRender: {
        ...DEFAULT_TRAIL_SETTINGS,
        lineWidth: 7,
        blueColor: "#1e90ff",
        redColor: "#ff2d55",
        glowBlur: 18,
        effect: TrailEffect.GLOW,
        hideProps: false,
        previewMode: true,
      },
    },
  } as CollectedTunnel;
}

describe("posterTrailSettings", () => {
  it("draws the whole figure instead of a moving window", () => {
    const poster = posterTrailSettings(tunnel().snapshot.trailRender);
    expect(poster.mode).toBe(TrailMode.PERSISTENT);
    expect(poster.tailLength).toBe(TAIL_LENGTH_MAX);
    expect(poster.usePathCache).toBe(true);
  });

  it("stops the overlay decaying, which is what made two publishes differ", () => {
    const poster = posterTrailSettings(tunnel().snapshot.trailRender);
    // Zero would mean "fade instantly" to decayRateFor, not "never fade".
    expect(poster.fadeDurationMs).toBe(POSTER_NO_DECAY_FADE_MS);
    expect(poster.fadeDurationMs).toBeGreaterThan(0);
  });

  it("clears the instrument out of the portrait", () => {
    const poster = posterTrailSettings(tunnel().snapshot.trailRender);
    expect(poster.hideProps).toBe(true);
    expect(poster.previewMode).toBe(false);
  });

  it("keeps everything that is the tunnel's identity", () => {
    const source = tunnel().snapshot.trailRender;
    const poster = posterTrailSettings(source);
    expect(poster.lineWidth).toBe(source.lineWidth);
    expect(poster.blueColor).toBe(source.blueColor);
    expect(poster.redColor).toBe(source.redColor);
    expect(poster.glowBlur).toBe(source.glowBlur);
    expect(poster.effect).toBe(source.effect);
  });
});

describe("tunnelForPoster", () => {
  it("hides the grid a tunnel was built against", () => {
    expect(tunnelForPoster(tunnel()).snapshot.tunnel.gridVisible).toBe(false);
  });

  it("leaves the saved record untouched", () => {
    const original = tunnel();
    const forPoster = tunnelForPoster(original);
    expect(original.snapshot.tunnel.gridVisible).toBe(true);
    expect(original.snapshot.trailRender.hideProps).toBe(false);
    expect(original.snapshot.trailRender.mode).not.toBe(TrailMode.PERSISTENT);
    expect(forPoster).not.toBe(original);
    expect(forPoster.snapshot).not.toBe(original.snapshot);
  });

  it("carries the config, cast and effects through unchanged", () => {
    const original = tunnel();
    const forPoster = tunnelForPoster(original);
    expect(forPoster.id).toBe(original.id);
    expect(forPoster.name).toBe(original.name);
    expect(forPoster.snapshot.tunnel.config).toEqual(
      original.snapshot.tunnel.config
    );
    expect(forPoster.snapshot.tunnel.spectrum).toBe(true);
    expect(forPoster.snapshot.effects).toEqual(original.snapshot.effects);
    expect(forPoster.snapshot.props).toEqual(original.snapshot.props);
    expect(forPoster.snapshot.playback).toEqual(original.snapshot.playback);
  });
});

import { describe, expect, it } from "vitest";
import { describeTunnel, deriveTunnelName } from "../tunnel-name";
import { DEFAULT_CONFIG, type TunnelConfig } from "../tunnel-config";
import type { TunnelPerformer } from "../tunnel-composition";
import type { TunnelSnapshot } from "../tunnel-snapshot";

function performer(
  word: string,
  overrides: Partial<TunnelPerformer> = {},
): TunnelPerformer {
  return {
    id: `performer-${word}`,
    label: word,
    source: {
      kind: "independent",
      sequence: { id: word, name: word, word, steps: [] } as never,
    },
    timing: { stepOffset: 0, speed: 1 },
    ...overrides,
  };
}

function snapshot(overrides: Partial<TunnelSnapshot> = {}): TunnelSnapshot {
  return {
    version: 1,
    tunnel: {
      config: { ...DEFAULT_CONFIG },
      gridVisible: false,
      spectrum: false,
      section: "tunnel",
    },
    effects: { tipEffectMap: {} },
    effort: "medium",
    paths: {
      pathShape: "arc",
      motionAwarePaths: false,
      bluePathLines: false,
      redPathLines: false,
    },
    playback: { bpm: 120, playbackMode: "continuous" },
    props: { bluePropType: "staff", redPropType: "staff" },
    trailRender: {},
    ...overrides,
  } as TunnelSnapshot;
}

function configWith(overrides: Partial<TunnelConfig>): TunnelConfig {
  return { ...DEFAULT_CONFIG, speedOverrides: {}, ...overrides };
}

describe("deriveTunnelName", () => {
  it("names a plain tunnel by its word and formation", () => {
    expect(deriveTunnelName({ baseWord: "BBBA", snapshot: snapshot() })).toBe(
      "BBBA Duo",
    );
  });

  it("collapses a repeated word to its seed", () => {
    expect(
      deriveTunnelName({ baseWord: "FΨFΨFΨFΨ", snapshot: snapshot() }),
    ).toBe("FΨ Duo");
  });

  it("sets each independent word against the others", () => {
    const name = deriveTunnelName({
      composition: { performers: [performer("BBBA"), performer("ΩORZ")] },
      snapshot: snapshot(),
    });
    expect(name).toBe("BBBA × ΩORZ Duo");
  });

  it("does not repeat a derived performer's borrowed word", () => {
    const derived = performer("BBBA", {
      id: "performer-mirror",
      source: {
        kind: "derived",
        performerId: "performer-BBBA",
        transforms: [{ kind: "mirror" }],
      },
    });
    const name = deriveTunnelName({
      composition: { performers: [performer("BBBA"), derived] },
      snapshot: snapshot(),
    });
    expect(name).toBe("BBBA Duo");
  });

  it("describes a custom formation by its arms and one flag", () => {
    const name = deriveTunnelName({
      baseWord: "BBBA",
      snapshot: snapshot({
        tunnel: {
          config: configWith({ fold: 8, staggerSteps: 2 }),
          gridVisible: false,
          spectrum: false,
          section: "tunnel",
        },
      }),
    });
    expect(name).toBe("BBBA 8-arm staggered");
  });

  it("names a non-default prop and omits the default staff", () => {
    const withFans = deriveTunnelName({
      baseWord: "BBBA",
      snapshot: snapshot({
        props: { bluePropType: "fan", redPropType: "fan" },
      }),
    });
    expect(withFans).toBe("BBBA Duo on fans");
    expect(deriveTunnelName({ baseWord: "BBBA", snapshot: snapshot() })).toBe(
      "BBBA Duo",
    );
  });

  it("distinguishes one shared effect from several", () => {
    const one = deriveTunnelName({
      baseWord: "BBBA",
      snapshot: snapshot({ effects: { tipEffectMap: { "*": { effect: "fire" } } } } as never),
    });
    expect(one).toBe("BBBA Duo in fire");

    const many = deriveTunnelName({
      baseWord: "BBBA",
      snapshot: snapshot({
        effects: {
          tipEffectMap: { "0": { effect: "fire" }, "1": { effect: "goo" } },
        },
      } as never),
    });
    expect(many).toBe("BBBA Duo in mixed effects");
  });

  it("flags arms running at different rates", () => {
    const name = deriveTunnelName({
      baseWord: "BBBA",
      snapshot: snapshot({
        tunnel: {
          config: configWith({ speedOverrides: { 1: 2 } }),
          gridVisible: false,
          spectrum: false,
          section: "tunnel",
        },
      }),
    });
    expect(name).toBe("BBBA Duo multi-speed");
  });

  it("keeps at most two qualifiers so the name stays a name", () => {
    const name = deriveTunnelName({
      baseWord: "BBBA",
      snapshot: snapshot({
        tunnel: {
          config: configWith({ speedOverrides: { 1: 2 } }),
          gridVisible: false,
          spectrum: false,
          section: "tunnel",
        },
        props: { bluePropType: "fan", redPropType: "fan" },
        effects: { tipEffectMap: { "*": { effect: "fire" } } },
      } as never),
    });
    expect(name).toBe("BBBA Duo on fans in fire");
  });

  it("summarizes a cast wider than three words", () => {
    const name = deriveTunnelName({
      composition: {
        performers: [
          performer("ABC"),
          performer("DEF"),
          performer("GHI"),
          performer("JKL"),
          performer("MNO"),
        ],
      },
      snapshot: snapshot(),
    });
    expect(name).toBe("ABC × DEF × GHI +2 Duo");
  });

  it("returns empty when there is nothing to say, so callers can fall back", () => {
    expect(deriveTunnelName({})).toBe("");
  });

  it("names a formation the creator supplies before any viewer state exists", () => {
    const name = deriveTunnelName({
      composition: { performers: [performer("BBBA")] },
      formation: configWith({ fold: 4, mirror: true }),
    });
    expect(name).toBe("BBBA Mandala");
  });
});

describe("describeTunnel", () => {
  it("reports facets separately from the assembled name", () => {
    const description = describeTunnel({
      composition: { performers: [performer("BBBA"), performer("ΩORZ")] },
      snapshot: snapshot({
        props: { bluePropType: "fan", redPropType: "club" },
      }),
    });
    expect(description.words).toEqual(["BBBA", "ΩORZ"]);
    expect(description.castSize).toBe(2);
    expect(description.formation).toBe("Duo");
    expect(description.formationIsPreset).toBe(true);
    expect(description.props).toBe("mixed props");
    expect(description.effects).toBeNull();
    expect(description.multiSpeed).toBe(false);
  });
});

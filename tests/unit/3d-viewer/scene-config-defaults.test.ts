import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createDefaultAutumnConfig,
  createDefaultBlossomConfig,
  createDefaultCelestialConfig,
  createDefaultCosmicAuroraConfig,
  createDefaultCosmicNightConfig,
  createDefaultEmberConfig,
  createDefaultForestAutumnConfig,
  createDefaultForestFireflyConfig,
  createDefaultOceanAbyssConfig,
  createDefaultOceanCinematicConfig,
  createDefaultOceanMysticalConfig,
  createDefaultOceanReefConfig,
  createDefaultRainbowConfig,
  createDefaultVoidConfig,
  createDefaultWinterConfig,
} from "$lib/shared/3d/environments/domain/models/scene-configs";

const factories = {
  createDefaultAutumnConfig,
  createDefaultBlossomConfig,
  createDefaultCelestialConfig,
  createDefaultCosmicAuroraConfig,
  createDefaultCosmicNightConfig,
  createDefaultEmberConfig,
  createDefaultForestAutumnConfig,
  createDefaultForestFireflyConfig,
  createDefaultOceanAbyssConfig,
  createDefaultOceanCinematicConfig,
  createDefaultOceanMysticalConfig,
  createDefaultOceanReefConfig,
  createDefaultRainbowConfig,
  createDefaultVoidConfig,
  createDefaultWinterConfig,
};

const expectedHashes: Record<keyof typeof factories, string> = {
  createDefaultAutumnConfig:
    "b88ab85d316bced0090b141fc2510505fa2e3e4bf1c177cf49b4c49c2b7fd955",
  // Re-baselined 2026-08-23 by 7f67e5c785 (feat(blossom): preserve the
  // site-system review build) — the approved sky/fog/petal/moonlight retune.
  createDefaultBlossomConfig:
    "274413fe4beee2e13a89a5192a082329156353912f5291376ea87fd9b73d570a",
  createDefaultCelestialConfig:
    "e9a9024f696ca5d692eececc3625d01914e5e99690b91356ebd7aa04f10fe164",
  createDefaultCosmicAuroraConfig:
    "0bd38acd71a42d1944bcdf0d61b9998b5bbed1800bc4f5cc0fe7e30a6d5763b4",
  createDefaultCosmicNightConfig:
    "36a5c5c124f80ad24e50ac7e5926ac5ca37df95f18c16dd30ae0278aed72f50c",
  // Re-baselined 2026-08-30 by the four-lane field-audit fix queue (river
  // drape/source/terminus, plume rebuild, upcountry detail reach, sky depth).
  createDefaultEmberConfig:
    "500b780cada771ca043948f7772a0b8684fc3df7d6f6c48bad5d9cfe2fd89ac3",
  createDefaultForestAutumnConfig:
    "5429d3c565a020b03582d6fe83b48e2a430f160e7f533363d4d6ebe689f70a8e",
  createDefaultForestFireflyConfig:
    "cf1c3bb1de132b2d8cc79c70271a1affa94ce3e3ae62dcec739342ea035a329d",
  createDefaultOceanAbyssConfig:
    "eae14dd630091ff87a777a0b7bd540c2af79b37b84e340bedc4487eec4f38981",
  createDefaultOceanCinematicConfig:
    "eae14dd630091ff87a777a0b7bd540c2af79b37b84e340bedc4487eec4f38981",
  createDefaultOceanMysticalConfig:
    "eae14dd630091ff87a777a0b7bd540c2af79b37b84e340bedc4487eec4f38981",
  createDefaultOceanReefConfig:
    "eae14dd630091ff87a777a0b7bd540c2af79b37b84e340bedc4487eec4f38981",
  createDefaultRainbowConfig:
    "3ea39eb50e9d9e320800490827c555d0dd65a73cb9e4cc1326e1ec498ee99fca",
  createDefaultVoidConfig:
    "b10ed0531f8504ea86366957b22e713b80aeb1b03a6b4f33fd485e395d6b42b2",
  createDefaultWinterConfig:
    "0a2b40a57b19487b1d8d9d07f836a2eebf296da6e4935ce215e62be8013f5e83",
};

describe("scene configuration defaults", () => {
  for (const name of Object.keys(factories) as Array<keyof typeof factories>) {
    it(`preserves ${name}`, () => {
      const serialized = JSON.stringify(factories[name]());
      const hash = createHash("sha256").update(serialized).digest("hex");

      expect(hash).toBe(expectedHashes[name]);
    });
  }
});

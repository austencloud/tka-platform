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
  createDefaultBlossomConfig:
    "3383f8c98507979b92b92c71c2287a362090ae1b5e90f1e8f3eb64862b484fbb",
  createDefaultCelestialConfig:
    "3b647eadcdee0e2c121b60e1928c61f035091740c15c1a747110bf422651c647",
  createDefaultCosmicAuroraConfig:
    "0bd38acd71a42d1944bcdf0d61b9998b5bbed1800bc4f5cc0fe7e30a6d5763b4",
  createDefaultCosmicNightConfig:
    "36a5c5c124f80ad24e50ac7e5926ac5ca37df95f18c16dd30ae0278aed72f50c",
  createDefaultEmberConfig:
    "119e2009e26ef6b7c891534a94a2ee14026ece6ab23275c37e5272b84a669c14",
  createDefaultForestAutumnConfig:
    "f768146e340c8fda5ea41f573595ef40275ac8e507bb2c98cca77ca8a929b5bb",
  createDefaultForestFireflyConfig:
    "f14f73826c33c5401a767b7f67ff5312cce934ea64a20022fd0514a0d52b4737",
  createDefaultOceanAbyssConfig:
    "dd6e6f77065d6ffc6b3957e39d256e09e7f72fdabb6130cf9a8b82e5b259bd84",
  createDefaultOceanCinematicConfig:
    "dd6e6f77065d6ffc6b3957e39d256e09e7f72fdabb6130cf9a8b82e5b259bd84",
  createDefaultOceanMysticalConfig:
    "dd6e6f77065d6ffc6b3957e39d256e09e7f72fdabb6130cf9a8b82e5b259bd84",
  createDefaultOceanReefConfig:
    "dd6e6f77065d6ffc6b3957e39d256e09e7f72fdabb6130cf9a8b82e5b259bd84",
  createDefaultRainbowConfig:
    "3ea39eb50e9d9e320800490827c555d0dd65a73cb9e4cc1326e1ec498ee99fca",
  createDefaultVoidConfig:
    "b10ed0531f8504ea86366957b22e713b80aeb1b03a6b4f33fd485e395d6b42b2",
  createDefaultWinterConfig:
    "e6ef9afe683a89872c02660b45f6b7d4a96e2d94b591a6d4f01954624f8408ac",
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

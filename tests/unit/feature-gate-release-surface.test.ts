import { afterEach, describe, expect, it, vi } from "vitest";

async function loadProductionFeatureFlags(
  covenOverride = "",
  buildAllOverride = ""
) {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("BUILD_COVEN", covenOverride);
  vi.stubEnv("BUILD_ALL", buildAllOverride);
  vi.resetModules();
  return import("../../src/config/feature-flags");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("production release feature gate", () => {
  it("fails Coven closed without stubbing its museum-shared components", async () => {
    const flags = await loadProductionFeatureFlags();
    const coven = flags.FEATURES.find((feature) => feature.id === "coven");

    expect(coven).toMatchObject({
      tier: "dev",
      modulePaths: [],
      routePatterns: ["src/routes/coven/"],
      emptyClientRouteComponents: true,
    });
    expect(flags.getEnabledFeaturesDefineMap().__FEATURE_COVEN__).toBe("false");
    expect(flags.getClientEmptiedRoutePaths()).toEqual([
      "src/routes/coven/",
      "src/routes/test/",
    ]);
    expect(flags.getDisabledFeatureModulePaths()).not.toContain(
      "features/coven-hub/"
    );
  });

  it("keeps Coven available only through its explicit build override", async () => {
    const flags = await loadProductionFeatureFlags("true");

    expect(flags.getEnabledFeaturesDefineMap().__FEATURE_COVEN__).toBe("true");
    expect(flags.getClientEmptiedRoutePaths()).toEqual(["src/routes/test/"]);
  });

  it("empties only the guarded route components in the client build", async () => {
    await loadProductionFeatureFlags();
    const { featureGatePlugin } =
      await import("../../src/config/vite-plugin-feature-gate");
    const plugin = featureGatePlugin();

    const configure = plugin.configResolved as (config: {
      command: string;
      build: { ssr: boolean };
    }) => void;
    configure({ command: "build", build: { ssr: false } });

    const load = plugin.load as (id: string) => string | null;
    expect(load("E:/tka-platform/src/routes/coven/+page.svelte")).toBe("");
    expect(load("E:/tka-platform/src/routes/test/foo/+page.svelte")).toBe("");
    expect(
      load(
        "E:/tka-platform/src/lib/features/coven-hub/components/CovenStation.svelte"
      )
    ).toBeNull();
    expect(
      load("E:/tka-platform/src/routes/browse/gallery/+page.svelte")
    ).toBeNull();
  });
});

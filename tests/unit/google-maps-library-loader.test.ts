import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mapsApi = vi.hoisted(() => ({
  importLibrary: vi.fn(),
  setOptions: vi.fn(),
}));

vi.mock("@googlemaps/js-api-loader", () => mapsApi);

import { GoogleMapsLibraryLoader } from "$lib/shared/maps/services/implementations/GoogleMapsLibraryLoader";

beforeEach(() => {
  vi.clearAllMocks();
  mapsApi.importLibrary.mockResolvedValue({});
  Reflect.deleteProperty(globalThis, "google");
});

describe("GoogleMapsLibraryLoader", () => {
  it("configures once and shares one in-flight library request", async () => {
    const loader = new GoogleMapsLibraryLoader();

    const first = loader.load("maps-key");
    const second = loader.load("maps-key");

    expect(first).toBe(second);
    await first;
    expect(mapsApi.setOptions).toHaveBeenCalledOnce();
    expect(mapsApi.setOptions).toHaveBeenCalledWith({
      key: "maps-key",
      v: "weekly",
    });
    expect(mapsApi.importLibrary.mock.calls).toEqual([["maps"], ["marker"]]);
  });

  it("turns non-Error rejections into an Error and permits a retry", async () => {
    mapsApi.importLibrary
      .mockRejectedValueOnce(undefined)
      .mockResolvedValue({});
    const loader = new GoogleMapsLibraryLoader();

    await expect(loader.load("maps-key")).rejects.toThrow(
      "Google Maps libraries could not load."
    );
    await expect(loader.load("maps-key")).resolves.toBeUndefined();

    expect(mapsApi.setOptions).toHaveBeenCalledOnce();
    expect(mapsApi.importLibrary).toHaveBeenCalledTimes(4);
  });

  it("rejects missing or conflicting API keys", async () => {
    const loader = new GoogleMapsLibraryLoader();

    await expect(loader.load(" ")).rejects.toThrow(
      "Google Maps API key is missing."
    );
    await loader.load("first-key");
    await expect(loader.load("second-key")).rejects.toThrow(
      "Google Maps is already configured with a different API key."
    );
  });

  it("reuses a Maps import function preserved across HMR", async () => {
    Object.defineProperty(globalThis, "google", {
      configurable: true,
      value: { maps: { importLibrary: vi.fn() } },
    });
    const loader = new GoogleMapsLibraryLoader();

    await loader.load("maps-key");

    expect(mapsApi.setOptions).not.toHaveBeenCalled();
    expect(mapsApi.importLibrary.mock.calls).toEqual([["maps"], ["marker"]]);
  });
});

describe("map component loading contract", () => {
  it("routes both map components through the shared loader", () => {
    const files = [
      "src/lib/features/community/components/GlobalUserMap.svelte",
      "src/lib/features/festivals/components/map/FestivalMap.svelte",
    ];

    for (const file of files) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source).toContain("getGoogleMapsLibraryLoader");
      expect(source).not.toContain("maps.googleapis.com/maps/api/js");
      expect(source).not.toContain("loadGoogleMapsScript");
      expect(source).not.toContain("onMount(async");
      expect(source).not.toContain("async function createMarkers");
    }
  });
});

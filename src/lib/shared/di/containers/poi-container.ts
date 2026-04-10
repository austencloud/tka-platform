import { createContainer } from "iti";
import { ImagePatternLoader } from "$lib/features/poi/services/implementations/ImagePatternLoader";
import { StripPatternEngine } from "$lib/features/poi/services/implementations/StripPatternEngine";
import { OpenPixelPoiAdapter } from "$lib/features/poi/services/implementations/OpenPixelPoiAdapter";
import { PoiDeviceManager } from "$lib/features/poi/services/implementations/PoiDeviceManager";

/**
 * Poi (LED strip pattern engine + hardware adapters) DI container.
 * Self-contained — no external dependencies needed.
 */
export function createPoiContainer() {
  return createContainer()
    .add({
      imagePatternLoader: () => new ImagePatternLoader(),
      openPixelPoiAdapter: () => new OpenPixelPoiAdapter(),
    })
    .add(({ imagePatternLoader, openPixelPoiAdapter }) => ({
      stripPatternEngine: () => new StripPatternEngine(imagePatternLoader),
      poiDeviceManager: () => new PoiDeviceManager([openPixelPoiAdapter]),
    }));
}

export type PoiContainer = ReturnType<typeof createPoiContainer>;

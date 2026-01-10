// Background Gradient Constants
import type { BackgroundType } from "../../domain/enums/background-enums";

export const BACKGROUND_GRADIENTS: Record<BackgroundType, string> = {
  pride:
    "linear-gradient(180deg, #0a0a15 0%, #12121f 50%, #0d0d18 100%)",
  snowfall: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  nightSky: "linear-gradient(135deg, #0a0e2c 0%, #1a2040 50%, #2a3060 100%)",
  deepOcean: "linear-gradient(135deg, #001122 0%, #000c1e 50%, #000511 100%)",
  emberGlow:
    "linear-gradient(135deg, #1a0a0a 0%, #2d1410 30%, #4a1f1a 60%, #3d1814 100%)",
  sakuraDrift: // Cherry Blossom gradient
    "linear-gradient(135deg, #2a1f2e 0%, #3d2f42 30%, #4a3d52 60%, #362d40 100%)",
  fireflyForest:
    "linear-gradient(180deg, #0a0e18 0%, #0a1612 60%, #0c1a14 85%, #0a1810 100%)",
  autumnDrift:
    "linear-gradient(180deg, #1a1520 0%, #2d1f28 30%, #3d2a1f 60%, #2a1810 100%)",
  solidColor: "",
  linearGradient: "",
};

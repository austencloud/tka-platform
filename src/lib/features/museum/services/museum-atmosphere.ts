import { Color, FogExp2 } from "three";
import type { WingTheme } from "../domain/museum-grid-types";

const WING_FOG: Record<WingTheme, { density: number; color: string }> = {
  cave: { density: 0.06, color: "#1a1008" },
  classical: { density: 0.03, color: "#1a1510" },
  renaissance: { density: 0.03, color: "#14120e" },
  industrial: { density: 0.04, color: "#141414" },
  digital: { density: 0.04, color: "#0a0a14" },
  institutional: { density: 0.02, color: "#606068" },
  gallery: { density: 0.02, color: "#0e0a10" },
  modern: { density: 0.03, color: "#0a0a0a" },
  futuristic: { density: 0.03, color: "#0a0a10" },
  outdoor: { density: 0.008, color: "#2a2418" },
  construction: { density: 0.04, color: "#14120a" },
  retail: { density: 0.02, color: "#141210" },
};

const FOG_LERP_SPEED = 2.0;

export class MuseumAtmosphere {
  readonly fog = new FogExp2("#1a1008", 0.08);
  private colorTarget = new Color("#1a1008");
  private colorCurrent = new Color("#1a1008");
  private densityTarget = 0.08;
  private currentWingTheme: WingTheme | null = null;

  getCurrentWing(): WingTheme | null {
    return this.currentWingTheme;
  }

  update(
    theme: WingTheme | null,
    fpsActive: boolean,
    delta: number,
  ): boolean {
    let wingChanged = false;

    if (theme && theme !== this.currentWingTheme) {
      this.currentWingTheme = theme;
      const fogCfg = WING_FOG[theme];
      this.colorTarget.set(fogCfg.color);
      this.densityTarget = fogCfg.density;
      wingChanged = true;
    }

    if (fpsActive) {
      this.colorCurrent.lerp(this.colorTarget, FOG_LERP_SPEED * delta);
      this.fog.color.copy(this.colorCurrent);
      this.fog.density +=
        (this.densityTarget - this.fog.density) * FOG_LERP_SPEED * delta;
    } else {
      this.fog.density += (0 - this.fog.density) * FOG_LERP_SPEED * delta;
    }

    return wingChanged;
  }
}

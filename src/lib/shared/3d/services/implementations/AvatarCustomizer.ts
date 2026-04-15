/**
 * AvatarCustomizer
 *
 * Manages avatar appearance with proper anthropometric proportions.
 * Uses research-based ratios for realistic human body proportions.
 */

import { MeshStandardMaterial, Color } from "three";
import type { Material } from "three";
import type {
  IAvatarCustomizer,
  BodyType,
  SkinTonePreset,
  BodyProportions,
  AvatarCustomization,
  ProportionPreset,
} from "../contracts/IAvatarCustomizer";
import type { IScene3DPersister } from "../contracts/IScene3DPersister";

/**
 * Anthropometric ratios based on research
 * These are averages from human measurement studies
 */
const ANTHROPOMETRIC_RATIOS = {
  masculine: {
    headToHeight: 0.121, // Head is ~1/8.25 of height
    neckToHeight: 0.05,
    shoulderWidthToHeight: 0.24,
    torsoToHeight: 0.32,
    hipWidthToHeight: 0.17,
    upperArmToHeight: 0.175,
    forearmToHeight: 0.155,
    handToHeight: 0.105,
    inseamToHeight: 0.43,
    thighToHeight: 0.24,
    shinToHeight: 0.23,
  },
  feminine: {
    headToHeight: 0.125, // Slightly larger head ratio
    neckToHeight: 0.045,
    shoulderWidthToHeight: 0.21, // Narrower shoulders
    torsoToHeight: 0.31,
    hipWidthToHeight: 0.19, // Wider hips
    upperArmToHeight: 0.165,
    forearmToHeight: 0.145,
    handToHeight: 0.095,
    inseamToHeight: 0.44,
    thighToHeight: 0.25,
    shinToHeight: 0.23,
  },
  androgynous: {
    headToHeight: 0.123,
    neckToHeight: 0.048,
    shoulderWidthToHeight: 0.225,
    torsoToHeight: 0.315,
    hipWidthToHeight: 0.18,
    upperArmToHeight: 0.17,
    forearmToHeight: 0.15,
    handToHeight: 0.1,
    inseamToHeight: 0.435,
    thighToHeight: 0.245,
    shinToHeight: 0.23,
  },
};

const SKIN_TONE_PRESETS: SkinTonePreset[] = [
  { id: "fair", name: "Fair", color: "#ffe0bd" },
  { id: "light", name: "Light", color: "#e8beac" },
  { id: "medium-light", name: "Medium Light", color: "#d4a574" },
  { id: "medium", name: "Medium", color: "#c68642" },
  { id: "medium-dark", name: "Medium Dark", color: "#8d5524" },
  { id: "dark", name: "Dark", color: "#5c3317" },
];

const PROPORTION_PRESETS: ProportionPreset[] = [
  {
    id: "average-male",
    name: "Average Male",
    description: "5'10\" average build",
    proportions: deriveProportionsInternal(178, "masculine"),
  },
  {
    id: "average-female",
    name: "Average Female",
    description: "5'4\" average build",
    proportions: deriveProportionsInternal(163, "feminine"),
  },
  {
    id: "tall-male",
    name: "Tall Male",
    description: "6'3\" lanky build (Austen)",
    proportions: {
      height: 190.5,
      headHeight: 23,
      neckLength: 10,
      shoulderWidth: 44,
      torsoLength: 62,
      hipWidth: 32,
      upperArmLength: 34,
      forearmLength: 29,
      handLength: 20,
      inseam: 81.3,
      thighLength: 45,
      shinLength: 44,
    },
  },
  {
    id: "petite-female",
    name: "Petite Female",
    description: "5'0\" slim build",
    proportions: deriveProportionsInternal(152, "feminine"),
  },
];

function deriveProportionsInternal(
  heightCm: number,
  bodyType: BodyType
): BodyProportions {
  const ratios = ANTHROPOMETRIC_RATIOS[bodyType];

  return {
    height: heightCm,
    headHeight: heightCm * ratios.headToHeight,
    neckLength: heightCm * ratios.neckToHeight,
    shoulderWidth: heightCm * ratios.shoulderWidthToHeight,
    torsoLength: heightCm * ratios.torsoToHeight,
    hipWidth: heightCm * ratios.hipWidthToHeight,
    upperArmLength: heightCm * ratios.upperArmToHeight,
    forearmLength: heightCm * ratios.forearmToHeight,
    handLength: heightCm * ratios.handToHeight,
    inseam: heightCm * ratios.inseamToHeight,
    thighLength: heightCm * ratios.thighToHeight,
    shinLength: heightCm * ratios.shinToHeight,
  };
}

export class AvatarCustomizer implements IAvatarCustomizer {
  private state: AvatarCustomization;
  private skinMaterial: MeshStandardMaterial;
  private bodyMaterial: MeshStandardMaterial;
  private listeners: Set<(state: AvatarCustomization) => void> = new Set();

  constructor(private persistence: IScene3DPersister) {
    // Get Austen preset (index 2)
    const austenPreset = PROPORTION_PRESETS.find((p) => p.id === "tall-male");
    const defaultProportions =
      austenPreset?.proportions ?? deriveProportionsInternal(178, "masculine");

    // Initialize with defaults
    this.state = {
      bodyType: "masculine",
      skinTone: "#d4a574",
      proportions: defaultProportions,
      visible: true,
    };

    // Create materials
    this.skinMaterial = new MeshStandardMaterial({
      color: new Color(this.state.skinTone),
      roughness: 0.6,
      metalness: 0.1,
    });

    this.bodyMaterial = new MeshStandardMaterial({
      color: new Color("#4a5568"),
      roughness: 0.5,
      metalness: 0.0,
    });

    // Load persisted state
    this.load();
  }

  getState(): AvatarCustomization {
    return { ...this.state };
  }

  setBodyType(type: BodyType): void {
    this.state.bodyType = type;
    // Recalculate proportions based on current height
    this.state.proportions = this.deriveProportions(
      this.state.proportions.height,
      type
    );
    this.notifyListeners();
    this.save();
  }

  setSkinTone(color: string): void {
    this.state.skinTone = color;
    this.skinMaterial.color.set(color);
    this.skinMaterial.needsUpdate = true;
    this.notifyListeners();
    this.save();
  }

  setProportions(proportions: Partial<BodyProportions>): void {
    this.state.proportions = {
      ...this.state.proportions,
      ...proportions,
    };
    this.notifyListeners();
    this.save();
  }

  applyPreset(presetId: string): void {
    const preset = PROPORTION_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      this.state.proportions = { ...preset.proportions };
      this.notifyListeners();
      this.save();
    }
  }

  getPresets(): ProportionPreset[] {
    return PROPORTION_PRESETS;
  }

  getSkinTonePresets(): SkinTonePreset[] {
    return SKIN_TONE_PRESETS;
  }

  setVisible(visible: boolean): void {
    this.state.visible = visible;
    this.notifyListeners();
    this.save();
  }

  getSkinMaterial(): Material {
    return this.skinMaterial;
  }

  getBodyMaterial(): Material {
    return this.bodyMaterial;
  }

  deriveProportions(heightCm: number, bodyType: BodyType): BodyProportions {
    return deriveProportionsInternal(heightCm, bodyType);
  }

  onChange(callback: (state: AvatarCustomization) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  save(): void {
    const saved = this.persistence.loadState();
    // Only persist masculine/feminine (persistence doesn't support androgynous)
    const persistBodyType: "masculine" | "feminine" =
      this.state.bodyType === "androgynous" ? "masculine" : this.state.bodyType;

    this.persistence.saveState({
      ...saved,
      bodyType: persistBodyType,
      skinTone: this.state.skinTone,
      avatarProportions: this.state.proportions,
      showFigure: this.state.visible,
    });
  }

  load(): AvatarCustomization {
    const saved = this.persistence.loadState();

    if (saved.bodyType) {
      this.state.bodyType = saved.bodyType;
    }
    if (saved.skinTone) {
      this.state.skinTone = saved.skinTone;
      this.skinMaterial.color.set(saved.skinTone);
    }
    if (saved.avatarProportions) {
      this.state.proportions = saved.avatarProportions;
    }
    if (saved.showFigure !== undefined) {
      this.state.visible = saved.showFigure;
    }

    return this.getState();
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((cb) => cb(state));
  }
}

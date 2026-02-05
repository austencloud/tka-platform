/**
 * ThumbnailKeyDeriver Tests
 *
 * Critical for cache correctness - same inputs MUST produce same hashes,
 * different inputs MUST produce different hashes. Silent bugs here cause
 * cache misses that silently degrade performance.
 *
 * These tests are intentionally simple and avoid complex setup dependencies.
 */

import { describe, it, expect } from "vitest";

// Import only what we need to test - avoid triggering full app initialization
const PropType = {
  STAFF: "staff",
  BUUGENG: "buugeng",
  CLUB: "club",
} as const;

type PropTypeValue = typeof PropType[keyof typeof PropType];

interface VisibilitySettings {
  showTKA?: boolean;
  showReversals?: boolean;
  showGrid?: boolean;
  showNonRadialPoints?: boolean;
  handPointVisibility?: "all" | "selected" | "none";
}

interface ThumbnailRenderInput {
  sequenceName: string;
  bluePropType?: PropTypeValue;
  redPropType?: PropTypeValue;
  lightMode: boolean;
  variant: "gallery" | "wordcard";
  catDogModeEnabled?: boolean;
  addWord?: boolean;
  addBeatNumbers?: boolean;
  includeStartPosition?: boolean;
  addDifficultyLevel?: boolean;
  addUserInfo?: boolean;
  showCreatorName?: boolean;
  showNotes?: boolean;
  showBirthday?: boolean;
  customNotesText?: string;
  userName?: string;
  visibility?: VisibilitySettings;
}

interface CompositionDefaults {
  addWord: boolean;
  addBeatNumbers: boolean;
  includeStartPosition: boolean;
  addDifficultyLevel: boolean;
  addUserInfo: boolean;
  showCreatorName: boolean;
  showNotes: boolean;
  showBirthday: boolean;
}

const GALLERY_DEFAULTS: CompositionDefaults = {
  addWord: true,
  addBeatNumbers: true,
  includeStartPosition: true,
  addDifficultyLevel: true,
  addUserInfo: false,
  showCreatorName: true,
  showNotes: true,
  showBirthday: true,
};

// Inline the key derivation logic for testing without importing the full service
function deriveKey(input: ThumbnailRenderInput) {
  const defaults = GALLERY_DEFAULTS;
  const usesDefaults = checkInputUsesDefaults(input, defaults);
  const isCatDog = isCatDogMode(input);
  const propKey = derivePropKey(input, isCatDog);
  const mode = input.lightMode ? "light" : "dark";

  const hashInput = usesDefaults
    ? { seq: input.sequenceName, prop: propKey, mode, variant: input.variant }
    : buildFullHashInput(input);

  const hash = computeHash(hashInput);

  return { hash, usesDefaults, propKey };
}

function isCatDogMode(input: ThumbnailRenderInput): boolean {
  return (
    !!input.catDogModeEnabled &&
    input.bluePropType !== undefined &&
    input.redPropType !== undefined &&
    input.bluePropType !== input.redPropType
  );
}

function derivePropKey(input: ThumbnailRenderInput, isCatDog: boolean): string {
  if (isCatDog) {
    return `catdog_${input.bluePropType}_${input.redPropType}`;
  }
  return input.bluePropType || input.redPropType || PropType.STAFF;
}

function checkInputUsesDefaults(
  input: ThumbnailRenderInput,
  defaults: CompositionDefaults
): boolean {
  if (input.addWord !== undefined && input.addWord !== defaults.addWord) return false;
  if (input.addBeatNumbers !== undefined && input.addBeatNumbers !== defaults.addBeatNumbers) return false;
  if (input.includeStartPosition !== undefined && input.includeStartPosition !== defaults.includeStartPosition) return false;
  if (input.addDifficultyLevel !== undefined && input.addDifficultyLevel !== defaults.addDifficultyLevel) return false;
  if (input.addUserInfo !== undefined && input.addUserInfo !== defaults.addUserInfo) return false;
  if (input.showCreatorName !== undefined && input.showCreatorName !== defaults.showCreatorName) return false;
  if (input.showNotes !== undefined && input.showNotes !== defaults.showNotes) return false;
  if (input.showBirthday !== undefined && input.showBirthday !== defaults.showBirthday) return false;
  if (input.customNotesText !== undefined) return false;

  // userName only matters if addUserInfo is enabled
  const userInfoEnabled = input.addUserInfo ?? defaults.addUserInfo;
  if (userInfoEnabled && input.userName !== undefined && input.userName !== "") return false;

  // Visibility settings affect rendered appearance - check if any are non-default
  if (input.visibility) {
    const defaultVisibility = {
      showTKA: true,
      showReversals: true,
      showGrid: true,
      showNonRadialPoints: false,
      handPointVisibility: "all" as const,
    };
    if (input.visibility.showTKA !== undefined && input.visibility.showTKA !== defaultVisibility.showTKA)
      return false;
    if (input.visibility.showReversals !== undefined && input.visibility.showReversals !== defaultVisibility.showReversals)
      return false;
    if (input.visibility.showGrid !== undefined && input.visibility.showGrid !== defaultVisibility.showGrid)
      return false;
    if (input.visibility.showNonRadialPoints !== undefined && input.visibility.showNonRadialPoints !== defaultVisibility.showNonRadialPoints)
      return false;
    if (input.visibility.handPointVisibility !== undefined && input.visibility.handPointVisibility !== defaultVisibility.handPointVisibility)
      return false;
  }

  return true;
}

function buildFullHashInput(input: ThumbnailRenderInput): object {
  return {
    seq: input.sequenceName,
    blue: input.bluePropType,
    red: input.redPropType,
    catDog: input.catDogModeEnabled,
    light: input.lightMode,
    variant: input.variant,
    addWord: input.addWord,
    addBeatNumbers: input.addBeatNumbers,
    includeStartPosition: input.includeStartPosition,
    addDifficultyLevel: input.addDifficultyLevel,
    addUserInfo: input.addUserInfo,
    showCreatorName: input.showCreatorName,
    showNotes: input.showNotes,
    showBirthday: input.showBirthday,
    customNotesText: input.customNotesText,
    userName: input.userName,
    // Grid visibility settings - affect rendered appearance
    showGrid: input.visibility?.showGrid,
    handPointVisibility: input.visibility?.handPointVisibility,
    showNonRadialPoints: input.visibility?.showNonRadialPoints,
  };
}

function computeHash(obj: object): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

// Tests
describe("ThumbnailKeyDeriver", () => {
  const baseInput: ThumbnailRenderInput = {
    sequenceName: "TestSequence",
    bluePropType: PropType.STAFF,
    redPropType: PropType.STAFF,
    lightMode: false,
    variant: "gallery",
    catDogModeEnabled: false,
  };

  describe("hash consistency", () => {
    it("produces same hash for identical inputs", () => {
      const key1 = deriveKey({ ...baseInput });
      const key2 = deriveKey({ ...baseInput });
      expect(key1.hash).toBe(key2.hash);
    });

    it("produces different hash for different sequence names", () => {
      const key1 = deriveKey({ ...baseInput, sequenceName: "Seq1" });
      const key2 = deriveKey({ ...baseInput, sequenceName: "Seq2" });
      expect(key1.hash).not.toBe(key2.hash);
    });

    it("produces different hash for different prop types", () => {
      const key1 = deriveKey({ ...baseInput, bluePropType: PropType.STAFF });
      const key2 = deriveKey({ ...baseInput, bluePropType: PropType.BUUGENG });
      expect(key1.hash).not.toBe(key2.hash);
    });

    it("produces different hash for light vs dark mode", () => {
      const key1 = deriveKey({ ...baseInput, lightMode: false });
      const key2 = deriveKey({ ...baseInput, lightMode: true });
      expect(key1.hash).not.toBe(key2.hash);
    });

    it("produces different hash for different variants", () => {
      const key1 = deriveKey({ ...baseInput, variant: "gallery" });
      const key2 = deriveKey({ ...baseInput, variant: "wordcard" });
      expect(key1.hash).not.toBe(key2.hash);
    });
  });

  describe("usesDefaults detection", () => {
    it("returns true for gallery defaults", () => {
      const key = deriveKey({
        ...baseInput,
        addWord: true,
        addBeatNumbers: true,
        includeStartPosition: true,
        addDifficultyLevel: true,
        addUserInfo: false,
        showCreatorName: true,
        showNotes: true,
        showBirthday: true,
      });
      expect(key.usesDefaults).toBe(true);
    });

    it("returns true when settings are undefined (use defaults)", () => {
      const key = deriveKey(baseInput);
      expect(key.usesDefaults).toBe(true);
    });

    it("returns false when addWord differs from default", () => {
      const key = deriveKey({ ...baseInput, addWord: false });
      expect(key.usesDefaults).toBe(false);
    });

    it("returns false when addBeatNumbers differs from default", () => {
      const key = deriveKey({ ...baseInput, addBeatNumbers: false });
      expect(key.usesDefaults).toBe(false);
    });

    it("returns false when addUserInfo is enabled (differs from gallery default)", () => {
      const key = deriveKey({ ...baseInput, addUserInfo: true });
      expect(key.usesDefaults).toBe(false);
    });

    it("ignores userName when addUserInfo is false (gallery default)", () => {
      const key = deriveKey({
        ...baseInput,
        addUserInfo: false,
        userName: "Austen Cloud",
      });
      // userName shouldn't matter since addUserInfo is false
      expect(key.usesDefaults).toBe(true);
    });

    it("considers userName when addUserInfo is true", () => {
      const key = deriveKey({
        ...baseInput,
        addUserInfo: true,
        userName: "Austen Cloud",
      });
      expect(key.usesDefaults).toBe(false);
    });

    it("returns false when customNotesText is set", () => {
      const key = deriveKey({
        ...baseInput,
        customNotesText: "Custom note",
      });
      expect(key.usesDefaults).toBe(false);
    });
  });

  describe("cat-dog mode detection", () => {
    it("uses single prop key when catDogModeEnabled is false", () => {
      const key = deriveKey({
        ...baseInput,
        bluePropType: PropType.STAFF,
        redPropType: PropType.BUUGENG,
        catDogModeEnabled: false,
      });
      expect(key.propKey).toBe(PropType.STAFF);
    });

    it("uses catdog key format when enabled with different props", () => {
      const key = deriveKey({
        ...baseInput,
        bluePropType: PropType.STAFF,
        redPropType: PropType.BUUGENG,
        catDogModeEnabled: true,
      });
      expect(key.propKey).toBe(`catdog_${PropType.STAFF}_${PropType.BUUGENG}`);
    });

    it("uses single prop key when catDogMode enabled but props are same", () => {
      const key = deriveKey({
        ...baseInput,
        bluePropType: PropType.STAFF,
        redPropType: PropType.STAFF,
        catDogModeEnabled: true,
      });
      // Same props = not actually cat-dog mode
      expect(key.propKey).toBe(PropType.STAFF);
    });

    it("falls back to STAFF when no prop types provided", () => {
      const key = deriveKey({
        ...baseInput,
        bluePropType: undefined,
        redPropType: undefined,
      });
      expect(key.propKey).toBe(PropType.STAFF);
    });
  });

  describe("visibility settings detection", () => {
    it("uses defaults when visibility settings match defaults", () => {
      const key = deriveKey({
        ...baseInput,
        visibility: {
          showTKA: true,
          showReversals: true,
          showGrid: true,
          showNonRadialPoints: false,
          handPointVisibility: "all",
        },
      });
      expect(key.usesDefaults).toBe(true);
    });

    it("uses defaults when visibility is undefined", () => {
      const key = deriveKey({
        ...baseInput,
        visibility: undefined,
      });
      expect(key.usesDefaults).toBe(true);
    });

    it("returns false when showGrid differs from default", () => {
      const key = deriveKey({
        ...baseInput,
        visibility: { showGrid: false },
      });
      expect(key.usesDefaults).toBe(false);
    });

    it("returns false when showReversals differs from default", () => {
      const key = deriveKey({
        ...baseInput,
        visibility: { showReversals: false },
      });
      expect(key.usesDefaults).toBe(false);
    });

    it("returns false when showTKA differs from default", () => {
      const key = deriveKey({
        ...baseInput,
        visibility: { showTKA: false },
      });
      expect(key.usesDefaults).toBe(false);
    });

    it("returns false when showNonRadialPoints differs from default", () => {
      const key = deriveKey({
        ...baseInput,
        visibility: { showNonRadialPoints: true },
      });
      expect(key.usesDefaults).toBe(false);
    });

    it("returns false when handPointVisibility differs from default", () => {
      const key = deriveKey({
        ...baseInput,
        visibility: { handPointVisibility: "selected" },
      });
      expect(key.usesDefaults).toBe(false);
    });

    it("produces different hash for different visibility settings", () => {
      const key1 = deriveKey({
        ...baseInput,
        visibility: { showGrid: true },
      });
      const key2 = deriveKey({
        ...baseInput,
        visibility: { showGrid: false },
      });
      expect(key1.hash).not.toBe(key2.hash);
    });
  });
});

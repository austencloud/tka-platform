/**
 * ThumbnailKeyDeriver Tests
 *
 * Critical for cache correctness - same inputs MUST produce same hashes,
 * different inputs MUST produce different hashes. Silent bugs here cause
 * cache misses that silently degrade performance.
 */

import { describe, it, expect } from "vitest";
import { ThumbnailKeyDeriver } from "$lib/features/discover/sequences/display/services/implementations/ThumbnailKeyDeriver";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { ThumbnailRenderInput } from "$lib/features/discover/sequences/display/services/contracts/IThumbnailKeyDeriver";

describe("ThumbnailKeyDeriver", () => {
  const deriver = new ThumbnailKeyDeriver();

  // Base input with gallery defaults
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
      const key1 = deriver.deriveKey({ ...baseInput });
      const key2 = deriver.deriveKey({ ...baseInput });

      expect(key1.hash).toBe(key2.hash);
    });

    it("produces different hash for different sequence names", () => {
      const key1 = deriver.deriveKey({ ...baseInput, sequenceName: "Seq1" });
      const key2 = deriver.deriveKey({ ...baseInput, sequenceName: "Seq2" });

      expect(key1.hash).not.toBe(key2.hash);
    });

    it("produces different hash for different prop types", () => {
      const key1 = deriver.deriveKey({ ...baseInput, bluePropType: PropType.STAFF });
      const key2 = deriver.deriveKey({ ...baseInput, bluePropType: PropType.BUUGENG });

      expect(key1.hash).not.toBe(key2.hash);
    });

    it("produces different hash for light vs dark mode", () => {
      const key1 = deriver.deriveKey({ ...baseInput, lightMode: false });
      const key2 = deriver.deriveKey({ ...baseInput, lightMode: true });

      expect(key1.hash).not.toBe(key2.hash);
    });

    it("produces different hash for different variants", () => {
      const key1 = deriver.deriveKey({ ...baseInput, variant: "gallery" });
      const key2 = deriver.deriveKey({ ...baseInput, variant: "wordcard" });

      expect(key1.hash).not.toBe(key2.hash);
    });
  });

  describe("usesDefaults detection", () => {
    it("returns true for gallery defaults", () => {
      const key = deriver.deriveKey({
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
      const key = deriver.deriveKey(baseInput);

      expect(key.usesDefaults).toBe(true);
    });

    it("returns false when addWord differs from default", () => {
      const key = deriver.deriveKey({ ...baseInput, addWord: false });

      expect(key.usesDefaults).toBe(false);
    });

    it("returns false when addBeatNumbers differs from default", () => {
      const key = deriver.deriveKey({ ...baseInput, addBeatNumbers: false });

      expect(key.usesDefaults).toBe(false);
    });

    it("returns false when addUserInfo is enabled (differs from gallery default)", () => {
      const key = deriver.deriveKey({ ...baseInput, addUserInfo: true });

      expect(key.usesDefaults).toBe(false);
    });

    it("ignores userName when addUserInfo is false (gallery default)", () => {
      const key = deriver.deriveKey({
        ...baseInput,
        addUserInfo: false,
        userName: "Austen Cloud",
      });

      // userName shouldn't matter since addUserInfo is false
      expect(key.usesDefaults).toBe(true);
    });

    it("considers userName when addUserInfo is true", () => {
      const key = deriver.deriveKey({
        ...baseInput,
        addUserInfo: true,
        userName: "Austen Cloud",
      });

      expect(key.usesDefaults).toBe(false);
    });

    it("returns false when customNotesText is set", () => {
      const key = deriver.deriveKey({
        ...baseInput,
        customNotesText: "Custom note",
      });

      expect(key.usesDefaults).toBe(false);
    });
  });

  describe("cat-dog mode detection", () => {
    it("uses single prop key when catDogModeEnabled is false", () => {
      const key = deriver.deriveKey({
        ...baseInput,
        bluePropType: PropType.STAFF,
        redPropType: PropType.BUUGENG,
        catDogModeEnabled: false,
      });

      expect(key.propKey).toBe(PropType.STAFF);
    });

    it("uses catdog key format when enabled with different props", () => {
      const key = deriver.deriveKey({
        ...baseInput,
        bluePropType: PropType.STAFF,
        redPropType: PropType.BUUGENG,
        catDogModeEnabled: true,
      });

      expect(key.propKey).toBe(`catdog_${PropType.STAFF}_${PropType.BUUGENG}`);
    });

    it("uses single prop key when catDogMode enabled but props are same", () => {
      const key = deriver.deriveKey({
        ...baseInput,
        bluePropType: PropType.STAFF,
        redPropType: PropType.STAFF,
        catDogModeEnabled: true,
      });

      // Same props = not actually cat-dog mode
      expect(key.propKey).toBe(PropType.STAFF);
    });

    it("falls back to STAFF when no prop types provided", () => {
      const key = deriver.deriveKey({
        ...baseInput,
        bluePropType: undefined,
        redPropType: undefined,
      });

      expect(key.propKey).toBe(PropType.STAFF);
    });
  });

  describe("keysEqual", () => {
    it("returns true for keys with same hash", () => {
      const key1 = deriver.deriveKey(baseInput);
      const key2 = deriver.deriveKey(baseInput);

      expect(deriver.keysEqual(key1, key2)).toBe(true);
    });

    it("returns false for keys with different hash", () => {
      const key1 = deriver.deriveKey({ ...baseInput, sequenceName: "Seq1" });
      const key2 = deriver.deriveKey({ ...baseInput, sequenceName: "Seq2" });

      expect(deriver.keysEqual(key1, key2)).toBe(false);
    });
  });
});

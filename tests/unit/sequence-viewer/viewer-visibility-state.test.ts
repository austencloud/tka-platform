import { describe, it, expect } from "vitest";
import { SequenceViewerVisibilityState } from "$lib/shared/sequence-viewer/state/viewer-visibility-state.svelte";

describe("SequenceViewerVisibilityState", () => {
  it("starts with both motions visible", () => {
    const s = new SequenceViewerVisibilityState();
    expect(s.blueMotion).toBe(true);
    expect(s.redMotion).toBe(true);
  });

  it("setBlueMotion(false) hides blue when red is visible", () => {
    const s = new SequenceViewerVisibilityState();
    s.setBlueMotion(false);
    expect(s.blueMotion).toBe(false);
    expect(s.redMotion).toBe(true);
  });

  it("setRedMotion(false) hides red when blue is visible", () => {
    const s = new SequenceViewerVisibilityState();
    s.setRedMotion(false);
    expect(s.blueMotion).toBe(true);
    expect(s.redMotion).toBe(false);
  });

  it("hiding the last visible motion flips the other on", () => {
    const s = new SequenceViewerVisibilityState();
    s.setBlueMotion(false);
    // red is the only visible one — hiding it should flip blue back on
    s.setRedMotion(false);
    expect(s.blueMotion).toBe(true);
    expect(s.redMotion).toBe(false);
  });

  it("toggleBlue flips blue visibility", () => {
    const s = new SequenceViewerVisibilityState();
    s.toggleBlue();
    expect(s.blueMotion).toBe(false);
    s.toggleBlue();
    expect(s.blueMotion).toBe(true);
  });

  it("reset restores both motions to visible", () => {
    const s = new SequenceViewerVisibilityState();
    s.setBlueMotion(false);
    s.reset();
    expect(s.blueMotion).toBe(true);
    expect(s.redMotion).toBe(true);
  });

  it("isSolo is true when exactly one motion is visible", () => {
    const s = new SequenceViewerVisibilityState();
    expect(s.isSolo).toBe(false);
    s.setBlueMotion(false);
    expect(s.isSolo).toBe(true);
    s.setBlueMotion(true);
    expect(s.isSolo).toBe(false);
  });

  it("soloColor returns the visible color when solo", () => {
    const s = new SequenceViewerVisibilityState();
    expect(s.soloColor).toBeUndefined();
    s.setBlueMotion(false);
    expect(s.soloColor).toBe("red");
    s.setBlueMotion(true);
    s.setRedMotion(false);
    expect(s.soloColor).toBe("blue");
  });

  describe("allowNone (landing spinner — prop existence is a free variable)", () => {
    it("permits hiding the last visible motion (both off)", () => {
      const s = new SequenceViewerVisibilityState(true);
      s.setBlueMotion(false);
      s.setRedMotion(false);
      expect(s.blueMotion).toBe(false);
      expect(s.redMotion).toBe(false);
    });

    it("toggles each color independently with both able to be off", () => {
      const s = new SequenceViewerVisibilityState(true);
      s.toggleBlue(); // blue off
      s.toggleRed(); // red off — not flipped back on
      expect(s.blueMotion).toBe(false);
      expect(s.redMotion).toBe(false);
      s.toggleBlue(); // blue back on
      expect(s.blueMotion).toBe(true);
      expect(s.redMotion).toBe(false);
    });

    it("default (allowNone=false) still flips the other on", () => {
      const s = new SequenceViewerVisibilityState();
      s.setBlueMotion(false);
      s.setRedMotion(false);
      expect(s.redMotion).toBe(false);
      expect(s.blueMotion).toBe(true);
    });
  });
});

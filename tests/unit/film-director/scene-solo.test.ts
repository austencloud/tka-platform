/**
 * Solo playback: confining the playhead to one scene so a capability can be
 * inspected on its own instead of being watched to in a linear film.
 */
import { describe, expect, it } from "vitest";

import { createFilmDirectorState } from "../../../src/routes/test/film-director/_lib/film-director-state.svelte";
import type { FilmDirectorInput } from "../../../src/routes/test/film-director/_lib/film-director-schema";

function scene(id: string, title: string, durationSeconds: number) {
  return {
    id,
    title,
    durationSeconds,
    transition: { kind: "cut" as const },
    performance: {
      bpm: 120,
      formation: "side-by-side",
      cast: { count: 2 },
    },
  };
}

/**
 * Three scenes of known, different lengths, so a wrap that used the wrong
 * scene's duration lands somewhere the assertions can see.
 */
function threeSceneFilm(playback?: Record<string, unknown>): FilmDirectorInput {
  return {
    version: 5,
    id: "solo-film",
    title: "Solo Film",
    ...(playback ? { playback } : {}),
    scenes: [
      scene("first", "First", 10),
      scene("second", "Second", 6),
      scene("third", "Third", 8),
    ],
  } as unknown as FilmDirectorInput;
}

function director(playback?: Record<string, unknown>) {
  return createFilmDirectorState(threeSceneFilm(playback));
}

describe("solo playback", () => {
  it("parks the playhead inside the soloed scene", () => {
    const state = director();
    state.setSoloScene(1);

    expect(state.soloSceneIndex).toBe(1);
    expect(state.frame.sceneIndex).toBe(1);
    // Just past the boundary, not on it: landing exactly on a start lands
    // inside the outgoing scene's transition.
    expect(state.playheadSeconds).toBeGreaterThan(10);
    expect(state.playheadSeconds).toBeLessThan(10.1);
  });

  it("wraps forward inside the scene instead of running into the next one", () => {
    const state = director();
    state.setSoloScene(1);

    // Two seconds past the end of a six-second scene starting at ten.
    state.seek(18);

    expect(state.frame.sceneIndex).toBe(1);
    expect(state.playheadSeconds).toBeGreaterThan(11.9);
    expect(state.playheadSeconds).toBeLessThan(12.1);
  });

  it("wraps backward into the tail of the scene", () => {
    const state = director();
    state.setSoloScene(1);

    // One second before the scene opens.
    state.seek(9);

    expect(state.frame.sceneIndex).toBe(1);
    expect(state.playheadSeconds).toBeGreaterThan(14.9);
    expect(state.playheadSeconds).toBeLessThan(16);
  });

  it("keeps looping a soloed scene inside a film that does not loop", () => {
    const state = director({ loop: false });
    state.setSoloScene(2);

    // Past the end of the whole film, which un-soloed would clamp.
    state.seek(30);

    expect(state.frame.sceneIndex).toBe(2);
    expect(state.playheadSeconds).toBeLessThan(state.film.durationSeconds);
  });

  it("releases the film when solo is cleared", () => {
    const state = director();
    state.setSoloScene(0);
    state.setSoloScene(null);

    expect(state.soloSceneIndex).toBeNull();

    state.seek(17);
    expect(state.playheadSeconds).toBeCloseTo(17, 5);
    expect(state.frame.sceneIndex).toBe(2);
  });

  it("moves the solo when a scene is selected while soloing", () => {
    const state = director();
    state.setSoloScene(0);
    state.selectScene(2);

    expect(state.soloSceneIndex).toBe(2);
    expect(state.frame.sceneIndex).toBe(2);
  });

  it("seeks without soloing when no scene is soloed", () => {
    const state = director();
    state.selectScene(2);

    expect(state.soloSceneIndex).toBeNull();
    expect(state.frame.sceneIndex).toBe(2);
  });

  it("ignores a scene index the film does not have", () => {
    const state = director();
    state.setSoloScene(99);

    expect(state.soloSceneIndex).toBeNull();
  });

  it("clears the solo when a different film is loaded", () => {
    const state = director();
    state.setSoloScene(2);
    state.loadFilm(threeSceneFilm());

    expect(state.soloSceneIndex).toBeNull();
    expect(state.playheadSeconds).toBe(0);
  });
});

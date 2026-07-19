/**
 * hero-act.svelte.ts logic tests. Named without the `.svelte.` infix so it
 * runs under jsdom (the plain unit-test project), not the browser component
 * project — see docs/reference/component-testing.md's naming footgun.
 *
 * Mocks generatePerVisitDemo/FALLBACK_DEMO at the per-visit-demo.ts module
 * boundary: that's where "generation" enters hero-act.ts's world, so tests
 * exercise the act's own cycling/pass-counting/chaining logic without
 * touching the real generation engine.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

const mocks = vi.hoisted(() => ({
  generatePerVisitDemo: vi.fn(),
}));

vi.mock("$lib/shared/landing/data/per-visit-demo", () => ({
  FALLBACK_DEMO: {
    id: "fallback",
    name: "fallback",
    word: "fallback",
    steps: [],
    startPosition: {
      isStartPosition: true,
      id: "fallback-start",
      startPosition: "alpha1",
      motions: {},
    },
    thumbnails: [],
    isFavorite: false,
    isCircular: true,
    tags: [],
    metadata: {},
  },
  generatePerVisitDemo: mocks.generatePerVisitDemo,
}));

import { createHeroAct, PROP_CYCLE, PASSES_PER_SEQUENCE } from "../hero-act.svelte";

/** Minimal fixture — hero-act.ts only ever reads `.id` and `.startPosition`. */
function fakeSequence(id: string, startPos: string): SequenceData {
  return {
    id,
    name: id,
    word: id,
    steps: [],
    startPosition: {
      isStartPosition: true,
      id: `${id}-start`,
      startPosition: startPos,
      motions: {},
    },
    thumbnails: [],
    isFavorite: false,
    isCircular: true,
    tags: [],
    metadata: {},
  } as unknown as SequenceData;
}

/** Flushes every pending microtask (including a `.then()` chain fired by a
 *  background `prepareNext()` call that `advance()` doesn't itself await). */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

let callCount = 0;

beforeEach(() => {
  callCount = 0;
  mocks.generatePerVisitDemo.mockReset();
  mocks.generatePerVisitDemo.mockImplementation(
    async (options?: { propType?: PropType; startPosition?: unknown }) => {
      callCount += 1;
      return fakeSequence(`gen-${callCount}`, `pos-${callCount}`);
    }
  );
});

describe("createHeroAct", () => {
  it("starts on the fallback sequence and staff, generating nothing until start() is called", async () => {
    const act = createHeroAct({ propMorphDelayMs: 0 });
    expect(act.sequence.id).toBe("fallback");
    expect(act.propType).toBe(PropType.STAFF);
    await flush();
    expect(mocks.generatePerVisitDemo).not.toHaveBeenCalled();
  });

  it("never includes poi in the prop cycle", () => {
    expect(PROP_CYCLE).not.toContain(PropType.POI);
  });

  it("start() pre-generates the next prop in the cycle, chained to the current start position", async () => {
    const act = createHeroAct({ propMorphDelayMs: 0 });
    act.start();
    await flush();

    expect(mocks.generatePerVisitDemo).toHaveBeenCalledTimes(1);
    expect(mocks.generatePerVisitDemo).toHaveBeenCalledWith({
      propType: PropType.FAN,
      startPosition: expect.objectContaining({ startPosition: "alpha1" }),
    });
  });

  it("cycles STAFF -> FAN -> CLUB -> BUUGENG -> STAFF, wrapping around", async () => {
    const act = createHeroAct({ propMorphDelayMs: 0 });
    const seen: PropType[] = [act.propType];

    for (let i = 0; i < PROP_CYCLE.length; i++) {
      await act.advanceNow();
      await flush();
      seen.push(act.propType);
    }

    expect(seen).toEqual([
      PropType.STAFF,
      PropType.FAN,
      PropType.CLUB,
      PropType.BUUGENG,
      PropType.STAFF,
    ]);
    // Every prop visited across a full lap stays inside the sanctioned cycle.
    for (const prop of seen) {
      expect(PROP_CYCLE).toContain(prop);
    }
  });

  it("every advance carries a distinct sequence id (the player keys its in-place reload on id)", async () => {
    const act = createHeroAct({ propMorphDelayMs: 0 });
    const ids: string[] = [act.sequence.id];

    for (let i = 0; i < PROP_CYCLE.length; i++) {
      await act.advanceNow();
      await flush();
      ids.push(act.sequence.id);
    }

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("chains each generated sequence's startPosition to the immediately-preceding sequence's start position", async () => {
    const act = createHeroAct({ propMorphDelayMs: 0 });

    await act.advanceNow(); // STAFF -> FAN (fresh generation, chained off the fallback)
    await flush();
    const fanCall = mocks.generatePerVisitDemo.mock.calls.find(
      ([options]) => (options as { propType?: PropType } | undefined)?.propType === PropType.FAN
    );
    expect(fanCall?.[0]).toMatchObject({
      startPosition: expect.objectContaining({ startPosition: "alpha1" }),
    });
    const fanStartPosition = act.sequence.startPosition;

    await act.advanceNow(); // FAN -> CLUB
    await flush();
    const clubCall = mocks.generatePerVisitDemo.mock.calls.find(
      ([options]) => (options as { propType?: PropType } | undefined)?.propType === PropType.CLUB
    );
    expect(clubCall?.[0]).toMatchObject({ startPosition: fanStartPosition });
  });

  it("advanceNow reuses an already-prepared next sequence instead of generating a duplicate", async () => {
    const act = createHeroAct({ propMorphDelayMs: 0 });
    act.start();
    await flush(); // the FAN pre-generation lands

    expect(mocks.generatePerVisitDemo).toHaveBeenCalledTimes(1);

    await act.advanceNow();
    await flush();

    // Exactly one more call: the background prepareNext() for the prop after
    // FAN (CLUB), fired by advance() itself. A second call targeting FAN
    // again would mean the ready sequence was discarded and regenerated.
    expect(mocks.generatePerVisitDemo).toHaveBeenCalledTimes(2);
    expect(act.propType).toBe(PropType.FAN);
  });

  it("advanceNow generates fresh when nothing has been pre-generated yet", async () => {
    const act = createHeroAct({ propMorphDelayMs: 0 });
    // No start() call — nothing was ever pre-generated in the background.
    await act.advanceNow();
    await flush();

    expect(act.propType).toBe(PropType.FAN);
    expect(mocks.generatePerVisitDemo).toHaveBeenCalledWith(
      expect.objectContaining({ propType: PropType.FAN })
    );
  });

  it("advances only once handleLoopComplete has fired PASSES_PER_SEQUENCE times with a ready next", async () => {
    const act = createHeroAct({ propMorphDelayMs: 0 });
    act.start();
    await flush(); // FAN pre-generation lands
    expect(act.propType).toBe(PropType.STAFF);

    for (let i = 1; i < PASSES_PER_SEQUENCE; i++) {
      act.handleLoopComplete();
      await flush();
      expect(act.propType).toBe(PropType.STAFF); // quota not met yet
    }

    act.handleLoopComplete(); // the PASSES_PER_SEQUENCE-th boundary
    await flush();
    expect(act.propType).toBe(PropType.FAN);
  });

  it("keeps looping the current sequence when the pre-generated next hasn't landed, then advances once it does", async () => {
    let resolveNext!: (seq: SequenceData) => void;
    const pending = new Promise<SequenceData>((resolve) => {
      resolveNext = resolve;
    });
    mocks.generatePerVisitDemo.mockReturnValueOnce(pending);

    const act = createHeroAct({ propMorphDelayMs: 0 });
    act.start();
    await flush();
    expect(mocks.generatePerVisitDemo).toHaveBeenCalledTimes(1);

    // Loop boundary fires before generation has resolved. PASSES_PER_SEQUENCE
    // may be 1 (crossing the quota on this very call) — either way, with no
    // ready sequence the act must not advance.
    for (let i = 0; i < PASSES_PER_SEQUENCE; i++) {
      act.handleLoopComplete();
    }
    await flush();
    expect(act.sequence.id).toBe("fallback");
    expect(act.propType).toBe(PropType.STAFF);

    // Generation lands.
    resolveNext(fakeSequence("gen-fan", "pos-fan"));
    await flush();

    // Retried at the next boundary: now it advances.
    act.handleLoopComplete();
    await flush();
    expect(act.sequence.id).toBe("gen-fan");
    expect(act.propType).toBe(PropType.FAN);
  });

  it("with a morph delay, the sequence swaps first and the prop flips after the delay", async () => {
    const act = createHeroAct({ propMorphDelayMs: 25 });
    act.start();
    await flush();
    const advancing = act.advanceNow();
    await flush();
    // Sequence already swapped; prop still the old one during the morph window.
    expect(act.sequence.id).not.toBe("fallback");
    expect(act.propType).toBe(PropType.STAFF);
    await advancing;
    expect(act.propType).toBe(PropType.FAN);
  });
});

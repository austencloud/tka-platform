# Director First-Class Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/test/film-director` from proof-of-concept scaffolding into a first-class surface: a film library front door, a stage carrying only the rail and a one-row transport, and exactly one save action.

**Architecture:** The route gains two sibling surfaces chosen by the URL — a marquee (film library) and a stage (the workbench). `createFilmDirectorState` requires a film at construction and stays that way, so the marquee is a separate component rather than an empty mode. The stage's chrome collapses to a rebuilt transport on the canonical `TransportControls`, with the scrubber and scene chip strip replaced by one segmented timeline, and a film panel in that transport row owning save and Scene JSON. The shared `SceneControlWorkspace` gains one defaulted prop so this host can suppress Save scene.

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Zod, bits-ui (Popover), Vitest.

**Spec:** `docs/superpowers/specs/active/2026-08-25-director-first-class-shell-design.md`

---

## File Structure

**Create:**

| Path | Responsibility |
| --- | --- |
| `src/routes/test/film-director/_lib/film-origin.ts` | Where the staged film came from, and what Save does about it |
| `src/routes/test/film-director/_lib/film-timeline-geometry.ts` | Pure seconds↔fraction and scene→segment math |
| `src/routes/test/film-director/_components/FilmTimeline.svelte` | The segmented track: render, drag, seek |
| `src/routes/test/film-director/_components/FilmDirectorFilmPanel.svelte` | Popover: title, Save, Save as new, Scene JSON, Restore |
| `src/routes/test/film-director/_components/FilmDirectorMarquee.svelte` | The front door: starting points + saved films |
| `tests/unit/film-director/film-origin.test.ts` | |
| `tests/unit/film-director/film-timeline-geometry.test.ts` | |
| `tests/unit/film-collection/previous-film.test.ts` | |

**Modify:**

| Path | Change |
| --- | --- |
| `src/lib/features/film-collection/domain/film-collection-types.ts` | `previousFilm` field + schema |
| `src/lib/shared/3d/components/controls/SceneControlRail.svelte` | `onOpenSaveScene` becomes optional; button gated on it |
| `src/lib/shared/3d/components/controls/SceneControlWorkspace.svelte` | `allowSaveScene` prop gating forwarding and the modal |
| `src/routes/test/film-director/_components/FilmDirectorWorkbench.svelte` | Origin state, save handlers, chrome deletions, props |
| `src/routes/test/film-director/_components/FilmDirectorTransport.svelte` | Rebuilt as one row |
| `src/routes/test/film-director/_components/FilmDirectorScene.svelte` | Drop `topOffset`, pass `allowSaveScene={false}` |
| `src/routes/test/film-director/+page.svelte` | Marquee vs stage decision |

Task order keeps the tree compiling and the app working after every commit. Tasks 1–3 are leaf changes nothing consumes yet; 4 rewires existing buttons without moving them; 5–7 build and install the new transport; 8–10 flip the route over.

---

### Task 1: Film origin

**Files:**
- Create: `src/routes/test/film-director/_lib/film-origin.ts`
- Test: `tests/unit/film-director/film-origin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/film-director/film-origin.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  filmOriginIsSaved,
  filmOriginLabel,
  filmOriginUrlKey,
  type FilmOrigin,
} from "../../../src/routes/test/film-director/_lib/film-origin";

const library: FilmOrigin = { kind: "library", key: "star" };
const saved: FilmOrigin = { kind: "saved", id: "abc123", name: "My cut" };

describe("filmOriginUrlKey", () => {
  it("names a library film by its bare key", () => {
    expect(filmOriginUrlKey(library)).toBe("star");
  });

  it("prefixes a saved film so its id cannot shadow a library key", () => {
    expect(filmOriginUrlKey(saved)).toBe("saved:abc123");
  });
});

describe("filmOriginIsSaved", () => {
  it("is false for a library film, so Save creates", () => {
    expect(filmOriginIsSaved(library)).toBe(false);
  });

  it("is true for a saved film, so Save overwrites", () => {
    expect(filmOriginIsSaved(saved)).toBe(true);
  });
});

describe("filmOriginLabel", () => {
  it("prefers the saved entry's name over the document title", () => {
    expect(filmOriginLabel(saved, "Star of Five")).toBe("My cut");
  });

  it("falls back to the document title for a library film", () => {
    expect(filmOriginLabel(library, "Star of Five")).toBe("Star of Five");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run --config tests/config/vitest.config.ts tests/unit/film-director/film-origin.test.ts
```

Expected: FAIL, cannot resolve `_lib/film-origin`.

- [ ] **Step 3: Write the module**

Create `src/routes/test/film-director/_lib/film-origin.ts`:

```ts
import { savedFilmKey } from "./film-key";

/**
 * Where the film on the stage came from.
 *
 * Not recoverable from the film document: a saved film keeps the `id` and
 * `title` of the library film it started as, so the document cannot say whether
 * Save should overwrite an existing entry or create a new one.
 */
export type FilmOrigin =
  | { kind: "library"; key: string }
  | { kind: "saved"; id: string; name: string };

export type SavedFilmOrigin = Extract<FilmOrigin, { kind: "saved" }>;

/** The `?film=` value naming this origin. */
export function filmOriginUrlKey(origin: FilmOrigin): string {
  return origin.kind === "saved" ? savedFilmKey(origin.id) : origin.key;
}

/** Whether Save writes over an existing document rather than creating one. */
export function filmOriginIsSaved(origin: FilmOrigin): origin is SavedFilmOrigin {
  return origin.kind === "saved";
}

/**
 * What to call the current film. A saved entry's name is user-chosen and can
 * differ from the document's title, and the user's name wins.
 */
export function filmOriginLabel(origin: FilmOrigin, filmTitle: string): string {
  return origin.kind === "saved" ? origin.name : filmTitle;
}
```

- [ ] **Step 4: Run the test again**

```bash
npx vitest run --config tests/config/vitest.config.ts tests/unit/film-director/film-origin.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/routes/test/film-director/_lib/film-origin.ts tests/unit/film-director/film-origin.test.ts
git commit -m "feat(director): film origin, so Save can tell overwrite from create" -- src/routes/test/film-director/_lib/film-origin.ts tests/unit/film-director/film-origin.test.ts
```

---

### Task 2: One prior version on a saved film

**Files:**
- Modify: `src/lib/features/film-collection/domain/film-collection-types.ts`
- Test: `tests/unit/film-collection/previous-film.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/film-collection/previous-film.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { CollectedFilmSchema } from "../../../src/lib/features/film-collection/domain/film-collection-types";

const base = {
  id: "entry-1",
  name: "My cut",
  createdAt: 1_700_000_000_000,
  poster: "",
  film: { id: "star-of-five", title: "Star of Five", version: 1 },
  durationSeconds: 32,
  sceneCount: 2,
};

describe("CollectedFilmSchema previousFilm", () => {
  it("accepts an entry that has never been overwritten", () => {
    expect(CollectedFilmSchema.parse(base).previousFilm).toBeUndefined();
  });

  it("round-trips the document held before the last overwrite", () => {
    const parsed = CollectedFilmSchema.parse({
      ...base,
      previousFilm: { id: "star-of-five", title: "Star of Five", version: 1 },
    });
    expect(parsed.previousFilm?.title).toBe("Star of Five");
  });

  it("passes unknown keys on the prior document through untouched", () => {
    const parsed = CollectedFilmSchema.parse({
      ...base,
      previousFilm: {
        id: "star-of-five",
        title: "Star of Five",
        version: 1,
        scenes: [{ id: "reveal" }],
      },
    });
    expect(
      (parsed.previousFilm as Record<string, unknown>).scenes
    ).toEqual([{ id: "reveal" }]);
  });

  it("rejects a prior document missing its identity", () => {
    expect(() =>
      CollectedFilmSchema.parse({ ...base, previousFilm: { title: "x" } })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run --config tests/config/vitest.config.ts tests/unit/film-collection/previous-film.test.ts
```

Expected: FAIL on the round-trip test — `previousFilm` is stripped by the schema, so `parsed.previousFilm` is `undefined`.

- [ ] **Step 3: Add the field**

In `src/lib/features/film-collection/domain/film-collection-types.ts`, add to the `CollectedFilm` interface immediately after the `film` field:

```ts
  /**
   * The document this entry held before the last overwrite, so a bad save can
   * be undone. One deep, deliberately: enough to reverse a mistake, not a
   * version history. Absent until the entry has been overwritten once.
   */
  previousFilm?: StoredFilmDocument;
```

And add to `CollectedFilmSchema`, after the `film:` line:

```ts
  previousFilm: StoredFilmDocumentSchema.optional(),
```

Optional, so entries already in Firestore and localStorage keep parsing and
`FILM_COLLECTION_SCHEMA_VERSION` does not move.

- [ ] **Step 4: Run the test again**

```bash
npx vitest run --config tests/config/vitest.config.ts tests/unit/film-collection/previous-film.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/film-collection/domain/film-collection-types.ts tests/unit/film-collection/previous-film.test.ts
git commit -m "feat(film-collection): retain one prior document per saved film" -- src/lib/features/film-collection/domain/film-collection-types.ts tests/unit/film-collection/previous-film.test.ts
```

---

### Task 3: Gate Save scene at the workspace

Hiding the rail's button is not enough — the workspace also forwards `onOpenSaveScene` into `PresetsPanel` and mounts `SaveSceneModal` unconditionally. Both must go when a host opts out.

**Files:**
- Modify: `src/lib/shared/3d/components/controls/SceneControlRail.svelte`
- Modify: `src/lib/shared/3d/components/controls/SceneControlWorkspace.svelte`

- [ ] **Step 1: Make the rail's save action optional**

In `SceneControlRail.svelte`, change the Props line:

```ts
    onOpenSaveScene: () => void;
```

to:

```ts
    /** Omit to leave Save scene off the rail — see SceneControlWorkspace's
     *  allowSaveScene. */
    onOpenSaveScene?: () => void;
```

In `openSaveScene()`, change the final line from `onOpenSaveScene();` to:

```ts
    onOpenSaveScene?.();
```

Wrap the Save scene button (currently the `SceneChromeButton` with
`icon="fa-bookmark"` and `data-save-shortcut`) in a guard:

```svelte
      {#if onOpenSaveScene}
        <SceneChromeButton
          icon="fa-bookmark"
          label="Save scene"
          data-save-shortcut
          onclick={openSaveScene}
        />
      {/if}
```

- [ ] **Step 2: Add the workspace gate**

In `SceneControlWorkspace.svelte`, add to `interface Props`:

```ts
    /**
     * Whether this host offers saving the live viewer state as a reusable look.
     * The Director turns it off: its artifact is the film document, and a
     * viewer snapshot taken there records one instant of a playing film with no
     * relationship to what is being authored.
     */
    allowSaveScene?: boolean;
```

Add to the destructuring, after `topOffset`:

```ts
    allowSaveScene = true,
```

Change the rail's props from `onOpenSaveScene={openSaveScene}` to:

```svelte
      onOpenSaveScene={allowSaveScene ? openSaveScene : undefined}
```

Change the inspector's the same way:

```svelte
          onOpenSaveScene={allowSaveScene ? openSaveScene : undefined}
```

And gate the modal:

```svelte
{#if allowSaveScene}
  <SaveSceneModal bind:open={saveSceneOpen} {bpm} {onSettingChange} {onAction} />
{/if}
```

- [ ] **Step 3: Prove no consumer regressed**

```bash
grep -rn "SceneControlWorkspace" --include=*.svelte src/ | grep -v "controls/SceneControlWorkspace.svelte"
```

Expected: four hits — `Viewer3DFullscreen.svelte` (a lazy type reference and its state), `ViewerMotionSurface.svelte:354`, `FilmDirectorScene.svelte`, `OceanExperienceControls.svelte`. None passes `allowSaveScene`, so all default to `true` and behave exactly as before.

- [ ] **Step 4: Typecheck**

```bash
npm run check:fast
```

Expected: no new errors in `SceneControlRail.svelte` or `SceneControlWorkspace.svelte`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/components/controls/SceneControlRail.svelte src/lib/shared/3d/components/controls/SceneControlWorkspace.svelte
git commit -m "feat(3d): allowSaveScene, so a host can own its only save action" -- src/lib/shared/3d/components/controls/SceneControlRail.svelte src/lib/shared/3d/components/controls/SceneControlWorkspace.svelte
```

---

### Task 4: Origin state and save handlers in the workbench

Rewires the existing header buttons onto the new origin model. Nothing moves or disappears yet, so the page keeps working while the identity gap closes.

**Files:**
- Modify: `src/routes/test/film-director/_components/FilmDirectorWorkbench.svelte`

- [ ] **Step 1: Replace `selectedFilmKey` with an origin**

Add to the imports:

```ts
  import {
    filmOriginIsSaved,
    filmOriginLabel,
    filmOriginUrlKey,
    type FilmOrigin,
  } from "../_lib/film-origin";
```

Replace the `selectedFilmKey` declaration with:

```ts
  let origin = $state<FilmOrigin>({ kind: "library", key: initialFilmKey });
```

Replace `syncFilmToUrl(key: string)` with a version that takes the origin, so the URL can never disagree with what Save will do:

```ts
  function syncFilmToUrl(next: FilmOrigin): void {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("film", filmOriginUrlKey(next));
    replaceState(url, {});
  }
```

Update the three existing call sites:

- `selectFilm`: `selectedFilmKey = key; syncFilmToUrl(key);` becomes
  `origin = { kind: "library", key }; syncFilmToUrl(origin);`
  and its early return becomes `if (origin.kind === "library" && key === origin.key) return;`
- `openSavedFilm`: replace `selectedFilmKey = ""; shelfOpen = false; syncFilmToUrl(savedFilmKey(entry.id));` with
  `origin = { kind: "saved", id: entry.id, name: entry.name }; shelfOpen = false; syncFilmToUrl(origin);`
- the `pendingSavedId` effect's `else syncFilmToUrl(selectedFilmKey);` becomes `else syncFilmToUrl(origin);`
- `onMount`'s `if (requestedFilm.kind === "unknown") syncFilmToUrl(selectedFilmKey);` becomes `syncFilmToUrl(origin);` under the same guard

Delete the now-unused `savedFilmKey` import if nothing else references it.

- [ ] **Step 2: Add the three save handlers**

Add after `openSaveModal`:

```ts
  let saveBusy = $state(false);

  /**
   * The saved entry the stage is editing, or null when the film has never been
   * saved. Reads `origin` into a const first: TypeScript drops the narrowing
   * from `filmOriginIsSaved` inside a callback that captures a mutable `let`.
   */
  function currentEntry() {
    const current = origin;
    if (!filmOriginIsSaved(current)) return null;
    return (
      filmCollectionState.collection.find((entry) => entry.id === current.id) ??
      null
    );
  }

  /** The fields an overwrite replaces. Identity — id, name, createdAt — is
   *  exactly what it preserves, so a link to this entry survives an edit. */
  function currentFilmPatch() {
    return {
      film: $state.snapshot(director.sourceInput) as unknown as StoredFilmDocument,
      poster: captureFilmPoster(director.readPosterSource()),
      durationSeconds: director.film.durationSeconds,
      sceneCount: director.film.scenes.length,
    };
  }

  async function saveFilm(): Promise<void> {
    const entry = currentEntry();
    if (!entry) {
      openSaveModal();
      return;
    }
    if (saveBusy) return;
    saveBusy = true;
    try {
      // previousFilm is always a real document here. Never pass it as
      // undefined: update() spreads the patch, and Firestore rejects an
      // explicit undefined field.
      await filmCollectionState.update(entry.id, {
        ...currentFilmPatch(),
        previousFilm: $state.snapshot(entry.film),
      });
      toast.success("Film saved");
    } catch (error) {
      console.warn("[Director] Overwrite failed:", error);
      toast.error("Couldn't save the film");
    } finally {
      saveBusy = false;
    }
  }

  async function restorePreviousFilm(): Promise<void> {
    if (saveBusy) return;
    const entry = currentEntry();
    const restored = entry?.previousFilm;
    if (!entry || !restored) return;
    saveBusy = true;
    try {
      // Swap rather than drop, so Restore is itself undoable.
      const document = $state.snapshot(restored) as unknown as StoredFilmDocument;
      await filmCollectionState.update(entry.id, {
        film: document,
        previousFilm: $state.snapshot(entry.film),
      });
      director.loadFilm(document as unknown as FilmDirectorInput);
      toast.success("Previous version restored");
    } catch (error) {
      console.warn("[Director] Restore failed:", error);
      toast.error("Couldn't restore that version");
    } finally {
      saveBusy = false;
    }
  }
```

Add the imports these need:

```ts
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import type { StoredFilmDocument } from "$lib/features/film-collection/domain/film-collection-types";
```

Update `handleSaved` so a fresh save adopts its new identity:

```ts
  function handleSaved(id: string): void {
    const entry = filmCollectionState.collection.find((item) => item.id === id);
    origin = { kind: "saved", id, name: entry?.name ?? director.film.title };
    syncFilmToUrl(origin);
  }
```

- [ ] **Step 3: Point the existing buttons at them**

In `.film-actions`, change the first button's `onclick={openSaveModal}` to `onclick={saveFilm}` and its label to:

```svelte
      {filmOriginIsSaved(origin) ? "Save" : "Save film"}
```

- [ ] **Step 4: Typecheck and drive it**

```bash
npm run check:fast
```

Expected: no errors in `FilmDirectorWorkbench.svelte`.

Then, with the dev server already running (never start it — see `.claude/rules/never-start-the-dev-server.md`), load `https://localhost:5173/test/film-director?film=star`, click Save film, name it, and confirm in DevTools that the URL became `?film=saved:<id>` and the button now reads "Save". Click Save again and confirm the entry's `id` and `createdAt` are unchanged:

```js
JSON.stringify(
  (await import("/src/lib/features/film-collection/state/film-collection-state.svelte.ts"))
    .filmCollectionState.collection.map((e) => ({
      id: e.id, name: e.name, createdAt: e.createdAt, hasPrevious: Boolean(e.previousFilm),
    }))
)
```

Expected: one entry, `hasPrevious: true` after the second save.

- [ ] **Step 5: Commit**

```bash
git add src/routes/test/film-director/_components/FilmDirectorWorkbench.svelte
git commit -m "feat(director): film identity, overwrite, and one-deep restore" -- src/routes/test/film-director/_components/FilmDirectorWorkbench.svelte
```

---

### Task 5: Timeline geometry

Pure math, extracted so the segment arithmetic is testable without a browser.

**Files:**
- Create: `src/routes/test/film-director/_lib/film-timeline-geometry.ts`
- Test: `tests/unit/film-director/film-timeline-geometry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/film-director/film-timeline-geometry.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  buildTimelineSegments,
  fractionAtSeconds,
  secondsAtFraction,
} from "../../../src/routes/test/film-director/_lib/film-timeline-geometry";

const scenes = [
  { id: "a", title: "Reveal", startSeconds: 0, durationSeconds: 10 },
  { id: "b", title: "Turn", startSeconds: 10, durationSeconds: 30 },
];

describe("buildTimelineSegments", () => {
  it("sizes each segment by its share of the film", () => {
    const segments = buildTimelineSegments(scenes, 40);
    expect(segments.map((s) => s.width)).toEqual([0.25, 0.75]);
    expect(segments.map((s) => s.offset)).toEqual([0, 0.25]);
  });

  it("covers the whole track with no gap", () => {
    const segments = buildTimelineSegments(scenes, 40);
    const last = segments[segments.length - 1]!;
    expect(last.offset + last.width).toBeCloseTo(1, 10);
  });

  it("returns nothing for a zero-length film rather than dividing by zero", () => {
    expect(buildTimelineSegments(scenes, 0)).toEqual([]);
  });

  it("keeps the scene index so a click can select it", () => {
    expect(buildTimelineSegments(scenes, 40).map((s) => s.index)).toEqual([0, 1]);
  });
});

describe("secondsAtFraction", () => {
  it("maps the track onto the film", () => {
    expect(secondsAtFraction(0.25, 40)).toBe(10);
  });

  it("clamps a pointer dragged past either end", () => {
    expect(secondsAtFraction(-0.4, 40)).toBe(0);
    expect(secondsAtFraction(1.8, 40)).toBe(40);
  });
});

describe("fractionAtSeconds", () => {
  it("is the inverse of secondsAtFraction", () => {
    expect(fractionAtSeconds(secondsAtFraction(0.6, 40), 40)).toBeCloseTo(0.6, 10);
  });

  it("is zero for a zero-length film", () => {
    expect(fractionAtSeconds(5, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run --config tests/config/vitest.config.ts tests/unit/film-director/film-timeline-geometry.test.ts
```

Expected: FAIL, cannot resolve `_lib/film-timeline-geometry`.

- [ ] **Step 3: Write the module**

Create `src/routes/test/film-director/_lib/film-timeline-geometry.ts`:

```ts
/** The scene fields the timeline needs, structural so tests need no fixture. */
export interface TimelineScene {
  id: string;
  title: string;
  startSeconds: number;
  durationSeconds: number;
}

export interface TimelineSegment extends TimelineScene {
  /** Position in `film.scenes`, which is what selectScene takes. */
  index: number;
  /** Distance from the track's left edge, 0..1. */
  offset: number;
  /** Share of the track, 0..1. */
  width: number;
}

export function buildTimelineSegments(
  scenes: readonly TimelineScene[],
  filmDurationSeconds: number
): TimelineSegment[] {
  if (filmDurationSeconds <= 0) return [];
  return scenes.map((scene, index) => ({
    ...scene,
    index,
    offset: scene.startSeconds / filmDurationSeconds,
    width: scene.durationSeconds / filmDurationSeconds,
  }));
}

/** Track position to film time. Clamped: a captured pointer keeps reporting
 *  past the element's edges. */
export function secondsAtFraction(
  fraction: number,
  filmDurationSeconds: number
): number {
  return Math.max(0, Math.min(1, fraction)) * filmDurationSeconds;
}

export function fractionAtSeconds(
  seconds: number,
  filmDurationSeconds: number
): number {
  if (filmDurationSeconds <= 0) return 0;
  return Math.max(0, Math.min(1, seconds / filmDurationSeconds));
}
```

- [ ] **Step 4: Run the test again**

```bash
npx vitest run --config tests/config/vitest.config.ts tests/unit/film-director/film-timeline-geometry.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/routes/test/film-director/_lib/film-timeline-geometry.ts tests/unit/film-director/film-timeline-geometry.test.ts
git commit -m "feat(director): timeline geometry" -- src/routes/test/film-director/_lib/film-timeline-geometry.ts tests/unit/film-director/film-timeline-geometry.test.ts
```

---

### Task 6: The timeline component

**Files:**
- Create: `src/routes/test/film-director/_components/FilmTimeline.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script lang="ts">
  import {
    buildTimelineSegments,
    fractionAtSeconds,
    secondsAtFraction,
  } from "../_lib/film-timeline-geometry";
  import { getFilmDirectorContext } from "../_lib/film-director-context";

  const director = getFilmDirectorContext();

  let trackEl = $state<HTMLElement | null>(null);
  let scrubbing = $state(false);
  let resumeAfterScrub = false;

  const segments = $derived(
    buildTimelineSegments(director.film.scenes, director.film.durationSeconds)
  );
  const playheadFraction = $derived(
    fractionAtSeconds(director.playheadSeconds, director.film.durationSeconds)
  );

  function seekToPointer(event: PointerEvent): void {
    const rect = trackEl?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    director.seek(
      secondsAtFraction(
        (event.clientX - rect.left) / rect.width,
        director.film.durationSeconds
      )
    );
  }

  // The playhead keeps advancing under rAF between pointer samples, so a drag
  // that did not pause would fight its own seeks. Pausing also stops scene
  // transitions from retriggering at every boundary the drag crosses.
  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    trackEl?.setPointerCapture(event.pointerId);
    scrubbing = true;
    resumeAfterScrub = director.wantsToPlay;
    director.pause();
    seekToPointer(event);
  }

  function onPointerMove(event: PointerEvent): void {
    if (scrubbing) seekToPointer(event);
  }

  function onPointerUp(event: PointerEvent): void {
    if (!scrubbing) return;
    scrubbing = false;
    trackEl?.releasePointerCapture(event.pointerId);
    if (resumeAfterScrub) director.play();
    resumeAfterScrub = false;
  }

  function onKeydown(event: KeyboardEvent): void {
    const step =
      event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (step === 0) return;
    event.preventDefault();
    director.seek(director.playheadSeconds + step * (event.shiftKey ? 5 : 1));
  }
</script>

<div
  class="timeline"
  bind:this={trackEl}
  role="slider"
  tabindex="0"
  aria-label="Film position"
  aria-valuemin={0}
  aria-valuemax={director.film.durationSeconds}
  aria-valuenow={Math.round(director.playheadSeconds)}
  aria-valuetext="{director.frame.scene.title}, {Math.round(
    director.playheadSeconds
  )} of {Math.round(director.film.durationSeconds)} seconds"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  onkeydown={onKeydown}
>
  {#each segments as segment (segment.id)}
    <div
      class="segment"
      class:current={segment.index === director.frame.sceneIndex}
      style:left="{segment.offset * 100}%"
      style:width="{segment.width * 100}%"
    >
      <!-- Jumping to a scene lands past its transition, which seeking to the
           same x would land inside, so the label is its own action rather than
           part of the drag. -->
      <button
        type="button"
        onpointerdown={(event) => event.stopPropagation()}
        onclick={() => director.selectScene(segment.index)}
      >
        <span class="segment-number">{String(segment.index + 1).padStart(2, "0")}</span>
        <span class="segment-title">{segment.title}</span>
      </button>
    </div>
  {/each}

  <div class="playhead" style:left="{playheadFraction * 100}%" aria-hidden="true"></div>
</div>

<style>
  .timeline {
    position: relative;
    min-width: 0;
    height: 2.75rem;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 0.7rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    cursor: pointer;
    touch-action: none;
  }

  .timeline:focus-visible {
    outline: 3px solid var(--theme-accent, #9d8cff);
    outline-offset: 2px;
  }

  .segment {
    position: absolute;
    top: 0;
    bottom: 0;
    min-width: 0;
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
  }

  .segment:last-child {
    border-right: 0;
  }

  .segment.current {
    background: color-mix(
      in srgb,
      var(--theme-accent, #7869eb) 22%,
      transparent
    );
  }

  .segment button {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    height: 100%;
    padding: 0 0.55rem;
    border: 0;
    color: inherit;
    background: transparent;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .segment button:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .segment button:focus-visible {
    outline: 2px solid var(--theme-accent, #9d8cff);
    outline-offset: -3px;
  }

  .segment-number {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }

  .segment-title {
    overflow: hidden;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: var(--theme-text, #fff);
    box-shadow: 0 0 0.5rem rgba(0, 0, 0, 0.6);
    pointer-events: none;
  }
</style>
```

- [ ] **Step 2: Typecheck**

```bash
npm run check:fast
```

Expected: no errors in `FilmTimeline.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/routes/test/film-director/_components/FilmTimeline.svelte
git commit -m "feat(director): segmented film timeline" -- src/routes/test/film-director/_components/FilmTimeline.svelte
```

---

### Task 7: The film panel

**Files:**
- Create: `src/routes/test/film-director/_components/FilmDirectorFilmPanel.svelte`

Built on `bits-ui`'s `Popover` directly. `ViewerPopover` wraps the same primitive but is bound to the viewer context's `PopoverId` union, and this is not a viewer control.

- [ ] **Step 1: Write the component**

```svelte
<script lang="ts">
  import { Popover } from "bits-ui";

  import { getFilmDirectorContext } from "../_lib/film-director-context";
  import { filmOriginIsSaved, filmOriginLabel, type FilmOrigin } from "../_lib/film-origin";

  let {
    origin,
    hasPreviousVersion = false,
    busy = false,
    onSave,
    onSaveAsNew,
    onRestore,
  }: {
    origin: FilmOrigin;
    hasPreviousVersion?: boolean;
    busy?: boolean;
    onSave: () => void;
    onSaveAsNew: () => void;
    onRestore: () => void;
  } = $props();

  const director = getFilmDirectorContext();

  let open = $state(false);

  const saved = $derived(filmOriginIsSaved(origin));
  const label = $derived(filmOriginLabel(origin, director.film.title));

  function run(action: () => void): void {
    open = false;
    action();
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger>
    {#snippet child({ props })}
      <button {...props} class="film-button" aria-label="Film">
        <i class="fas fa-clapperboard" aria-hidden="true"></i>
        <span>Film</span>
      </button>
    {/snippet}
  </Popover.Trigger>

  <Popover.Content side="top" align="end" sideOffset={10} collisionPadding={12}>
    {#snippet child({ props, open: isOpen })}
      {#if isOpen}
        <div {...props} class="film-panel">
          <header>
            <span class="kicker">{saved ? "Saved film" : "Starting point"}</span>
            <strong>{label}</strong>
          </header>

          <button type="button" disabled={busy} onclick={() => run(onSave)}>
            <i class="fas fa-floppy-disk" aria-hidden="true"></i>
            {saved ? "Save" : "Save film"}
          </button>

          {#if saved}
            <button type="button" disabled={busy} onclick={() => run(onSaveAsNew)}>
              <i class="fas fa-copy" aria-hidden="true"></i>
              Save as new
            </button>
          {/if}

          {#if hasPreviousVersion}
            <button type="button" disabled={busy} onclick={() => run(onRestore)}>
              <i class="fas fa-rotate-left" aria-hidden="true"></i>
              Restore previous version
            </button>
          {/if}

          <div class="divider" aria-hidden="true"></div>

          <button
            type="button"
            aria-pressed={director.editorOpen}
            onclick={() => run(director.toggleEditor)}
          >
            <i class="fas fa-code" aria-hidden="true"></i>
            Scene JSON
          </button>
        </div>
      {/if}
    {/snippet}
  </Popover.Content>
</Popover.Root>

<style>
  .film-button {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0 0.9rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 0.7rem;
    color: var(--theme-text, #fff);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 750;
    white-space: nowrap;
    cursor: pointer;
  }

  .film-button:hover {
    border-color: var(--theme-accent, #9d8cff);
  }

  .film-button:focus-visible {
    outline: 3px solid var(--theme-accent, #9d8cff);
    outline-offset: 2px;
  }

  .film-panel {
    z-index: 80;
    display: grid;
    gap: 0.35rem;
    width: min(20rem, calc(100vw - 1.5rem));
    padding: 0.75rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 0.9rem;
    color: var(--theme-text, #fff);
    background: var(--theme-panel-bg, #10111b);
    box-shadow: 0 1.5rem 3rem rgba(0, 0, 0, 0.45);
  }

  header {
    display: grid;
    gap: 0.15rem;
    padding: 0 0.25rem 0.5rem;
  }

  .kicker {
    color: var(--theme-accent, #b0a4ff);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .film-panel button {
    display: flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.6rem;
    padding: 0 0.7rem;
    border: 1px solid transparent;
    border-radius: 0.6rem;
    color: inherit;
    background: transparent;
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    text-align: left;
    cursor: pointer;
  }

  .film-panel button:hover:not(:disabled) {
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.14));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
  }

  .film-panel button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .film-panel button:focus-visible {
    outline: 3px solid var(--theme-accent, #9d8cff);
    outline-offset: -2px;
  }

  .film-panel button i {
    width: 1rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    text-align: center;
  }

  .divider {
    height: 1px;
    margin: 0.3rem 0.25rem;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.14));
  }
</style>
```

- [ ] **Step 2: Typecheck**

```bash
npm run check:fast
```

Expected: no errors in `FilmDirectorFilmPanel.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/routes/test/film-director/_components/FilmDirectorFilmPanel.svelte
git commit -m "feat(director): film panel owning save and Scene JSON" -- src/routes/test/film-director/_components/FilmDirectorFilmPanel.svelte
```

---

### Task 8: Rebuild the transport as one row

**Files:**
- Modify: `src/routes/test/film-director/_components/FilmDirectorTransport.svelte`
- Modify: `src/routes/test/film-director/_components/FilmDirectorWorkbench.svelte`

- [ ] **Step 1: Replace the transport**

Replace the whole of `FilmDirectorTransport.svelte` with:

```svelte
<script lang="ts">
  import type { Snippet } from "svelte";

  import TransportControls from "$lib/shared/animation-engine/components/controls/TransportControls.svelte";
  import { getFilmDirectorContext } from "../_lib/film-director-context";
  import FilmTimeline from "./FilmTimeline.svelte";

  // The host's film panel. It lives in this row because the row renders at
  // every width, unlike the scene control rail, which the compact layout
  // replaces wholesale.
  let { trailing }: { trailing?: Snippet } = $props();

  const director = getFilmDirectorContext();

  // The scene control rail has to sit clear of this bar. What it needs is not
  // the height but the reserve: the distance from the bottom of the stage to
  // the top of the transport, which folds in the bottom inset and the borders.
  let transportEl = $state<HTMLElement | null>(null);
  let measuredHeight = $state(0);
  $effect(() => {
    // measuredHeight is read only to re-run this when the row changes height.
    void measuredHeight;
    const stage = transportEl?.offsetParent as HTMLElement | null;
    if (!transportEl || !stage) return;
    document.documentElement.style.setProperty(
      "--director-transport-reserve",
      `${stage.clientHeight - transportEl.offsetTop}px`
    );
  });

  function formatTime(seconds: number): string {
    const whole = Math.max(0, Math.floor(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  }
</script>

<div
  class="transport"
  aria-label="Film playback controls"
  bind:this={transportEl}
  bind:clientHeight={measuredHeight}
>
  <!-- wantsToPlay, not isPlaying: the director suspends isPlaying during scene
       preparation and transition holds while intent stays true, so isPlaying
       would show Play during a hold and the click would cancel playback the
       user already asked for. -->
  <TransportControls
    isPlaying={director.wantsToPlay}
    onPlaybackToggle={director.togglePlayback}
    onStepFullBeatBackward={director.previousScene}
    onStepFullBeatForward={director.nextScene}
  />

  <FilmTimeline />

  <span class="timecode">
    <span class="sizer" aria-hidden="true">00:00 / 00:00</span>
    <span class="live">
      {formatTime(director.playheadSeconds)} / {formatTime(
        director.film.durationSeconds
      )}
    </span>
  </span>

  {#if trailing}{@render trailing()}{/if}
</div>

<style>
  .transport {
    position: absolute;
    right: max(0.75rem, env(safe-area-inset-right));
    bottom: max(0.75rem, env(safe-area-inset-bottom));
    left: max(0.75rem, env(safe-area-inset-left));
    z-index: 70;
    display: grid;
    grid-template-columns: auto minmax(8rem, 1fr) auto auto;
    align-items: center;
    gap: 0.65rem;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 1rem;
    color: var(--theme-text, #fff);
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, #10111b) 94%,
      transparent
    );
    box-shadow: 0 1rem 3.5rem rgba(0, 0, 0, 0.38);
  }

  /* The elapsed half changes every frame and the total changes per film, so the
     cell is sized to the widest value rather than to whatever is showing —
     otherwise crossing 0:59 shoves the film button. */
  .timecode {
    display: inline-grid;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .timecode .sizer,
  .timecode .live {
    grid-area: 1 / 1;
  }

  .timecode .sizer {
    visibility: hidden;
  }

  @media (max-width: 44rem) {
    .transport {
      grid-template-columns: auto minmax(4rem, 1fr) auto;
      gap: 0.45rem;
      padding: 0.5rem 0.6rem;
    }

    .timecode {
      display: none;
    }
  }
</style>
```

- [ ] **Step 2: Pass the film panel in, and delete the header actions**

In `FilmDirectorWorkbench.svelte`, add the import:

```ts
  import FilmDirectorFilmPanel from "./FilmDirectorFilmPanel.svelte";
```

Add a derived for the restore affordance:

```ts
  const previousVersionAvailable = $derived(
    Boolean(currentEntry()?.previousFilm)
  );
```

Replace `<FilmDirectorTransport />` with:

```svelte
  <FilmDirectorTransport>
    {#snippet trailing()}
      <FilmDirectorFilmPanel
        {origin}
        hasPreviousVersion={previousVersionAvailable}
        busy={saveBusy}
        onSave={saveFilm}
        onSaveAsNew={openSaveModal}
        onRestore={restorePreviousFilm}
      />
    {/snippet}
  </FilmDirectorTransport>
```

Delete the `.film-actions` block (the two buttons) and the `{#if shelfOpen}` /
`.film-shelf` block from the markup, plus their `.film-actions`,
`.film-actions button`, `.film-actions .badge`, and `.film-shelf` style rules
and the two narrow-layout overrides for them. Delete the now-unused `shelfOpen`
state, the `filmActionsEl` / `filmActionsHeight` bindings, and the
`FilmCollectionModule` import.

The `--director-header-reserve` effect stays for now — the titleplate still
uses it. It goes in Task 10.

- [ ] **Step 3: Typecheck**

```bash
npm run check:fast
```

Expected: no errors in either file, and no unused-import warnings.

- [ ] **Step 4: Verify the row and the clearance**

Load `https://localhost:5173/test/film-director?film=star` in the shared debug
browser (`pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank`),
`emulate` at `1920x1080x1`, and run:

```js
const t = document.querySelector('[aria-label="Film playback controls"]').getBoundingClientRect();
const rail = document.querySelector('[role="toolbar"][aria-label="Scene controls"]').getBoundingClientRect();
JSON.stringify({ transportHeight: t.height, gapAboveTransport: t.top - rail.bottom });
```

Expected: `transportHeight` under 70, `gapAboveTransport` positive.

- [ ] **Step 5: Commit**

```bash
git add src/routes/test/film-director/_components/FilmDirectorTransport.svelte src/routes/test/film-director/_components/FilmDirectorWorkbench.svelte
git commit -m "feat(director): one-row transport on the canonical controls" -- src/routes/test/film-director/_components/FilmDirectorTransport.svelte src/routes/test/film-director/_components/FilmDirectorWorkbench.svelte
```

---

### Task 9: The marquee

**Files:**
- Create: `src/routes/test/film-director/_components/FilmDirectorMarquee.svelte`

- [ ] **Step 1: Write the component**

```svelte
<script lang="ts">
  import FilmCollectionModule from "$lib/features/film-collection/FilmCollectionModule.svelte";
  import type { CollectedFilm } from "$lib/features/film-collection/domain/film-collection-types";
  import { resolveFilmDirectorSpec } from "../_lib/resolve-film-director-spec";
  import { FILM_LIBRARY } from "../_films/index";

  let {
    onOpenLibraryFilm,
    onOpenSavedFilm,
  }: {
    onOpenLibraryFilm: (key: string) => void;
    onOpenSavedFilm: (entry: CollectedFilm) => void;
  } = $props();

  // A library film has no stored poster or denormalized meta, so the card's
  // chips come from resolving it. Five short documents, resolved once.
  const startingPoints = FILM_LIBRARY.map((entry) => {
    const spec = resolveFilmDirectorSpec(entry.film);
    return {
      key: entry.key,
      label: entry.label,
      sceneCount: spec.scenes.length,
      durationSeconds: spec.durationSeconds,
    };
  });

  function formatDuration(seconds: number): string {
    const whole = Math.round(seconds);
    const minutes = Math.floor(whole / 60);
    const rest = whole % 60;
    return minutes > 0 ? `${minutes}:${String(rest).padStart(2, "0")}` : `${rest}s`;
  }

  // The collection is started by the route, which needs it loaded before this
  // component mounts in order to resolve a ?film=saved: link.
</script>

<main class="marquee">
  <header class="marquee-header">
    <span class="kicker">Director</span>
    <h1>Films</h1>
  </header>

  <section aria-labelledby="starting-points">
    <h2 id="starting-points">Starting points</h2>
    <ul class="card-grid">
      {#each startingPoints as film (film.key)}
        <li>
          <button type="button" onclick={() => onOpenLibraryFilm(film.key)}>
            <strong>{film.label}</strong>
            <span class="meta">
              {film.sceneCount === 1 ? "1 scene" : `${film.sceneCount} scenes`}
              <span aria-hidden="true">·</span>
              {formatDuration(film.durationSeconds)}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  </section>

  <section aria-labelledby="saved-films">
    <h2 id="saved-films">Saved films</h2>
    <FilmCollectionModule onopen={onOpenSavedFilm} />
  </section>
</main>

<style>
  .marquee {
    min-height: 100dvh;
    padding: clamp(1.5rem, 4vw, 3rem) 0 clamp(3rem, 8vw, 6rem);
    overflow-y: auto;
    color: var(--theme-text, #fff);
    background: #070812;
  }

  .marquee > * {
    width: var(--shell-w, min(1720px, 92vw));
    margin: 0 auto;
  }

  .marquee-header {
    margin-bottom: clamp(1.5rem, 3vw, 2.5rem);
  }

  .kicker {
    color: var(--theme-accent, #b0a4ff);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0.25rem 0 0;
    font-size: clamp(1.9rem, 4vw, 3rem);
    line-height: 1.1;
  }

  section + section {
    margin-top: clamp(2rem, 5vw, 3.5rem);
  }

  h2 {
    margin: 0 0 1rem;
    font-size: clamp(1.05rem, 1.6vw, 1.4rem);
  }

  /* Pinned counts, not auto-fill: five known cards against a minmax floor
     strands the fifth on its own row as the viewport grows. */
  .card-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  @media (min-width: 48rem) {
    .card-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (min-width: 105rem) {
    .card-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
  }

  .card-grid button {
    display: grid;
    gap: 0.45rem;
    width: 100%;
    min-height: 8.5rem;
    align-content: end;
    padding: 1.1rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 1rem;
    color: inherit;
    background: linear-gradient(
      160deg,
      color-mix(in srgb, var(--theme-accent, #7869eb) 16%, transparent),
      var(--theme-card-bg, rgba(255, 255, 255, 0.05))
    );
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .card-grid button:hover {
    border-color: var(--theme-accent, #9d8cff);
  }

  .card-grid button:focus-visible {
    outline: 3px solid var(--theme-accent, #9d8cff);
    outline-offset: 2px;
  }

  .card-grid strong {
    font-size: clamp(1rem, 1.2vw, 1.2rem);
  }

  .meta {
    display: flex;
    gap: 0.3rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }
</style>
```

- [ ] **Step 2: Confirm the resolver's export name**

```bash
grep -n "^export function resolveFilmDirectorSpec\|^export const resolveFilmDirectorSpec" src/routes/test/film-director/_lib/resolve-film-director-spec.ts
```

Expected: one hit. If the exported name differs, use the actual one.

- [ ] **Step 3: Typecheck**

```bash
npm run check:fast
```

Expected: no errors in `FilmDirectorMarquee.svelte`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/test/film-director/_components/FilmDirectorMarquee.svelte
git commit -m "feat(director): film marquee" -- src/routes/test/film-director/_components/FilmDirectorMarquee.svelte
```

---

### Task 10: Flip the route over

The largest task: the route gains the mode decision, the workbench takes its film as a prop, and the remaining scaffolding chrome comes out. These land together because the workbench's prop signature and the route's decision are one change.

**Files:**
- Modify: `src/routes/test/film-director/+page.svelte`
- Modify: `src/routes/test/film-director/_components/FilmDirectorWorkbench.svelte`

- [ ] **Step 1: Give the workbench props**

At the top of `FilmDirectorWorkbench.svelte`'s script, replace the URL-reading
block (`requestedFilm`, `initialFilmKey`, and the `director` construction) with:

```ts
  let {
    film,
    initialOrigin,
    onExit,
  }: {
    film: FilmDirectorInput;
    initialOrigin: FilmOrigin;
    /** Back to the marquee. The route owns which surface is showing. */
    onExit: () => void;
  } = $props();

  const director = createFilmDirectorState(film);
  setFilmDirectorContext(director);

  let origin = $state<FilmOrigin>(initialOrigin);
```

Delete: the `parseFilmKey` import and its use, `pendingSavedId` and its
`$effect`, `selectFilm`, `filmOptions`, `FILM_SHORT_LABELS`, the
`SegmentedControl` import, `getLibraryFilm`/`DEFAULT_FILM_KEY`/`FILM_LIBRARY`
imports, and `openSavedFilm`.

Reduce `onMount` to:

```ts
  onMount(() => {
    filmCollectionState.initLocal();
    syncFilmToUrl(origin);
    return director.start();
  });
```

- [ ] **Step 2: Delete the remaining scaffolding chrome**

From the markup, delete the whole `.top-left` block (wrapper, `.titleplate`, and
`.film-picker`) and the `.readiness` block. From the styles, delete `.top-left`,
`.film-picker`, `.film-picker-track`, `.titleplate`, `.film-name`, the `h1, p` /
`h1` / `p` rules, `.readiness`, `.readiness span`, `.readiness.ready span`, and
every reference to those selectors inside the two `@container` blocks.

Delete the `--director-header-reserve` `$effect` and the `topLeftEl` /
`topLeftHeight` bindings.

Add the exit control as the first child of `<main>`, after `<FilmDirectorScene />`:

```svelte
  <button class="exit-button" type="button" onclick={onExit}>
    <i class="fas fa-arrow-left" aria-hidden="true"></i>
    <span>Films</span>
  </button>
```

```css
  /* The way out of the stage is a labeled button that is always on screen —
     not a glyph, not a hover reveal, and not inside the film popover. */
  .exit-button {
    position: absolute;
    top: max(0.85rem, env(safe-area-inset-top));
    left: max(0.85rem, env(safe-area-inset-left));
    z-index: 65;
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.9rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 999px;
    color: var(--theme-text, #fff);
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, #10111b) 88%,
      transparent
    );
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 700;
    cursor: pointer;
  }

  .exit-button:hover {
    border-color: var(--theme-accent, #9d8cff);
  }

  .exit-button:focus-visible {
    outline: 3px solid var(--theme-accent, #9d8cff);
    outline-offset: 2px;
  }
```

Reposition `.edit-error`, whose narrow layout anchored to the deleted custom
property. Change its `top` from
`calc(var(--director-header-reserve, 12rem) + 0.65rem)` to:

```css
    top: calc(max(0.85rem, env(safe-area-inset-top)) + 3.6rem);
```

and change its `right` to clear the rail:

```css
    right: max(4.75rem, calc(env(safe-area-inset-right) + 4.75rem));
```

The existing `@media (min-width: 64rem)` branch that parks it above the
transport is unchanged.

- [ ] **Step 3: Put the decision in the route**

In `+page.svelte`, replace the script with:

```svelte
<script lang="ts">
  import { onMount } from "svelte";

  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import type { CollectedFilm } from "$lib/features/film-collection/domain/film-collection-types";
  import { filmCollectionState } from "$lib/features/film-collection/state/film-collection-state.svelte";
  import FilmDirectorMarquee from "./_components/FilmDirectorMarquee.svelte";
  import { getLibraryFilm } from "./_films/index";
  import type { FilmDirectorInput } from "./_lib/film-director-schema";
  import { parseFilmKey } from "./_lib/film-key";
  import type { FilmOrigin } from "./_lib/film-origin";

  type WorkbenchComponent =
    typeof import("./_components/FilmDirectorWorkbench.svelte").default;

  type Stage = { film: FilmDirectorInput; origin: FilmOrigin };

  let Workbench = $state<WorkbenchComponent | null>(null);
  let loadError = $state<string | null>(null);
  let stage = $state<Stage | null>(null);

  const requested = parseFilmKey(page.url.searchParams.get("film"));

  // A saved link waits on the marquee while the collection loads rather than
  // booting an unrelated film and swapping it out. A link to an entry the user
  // cannot see simply stays on the marquee.
  let pendingSavedId = $state<string | null>(
    requested.kind === "saved" ? requested.id : null
  );

  if (requested.kind === "library") {
    stage = {
      film: getLibraryFilm(requested.key),
      origin: { kind: "library", key: requested.key },
    };
  }

  $effect(() => {
    const id = pendingSavedId;
    if (!id || filmCollectionState.loading) return;
    const entry = filmCollectionState.collection.find((item) => item.id === id);
    pendingSavedId = null;
    if (entry) openSavedFilm(entry);
  });

  function openLibraryFilm(key: string): void {
    stage = { film: getLibraryFilm(key), origin: { kind: "library", key } };
  }

  function openSavedFilm(entry: CollectedFilm): void {
    // The entry is a $state proxy and the director structuredClones its input,
    // which throws on a proxy. Snapshot to a plain object first.
    stage = {
      film: $state.snapshot(entry.film) as unknown as FilmDirectorInput,
      origin: { kind: "saved", id: entry.id, name: entry.name },
    };
  }

  function exitToMarquee(): void {
    stage = null;
    const url = new URL(window.location.href);
    url.searchParams.delete("film");
    replaceState(url, {});
  }

  onMount(() => {
    // This route owns starting the collection: the marquee's saved-films list
    // and the ?film=saved: resolution both read it, and FilmCollectionModule
    // does not start it itself.
    filmCollectionState.initLocal();

    let active = true;
    void import("./_components/FilmDirectorWorkbench.svelte")
      .then(({ default: component }) => {
        if (active) Workbench = component;
      })
      .catch((error: unknown) => {
        if (!active) return;
        loadError = error instanceof Error ? error.message : String(error);
      });

    return () => {
      active = false;
    };
  });
</script>
```

Replace the markup between `</svelte:head>` and `<style>` with:

```svelte
{#if !stage}
  <FilmDirectorMarquee
    onOpenLibraryFilm={openLibraryFilm}
    onOpenSavedFilm={openSavedFilm}
  />
{:else if Workbench}
  {#key stage.origin}
    <Workbench
      film={stage.film}
      initialOrigin={stage.origin}
      onExit={exitToMarquee}
    />
  {/key}
{:else}
  <main class="loading-shell">…</main>
{/if}
```

In that last branch, keep the file's existing `.loading-shell` / `.loading-card`
markup and its `loadError` handling exactly as they are — only its position in
the `{#if}` chain changes. The `<style>` block is unchanged.

The `{#key}` is load-bearing: `createFilmDirectorState` runs once per instance,
so switching films has to remount the workbench.

- [ ] **Step 4: Typecheck**

```bash
npm run check:fast
```

Expected: no errors in either file, and no unused imports left behind.

- [ ] **Step 5: Verify the four URL cases**

With the dev server running, check each:

| URL | Expected |
| --- | --- |
| `/test/film-director` | marquee; URL does **not** become `?film=sky` |
| `/test/film-director?film=star` | stage, Star of Five |
| `/test/film-director?film=saved:<real id>` | marquee briefly, then that film |
| `/test/film-director?film=saved:nope` | marquee, stays there |

Then click a starting-point card, confirm the stage loads and the URL stamps,
click **Films**, and confirm the marquee returns with `?film=` removed.

- [ ] **Step 6: Commit**

```bash
git add src/routes/test/film-director/+page.svelte src/routes/test/film-director/_components/FilmDirectorWorkbench.svelte
git commit -m "feat(director): marquee front door, stage without the scaffolding" -- src/routes/test/film-director/+page.svelte src/routes/test/film-director/_components/FilmDirectorWorkbench.svelte
```

---

### Task 11: Free the rail and suppress Save scene

**Files:**
- Modify: `src/routes/test/film-director/_components/FilmDirectorScene.svelte`

- [ ] **Step 1: Fix the workspace props**

`topOffset` currently reads a custom property that Task 10 stopped setting, so
it would freeze at the `12rem` fallback. Remove it and opt out of Save scene.
Change the `<SceneControlWorkspace .../>` call to:

```svelte
  <!-- Outside .director-scene, which is aria-hidden: the control workspace is
       the one interactive thing over the stage and has to stay reachable. It
       renders here rather than in the workbench because it reads the viewer
       context this component establishes.

       No topOffset: the stage's exit button sits in the top-left, clear of the
       right-edge rail, so the workspace's own default applies. bottomOffset is
       the transport's measured band. allowSaveScene is off because this host's
       artifact is the film document, and the film panel owns saving it. -->
  {#if director.preparation.complete}
    <SceneControlWorkspace
      bottomOffset="calc(var(--director-transport-reserve, 9.5rem) + 0.75rem)"
      allowSaveScene={false}
      onPerformerEdit={handlePerformerEdit}
      onInspectorChange={handleInspectorChange}
    />
  {/if}
```

- [ ] **Step 2: Prove there is exactly one save**

At `1920x1080x1` on `?film=star`, open the rail's Presets tool, then run:

```js
JSON.stringify({
  railSave: document.querySelectorAll("[data-save-shortcut]").length,
  filmButtons: [...document.querySelectorAll("button")].filter(
    (b) => b.getAttribute("aria-label") === "Film"
  ).length,
  saveSceneDialogs: document.querySelectorAll('[role="dialog"]').length,
});
```

Expected: `railSave: 0`, `filmButtons: 1`.

- [ ] **Step 3: Confirm the rail sits clear**

```js
const rail = document.querySelector('[role="toolbar"][aria-label="Scene controls"]').getBoundingClientRect();
const t = document.querySelector('[aria-label="Film playback controls"]').getBoundingClientRect();
JSON.stringify({ railTop: rail.top, gapAbove: t.top - rail.bottom, hugsRight: innerWidth - rail.right });
```

Expected: `railTop` near 12 (not ~200, which is the 12rem fallback), `gapAbove`
positive, `hugsRight` small and positive.

- [ ] **Step 4: Commit**

```bash
git add src/routes/test/film-director/_components/FilmDirectorScene.svelte
git commit -m "feat(director): rail takes its own offsets and drops Save scene" -- src/routes/test/film-director/_components/FilmDirectorScene.svelte
```

---

### Task 12: Verification pass

No code. This is the gate before calling it done, per
`.claude/rules/visual-verification-mandatory.md`.

- [ ] **Step 1: Run the film-director and film-collection suites**

```bash
npx vitest run --config tests/config/vitest.config.ts tests/unit/film-director tests/unit/film-collection
```

Expected: all pass. Note any pre-existing failures separately rather than
claiming them.

- [ ] **Step 2: Full typecheck**

Check nothing else is running first (`.claude/rules/resource-budget.md`):

```bash
npm run check > /tmp/check.log 2>&1; grep -niE "error" /tmp/check.log
```

Expected: no errors in any file this plan touched.

- [ ] **Step 3: Measure before shooting**

For each of 3840×2160, 2560×1440, 1920×1080, 1440×900, 820×1180, 960×412, and
375×667, on both the marquee and `?film=star`:

```js
const t = document.querySelector('[aria-label="Film playback controls"]');
const rail = document.querySelector('[role="toolbar"][aria-label="Scene controls"]');
const bar = document.querySelector(".bar-cluster");
const tr = t?.getBoundingClientRect();
JSON.stringify({
  docScrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  transportHeight: tr?.height,
  gapAboveTransport: rail && tr ? tr.top - rail.getBoundingClientRect().bottom : null,
  compactGap: bar && tr ? tr.top - bar.getBoundingClientRect().bottom : null,
});
```

Expected at every size: `docScrollsX` false; whichever of `gapAboveTransport` or
`compactGap` is non-null is positive.

On the marquee, confirm no stranded row:

```js
const items = [...document.querySelectorAll(".card-grid li")];
const rows = new Set(items.map((el) => Math.round(el.getBoundingClientRect().top)));
JSON.stringify({ rows: rows.size, lastRowCount: items.filter((el) =>
  Math.round(el.getBoundingClientRect().top) === Math.max(...rows)).length });
```

Expected: `lastRowCount` never 1 while `rows` is greater than 1.

- [ ] **Step 4: Screenshot and read every frame**

`format: "webp", quality: 70`, both surfaces, all seven viewports. Check each
against the list in `visual-verification-mandatory.md` — absurdly wide controls,
dead space, orphans, a page that dead-ends in the top third at 3840, legibility
at real scale. Fix what the frames show and re-shoot.

- [ ] **Step 5: Behavior checks**

1. Drag the timeline while playing: it pauses, seeks continuously, resumes on
   release, and does not retrigger a scene transition at each boundary crossed.
2. Click a segment label: it jumps to that scene and does not start a drag.
3. Keyboard: focus the timeline, arrow keys step 1s, shift-arrow 5s.
4. Save an unsaved film, save it again, then Restore, then Restore again — the
   document goes back and forth and `id` / `name` / `createdAt` never change.

- [ ] **Step 6: Deliver**

Open `https://localhost:5173/test/film-director` in the in-app Browser pane
(`.claude/rules/deliver-in-the-app-browser.md`), state what it is pointed at,
and end the message with the clickable link.

---

## Known follow-ons

Out of scope here, recorded so they are not mistaken for gaps:

- **`firestore.rules` is committed but not deployed.** The
  `users/{uid}/film-collection` block exists and has not shipped, so signed-in
  saves fail with a permissions error while guest saves work off localStorage.
  Deploy before treating save as working for anyone signed in.
- **Compact stage.** The rail's tools are already unreachable in compact, which
  this plan does not change; it only keeps the Director's own controls out of
  that hole by putting them in the transport.
- **Into the app.** The marquee is the gallery a Films card on the Library Art
  shelf would open, next to Tunnels, 3D Scenes, and Mandalas. Admin gating and
  the route move go with it.

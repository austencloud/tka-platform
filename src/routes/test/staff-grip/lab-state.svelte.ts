/**
 * The lab's state IS its URL.
 *
 * Every axis a person can change here — the character, the prop, the prop
 * length, the sequence, where in that sequence we are, whether it is running,
 * which cameras are up, which inspector is open — lives in the query string.
 * Copying the address bar and pasting it somewhere else reproduces the exact
 * moment, which is the only way a cross-body / cross-prop finding can be
 * handed to another person without a paragraph of setup instructions.
 *
 * One direction of flow: the URL is read into derived values, and every
 * setter writes the URL. Nothing keeps a private copy of an axis, so the two
 * can never disagree. `phase` is the single exception and it is explained on
 * its own accessor.
 */
import { browser } from "$app/environment";
import { page } from "$app/state";

import { mutateCurrentUrl } from "$lib/shared/navigation/services/url-state";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { CharacterId } from "$lib/shared/3d/domain/character-model";

import {
  DEFAULT_LAB_CHARACTER_ID,
  DEFAULT_LAB_SEQUENCE_ID,
  isLabCharacterId,
  isLabPropType,
} from "./lab-catalog";
import { INSPECTION_VIEWS } from "./inspection-framing";

export const LAB_PARAM = {
  character: "character",
  prop: "prop",
  length: "length",
  sequence: "seq",
  phase: "phase",
  playing: "play",
  view: "view",
  panel: "panel",
  labels: "labels",
} as const;

/** Camera layout: the four-pane rig, or one pane on its own. */
export type LabView = "quad" | (typeof INSPECTION_VIEWS)[number]["id"];

const VIEW_IDS: readonly string[] = [
  "quad",
  ...INSPECTION_VIEWS.map((view) => view.id),
];

/** Which inspector the console rail is showing. */
export const LAB_PANELS = ["fit", "grip", "turn", "matrix"] as const;
export type LabPanel = (typeof LAB_PANELS)[number];

/**
 * `body` asks the renderer for the length this body can actually hold inside
 * its own hug; a number pins the prop at that many centimetres regardless of
 * who is holding it. Both are needed: the first is the product's behaviour,
 * the second is how you hold one variable still while sweeping the other.
 */
export type LabPropLength = "body" | number;

export const DEFAULT_LAB_PHASE = 7.99;

/** Supported prop length band, matching the hug fit's own bounds. */
export const LAB_LENGTH_MIN_CM = 61;
export const LAB_LENGTH_MAX_CM = 152;

function clampPhase(value: number, stepCount: number): number {
  if (!Number.isFinite(value)) return 0;
  const span = Math.max(stepCount, 1);
  const wrapped = ((value % span) + span) % span;
  return Math.min(wrapped, span - 0.01);
}

function formatPhase(value: number): string {
  return value.toFixed(2);
}

export interface StaffLabStateOptions {
  /** Steps in the loaded sequence, so phase can clamp to it. */
  stepCount: () => number;
}

export class StaffLabState {
  readonly #stepCount: () => number;

  /**
   * Phase is the one axis that changes continuously, so it cannot be read
   * straight off the URL: a running clock would issue a history write every
   * frame. It is mirrored locally, written on a short coalescing timer, and
   * flushed the instant it stops moving or the window loses focus — which is
   * exactly when someone reaches for the address bar. A URL change that did
   * not come from this mirror (a reload, Back, or a pasted link) is adopted.
   */
  #phase = $state(DEFAULT_LAB_PHASE);
  #phaseWrittenParam: string | null = null;
  #phaseFlushTimer: ReturnType<typeof setTimeout> | null = null;
  #adopted = false;

  constructor(options: StaffLabStateOptions) {
    this.#stepCount = options.stepCount;
  }

  readonly character = $derived.by((): CharacterId => {
    const raw = page.url.searchParams.get(LAB_PARAM.character);
    return raw && isLabCharacterId(raw) ? raw : DEFAULT_LAB_CHARACTER_ID;
  });

  readonly prop = $derived.by((): PropType => {
    const raw = page.url.searchParams.get(LAB_PARAM.prop);
    return raw && isLabPropType(raw) ? raw : PropType.STAFF;
  });

  readonly propLength = $derived.by((): LabPropLength => {
    const raw = page.url.searchParams.get(LAB_PARAM.length);
    if (!raw || raw === "body") return "body";
    const cm = Number(raw);
    if (!Number.isFinite(cm)) return "body";
    return Math.min(LAB_LENGTH_MAX_CM, Math.max(LAB_LENGTH_MIN_CM, cm));
  });

  readonly sequenceId = $derived(
    page.url.searchParams.get(LAB_PARAM.sequence) ?? DEFAULT_LAB_SEQUENCE_ID
  );

  readonly playing = $derived(
    page.url.searchParams.get(LAB_PARAM.playing) === "1"
  );

  readonly view = $derived.by((): LabView => {
    const raw = page.url.searchParams.get(LAB_PARAM.view);
    return raw && VIEW_IDS.includes(raw) ? (raw as LabView) : "quad";
  });

  readonly panel = $derived.by((): LabPanel => {
    const raw = page.url.searchParams.get(LAB_PARAM.panel);
    return raw && (LAB_PANELS as readonly string[]).includes(raw)
      ? (raw as LabPanel)
      : "fit";
  });

  /** Grid point labels in the wide reference pane. Off is opt-in. */
  readonly gridLabels = $derived(
    page.url.searchParams.get(LAB_PARAM.labels) !== "0"
  );

  get phase(): number {
    return this.#phase;
  }

  /**
   * Adopt a phase this state owner did not write. Call from an effect so a
   * reload, a Back, or a pasted link lands on the frame it names.
   */
  adoptUrlPhase(): void {
    const raw = page.url.searchParams.get(LAB_PARAM.phase);
    if (this.#adopted && raw === this.#phaseWrittenParam) return;
    this.#adopted = true;
    this.#phaseWrittenParam = raw;
    const next = raw === null ? DEFAULT_LAB_PHASE : Number(raw);
    this.#phase = clampPhase(next, this.#stepCount());
  }

  /**
   * Continuous phase movement — playback ticks and slider drags. Coalesced so
   * a running clock writes history roughly five times a second rather than
   * sixty, and always as a replace so scrubbing never fills the Back stack.
   */
  setPhase(next: number): void {
    this.#phase = clampPhase(next, this.#stepCount());
    if (this.#phaseFlushTimer !== null) return;
    this.#phaseFlushTimer = setTimeout(() => {
      this.#phaseFlushTimer = null;
      this.flushPhase();
    }, 180);
  }

  /** Write the exact current phase now. */
  flushPhase(): void {
    if (this.#phaseFlushTimer !== null) {
      clearTimeout(this.#phaseFlushTimer);
      this.#phaseFlushTimer = null;
    }
    const formatted = formatPhase(this.#phase);
    this.#phaseWrittenParam = formatted;
    this.#write((params) => params.set(LAB_PARAM.phase, formatted), "replace");
  }

  setCharacter(id: CharacterId): void {
    this.#write((params) => params.set(LAB_PARAM.character, id), "push");
  }

  setProp(prop: PropType): void {
    this.#write((params) => params.set(LAB_PARAM.prop, prop), "push");
  }

  setPropLength(length: LabPropLength): void {
    // A centimetre value arrives from a slider, so it replaces rather than
    // stacking one history entry per pixel of drag.
    this.#write(
      (params) =>
        params.set(
          LAB_PARAM.length,
          length === "body" ? "body" : length.toFixed(0)
        ),
      length === "body" ? "push" : "replace"
    );
  }

  setSequence(id: string): void {
    // A different sequence has a different length, so the frame we were on no
    // longer names the same moment. Start it at the top.
    this.#phaseWrittenParam = "0.00";
    this.#phase = 0;
    this.#write((params) => {
      params.set(LAB_PARAM.sequence, id);
      params.set(LAB_PARAM.phase, "0.00");
    }, "push");
  }

  setPlaying(playing: boolean): void {
    // Pausing pins the exact frame first, so the paused URL is the frame on
    // screen rather than whatever the last coalesced write happened to catch.
    if (!playing) this.flushPhase();
    this.#write(
      (params) => params.set(LAB_PARAM.playing, playing ? "1" : "0"),
      "replace"
    );
  }

  setView(view: LabView): void {
    this.#write((params) => params.set(LAB_PARAM.view, view), "push");
  }

  setPanel(panel: LabPanel): void {
    this.#write((params) => params.set(LAB_PARAM.panel, panel), "replace");
  }

  setGridLabels(enabled: boolean): void {
    this.#write(
      (params) => params.set(LAB_PARAM.labels, enabled ? "1" : "0"),
      "replace"
    );
  }

  /**
   * Write every axis explicitly, including the ones currently sitting on
   * their default. A link that omits defaults still restores correctly, but a
   * link that names them survives a change of default — which matters when
   * the whole point is pasting a finding into a conversation.
   */
  fullyQualifiedHref(): string {
    // Built from `page.url` rather than `window.location`, so the link is a
    // reactive value a template can render and a test can read, not a
    // snapshot that only exists at the moment a button was pressed.
    const url = new URL(page.url);
    const params = url.searchParams;
    params.set(LAB_PARAM.character, this.character);
    params.set(LAB_PARAM.prop, this.prop);
    params.set(
      LAB_PARAM.length,
      this.propLength === "body" ? "body" : this.propLength.toFixed(0)
    );
    params.set(LAB_PARAM.sequence, this.sequenceId);
    params.set(LAB_PARAM.phase, formatPhase(this.#phase));
    params.set(LAB_PARAM.playing, this.playing ? "1" : "0");
    params.set(LAB_PARAM.view, this.view);
    params.set(LAB_PARAM.panel, this.panel);
    params.set(LAB_PARAM.labels, this.gridLabels ? "1" : "0");
    return url.href;
  }

  /** Flush a moving phase when the window loses focus — the copy gesture. */
  attachFlushOnBlur(): () => void {
    if (!browser) return () => {};
    const flush = () => this.flushPhase();
    window.addEventListener("blur", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("blur", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }

  #write(
    mutate: (params: URLSearchParams) => void,
    mode: "push" | "replace"
  ): void {
    mutateCurrentUrl((url) => mutate(url.searchParams), { mode });
  }
}

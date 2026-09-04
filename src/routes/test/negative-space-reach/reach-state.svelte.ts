/**
 * The reach lab's state IS its URL.
 *
 * Every axis a person can change — the body, where in the reach we are,
 * whether it is running, which angle is up, whether the measurement overlay
 * draws — lives in the query string, so a finding can be handed over as a link
 * instead of a paragraph of setup instructions. That matters more here than in
 * most labs: the point of the page is disagreement about a specific frame.
 *
 * One direction of flow. The URL is read into derived values and every setter
 * writes the URL, so the two can never drift apart. `phase` is the single
 * exception, explained on its own accessor.
 *
 * The phase axis is deliberately SHARED by both panes. Two routes scrubbing
 * separate clocks could not be compared at all, which is the whole reason the
 * page exists.
 */
import { untrack } from "svelte";

import { browser } from "$app/environment";
import { page } from "$app/state";

import type { CharacterId } from "$lib/shared/3d/domain/character-model";
import { writeUrl } from "$lib/shared/navigation/services/url-state";

import {
  DEFAULT_LAB_CHARACTER_ID,
  isLabCharacterId,
} from "../_lab-kit/lab-characters";
import {
  clampLabPhase,
  formatLabPhase,
  snapLabPhase,
  type LabPhaseTransport,
} from "../_lab-kit/phase-transport";

import { DEFAULT_REACH_VIEW_ID, REACH_VIEWS } from "./reach-framing";

export const REACH_PARAM = {
  character: "character",
  phase: "phase",
  playing: "play",
  view: "view",
  overlay: "overlay",
} as const;

const VIEW_IDS: readonly string[] = REACH_VIEWS.map((view) => view.id);

/**
 * Where the lab opens: parked inside the hold, one full step after the reach
 * arrives. The document describes a "final resting place", and phase 1.00 is
 * the instant of arrival rather than the rest after it — a frame where the
 * settle is still running and the endpoint cannot honestly be read.
 */
export const DEFAULT_REACH_PHASE = 1.5;

export interface ReachLabStateOptions {
  /** Steps in the routes, so phase can clamp to them. */
  stepCount: () => number;
}

export class ReachLabState implements LabPhaseTransport {
  readonly #stepCount: () => number;

  /**
   * The URL this lab reads, mirrored reactively.
   *
   * It cannot be `page.url`. Writes go through SvelteKit shallow routing, and
   * `pushState`/`replaceState` update only `page.state` — `page.url` keeps
   * naming the last real navigation. Deriving from it gives a lab whose
   * address bar moves while the page ignores it. This mirror is written before
   * the history call and re-seeded from `popstate` and real navigations, so
   * reads follow the address bar in every direction.
   */
  #url = $state(new URL(page.url));

  /**
   * Phase is the one axis that moves continuously, so it cannot be read
   * straight off the URL: a running clock would write history every frame. It
   * is mirrored locally, written on a short coalescing timer, and flushed the
   * moment it stops or the window loses focus — which is exactly when someone
   * reaches for the address bar.
   */
  #phase = $state(DEFAULT_REACH_PHASE);
  #phaseWrittenParam: string | null = null;
  #phaseFlushTimer: ReturnType<typeof setTimeout> | null = null;
  #adopted = false;

  constructor(options: ReachLabStateOptions) {
    this.#stepCount = options.stepCount;
  }

  readonly character = $derived.by((): CharacterId => {
    const raw = this.#url.searchParams.get(REACH_PARAM.character);
    return raw && isLabCharacterId(raw) ? raw : DEFAULT_LAB_CHARACTER_ID;
  });

  readonly playing = $derived(
    this.#url.searchParams.get(REACH_PARAM.playing) === "1"
  );

  readonly viewId = $derived.by((): string => {
    const raw = this.#url.searchParams.get(REACH_PARAM.view);
    return raw && VIEW_IDS.includes(raw) ? raw : DEFAULT_REACH_VIEW_ID;
  });

  /** The measured skeleton drawn over the render. Off is opt-in. */
  readonly overlay = $derived(
    this.#url.searchParams.get(REACH_PARAM.overlay) !== "0"
  );

  get phase(): number {
    return this.#phase;
  }

  /**
   * The phase as a name: the exact string the `phase=` param carries, so the
   * frame the lab shows and the frame the address bar names are one string.
   */
  get phaseParam(): string {
    return formatLabPhase(this.#phase);
  }

  /**
   * Discrete transport movement — a frame button, a step button, an arrow key.
   * Snaps onto the addressable grid and writes immediately, so afterwards the
   * phase, the readout and the address bar are the same value.
   */
  stepPhase(delta: number): void {
    this.#phase = clampLabPhase(
      snapLabPhase(this.#phase + delta),
      this.#stepCount()
    );
    this.flushPhase();
  }

  /** Continuous movement — playback ticks and scrub drags. Coalesced. */
  setPhase(next: number): void {
    this.#phase = clampLabPhase(next, this.#stepCount());
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
    const formatted = formatLabPhase(this.#phase);
    this.#phaseWrittenParam = formatted;
    this.#write((params) => params.set(REACH_PARAM.phase, formatted), "replace");
  }

  /**
   * Adopt a phase this owner did not write, so a reload, a Back, or a pasted
   * link lands on the frame it names.
   */
  adoptUrlPhase(): void {
    const raw = this.#url.searchParams.get(REACH_PARAM.phase);
    if (this.#adopted && raw === this.#phaseWrittenParam) return;
    this.#adopted = true;
    this.#phaseWrittenParam = raw;
    const next = raw === null ? DEFAULT_REACH_PHASE : Number(raw);
    this.#phase = clampLabPhase(next, this.#stepCount());
  }

  setCharacter(id: CharacterId): void {
    this.#write((params) => params.set(REACH_PARAM.character, id), "push");
  }

  setPlaying(playing: boolean): void {
    // Pausing pins the exact frame first, so the paused URL is the frame on
    // screen rather than whatever the last coalesced write caught.
    if (!playing) this.flushPhase();
    this.#write(
      (params) => params.set(REACH_PARAM.playing, playing ? "1" : "0"),
      "replace"
    );
  }

  setView(id: string): void {
    this.#write((params) => params.set(REACH_PARAM.view, id), "push");
  }

  setOverlay(enabled: boolean): void {
    this.#write(
      (params) => params.set(REACH_PARAM.overlay, enabled ? "1" : "0"),
      "replace"
    );
  }

  /**
   * Every axis written explicitly, defaults included. A link that omits
   * defaults still restores correctly, but one that names them survives a
   * change of default — which matters when the point is pasting a finding into
   * a conversation.
   */
  fullyQualifiedHref(): string {
    const url = new URL(this.#url);
    const params = url.searchParams;
    params.set(REACH_PARAM.character, this.character);
    params.set(REACH_PARAM.phase, formatLabPhase(this.#phase));
    params.set(REACH_PARAM.playing, this.playing ? "1" : "0");
    params.set(REACH_PARAM.view, this.viewId);
    params.set(REACH_PARAM.overlay, this.overlay ? "1" : "0");
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

  /**
   * Re-read the address bar after a change this owner did not make. Back and
   * Forward move `window.location` without telling the app.
   */
  attachUrlSync(): () => void {
    if (!browser) return () => {};
    const sync = () => this.#adoptLocation();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }

  /**
   * Adopt a real navigation. `page.url` still tracks those, so arriving here
   * with different params re-seeds the mirror instead of being ignored.
   */
  syncFromNavigation(): void {
    // Read purely as the dependency that says a navigation happened; the value
    // adopted is always `window.location`.
    void page.url.href;
    // Untracked, because this runs inside an effect that writes both the
    // mirror and the phase. Reading either back as a dependency makes the
    // effect its own trigger, which Svelte kills with
    // `effect_update_depth_exceeded` during mount.
    untrack(() => this.#adoptLocation());
  }

  #write(
    mutate: (params: URLSearchParams) => void,
    mode: "push" | "replace"
  ): void {
    if (!browser) return;
    // Built from `window.location` rather than the mirror, so a write can never
    // resurrect an axis some other writer has since changed.
    const next = new URL(window.location.href);
    mutate(next.searchParams);
    if (next.href === window.location.href) return;
    // The mirror moves first: a control's re-render must not wait on the
    // history call, which the shared owner may defer while the router starts.
    this.#url = next;
    writeUrl(next, { mode });
  }

  /**
   * `window.location` is the only honest source. `page.url` names the last real
   * navigation and never moves for shallow routing, so re-seeding from it would
   * undo a Back the moment SvelteKit reassigns its page object.
   */
  #adoptLocation(): void {
    if (!browser) return;
    const href = window.location.href;
    if (this.#url.href === href) {
      // First run after mount. The mirror was seeded from `page.url`, which on
      // a fresh load already equals `window.location`, so the href guard would
      // skip the one adoption a pasted `phase=` depends on.
      if (!this.#adopted) this.adoptUrlPhase();
      return;
    }
    this.#url = new URL(href);
    this.adoptUrlPhase();
  }
}

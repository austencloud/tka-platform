/**
 * The rendered choreo card a surface previews, posts, or composes with.
 *
 * Extracted from PostShareSheet when Post Studio moved into the sequence
 * viewer and needed the same picture. Both surfaces have to show the card the
 * user is actually looking at — same composition settings, same visibility
 * flags — so the blob, its cache key, and the observer plumbing that makes the
 * whole thing reactive live here rather than in each host.
 *
 * Must be constructed during component init: it registers observers with
 * `onDestroy` and owns an `$effect`.
 */

import { onDestroy } from "svelte";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { SequenceExportOptions } from "$lib/shared/render/domain/models/sequence-export-options";
import type { ResolvedAutoLayout } from "$lib/shared/render/services/container-aware-layout";
import { getSharer } from "$lib/shared/share/get-sharer";
import { buildCardRenderOptions } from "$lib/shared/share/services/card-render-options";
import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";
import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";
import type { CardPresentation } from "$lib/shared/share/domain/models/card-presentation";
import { buildCardPreviewRenderKey } from "$lib/shared/share/state/card-preview-render-key";

interface CardPreviewInputs {
  /** The sequence to draw. Null suspends rendering. */
  getSequence: () => SequenceData | null | undefined;
  /** False suspends rendering, so a surface that never opens never pays it. */
  getEnabled: () => boolean;
  /**
   * The dark-mode flag the ON-SCREEN card preview is using. Not the
   * composition manager's own copy — the file has to match the card the user
   * was looking at when they pressed the button.
   */
  getDarkMode: () => boolean;
  getResolvedAutoLayout: () => ResolvedAutoLayout | null;
  /** Current card or one-share footer override. */
  getCardPresentation?: () => CardPresentation | undefined;
  onError?: (error: unknown) => void;
}

export function createCardPreviewState(inputs: CardPreviewInputs) {
  /**
   * Neither the card-composition manager nor the visibility manager is
   * rune-backed — both publish through observer callbacks — so reading them
   * inside an effect subscribes to nothing at all. Without this counter a
   * settings change never redraws the card, which is the one thing these
   * surfaces have to get right. ExportImagePanel carries the same counter.
   */
  const composition = getImageCompositionManager();
  const visibility = getVisibilityStateManager();
  let settingsVersion = $state(0);
  function onCardSettingsChanged(): void {
    settingsVersion++;
  }
  composition.registerObserver(onCardSettingsChanged);
  visibility.registerObserver(onCardSettingsChanged, ["all"]);

  let blob = $state<Blob | null>(null);
  let url = $state<string | null>(null);
  let renderOptions = $state<Partial<SequenceExportOptions> | null>(null);
  let renderedKey: string | null = null;
  let renderedTarget: SequenceData | null = null;

  $effect(() => {
    const target = inputs.getSequence();
    if (!inputs.getEnabled() || !target) return;

    // Subscribes this effect to every card setting the surface can reach.
    // buildCardRenderOptions reads both managers, but through plain method
    // calls that no rune is watching — this is the dependency.
    void settingsVersion;
    const darkMode = inputs.getDarkMode();
    const resolvedAutoLayout = inputs.getResolvedAutoLayout();
    const cardPresentation = inputs.getCardPresentation?.();
    const options = buildCardRenderOptions(target, {
      darkMode,
      isHandPath: !!target.metadata?.isHandPathVisualization,
      resolvedAutoLayout,
      cardPresentation,
    });
    renderOptions = options;

    // The visibility snapshot rides along because TKA, TnD, positions and
    // non-radial points never enter the options — the composer inherits them
    // from the global manager at render time. Keyed on the options alone, this
    // guard would return early on the one class of setting it cannot see.
    const settingsKey = buildCardPreviewRenderKey(
      options,
      visibility.getState()
    );
    if (settingsKey === renderedKey && target === renderedTarget) return;

    let stale = false;

    void (async () => {
      try {
        const rendered = await getSharer().getCardImageBlob(target, {
          darkMode,
          resolvedAutoLayout,
          cardPresentation,
        });
        if (stale) return;
        if (url) URL.revokeObjectURL(url);
        blob = rendered;
        url = URL.createObjectURL(rendered);
        renderedKey = settingsKey;
        renderedTarget = target;
      } catch (error) {
        console.error("[cardPreview] Card render failed:", error);
        if (!stale) inputs.onError?.(error);
      }
    })();

    return () => {
      stale = true;
    };
  });

  onDestroy(() => {
    composition.unregisterObserver(onCardSettingsChanged);
    visibility.unregisterObserver(onCardSettingsChanged);
    if (url) URL.revokeObjectURL(url);
  });

  return {
    get blob() {
      return blob;
    },
    get url() {
      return url;
    },
    /** The options the card was drawn with, for surfaces that re-render it. */
    get renderOptions() {
      return renderOptions;
    },
    get isPreparing() {
      return url === null;
    },
    /**
     * Identity of the settings the blob in hand was drawn from. Surfaces that
     * describe the artifact to something else (a post draft's crop revision)
     * key on this so a re-render is visible downstream.
     */
    get revision() {
      return renderedKey;
    },
    /** Bumps when a card setting changes. Exposed for hosts keying their own work. */
    get settingsVersion() {
      return settingsVersion;
    },
    /** Drops the cached blob so the next run re-renders. */
    reset(): void {
      if (url) URL.revokeObjectURL(url);
      blob = null;
      url = null;
      renderedKey = null;
      renderedTarget = null;
    },
  };
}

export type CardPreviewState = ReturnType<typeof createCardPreviewState>;

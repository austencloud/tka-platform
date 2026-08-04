<!--
LOOPExpandedOverlay.svelte - Expanded LOOP selection that covers the card grid
Animates forward in z-axis and expands to fill the container space
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { scale } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { onMount, tick } from "svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { flyFade, motionDuration } from "$lib/shared/transitions/motion";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import {
    generateLOOPType,
    canExtendCombo,
    buildLoopSpec,
  } from "$lib/shared/create/services/loop-type-utils";
  import { gateRhythm } from "$lib/shared/create/services/loop-rhythm-gating";
  import {
    guestLoopGate,
    type GuestLoopLock,
  } from "$lib/shared/create/services/loop-guest-gate";
  import { blockSignatures } from "$lib/shared/create/services/loop-block-signatures";
  import {
    LOOP_COMPONENTS,
    LOOPComponent,
  } from "$lib/features/create/generate/shared/domain/constants/loop-components";
  import { generateExplanationText } from "$lib/features/create/generate/shared/services/loop-explanation-text-generator";
  import { LOOPType } from "../../circular/domain/models/circular-models";
  import LOOPComponentGrid from "../modals/LOOPComponentGrid.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import LoopBlockTimeline from "$lib/shared/components/LoopBlockTimeline.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import FontAwesomeIcon from "$lib/shared/foundation/ui/FontAwesomeIcon.svelte";
  import type { ReflectionAxis } from "@tka/sequence-engine/loop";

  type RhythmValue = {
    rotationInterval: 2 | 4;
    inversionInterval: 2 | 4;
    inversionMode: "expand" | "overlay";
    reflectionAxis: ReflectionAxis;
  };

  const REFLECTION_AXIS_DETAILS = {
    "north-south": {
      axisLabel: "N–S",
      name: "Mirrored",
      description: "The vertical line stays fixed. East and west trade places.",
      applyLabel: "Apply Mirrored",
      line: { x1: 24, y1: 5, x2: 24, y2: 43 },
    },
    "east-west": {
      axisLabel: "E–W",
      name: "Flipped",
      description:
        "The horizontal line stays fixed. North and south trade places.",
      applyLabel: "Apply Flipped",
      line: { x1: 5, y1: 24, x2: 43, y2: 24 },
    },
    "northeast-southwest": {
      axisLabel: "NE–SW",
      name: "Diagonal",
      description:
        "NE and SW stay fixed. North trades with east; south trades with west.",
      applyLabel: "Apply NE–SW Reflection",
      line: { x1: 42, y1: 6, x2: 6, y2: 42 },
    },
    "northwest-southeast": {
      axisLabel: "NW–SE",
      name: "Diagonal",
      description:
        "NW and SE stay fixed. North trades with west; south trades with east.",
      applyLabel: "Apply NW–SE Reflection",
      line: { x1: 6, y1: 6, x2: 42, y2: 42 },
    },
  } satisfies Record<
    ReflectionAxis,
    {
      axisLabel: string;
      name: string;
      description: string;
      applyLabel: string;
      line: { x1: number; y1: number; x2: number; y2: number };
    }
  >;

  const REFLECTION_AXIS_OPTIONS = (
    Object.entries(REFLECTION_AXIS_DETAILS) as Array<
      [ReflectionAxis, (typeof REFLECTION_AXIS_DETAILS)[ReflectionAxis]]
    >
  ).map(([value, detail]) => ({
    value,
    label: `${detail.axisLabel} axis, ${detail.name}`,
    ariaLabel: `${detail.axisLabel} axis, ${detail.name}. ${detail.description}`,
    tone: "accent" as const,
  }));

  let {
    currentType,
    selectedComponents,
    onChange,
    onClose,
    onLoopDisable,
    layout = "grid",
    rhythm,
    sequenceLength,
    onRhythmChange,
    guestMaxLength,
    onRequestSignup,
  } = $props<{
    currentType: LOOPType;
    selectedComponents: Set<LOOPComponent>;
    onChange: (loopType: LOOPType) => void;
    onClose: () => void;
    onLoopDisable?: () => void;
    layout?: "grid" | "list" | "responsive";
    /** Current rhythm + context for the Rhythm tier. All optional — absent = tier hidden (legacy callers unaffected). */
    rhythm?: RhythmValue;
    sequenceLength?: number;
    onRhythmChange?: (updates: Partial<RhythmValue>) => void;
    /** Guest step cap. Set (by guest-facing hosts) turns on guest LOOP gating;
        absent = no gating (deck/store/admin hosts unaffected). */
    guestMaxLength?: number;
    /** Called with the lock reason when a guest taps a gated LOOP. */
    onRequestSignup?: (reason: string) => void;
  }>();

  let hapticService: HapticFeedback | null = null;
  let overlayElement: HTMLDivElement;
  let gridContainerElement: HTMLDivElement;
  let drawerHeightAnimation: Animation | null = null;
  let componentRevealFrame: number | null = null;
  // A reopened multi-component combo lands on the Combo screen it was applied
  // from, not back on Single (the overlay remounts per open — props are nulled
  // on close — so mount-time init is the reopen path).
  let isMultiSelectMode = $state(selectedComponents.size > 1);
  let localSelectedComponents = $state(new Set<LOOPComponent>());
  let mobileDetailComponent = $state<LOOPComponent | null>(null);

  function normalizeReflectionSelection(
    components: Set<LOOPComponent>
  ): Set<LOOPComponent> {
    const normalized = new Set(components);
    if (normalized.delete(LOOPComponent.FLIPPED)) {
      normalized.add(LOOPComponent.MIRRORED);
    }
    return normalized;
  }

  // Sync local state with prop changes
  $effect(() => {
    localSelectedComponents = normalizeReflectionSelection(
      new Set<LOOPComponent>(selectedComponents)
    );
    if (selectedComponents.size > 1) {
      isMultiSelectMode = true;
    }
  });

  // Combo edits stay local until Apply. Single LOOP settings write through as
  // soon as they form a valid configuration, while this local copy keeps an
  // invalid choice visible long enough to explain what needs changing.
  let localRhythm = $state<RhythmValue>({
    rotationInterval: 2,
    inversionInterval: 2,
    inversionMode: "expand",
    reflectionAxis:
      currentType === LOOPType.FLIPPED ? "east-west" : "north-south",
  });

  $effect(() => {
    if (rhythm) {
      localRhythm = { ...rhythm };
    }
  });

  onMount(() => {
    hapticService = getHapticFeedback();
    const initialComponents = normalizeReflectionSelection(
      new Set(selectedComponents)
    );
    const lowestExpandedComponent = [
      LOOPComponent.MIRRORED,
      LOOPComponent.INVERTED,
      LOOPComponent.ROTATED,
    ].find((component) => initialComponents.has(component));
    if (lowestExpandedComponent && !usesMobileDrawerPresentation()) {
      void keepExpandedComponentVisible(lowestExpandedComponent);
    }

    return () => {
      drawerHeightAnimation?.cancel();
      drawerHeightAnimation = null;
      if (componentRevealFrame !== null) {
        cancelAnimationFrame(componentRevealFrame);
        componentRevealFrame = null;
      }
    };
  });

  // Generate explanation text based on selected components
  const explanationText = $derived(
    generateExplanationText(localSelectedComponents)
  );

  // Does the current selection map to a real, generatable LOOP type?
  // (Intermediate states on the way to a bigger combo can be unmapped —
  // those disable Apply but keep compatible components selectable.)
  const isImplemented = $derived(
    generateLOOPType(localSelectedComponents) !== null
  );

  // Combo mode gating: a component is out of play when no implemented combo
  // contains it together with everything already selected. Selected
  // components always stay enabled so they can be deselected.
  const disabledComponents = $derived.by(() => {
    if (!isMultiSelectMode) return null;
    const disabled = new Set<LOOPComponent>();
    for (const info of LOOP_COMPONENTS) {
      const component = info.component as LOOPComponent;
      if (localSelectedComponents.has(component)) continue;
      if (!canExtendCombo(localSelectedComponents, component)) {
        disabled.add(component);
      }
    }
    return disabled;
  });

  // Derive selection count
  const selectionCount = $derived(localSelectedComponents.size);
  const hasReflection = $derived(
    localSelectedComponents.has(LOOPComponent.MIRRORED)
  );
  const hasInversion = $derived(
    localSelectedComponents.has(LOOPComponent.INVERTED)
  );
  const canConfigureReflection = $derived(
    hasReflection && !!rhythm && !!onRhythmChange
  );
  const canConfigureInversion = $derived(
    hasInversion && !!rhythm && !!onRhythmChange
  );
  const reflectionAxisDetail = $derived(
    REFLECTION_AXIS_DETAILS[localRhythm.reflectionAxis]
  );
  const reflectionColor =
    LOOP_COMPONENTS.find(
      (component) => component.component === LOOPComponent.MIRRORED
    )?.color ?? "#6f2da8";
  const inversionColor =
    LOOP_COMPONENTS.find(
      (component) => component.component === LOOPComponent.INVERTED
    )?.color ?? "#eb7d00";
  const rotationColor =
    LOOP_COMPONENTS.find(
      (component) => component.component === LOOPComponent.ROTATED
    )?.color ?? "#36c3ff";

  // Period belongs to the rotation component, including rotation-bearing
  // combos. The generator's LOOP spec preserves a quartered rotation interval
  // alongside independent inversion, swap, and reflection components.
  const canConfigureRotation = $derived(
    localSelectedComponents.has(LOOPComponent.ROTATED) &&
      !!rhythm &&
      !!onRhythmChange
  );
  const hasInlineConfigurator = $derived(
    canConfigureReflection || canConfigureInversion || canConfigureRotation
  );
  const configurableComponents = $derived.by(() => {
    const components = new Set<LOOPComponent>();
    if (canConfigureRotation) components.add(LOOPComponent.ROTATED);
    if (canConfigureInversion) components.add(LOOPComponent.INVERTED);
    if (canConfigureReflection) components.add(LOOPComponent.MIRRORED);
    return components;
  });
  const mobileDetailInfo = $derived(
    mobileDetailComponent
      ? (LOOP_COMPONENTS.find(
          (info) => info.component === mobileDetailComponent
        ) ?? null)
      : null
  );
  const mobileView = $derived(
    mobileDetailInfo ? `detail-${mobileDetailInfo.component}` : "picker"
  );

  // Wire-form spec for the CURRENT selection + rhythm — same helper the
  // generation orchestrator uses. Null when the combo isn't implemented
  // (mirrors `isImplemented`, single source of truth in loop-type-utils).
  const specWire = $derived(
    buildLoopSpec(localSelectedComponents, localRhythm)
  );

  // Apply-gating + word-math data. Only computed once the spec is buildable
  // and the caller told us the target length — legacy callers (no
  // sequenceLength) skip this entirely and behave exactly as today.
  const rhythmGate = $derived.by(() => {
    if (sequenceLength === undefined || !specWire) return null;
    return gateRhythm(localSelectedComponents, localRhythm, sequenceLength);
  });

  // ===== Guest LOOP gating (active only when guestMaxLength is set) =====
  // Lock for the CURRENT selection (drives combo-mode Apply).
  const guestLock = $derived.by<GuestLoopLock>(() => {
    if (guestMaxLength === undefined || localSelectedComponents.size === 0) {
      return { locked: false };
    }
    return guestLoopGate(
      generateLOOPType(localSelectedComponents),
      buildLoopSpec(localSelectedComponents, localRhythm),
      guestMaxLength
    );
  });

  const showSelectionDetails = $derived(
    isMultiSelectMode ||
      hasInlineConfigurator ||
      (selectionCount > 0 &&
        (!isImplemented ||
          guestLock.locked ||
          (rhythmGate !== null && !rhythmGate.ok)))
  );

  // Per-component lock for single-select mode: each component evaluated as if it
  // were the sole selection, so the grid can badge the gated ones up front.
  const lockedComponents = $derived.by(() => {
    if (guestMaxLength === undefined || isMultiSelectMode) return null;
    const locked = new Set<LOOPComponent>();
    for (const info of LOOP_COMPONENTS) {
      const component = info.component as LOOPComponent;
      const one = new Set<LOOPComponent>([component]);
      const gate = guestLoopGate(
        generateLOOPType(one),
        buildLoopSpec(one, localRhythm),
        guestMaxLength
      );
      if (gate.locked) locked.add(component);
    }
    return locked;
  });

  const wordMathText = $derived.by(() => {
    const gate = rhythmGate;
    if (!gate) return null;
    if (!gate.ok) return gate.reason;
    const overlaySuffix =
      localSelectedComponents.has(LOOPComponent.INVERTED) &&
      localRhythm.inversionMode === "overlay"
        ? " · inversion on top"
        : "";
    return `${gate.seedLength} letters × ${gate.multiplier} = ${sequenceLength} steps${overlaySuffix}`;
  });

  const inversionCaption = $derived.by(() => {
    const { inversionInterval, inversionMode } = localRhythm;
    if (inversionMode === "overlay") {
      return inversionInterval === 4
        ? "Same hand positions — props flip spin direction every quarter."
        : "Same hand positions — props flip spin direction for the second half.";
    }
    return inversionInterval === 4
      ? "Inverted blocks are added, alternating every quarter."
      : "The inverted half is added to the sequence.";
  });

  // Button text for combo mode
  const buttonText = $derived.by(() => {
    if (selectionCount === 0) return "Select Components";
    if (!isImplemented) return "Combo Not Supported";
    if (guestLock.locked) return "Sign Up to Unlock";
    if (selectionCount === 1 && canConfigureReflection) {
      return reflectionAxisDetail.applyLabel;
    }
    if (selectionCount === 1) {
      const component = Array.from(localSelectedComponents)[0] as LOOPComponent;
      const formatted = component.charAt(0) + component.slice(1).toLowerCase();
      return `Apply ${formatted}`;
    }
    return `Apply ${selectionCount}-Component Combo`;
  });

  function usesMobileDrawerPresentation(): boolean {
    const mobileStage =
      overlayElement?.querySelector<HTMLElement>(".mobile-loop-stage");
    if (mobileStage && getComputedStyle(mobileStage).display !== "none") {
      return true;
    }
    const drawer = overlayElement?.closest<HTMLElement>(".loop-drawer-sheet");
    if (drawer) return drawer.dataset.placement === "bottom";
    return (
      layout === "responsive" &&
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches
    );
  }

  function handleToggle(component: LOOPComponent) {
    hapticService?.trigger("selection");
    const isMobileDrawer = usesMobileDrawerPresentation();

    // A LOOP tile is the choice itself in Single mode. Configurable choices
    // stay open so their settings are reachable, but the valid type is already
    // active and closing the drawer does not undo it.
    if (!isMultiSelectMode) {
      // Guest-gated single pick routes to sign-up instead of applying.
      if (guestMaxLength !== undefined) {
        const gate = guestLoopGate(
          generateLOOPType(new Set([component])),
          buildLoopSpec(new Set([component]), localRhythm),
          guestMaxLength
        );
        if (gate.locked) {
          onRequestSignup?.(gate.reason);
          return;
        }
      }
      const nextComponents = new Set([component]);
      localSelectedComponents = nextComponents;
      const newLoopType = generateLOOPType(nextComponents);
      if (newLoopType === null) return;

      const nextRhythmGate =
        sequenceLength === undefined
          ? null
          : gateRhythm(nextComponents, localRhythm, sequenceLength);
      if (nextRhythmGate && !nextRhythmGate.ok) return;

      onChange(newLoopType);
      if (
        (component === LOOPComponent.ROTATED ||
          component === LOOPComponent.MIRRORED ||
          component === LOOPComponent.INVERTED) &&
        rhythm &&
        onRhythmChange
      ) {
        if (!isMobileDrawer) {
          void keepExpandedComponentVisible(component);
        }
        return;
      }
      onClose();
      return;
    }

    // Multi-select mode: Toggle selection
    const newSet = new Set(localSelectedComponents);
    const isAdding = !newSet.has(component);
    if (!isAdding) {
      newSet.delete(component);
    } else {
      newSet.add(component);
    }
    localSelectedComponents = newSet;
    if (!isAdding && mobileDetailComponent === component) {
      mobileDetailComponent = null;
    }
    if (
      isAdding &&
      !isMobileDrawer &&
      (component === LOOPComponent.ROTATED ||
        component === LOOPComponent.MIRRORED ||
        component === LOOPComponent.INVERTED)
    ) {
      void keepExpandedComponentVisible(component);
    }
  }

  async function openMobileConfigurator(component: LOOPComponent) {
    if (!configurableComponents.has(component)) return;
    hapticService?.trigger("selection");
    mobileDetailComponent = component;
    await tick();
    overlayElement
      ?.querySelector<HTMLButtonElement>(".mobile-detail-back")
      ?.focus({ preventScroll: true });
  }

  async function closeMobileConfigurator() {
    const previousComponent = mobileDetailComponent;
    if (!previousComponent) return;
    hapticService?.trigger("selection");
    mobileDetailComponent = null;
    await tick();
    overlayElement
      ?.querySelector<HTMLButtonElement>(
        `[data-configure-component="${previousComponent}"]`
      )
      ?.focus({ preventScroll: true });
  }

  async function keepExpandedComponentVisible(component: LOOPComponent) {
    await tick();

    if (componentRevealFrame !== null) {
      cancelAnimationFrame(componentRevealFrame);
      componentRevealFrame = null;
    }

    const card = gridContainerElement?.querySelector<HTMLElement>(
      `[data-component="${component}"]`
    );
    if (!card || !gridContainerElement?.isConnected) return;

    let scrollViewport: HTMLElement | null = card.parentElement;
    while (scrollViewport) {
      const overflowY = getComputedStyle(scrollViewport).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") break;
      scrollViewport = scrollViewport.parentElement;
    }
    scrollViewport ??= gridContainerElement;

    const duration = motionDuration(DURATION.dramatic);
    const startedAt = performance.now();
    const edgePadding = 8;

    // The last selected card can keep growing after its first rendered frame.
    // Follow that growth for the same duration as the row animation so its
    // controls never disappear underneath the sticky Apply area.
    const followExpansion = (now: number) => {
      if (!card.isConnected || !scrollViewport.isConnected) {
        componentRevealFrame = null;
        return;
      }

      const viewport = scrollViewport.getBoundingClientRect();
      const cardBounds = card.getBoundingClientRect();
      const bottomOverflow =
        cardBounds.bottom - (viewport.bottom - edgePadding);
      const topOverflow = viewport.top + edgePadding - cardBounds.top;

      if (bottomOverflow > 0) {
        scrollViewport.scrollTop += bottomOverflow;
      } else if (topOverflow > 0) {
        scrollViewport.scrollTop -= topOverflow;
      }

      if (now - startedAt < duration + 32) {
        componentRevealFrame = requestAnimationFrame(followExpansion);
      } else {
        componentRevealFrame = null;
      }
    };

    componentRevealFrame = requestAnimationFrame(followExpansion);
  }

  async function handleModeChange(isMulti: boolean) {
    if (isMulti === isMultiSelectMode) return;

    hapticService?.trigger("selection");

    const drawer = overlayElement?.closest<HTMLElement>(".loop-drawer-sheet");
    const animationDuration = motionDuration(DURATION.dramatic);
    const shouldAnimateDrawer =
      drawer !== null &&
      drawer.dataset.placement === "bottom" &&
      animationDuration > 0;

    // Single ends at its content while Combo fills the phone. Numeric
    // endpoints keep that intrinsic-height morph smooth in iPhone WebKit too.
    const startHeight = shouldAnimateDrawer
      ? drawer.getBoundingClientRect().height
      : 0;

    drawerHeightAnimation?.cancel();
    drawerHeightAnimation = null;
    mobileDetailComponent = null;
    if (!isMulti && localSelectedComponents.size > 1) {
      // A committed combo has no honest preselection in Single mode. Leave the
      // active combo untouched until the user chooses the single LOOP that
      // should replace it.
      localSelectedComponents = new Set();
    }
    isMultiSelectMode = isMulti;

    if (!shouldAnimateDrawer) return;

    await tick();
    if (!drawer.isConnected) return;

    const endHeight = drawer.getBoundingClientRect().height;
    if (Math.abs(startHeight - endHeight) < 1) return;

    const easing =
      getComputedStyle(drawer).getPropertyValue("--ease-out").trim() ||
      "cubic-bezier(0.16, 1, 0.3, 1)";
    const animation = drawer.animate(
      [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
      { duration: animationDuration, easing }
    );

    drawerHeightAnimation = animation;
    void animation.finished
      .catch(() => undefined)
      .finally(() => {
        if (drawerHeightAnimation === animation) {
          drawerHeightAnimation = null;
        }
      });
  }

  function updateRhythm(updates: Partial<RhythmValue>) {
    hapticService?.trigger("selection");
    const nextRhythm = { ...localRhythm, ...updates };

    if (!isMultiSelectMode && selectionCount > 0) {
      const newLoopType = generateLOOPType(localSelectedComponents);
      if (newLoopType !== null && guestMaxLength !== undefined) {
        const nextGuestLock = guestLoopGate(
          newLoopType,
          buildLoopSpec(localSelectedComponents, nextRhythm),
          guestMaxLength
        );
        if (nextGuestLock.locked) {
          onRequestSignup?.(nextGuestLock.reason);
          return;
        }
      }
    }

    localRhythm = nextRhythm;
    if (isMultiSelectMode || selectionCount === 0) return;

    const newLoopType = generateLOOPType(localSelectedComponents);
    if (newLoopType === null) return;
    const nextRhythmGate =
      sequenceLength === undefined
        ? null
        : gateRhythm(localSelectedComponents, nextRhythm, sequenceLength);
    if (nextRhythmGate && !nextRhythmGate.ok) return;

    onRhythmChange?.(updates);
    onChange(newLoopType);
  }

  function applyAndClose() {
    if (selectionCount === 0) return;

    const newLoopType = generateLOOPType(localSelectedComponents);
    if (newLoopType === null) return; // unmapped combo — Apply is disabled anyway

    // Rhythm changes are LOCAL until Apply — fire the diff BEFORE onChange so
    // the config-mapper reads both the new rhythm and the new loop type on
    // the next generate.
    if (rhythm && onRhythmChange) {
      const diff: Partial<RhythmValue> = {};
      if (localRhythm.rotationInterval !== rhythm.rotationInterval) {
        diff.rotationInterval = localRhythm.rotationInterval;
      }
      if (localRhythm.inversionInterval !== rhythm.inversionInterval) {
        diff.inversionInterval = localRhythm.inversionInterval;
      }
      if (localRhythm.inversionMode !== rhythm.inversionMode) {
        diff.inversionMode = localRhythm.inversionMode;
      }
      if (localRhythm.reflectionAxis !== rhythm.reflectionAxis) {
        diff.reflectionAxis = localRhythm.reflectionAxis;
      }
      if (Object.keys(diff).length > 0) {
        onRhythmChange(diff);
      }
    }

    onChange(newLoopType);
    onClose();
  }

  function handleConfirm() {
    if (selectionCount === 0 || !isImplemented) return;
    // Guest-gated combo routes to sign-up instead of applying.
    if (guestLock.locked) {
      hapticService?.trigger("selection");
      onRequestSignup?.(guestLock.reason);
      return;
    }
    if (rhythmGate && !rhythmGate.ok) return;
    hapticService?.trigger("selection");
    applyAndClose();
  }

  function handleClose() {
    hapticService?.trigger("selection");
    onClose();
  }

  function handleDisableLoop() {
    hapticService?.trigger("selection");
    onLoopDisable?.();
  }
</script>

<div
  bind:this={overlayElement}
  class="loop-expanded-overlay"
  class:combo-mode={showSelectionDetails}
  transition:scale={{ start: 0.95, duration: 250, easing: quintOut }}
>
  <!-- Header with title, disable toggle, and close button -->
  <div class="overlay-header">
    <h3 class="overlay-title">Select LOOP Type</h3>
    <div class="header-actions">
      {#if onLoopDisable}
        <button
          class="disable-button"
          onclick={handleDisableLoop}
          aria-label="Turn off LOOP"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
          </svg>
          <span>Off</span>
        </button>
      {/if}
      <button
        class="close-button"
        onclick={handleClose}
        aria-label="Close LOOP selection"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>

  <!-- Mode selector (shared SegmentedControl per chip-primitives rule) -->
  <SegmentedControl
    options={[
      { value: "single", label: "Single" },
      { value: "combo", label: "Combo" },
    ]}
    value={isMultiSelectMode ? "combo" : "single"}
    onchange={(v) => handleModeChange(v === "combo")}
    size="sm"
    color="accent"
  />

  <!-- Component grid -->
  {#snippet reflectionConfigurator(idPrefix = "loop")}
    <div
      class="reflection-axis-picker"
      style="--reflection-color: {reflectionColor};"
    >
      <div class="axis-heading">
        <span class="axis-title" id={`${idPrefix}-reflection-axis-label`}
          >Reflect across</span
        >
        <span class="axis-selection">{reflectionAxisDetail.name}</span>
      </div>

      {#snippet axisOption(reflectionAxis: ReflectionAxis)}
        {@const detail = REFLECTION_AXIS_DETAILS[reflectionAxis]}
        <span class="axis-option">
          <svg class="axis-diagram" viewBox="0 0 48 48" aria-hidden="true">
            <circle class="axis-ring" cx="24" cy="24" r="18"></circle>
            <circle class="axis-point" cx="24" cy="6" r="1.8"></circle>
            <circle class="axis-point" cx="37" cy="11" r="1.8"></circle>
            <circle class="axis-point" cx="42" cy="24" r="1.8"></circle>
            <circle class="axis-point" cx="37" cy="37" r="1.8"></circle>
            <circle class="axis-point" cx="24" cy="42" r="1.8"></circle>
            <circle class="axis-point" cx="11" cy="37" r="1.8"></circle>
            <circle class="axis-point" cx="6" cy="24" r="1.8"></circle>
            <circle class="axis-point" cx="11" cy="11" r="1.8"></circle>
            <line
              class="axis-line"
              x1={detail.line.x1}
              y1={detail.line.y1}
              x2={detail.line.x2}
              y2={detail.line.y2}
            ></line>
          </svg>
          <span class="axis-option-label">{detail.axisLabel}</span>
          <span class="axis-option-name">{detail.name}</span>
        </span>
      {/snippet}

      <SegmentedControl
        options={REFLECTION_AXIS_OPTIONS}
        value={localRhythm.reflectionAxis}
        onchange={(reflectionAxis) => updateRhythm({ reflectionAxis })}
        size="sm"
        color="accent"
        semantics="radiogroup"
        ariaLabelledby={`${idPrefix}-reflection-axis-label`}
        optionContent={axisOption}
      />

      <div class="axis-caption" aria-live="polite">
        <span class="axis-caption-sizer" aria-hidden="true"
          >NE and SW stay fixed. North trades with east; south trades with west.</span
        >
        <span class="axis-caption-live">{reflectionAxisDetail.description}</span
        >
      </div>
    </div>
  {/snippet}

  {#snippet rotationConfigurator(idPrefix = "loop")}
    <div
      class="owned-configurator rotation-configurator"
      style="--owner-color: {rotationColor};"
    >
      <div class="configurator-heading">
        <span
          class="configurator-title"
          id={`${idPrefix}-rotation-period-label`}>Rotation period</span
        >
        <span class="configurator-selection">
          {localRhythm.rotationInterval === 4 ? "Quartered" : "Halved"}
        </span>
      </div>
      <SegmentedControl
        options={[
          { value: "2", label: "Halved" },
          { value: "4", label: "Quartered" },
        ]}
        value={String(localRhythm.rotationInterval)}
        onchange={(value) =>
          updateRhythm({ rotationInterval: value === "4" ? 4 : 2 })}
        size="sm"
        color="accent"
        semantics="radiogroup"
        ariaLabelledby={`${idPrefix}-rotation-period-label`}
      />
      <div class="configurator-caption" aria-live="polite">
        <span class="configurator-caption-sizer" aria-hidden="true"
          >Positions rotate 90° at every quarter.</span
        >
        <span class="configurator-caption-live">
          {localRhythm.rotationInterval === 4
            ? "Positions rotate 90° at every quarter."
            : "Positions rotate 180° at halfway."}
        </span>
      </div>
    </div>
  {/snippet}

  {#snippet inversionConfigurator(idPrefix = "loop")}
    <div
      class="owned-configurator inversion-configurator"
      style="--owner-color: {inversionColor};"
    >
      <div class="configurator-row">
        <div class="configurator-heading">
          <span
            class="configurator-title"
            id={`${idPrefix}-inversion-timing-label`}>Invert when</span
          >
          <span class="configurator-selection">
            {localRhythm.inversionInterval === 4
              ? "Every quarter"
              : "At halfway"}
          </span>
        </div>
        <SegmentedControl
          options={[
            { value: "2", label: "At halfway" },
            { value: "4", label: "Every quarter" },
          ]}
          value={String(localRhythm.inversionInterval)}
          onchange={(value) =>
            updateRhythm({ inversionInterval: value === "4" ? 4 : 2 })}
          size="sm"
          color="accent"
          semantics="radiogroup"
          ariaLabelledby={`${idPrefix}-inversion-timing-label`}
        />
      </div>

      <div class="configurator-row">
        <span
          class="configurator-title"
          id={`${idPrefix}-inversion-length-label`}>Build the sequence</span
        >
        <SegmentedControl
          options={[
            { value: "expand", label: "Adds length" },
            { value: "overlay", label: "On top" },
          ]}
          value={localRhythm.inversionMode}
          onchange={(inversionMode) => updateRhythm({ inversionMode })}
          size="sm"
          color="accent"
          semantics="radiogroup"
          ariaLabelledby={`${idPrefix}-inversion-length-label`}
        />
      </div>

      <div class="configurator-caption">
        <span class="configurator-caption-sizer" aria-hidden="true"
          >Same hand positions — props flip spin direction for the second half.</span
        >
        <span class="configurator-caption-live">{inversionCaption}</span>
      </div>
    </div>
  {/snippet}

  {#snippet desktopRotationConfigurator()}
    {@render rotationConfigurator("desktop")}
  {/snippet}

  {#snippet desktopInversionConfigurator()}
    {@render inversionConfigurator("desktop")}
  {/snippet}

  {#snippet desktopReflectionConfigurator()}
    {@render reflectionConfigurator("desktop")}
  {/snippet}

  <!-- Desktop keeps the attached accordion. Phones show every transformation
       first, then drill into the selected transformation's settings. -->
  <div
    class="grid-container desktop-loop-grid themed-scrollbar"
    bind:this={gridContainerElement}
  >
    <LOOPComponentGrid
      selectedComponents={localSelectedComponents}
      {disabledComponents}
      {lockedComponents}
      {isMultiSelectMode}
      {layout}
      componentConfigurators={{
        [LOOPComponent.ROTATED]:
          rhythm && onRhythmChange ? desktopRotationConfigurator : undefined,
        [LOOPComponent.INVERTED]:
          rhythm && onRhythmChange ? desktopInversionConfigurator : undefined,
        [LOOPComponent.MIRRORED]:
          rhythm && onRhythmChange ? desktopReflectionConfigurator : undefined,
      }}
      expandedComponents={new Set([
        ...(canConfigureRotation ? [LOOPComponent.ROTATED] : []),
        ...(canConfigureInversion ? [LOOPComponent.INVERTED] : []),
        ...(canConfigureReflection ? [LOOPComponent.MIRRORED] : []),
      ])}
      onToggleComponent={handleToggle}
    />
  </div>

  <div class="mobile-loop-stage">
    <Crossfade key={mobileView} fill>
      {#if mobileDetailInfo}
        <section
          class="mobile-loop-detail themed-scrollbar"
          style="--component-color: {mobileDetailInfo.color};"
          aria-label="{mobileDetailInfo.label} settings"
        >
          <div class="mobile-detail-header">
            <button
              type="button"
              class="mobile-detail-back"
              onclick={closeMobileConfigurator}
              aria-label="Back to all LOOP types"
            >
              <FontAwesomeIcon icon="fas fa-arrow-left" size="1em" />
            </button>
            <div class="mobile-detail-identity">
              <div class="mobile-detail-icon" aria-hidden="true">
                <FontAwesomeIcon icon={mobileDetailInfo.icon} size="1em" />
              </div>
              <div class="mobile-detail-copy">
                <strong>{mobileDetailInfo.label}</strong>
                <span>{mobileDetailInfo.description}</span>
              </div>
            </div>
          </div>

          <div class="mobile-detail-controls">
            {#if mobileDetailComponent === LOOPComponent.ROTATED}
              {@render rotationConfigurator("mobile")}
            {:else if mobileDetailComponent === LOOPComponent.INVERTED}
              {@render inversionConfigurator("mobile")}
            {:else if mobileDetailComponent === LOOPComponent.MIRRORED}
              {@render reflectionConfigurator("mobile")}
            {/if}
          </div>
        </section>
      {:else}
        <div class="mobile-loop-picker">
          <LOOPComponentGrid
            selectedComponents={localSelectedComponents}
            {disabledComponents}
            {lockedComponents}
            {isMultiSelectMode}
            layout="grid"
            {configurableComponents}
            onConfigureComponent={openMobileConfigurator}
            onToggleComponent={handleToggle}
          />
          <p class="mobile-picker-hint">
            Tap a LOOP to select it. Use
            <FontAwesomeIcon icon="fas fa-sliders" size="0.85em" />
            to change its settings.
          </p>
        </div>
      {/if}
    </Crossfade>
  </div>

  <!-- Configurable LOOPs keep their explanation visible. Invalid single
       choices use the same area to say why they have not committed yet. -->
  {#if showSelectionDetails}
    <div
      class="combo-details desktop-combo-details themed-scrollbar"
      in:flyFade={{
        y: 8,
        delay: motionDuration(DURATION.instant),
        duration: DURATION.normal,
      }}
    >
      <!-- Word-math line: always visible in combo mode once a spec is buildable
           and the caller told us the target length. -->
      {#if wordMathText}
        <div class="word-math">
          <span class="word-math-sizer" aria-hidden="true"
            >Too short — a one-step seed has nothing for inversion to flip</span
          >
          <span class="word-math-live">{wordMathText}</span>
        </div>
      {/if}

      <!-- Block timeline: the novice bridge, shown whenever the spec is buildable. -->
      {#if specWire}
        <LoopBlockTimeline model={blockSignatures(specWire)} />
      {/if}

      <div class="explanation-section">
        <p class="explanation-text">{explanationText}</p>
        {#if !isImplemented && selectionCount > 0}
          <div class="coming-soon-badge">
            No LOOP type matches this exact combination — add or remove a
            component
          </div>
        {:else if guestLock.locked}
          <div class="signup-badge">{guestLock.reason}</div>
        {:else if rhythmGate && !rhythmGate.ok}
          <div class="coming-soon-badge">{rhythmGate.reason}</div>
        {/if}
      </div>
    </div>

    {#if !isImplemented && selectionCount > 0}
      <div class="mobile-loop-status coming-soon-badge">
        No LOOP type matches this exact combination. Add or remove a component.
      </div>
    {:else if guestLock.locked}
      <div class="mobile-loop-status signup-badge">{guestLock.reason}</div>
    {:else if rhythmGate && !rhythmGate.ok}
      <div class="mobile-loop-status coming-soon-badge">
        {rhythmGate.reason}
      </div>
    {/if}

    {#if isMultiSelectMode}
      <!-- Combo mode is intentionally transactional because several component
           and rhythm edits belong to one LOOP configuration. -->
      <div
        class="apply-dock"
        in:flyFade={{
          y: 8,
          delay: motionDuration(DURATION.fast),
          duration: DURATION.normal,
        }}
      >
        <button
          class="apply-button"
          class:locked={guestLock.locked}
          class:disabled={selectionCount === 0 ||
            !isImplemented ||
            (!guestLock.locked && rhythmGate !== null && !rhythmGate.ok)}
          onclick={handleConfirm}
          disabled={selectionCount === 0 ||
            !isImplemented ||
            (!guestLock.locked && rhythmGate !== null && !rhythmGate.ok)}
        >
          {buttonText}
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .loop-expanded-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;

    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;

    /* Solid background matching the card theme */
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 25%, #1a1a2e) 0%,
      color-mix(in srgb, var(--theme-accent, #818cf8) 15%, #1a1a2e) 50%,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 20%, #1a1a2e) 100%
    );
    border-radius: 16px;
    border: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.4),
      0 0 24px color-mix(in srgb, var(--theme-accent) 30%, transparent);

    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
  }

  .overlay-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .disable-button {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    padding: 8px 12px;
    height: var(--min-touch-target);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    font-family: inherit;
    transition: all var(--duration-normal) ease;
  }

  .disable-button:hover {
    background: rgba(255, 100, 100, 0.15);
    border-color: rgba(255, 100, 100, 0.3);
    color: var(--theme-text, white);
  }

  .disable-button svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .overlay-title {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 700;
    color: var(--theme-text, white);
    letter-spacing: 0.3px;
  }

  .close-button {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    border-radius: 8px;
    color: var(--theme-text, white);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    transition: all var(--duration-normal) ease;
  }

  .close-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.15));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
  }

  .close-button svg {
    width: 20px;
    height: 20px;
  }

  .grid-container {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-anchor: none;
    overscroll-behavior: contain;
  }

  .mobile-loop-stage,
  .mobile-loop-status {
    display: none;
  }

  .mobile-loop-picker,
  .mobile-loop-detail {
    height: 100%;
    min-height: 0;
  }

  .mobile-loop-picker {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 12px;
  }

  /* Six tracks preserve the three-card first row while giving the two-card
     second row equal breathing room on both sides. Every card still spans the
     same two tracks, so nothing changes size between rows. */
  .mobile-loop-picker :global(.loop-component-grid) {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .mobile-loop-picker :global(.loop-component-shell) {
    grid-column: span 2;
  }

  .mobile-loop-picker :global(.loop-component-shell:nth-child(4)) {
    grid-column: 2 / span 2;
  }

  .mobile-loop-picker :global(.loop-component-shell:nth-child(5)) {
    grid-column: 4 / span 2;
  }

  .mobile-picker-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    margin: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.72));
    font-size: var(--font-size-compact, 12px);
    line-height: 1.3;
    text-align: center;
  }

  .mobile-loop-detail {
    --theme-accent: var(--component-color);
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 2px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .mobile-detail-header {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 10px;
  }

  .mobile-detail-back {
    display: flex;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 1px solid
      color-mix(in srgb, var(--component-color) 55%, transparent);
    border-radius: 10px;
    background: color-mix(
      in srgb,
      var(--component-color) 16%,
      var(--theme-panel-bg, #18152a)
    );
    color: var(--theme-text, white);
    cursor: pointer;
  }

  .mobile-detail-back:focus-visible {
    outline: 2px solid var(--component-color);
    outline-offset: 2px;
  }

  .mobile-detail-identity {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 9px;
  }

  .mobile-detail-icon {
    display: flex;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    background: color-mix(in srgb, var(--component-color) 28%, transparent);
    color: var(--theme-text, white);
    font-size: 1.15rem;
  }

  .mobile-detail-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 1px;
  }

  .mobile-detail-copy strong {
    color: var(--theme-text, white);
    font-size: var(--font-size-sm, 14px);
  }

  .mobile-detail-copy span {
    overflow: hidden;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.72));
    font-size: var(--font-size-compact, 12px);
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-detail-controls {
    min-height: 0;
    padding: 0 2px 2px;
  }

  .combo-details {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: 10px;
  }

  .explanation-section {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .explanation-text {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    line-height: 1.4;
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
  }

  .coming-soon-badge {
    background: color-mix(in srgb, var(--semantic-warning) 20%, transparent);
    border: 1px solid
      color-mix(in srgb, var(--semantic-warning) 50%, transparent);
    border-radius: 6px;
    padding: 6px 10px;
    color: var(--semantic-warning);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-align: center;
  }

  .signup-badge {
    background: color-mix(in srgb, var(--theme-accent) 18%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 55%, transparent);
    border-radius: 6px;
    padding: 6px 10px;
    color: var(--theme-text, white);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-align: center;
  }

  /* Transformation settings inherit the color of the card that owns them.
     SegmentedControl consumes these local theme tokens without a second card. */
  .owned-configurator {
    --theme-accent: var(--owner-color);
    --theme-card-bg: color-mix(
      in srgb,
      var(--owner-color) 18%,
      var(--theme-panel-bg, #18152a)
    );
    --theme-card-hover-bg: color-mix(
      in srgb,
      var(--owner-color) 25%,
      var(--theme-panel-bg, #18152a)
    );
    --theme-stroke: color-mix(in srgb, var(--owner-color) 48%, transparent);
    --theme-text-dim: color-mix(
      in srgb,
      var(--theme-text, white) 72%,
      var(--owner-color)
    );

    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 10px;
    border-top: 1px solid
      color-mix(in srgb, var(--owner-color) 42%, transparent);
  }

  .configurator-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .configurator-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .configurator-title {
    color: var(--theme-text, white);
    font-size: var(--font-size-sm, 14px);
    font-weight: 700;
  }

  .configurator-selection {
    padding: 3px 8px;
    border: 1px solid color-mix(in srgb, var(--owner-color) 70%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--owner-color) 32%, transparent);
    color: var(--theme-text, white);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    text-align: center;
    white-space: nowrap;
  }

  .configurator-caption {
    display: grid;
    padding: 8px 10px;
    border-left: 3px solid var(--owner-color);
    border-radius: 0 8px 8px 0;
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, #18152a) 36%,
      transparent
    );
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    line-height: 1.4;
  }

  .configurator-caption-sizer,
  .configurator-caption-live {
    grid-area: 1 / 1;
  }

  .configurator-caption-sizer {
    visibility: hidden;
  }

  .reflection-axis-picker {
    --theme-accent: var(--reflection-color);
    --theme-card-bg: color-mix(
      in srgb,
      var(--reflection-color) 18%,
      var(--theme-panel-bg, #18152a)
    );
    --theme-card-hover-bg: color-mix(
      in srgb,
      var(--reflection-color) 24%,
      var(--theme-panel-bg, #18152a)
    );
    --theme-stroke: color-mix(
      in srgb,
      var(--reflection-color) 48%,
      transparent
    );
    --theme-text-dim: color-mix(
      in srgb,
      var(--theme-text, white) 72%,
      var(--reflection-color)
    );

    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 10px;
    border-top: 1px solid
      color-mix(in srgb, var(--reflection-color) 42%, transparent);
  }

  .axis-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .axis-title {
    color: var(--theme-text, white);
    font-size: var(--font-size-sm, 14px);
    font-weight: 700;
  }

  .axis-selection {
    width: 8ch;
    padding: 3px 8px;
    border: 1px solid
      color-mix(in srgb, var(--reflection-color) 70%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--reflection-color) 32%, transparent);
    color: var(--theme-text, white);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    text-align: center;
  }

  .axis-option {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    padding-block: 3px;
  }

  .axis-diagram {
    width: clamp(28px, 8cqw, 36px);
    height: clamp(28px, 8cqw, 36px);
    margin-bottom: 2px;
    overflow: visible;
  }

  .axis-ring {
    fill: color-mix(in srgb, currentColor 8%, transparent);
    stroke: currentColor;
    stroke-width: 1;
    opacity: 0.38;
  }

  .axis-point {
    fill: currentColor;
    opacity: 0.48;
  }

  .axis-line {
    stroke: currentColor;
    stroke-width: 3.5;
    stroke-linecap: round;
    filter: drop-shadow(0 0 3px currentColor);
  }

  .axis-option-label {
    color: currentColor;
    font-size: var(--font-size-compact, 12px);
    font-weight: 800;
    letter-spacing: 0.01em;
    white-space: nowrap;
  }

  .axis-option-name {
    color: currentColor;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    opacity: 0.72;
    white-space: nowrap;
  }

  .axis-caption {
    display: grid;
    padding: 8px 10px;
    border-left: 3px solid var(--reflection-color);
    border-radius: 0 8px 8px 0;
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, #18152a) 36%,
      transparent
    );
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 14px);
    line-height: 1.4;
  }

  .axis-caption-sizer,
  .axis-caption-live {
    grid-area: 1 / 1;
  }

  .axis-caption-sizer {
    visibility: hidden;
  }

  /* Ghost-sizer: same technique for the word-math line — its longest variant
     (the "too short" gate reason) reserves the height up front. */
  .word-math {
    display: grid;
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    font-weight: 700;
    color: var(--theme-text, white);
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .word-math-sizer,
  .word-math-live {
    grid-area: 1 / 1;
  }

  .word-math-sizer {
    visibility: hidden;
  }

  /* Sticky confirm dock. Sticks to the nearest scrollport bottom (the
     overlay itself in-card, drawer-inner inside LOOPDrawer). Negative side
     margins + own padding span the overlay's 12px gutter so the solid
     background fully covers content scrolling underneath. */
  .apply-dock {
    position: sticky;
    bottom: 0;
    z-index: 5;
    flex-shrink: 0;
    margin: 0 -12px -12px;
    padding: 8px 12px 12px;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #6366f1) 20%,
      #1a1a2e
    );
  }

  /* Below the side-by-side breakpoint the bottom nav overlaps the sheet's
     foot (the drawer content reserves clearance for it) — stick above it. */
  @media (max-width: 768px) {
    .desktop-loop-grid,
    .desktop-combo-details {
      display: none;
    }

    .mobile-loop-stage {
      display: block;
      width: 100%;
      height: clamp(260px, 45dvh, 320px);
      flex: 0 0 clamp(260px, 45dvh, 320px);
      min-height: 0;
      overflow: hidden;
    }

    .mobile-loop-picker :global(.loop-component-grid) {
      grid-auto-rows: 76px;
      gap: 8px;
    }

    .mobile-loop-picker :global(.loop-component-shell),
    .mobile-loop-picker :global(.loop-component-button) {
      min-height: 76px;
    }

    .mobile-loop-status {
      display: block;
      flex: 0 0 auto;
    }

    .apply-dock {
      bottom: 0;
    }
  }

  /* Portrait tablets remain bottom sheets until the shared layout manager
     actually chooses side-by-side mode. Match the Drawer's data-placement
     decision instead of letting a raw width breakpoint expose the desktop
     accordion inside a bottom sheet. */
  @media (min-width: 769px) and (max-width: 1023px) {
    :global(.loop-drawer-sheet[data-placement="bottom"]) .desktop-loop-grid,
    :global(.loop-drawer-sheet[data-placement="bottom"])
      .desktop-combo-details {
      display: none;
    }

    :global(.loop-drawer-sheet[data-placement="bottom"]) .mobile-loop-stage {
      display: block;
      width: 100%;
      height: clamp(260px, 45dvh, 320px);
      flex: 0 0 clamp(260px, 45dvh, 320px);
      min-height: 0;
      overflow: hidden;
    }

    :global(.loop-drawer-sheet[data-placement="bottom"])
      .mobile-loop-picker
      :global(.loop-component-grid) {
      grid-auto-rows: 76px;
      gap: 8px;
    }

    :global(.loop-drawer-sheet[data-placement="bottom"])
      .mobile-loop-picker
      :global(.loop-component-shell),
    :global(.loop-drawer-sheet[data-placement="bottom"])
      .mobile-loop-picker
      :global(.loop-component-button) {
      min-height: 76px;
    }

    :global(.loop-drawer-sheet[data-placement="bottom"]) .mobile-loop-status {
      display: block;
      flex: 0 0 auto;
    }

    :global(.loop-drawer-sheet[data-placement="bottom"]) .apply-dock {
      bottom: 0;
    }
  }

  /* Landscape phones and short laptop panes may use a right-side drawer, but
     they do not have the vertical room for three open desktop accordions. The
     compact picker owns the remaining height and each settings screen scrolls
     inside that stable stage. */
  @media (min-width: 769px) and (max-height: 700px) {
    :global(.loop-drawer-sheet[data-placement="right"]) .desktop-loop-grid,
    :global(.loop-drawer-sheet[data-placement="right"]) .desktop-combo-details {
      display: none;
    }

    :global(.loop-drawer-sheet[data-placement="right"]) .mobile-loop-stage {
      display: block;
      width: 100%;
      height: auto;
      flex: 1 1 0;
      min-height: 188px;
      overflow: hidden;
    }

    :global(.loop-drawer-sheet[data-placement="right"])
      .mobile-loop-picker
      :global(.loop-component-grid) {
      grid-auto-rows: 68px;
      gap: 6px;
    }

    :global(.loop-drawer-sheet[data-placement="right"])
      .mobile-loop-picker
      :global(.loop-component-shell),
    :global(.loop-drawer-sheet[data-placement="right"])
      .mobile-loop-picker
      :global(.loop-component-button) {
      min-height: 68px;
    }

    :global(.loop-drawer-sheet[data-placement="right"]) .mobile-loop-status {
      display: block;
      flex: 0 0 auto;
    }
  }

  /* On short phones the selected card's own caption already explains the
     transformation. Dropping the repeated combo sentence keeps that card's
     header and controls together without hiding lock or validation messages. */
  @media (max-width: 768px) and (max-height: 700px) {
    .explanation-text {
      display: none;
    }
  }

  .apply-button {
    flex-shrink: 0;
    width: 100%;
    padding: 12px 20px;
    min-height: var(--min-touch-target);

    background: color-mix(in srgb, var(--theme-accent) 30%, transparent);
    border: 2px solid var(--theme-accent);
    border-radius: 10px;
    color: var(--theme-text, white);

    font-size: var(--font-size-base, 16px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .apply-button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent) 45%, transparent);
    transform: translateY(-1px);
  }

  .apply-button:disabled,
  .apply-button.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Guest-locked Apply reads as a call-to-action, not a dead disabled button. */
  .apply-button.locked {
    opacity: 1;
    cursor: pointer;
    background: color-mix(in srgb, var(--theme-accent) 55%, transparent);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .apply-button,
    .close-button,
    .disable-button,
    .mobile-detail-back {
      transition: none;
    }
  }
</style>

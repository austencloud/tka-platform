<!--
  ChipMorphLab.svelte - Test different chip expansion approaches

  Comparing:
  A) Current: {#if} DOM swap (label pops from white to purple)
  B) Overlay: Chip stays in place, expands with z-index to cover siblings
-->
<script lang="ts">
  import { spring } from "svelte/motion";

  // ============================================================
  // SHARED STATE
  // ============================================================

  const SPRING_CONFIG = { stiffness: 0.3, damping: 0.8 };

  // Mutable values for each setting
  let dashesValue = $state("Mixed");
  let propsValue = $state("Mixed");
  let handsValue = $state("Smooth");

  const settings = [
    { id: "dashes", label: "Dashes", expandedLabel: "Dashes", getValue: () => dashesValue, setValue: (v: string) => dashesValue = v },
    { id: "props", label: "Props", expandedLabel: "Prop Reversals", getValue: () => propsValue, setValue: (v: string) => propsValue = v },
    { id: "hands", label: "Hands", expandedLabel: "Hand Reversals", getValue: () => handsValue, setValue: (v: string) => handsValue = v },
  ];

  const options = [
    { value: "smooth", label: "Smooth" },
    { value: "mixed", label: "Mixed" },
    { value: "high", label: "High" },
  ];

  // ============================================================
  // APPROACH A: Current {#if} swap
  // ============================================================

  let expandedA = $state<string | null>(null);
  const springA = spring(0, SPRING_CONFIG);

  function expandA(id: string) {
    expandedA = id;
    springA.set(1);
  }

  function collapseA() {
    expandedA = null;
    springA.set(0);
  }

  function selectOptionA(settingId: string, optionLabel: string) {
    const setting = settings.find(s => s.id === settingId);
    if (setting) {
      setting.setValue(optionLabel);
    }
    // Delay collapse for visual feedback
    setTimeout(() => collapseA(), 150);
  }

  // ============================================================
  // APPROACH B: True FLIP animation
  // ============================================================

  let expandedB = $state<string | null>(null);
  const springB = spring(0, SPRING_CONFIG);

  // Store refs to label elements for FLIP
  let labelRefs: Record<string, HTMLElement | null> = {};

  // FLIP animation state
  let flipTransform = $state<{ x: number; y: number; scaleX: number } | null>(null);
  let flipAnimating = $state(false); // When true, CSS transition is enabled
  let flippingId = $state<string | null>(null); // Which setting is currently being FLIPped

  function expandB(settingId: string) {
    const labelEl = labelRefs[settingId];
    if (!labelEl) {
      expandedB = settingId;
      springB.set(1);
      return;
    }

    // FIRST: Capture current position and size
    const firstRect = labelEl.getBoundingClientRect();

    // Instantly apply expanded state (layout changes immediately)
    expandedB = settingId;
    flippingId = settingId; // Track which label is being FLIPped
    flipAnimating = false; // Disable transition during INVERT

    // LAST/INVERT: After DOM updates, capture new position and apply inverse
    requestAnimationFrame(() => {
      const lastRect = labelEl.getBoundingClientRect();

      // Calculate delta from new position back to old position
      const deltaX = firstRect.left - lastRect.left;
      const deltaY = firstRect.top - lastRect.top;
      const scaleX = firstRect.width / lastRect.width;

      // Apply inverted transform - element appears in original position
      flipTransform = { x: deltaX, y: deltaY, scaleX };

      // PLAY: Enable transition and animate to final position (transform: none)
      requestAnimationFrame(() => {
        flipAnimating = true;
        flipTransform = { x: 0, y: 0, scaleX: 1 };
        springB.set(1);

        // Clear FLIP state after animation completes
        setTimeout(() => {
          flipTransform = null;
          flipAnimating = false;
          flippingId = null;
        }, 350);
      });
    });
  }

  function collapseB() {
    const settingId = expandedB;
    if (!settingId) return;

    const labelEl = labelRefs[settingId];
    if (!labelEl) {
      expandedB = null;
      springB.set(0);
      return;
    }

    // FIRST: Capture current (expanded) position
    const firstRect = labelEl.getBoundingClientRect();

    // Instantly apply collapsed state
    flippingId = settingId; // Track which label is being FLIPped
    flipAnimating = false;
    springB.set(0);

    // LAST/INVERT: After state change, capture new position
    requestAnimationFrame(() => {
      // Need to wait for expandedB to clear for proper collapsed position
      expandedB = null;

      requestAnimationFrame(() => {
        const lastRect = labelEl.getBoundingClientRect();

        const deltaX = firstRect.left - lastRect.left;
        const deltaY = firstRect.top - lastRect.top;
        const scaleX = firstRect.width / lastRect.width;

        flipTransform = { x: deltaX, y: deltaY, scaleX };

        // PLAY
        requestAnimationFrame(() => {
          flipAnimating = true;
          flipTransform = { x: 0, y: 0, scaleX: 1 };

          setTimeout(() => {
            flipTransform = null;
            flipAnimating = false;
            flippingId = null;
          }, 350);
        });
      });
    });
  }

  function selectOptionB(settingId: string, optionLabel: string) {
    const setting = settings.find(s => s.id === settingId);
    if (setting) {
      setting.setValue(optionLabel);
    }
    // Delay collapse for visual feedback
    setTimeout(() => collapseB(), 150);
  }
</script>

<div class="lab-container">
  <h2>Chip Morph Comparison</h2>
  <p class="subtitle">Click any chip to expand. Watch the label color transition.</p>

  <div class="comparison">
    <!-- ============================================================ -->
    <!-- APPROACH A: Current {#if} swap -->
    <!-- ============================================================ -->
    <div class="approach">
      <h3>A) Current: DOM Swap</h3>
      <p class="desc">Label pops because element is destroyed/recreated</p>

      <!-- Fake tool panel context -->
      <div class="fake-tool-panel">
        <div class="fake-input-row">
          <span class="fake-word">BELOVE</span>
          <button class="fake-btn"><i class="fas fa-backspace"></i></button>
          <button class="fake-btn"><i class="fas fa-times"></i></button>
        </div>

        <!-- Settings area - this is what we're testing -->
        <div class="settings-area" style:--expansion={$springA}>
          <!-- Row 1: Three setting chips -->
          <div class="chips-row-a" class:has-expanded={expandedA !== null}>
            {#each settings as setting (setting.id)}
              {@const isExpanded = expandedA === setting.id}
              {@const isHidden = expandedA !== null && !isExpanded}

              <div
                class="chip-wrapper-a"
                class:expanded={isExpanded}
                class:hidden={isHidden}
              >
                {#if isExpanded}
                  <div class="expanded-chip-a">
                    <button class="chip-header-a" onclick={collapseA}>
                      <i class="fas fa-chevron-left"></i>
                      <span class="chip-label expanded-label">{setting.expandedLabel}</span>
                    </button>
                    <div class="options-row-a">
                      {#each options as option}
                        <button
                          class="option-btn-a"
                          class:selected={setting.getValue() === option.label}
                          onclick={() => selectOptionA(setting.id, option.label)}
                        >
                          {option.label}
                        </button>
                      {/each}
                    </div>
                  </div>
                {:else}
                  <button class="chip-a" onclick={() => expandA(setting.id)}>
                    <span class="chip-label">{setting.label}</span>
                    <span class="chip-value">{setting.getValue()}</span>
                  </button>
                {/if}
              </div>
            {/each}
          </div>

          <!-- Row 2: Grid and Loop toggles -->
          <div class="toggles-row-a" class:hidden={expandedA !== null}>
            <button class="chip-a toggle-chip">
              <span class="chip-label">Grid</span>
              <span class="chip-value">Diamond</span>
            </button>
            <button class="chip-a toggle-chip">
              <span class="chip-label">Loop</span>
              <span class="chip-value">Off</span>
            </button>
          </div>
        </div>

        <button class="fake-generate-btn">
          <i class="fas fa-wand-magic-sparkles"></i>
          Generate
        </button>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- APPROACH B: Overlay expansion -->
    <!-- ============================================================ -->
    <div class="approach">
      <h3>B) Overlay: Same Element</h3>
      <p class="desc">Chip expands in place, covers siblings with z-index</p>

      <!-- Fake tool panel context -->
      <div class="fake-tool-panel">
        <div class="fake-input-row">
          <span class="fake-word">BELOVE</span>
          <button class="fake-btn"><i class="fas fa-backspace"></i></button>
          <button class="fake-btn"><i class="fas fa-times"></i></button>
        </div>

        <!-- Settings area - this is what we're testing -->
        <div class="settings-area settings-area-b" style:--expansion={$springB}>
          <!-- Row 1: Three setting chips -->
          <div class="chips-row-b">
            {#each settings as setting, index (setting.id)}
              {@const isExpanding = expandedB === setting.id}

              <!-- Placeholder maintains space -->
              <div class="chip-placeholder-b"></div>

              <!-- The actual chip -->
              <div
                class="chip-b"
                class:expanding={isExpanding}
                class:faded={expandedB !== null && !isExpanding}
                style:--morph-progress={isExpanding ? $springB : 0}
                style:--chip-index={index}
                onclick={() => {
                  if (!isExpanding && !expandedB) {
                    expandB(setting.id);
                  }
                }}
                role="button"
                tabindex="0"
              >
                <!-- Back icon - absolutely positioned, fades in at top-left -->
                <i
                  class="fas fa-chevron-left back-icon-b"
                  style:opacity={$springB}
                  onclick={(e) => {
                    if (isExpanding) {
                      e.stopPropagation();
                      collapseB();
                    }
                  }}
                ></i>

                <!-- Label - THE FLIP ELEMENT - same DOM node that morphs position -->
                {@const isFlipping = flippingId === setting.id}
                <span
                  class="chip-label-b"
                  bind:this={labelRefs[setting.id]}
                  style:transform={flipTransform && isFlipping
                    ? `translate(${flipTransform.x}px, ${flipTransform.y}px) scaleX(${flipTransform.scaleX})`
                    : undefined}
                  style:transition={flipAnimating && isFlipping
                    ? 'transform 300ms cubic-bezier(0.34, 1.2, 0.64, 1), color 300ms ease'
                    : 'none'}
                  onclick={(e) => {
                    if (isExpanding) {
                      e.stopPropagation();
                      collapseB();
                    }
                  }}
                >
                  {setting.label}
                </span>

                <!-- Value - stays centered, fades out -->
                <span
                  class="chip-value-b"
                  style:opacity={1 - $springB}
                >
                  {setting.getValue()}
                </span>

                <!-- Options - slide in from bottom -->
                <div
                  class="options-inside-b"
                  style:opacity={$springB}
                  style:pointer-events={isExpanding && $springB > 0.5 ? "auto" : "none"}
                >
                  {#each options as option}
                    <button
                      class="option-btn-b"
                      class:selected={setting.getValue() === option.label}
                      onclick={(e) => {
                        e.stopPropagation();
                        selectOptionB(setting.id, option.label);
                      }}
                      tabindex={isExpanding ? 0 : -1}
                    >
                      {option.label}
                    </button>
                  {/each}
                </div>
              </div>
            {/each}
          </div>

          <!-- Row 2: Grid and Loop toggles (underneath, visible when collapsed) -->
          <div class="toggles-row-b" class:hidden={expandedB !== null}>
            <button class="chip-a toggle-chip">
              <span class="chip-label">Grid</span>
              <span class="chip-value">Diamond</span>
            </button>
            <button class="chip-a toggle-chip">
              <span class="chip-label">Loop</span>
              <span class="chip-value">Off</span>
            </button>
          </div>
        </div>

        <button class="fake-generate-btn">
          <i class="fas fa-wand-magic-sparkles"></i>
          Generate
        </button>
      </div>
    </div>
  </div>

  <div class="notes">
    <h4>Key Differences:</h4>
    <ul>
      <li><strong>A (Current):</strong> The label "Props" is destroyed and "Prop Reversals" is created as a new element - hence the color pops instantly</li>
      <li><strong>B (Overlay):</strong> Same label element persists, text swaps at 50% progress, color transitions smoothly via CSS <code>color-mix()</code></li>
    </ul>
  </div>
</div>

<style>
  .lab-container {
    padding: 24px;
    max-width: 1000px;
    margin: 0 auto;
    color: var(--theme-text, #fff);
  }

  h2 {
    margin: 0 0 8px;
    font-size: 24px;
  }

  h3 {
    margin: 0 0 4px;
    font-size: 16px;
    color: var(--theme-accent, #6366f1);
  }

  h4 {
    margin: 0 0 8px;
    font-size: 14px;
  }

  .subtitle {
    margin: 0 0 24px;
    color: var(--theme-text-muted, rgba(255,255,255,0.6));
    font-size: 14px;
  }

  .desc {
    margin: 0 0 12px;
    color: var(--theme-text-muted, rgba(255,255,255,0.6));
    font-size: 12px;
  }

  .comparison {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 24px;
  }

  .approach {
    padding: 16px;
    background: var(--theme-card-bg, rgba(255,255,255,0.04));
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255,255,255,0.1));
    /* Fixed width to prevent expansion */
    min-width: 0;
    overflow: hidden;
  }

  .fake-tool-panel {
    /* Fixed width simulating mobile tool panel */
    width: 320px;
    max-width: 100%;
  }

  /* ============================================================ */
  /* FAKE TOOL PANEL - Simulates real context */
  /* ============================================================ */

  /* .fake-tool-panel width defined above in .approach section */
  .fake-tool-panel {
    background: var(--theme-panel-bg, rgba(18,18,28,0.98));
    border-radius: 18px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .fake-input-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255,255,255,0.04));
    border-radius: 12px;
  }

  .fake-word {
    flex: 1;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .fake-btn {
    width: 40px;
    height: 40px;
    background: var(--theme-card-bg, rgba(255,255,255,0.04));
    border: 1px solid var(--theme-stroke, rgba(255,255,255,0.1));
    border-radius: 8px;
    color: var(--theme-text-muted, rgba(255,255,255,0.6));
    cursor: pointer;
  }

  .fake-generate-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    background: #f97316;
    border: none;
    border-radius: 12px;
    color: white;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
  }

  .settings-area {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 132px;
  }

  /* ============================================================ */
  /* APPROACH A STYLES - Current DOM swap approach */
  /* ============================================================ */

  .chips-row-a {
    display: flex;
    gap: 8px;
  }

  .chips-row-a.has-expanded {
    height: 100%;
  }

  .chip-wrapper-a {
    flex: 1;
    transition: flex 300ms cubic-bezier(0.34, 1.2, 0.64, 1);
  }

  .chip-wrapper-a.expanded {
    flex: 1 0 100%;
    height: 100%;
  }

  .chip-wrapper-a.hidden {
    flex: 0;
    overflow: hidden;
    opacity: 0;
  }

  .chip-a {
    width: 100%;
    min-height: 56px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 12px;
    background: var(--theme-card-bg, rgba(255,255,255,0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255,255,255,0.1));
    border-radius: 18px;
    cursor: pointer;
    color: var(--theme-text, #fff);
  }

  .chip-a:hover {
    border-color: var(--theme-stroke-strong, rgba(255,255,255,0.2));
  }

  .expanded-chip-a {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    background: var(--theme-card-bg, rgba(255,255,255,0.04));
    border: 1.5px solid var(--theme-accent, #6366f1);
    border-radius: 18px;
    box-shadow:
      0 4px 20px rgba(99, 102, 241, 0.15),
      0 0 0 1px rgba(99, 102, 241, 0.1);
  }

  .chip-header-a {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    min-height: 40px;
    background: transparent;
    border: none;
    color: var(--theme-accent, #6366f1);
    cursor: pointer;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
  }

  .chip-header-a:hover {
    background: var(--theme-card-hover-bg, rgba(255,255,255,0.08));
  }

  .options-row-a {
    display: flex;
    gap: 4px;
    flex: 1;
  }

  .option-btn-a {
    flex: 1;
    min-height: 48px;
    background: var(--theme-panel-bg, rgba(18,18,28,0.6));
    border: 1.5px solid var(--theme-stroke, rgba(255,255,255,0.1));
    border-radius: 12px;
    color: var(--theme-text-muted, rgba(255,255,255,0.6));
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
  }

  .option-btn-a:hover {
    border-color: var(--theme-stroke-strong, rgba(255,255,255,0.2));
    color: var(--theme-text, #fff);
  }

  .option-btn-a.selected {
    background: color-mix(in srgb, var(--theme-accent) 25%, var(--theme-card-bg));
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-text, #fff);
  }

  .toggles-row-a {
    display: flex;
    gap: 8px;
    transition: opacity 200ms ease, max-height 200ms ease;
  }

  .toggles-row-a.hidden {
    opacity: 0;
    max-height: 0;
    overflow: hidden;
    margin-top: -8px;
  }

  .toggle-chip {
    flex: 1;
  }

  /* ============================================================ */
  /* APPROACH B STYLES - Overlay with absolute positioning */
  /* ============================================================ */

  .settings-area-b {
    position: relative;
  }

  .chips-row-b {
    display: flex;
    gap: 8px;
    position: relative;
    min-height: 56px;
  }

  /* Placeholder maintains layout space */
  .chip-placeholder-b {
    flex: 1;
    min-height: 56px;
  }

  /* The actual chip - positioned absolutely over the placeholder */
  .chip-b {
    position: absolute;
    top: 0;
    background: var(--theme-card-bg, rgba(255,255,255,0.04));
    border-radius: 18px;
    color: var(--theme-text, #fff);
    overflow: hidden;
    cursor: pointer;
    /* Spring-driven border color */
    border: 1.5px solid color-mix(
      in srgb,
      var(--theme-stroke, rgba(255,255,255,0.1)) calc(100% - var(--morph-progress, 0) * 100%),
      var(--theme-accent, #6366f1) calc(var(--morph-progress, 0) * 100%)
    );
    /* Position based on index */
    left: calc(var(--chip-index) * (33.33% + 2.67px));
    width: calc(33.33% - 5.33px);
    height: 56px;
    /* Smooth transitions */
    transition:
      left 300ms cubic-bezier(0.34, 1.2, 0.64, 1),
      width 300ms cubic-bezier(0.34, 1.2, 0.64, 1),
      height 300ms cubic-bezier(0.34, 1.2, 0.64, 1),
      opacity 200ms ease,
      box-shadow 200ms ease;
  }

  .chip-b.expanding {
    /* Expand to cover entire settings area */
    left: 0 !important;
    width: 100% !important;
    height: 132px;
    z-index: 10;
    cursor: default;
    box-shadow:
      0 4px 20px rgba(99, 102, 241, 0.15),
      0 0 0 1px rgba(99, 102, 241, 0.1);
  }

  .chip-b.faded {
    opacity: 0;
    pointer-events: none;
  }

  /* Back icon - absolutely positioned top-left, fades in */
  .back-icon-b {
    position: absolute;
    top: 12px;
    left: 12px;
    color: var(--theme-accent, #6366f1);
    font-size: 12px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: opacity 200ms ease;
  }

  .back-icon-b:hover {
    background: var(--theme-card-hover-bg, rgba(255,255,255,0.08));
  }

  /* Label - FLIP animation: position defined by state, transform by JS */
  .chip-label-b {
    position: absolute;
    white-space: nowrap;
    cursor: pointer;
    /* Color transitions with CSS - doesn't need FLIP */
    color: color-mix(
      in srgb,
      var(--theme-text-muted, rgba(255,255,255,0.6)) calc(100% - var(--morph-progress, 0) * 100%),
      var(--theme-accent, #6366f1) calc(var(--morph-progress, 0) * 100%)
    );
    /* COLLAPSED state: centered horizontally, positioned above center */
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    transform-origin: center center;
    font-size: 12px;
    font-weight: 500;
  }

  /* EXPANDED state: top-left position */
  .chip-b.expanding .chip-label-b {
    top: 12px;
    left: 32px;
    transform: translateX(0);
    font-size: 14px;
    font-weight: 600;
  }

  .chip-b.expanding .chip-label-b:hover {
    text-decoration: underline;
  }

  /* Value - centered below label, fades out when expanded */
  .chip-value-b {
    position: absolute;
    top: 32px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    color: var(--theme-text, #fff);
    pointer-events: none;
    transition: opacity 200ms ease;
  }

  /* Options - positioned at bottom, slide up */
  .options-inside-b {
    position: absolute;
    bottom: 8px;
    left: 8px;
    right: 8px;
    display: flex;
    gap: 4px;
    transition: opacity 200ms ease;
  }

  .chip-b:not(.expanding) .options-inside-b {
    bottom: -100px;
    opacity: 0;
  }

  /* Options INSIDE the chip */
  .options-inside-b {
    display: flex;
    gap: 4px;
    padding: 0 8px;
    overflow: hidden;
  }

  .option-btn-b {
    flex: 1;
    min-height: 48px;
    background: var(--theme-panel-bg, rgba(18,18,28,0.6));
    border: 1.5px solid var(--theme-stroke, rgba(255,255,255,0.1));
    border-radius: 12px;
    color: var(--theme-text-muted, rgba(255,255,255,0.6));
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
  }

  .option-btn-b:hover {
    border-color: var(--theme-stroke-strong, rgba(255,255,255,0.2));
    color: var(--theme-text, #fff);
  }

  .option-btn-b.selected {
    background: color-mix(in srgb, var(--theme-accent) 25%, var(--theme-card-bg));
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-text, #fff);
  }

  .toggles-row-b {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    transition: opacity 200ms ease, max-height 200ms ease;
  }

  .toggles-row-b.hidden {
    opacity: 0;
    max-height: 0;
    overflow: hidden;
    margin-top: 0;
  }

  /* ============================================================ */
  /* SHARED LABEL STYLES */
  /* ============================================================ */

  .chip-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--theme-text-muted, rgba(255,255,255,0.6));
  }

  .chip-label.expanded-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-accent, #6366f1);
  }

  .chip-value {
    font-size: 14px;
    font-weight: 600;
  }

  /* ============================================================ */
  /* NOTES */
  /* ============================================================ */

  .notes {
    padding: 16px;
    background: var(--theme-card-bg, rgba(255,255,255,0.04));
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255,255,255,0.1));
  }

  .notes ul {
    margin: 0;
    padding-left: 20px;
  }

  .notes li {
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--theme-text-muted, rgba(255,255,255,0.7));
  }

  .notes li:last-child {
    margin-bottom: 0;
  }

  @media (max-width: 700px) {
    .comparison {
      grid-template-columns: 1fr;
    }
  }
</style>

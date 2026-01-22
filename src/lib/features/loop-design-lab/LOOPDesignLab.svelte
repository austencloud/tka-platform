<!--
  LOOP Design Lab

  A playground for designing the ultimate LOOP primitive icon system.
  Pick your favorites, see combinations, export your choices.
-->
<script lang="ts">
  // The 7 concepts we need icons for
  const primitives = [
    { id: "rotated", name: "Rotated", description: "Position rotation (180° or 90°)", currentColor: "#36c3ff" },
    { id: "mirrored", name: "Mirrored", description: "Vertical reflection (left ↔ right)", currentColor: "#6F2DA8" },
    { id: "flipped", name: "Flipped", description: "Horizontal reflection (north ↔ south)", currentColor: "#e91e63" },
    { id: "swapped", name: "Swapped", description: "Blue/red hand exchange", currentColor: "#26e600" },
    { id: "inverted", name: "Inverted", description: "PRO ↔ ANTI motion flip", currentColor: "#eb7d00" },
    { id: "rewound", name: "Rewound", description: "Plays backward in time", currentColor: "#00bcd4" },
    { id: "freeform", name: "Freeform", description: "Circular but no pattern", currentColor: "#9e9e9e" },
  ] as const;

  type PrimitiveId = typeof primitives[number]["id"];

  // Icon design options for each primitive - using Font Awesome icons
  // Format: { id, name, faClass } - we'll render these as <i> elements
  const iconOptions: Record<PrimitiveId, { id: string; name: string; faClass: string }[]> = {
    rotated: [
      { id: "r1", name: "Sync", faClass: "fas fa-sync-alt" },
      { id: "r2", name: "Rotate", faClass: "fas fa-rotate" },
      { id: "r3", name: "Redo", faClass: "fas fa-redo" },
      { id: "r4", name: "Compass", faClass: "fas fa-compass" },
      { id: "r5", name: "Circle Notch", faClass: "fas fa-circle-notch" },
      { id: "r6", name: "Arrows Rotate", faClass: "fas fa-arrows-rotate" },
      { id: "r7", name: "Rotate Right", faClass: "fas fa-rotate-right" },
      { id: "r8", name: "Arrow Rotate Right", faClass: "fas fa-arrow-rotate-right" },
    ],
    mirrored: [
      { id: "m1", name: "Arrows Left Right", faClass: "fas fa-arrows-left-right" },
      { id: "m2", name: "Left Right", faClass: "fas fa-left-right" },
      { id: "m3", name: "Reflect Horizontal", faClass: "fas fa-reflect-horizontal" },
      { id: "m4", name: "Grip Lines Vertical", faClass: "fas fa-grip-lines-vertical" },
      { id: "m5", name: "Columns", faClass: "fas fa-columns" },
      { id: "m6", name: "Pause", faClass: "fas fa-pause" },
      { id: "m7", name: "Arrows Left Right to Line", faClass: "fas fa-arrows-left-right-to-line" },
      { id: "m8", name: "Code", faClass: "fas fa-code" },
    ],
    flipped: [
      { id: "f1", name: "Arrows Up Down", faClass: "fas fa-arrows-up-down" },
      { id: "f2", name: "Up Down", faClass: "fas fa-up-down" },
      { id: "f3", name: "Reflect Vertical", faClass: "fas fa-reflect-vertical" },
      { id: "f4", name: "Grip Lines", faClass: "fas fa-grip-lines" },
      { id: "f5", name: "Arrows Up Down Left Right", faClass: "fas fa-arrows-up-down-left-right" },
      { id: "f6", name: "Sort", faClass: "fas fa-sort" },
      { id: "f7", name: "Arrows To Line", faClass: "fas fa-arrows-to-line" },
      { id: "f8", name: "Hourglass", faClass: "fas fa-hourglass" },
    ],
    swapped: [
      { id: "s1", name: "Right Left", faClass: "fas fa-right-left" },
      { id: "s2", name: "Shuffle", faClass: "fas fa-shuffle" },
      { id: "s3", name: "Exchange", faClass: "fas fa-exchange-alt" },
      { id: "s4", name: "Retweet", faClass: "fas fa-retweet" },
      { id: "s5", name: "Arrows Cross", faClass: "fas fa-arrows-cross" },
      { id: "s6", name: "Yin Yang", faClass: "fas fa-yin-yang" },
      { id: "s7", name: "People Arrows", faClass: "fas fa-people-arrows" },
      { id: "s8", name: "Repeat", faClass: "fas fa-repeat" },
    ],
    inverted: [
      { id: "i1", name: "Circle Half Stroke", faClass: "fas fa-circle-half-stroke" },
      { id: "i2", name: "Adjust", faClass: "fas fa-adjust" },
      { id: "i3", name: "Moon", faClass: "fas fa-moon" },
      { id: "i4", name: "Sun", faClass: "fas fa-sun" },
      { id: "i5", name: "Plus Minus", faClass: "fas fa-plus-minus" },
      { id: "i6", name: "Not Equal", faClass: "fas fa-not-equal" },
      { id: "i7", name: "Toggle On", faClass: "fas fa-toggle-on" },
      { id: "i8", name: "Arrows Turn Right", faClass: "fas fa-arrows-turn-right" },
    ],
    rewound: [
      { id: "w1", name: "Backward Fast", faClass: "fas fa-backward-fast" },
      { id: "w2", name: "Backward Step", faClass: "fas fa-backward-step" },
      { id: "w3", name: "Backward", faClass: "fas fa-backward" },
      { id: "w4", name: "Clock Rotate Left", faClass: "fas fa-clock-rotate-left" },
      { id: "w5", name: "History", faClass: "fas fa-history" },
      { id: "w6", name: "Arrow Left", faClass: "fas fa-arrow-left" },
      { id: "w7", name: "Rotate Left", faClass: "fas fa-rotate-left" },
      { id: "w8", name: "Undo", faClass: "fas fa-undo" },
    ],
    freeform: [
      { id: "x1", name: "Question", faClass: "fas fa-question" },
      { id: "x2", name: "Circle Question", faClass: "fas fa-circle-question" },
      { id: "x3", name: "Asterisk", faClass: "fas fa-asterisk" },
      { id: "x4", name: "Infinity", faClass: "fas fa-infinity" },
      { id: "x5", name: "Wave Square", faClass: "fas fa-wave-square" },
      { id: "x6", name: "Circle Dashed", faClass: "fas fa-circle-dashed" },
      { id: "x7", name: "Slash", faClass: "fas fa-slash" },
      { id: "x8", name: "Ban", faClass: "fas fa-ban" },
    ],
  };

  // User selections state
  let selections = $state<Record<PrimitiveId, string | null>>({
    rotated: null,
    mirrored: null,
    flipped: null,
    swapped: null,
    inverted: null,
    rewound: null,
    freeform: null,
  });

  // Custom colors (editable)
  let colors = $state<Record<PrimitiveId, string>>({
    rotated: "#36c3ff",
    mirrored: "#6F2DA8",
    flipped: "#e91e63",
    swapped: "#26e600",
    inverted: "#eb7d00",
    rewound: "#00bcd4",
    freeform: "#9e9e9e",
  });

  // Preview sizes
  const previewSizes = [16, 24, 32, 48, 64];

  // Active primitives for combination preview
  let activePrimitives = $state<Set<PrimitiveId>>(new Set(["rotated", "mirrored"]));

  function togglePrimitive(id: PrimitiveId) {
    const newSet = new Set(activePrimitives);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    activePrimitives = newSet;
  }

  function selectIcon(primitiveId: PrimitiveId, iconId: string) {
    selections[primitiveId] = iconId;
  }

  function getSelectedIcon(primitiveId: PrimitiveId): { id: string; name: string; faClass: string } | null {
    const selectedId = selections[primitiveId];
    if (!selectedId) return null;
    return iconOptions[primitiveId].find(o => o.id === selectedId) ?? null;
  }

  function exportSelections() {
    const result = primitives.map(p => ({
      primitive: p.id,
      selectedIcon: selections[p.id],
      color: colors[p.id],
      iconData: getSelectedIcon(p.id),
    }));
    console.log("LOOP Icon Selections:", result);
    alert("Selections logged to console! Copy from DevTools.");
  }

  // Dark mode for testing
  let darkMode = $state(true);
</script>

<div class="lab" class:dark={darkMode}>
  <header class="lab-header">
    <h1>LOOP Design Lab</h1>
    <p>Pick the perfect icon for each LOOP primitive. Your choices will stand the test of time.</p>
    <div class="header-controls">
      <button onclick={() => darkMode = !darkMode}>
        {darkMode ? "Light Mode" : "Dark Mode"}
      </button>
      <button class="export-btn" onclick={exportSelections}>
        Export Selections
      </button>
    </div>
  </header>

  <!-- Icon Selection Grid -->
  <section class="selection-section">
    <h2>1. Choose Icons for Each Primitive</h2>

    {#each primitives as primitive}
      {@const selectedIcon = getSelectedIcon(primitive.id)}
      <div class="primitive-row">
        <div class="primitive-info">
          <h3 style="color: {colors[primitive.id]}">{primitive.name}</h3>
          <p>{primitive.description}</p>
          <div class="color-picker">
            <label>
              Color:
              <input type="color" bind:value={colors[primitive.id]} />
            </label>
          </div>
        </div>

        <div class="icon-options">
          {#each iconOptions[primitive.id] as option}
            <button
              class="icon-option"
              class:selected={selections[primitive.id] === option.id}
              onclick={() => selectIcon(primitive.id, option.id)}
              title={option.name}
            >
              <i class={option.faClass} style="font-size: 36px; color: {colors[primitive.id]}" aria-hidden="true"></i>
              <span class="option-name">{option.name}</span>
            </button>
          {/each}
        </div>

        {#if selectedIcon}
          <div class="size-preview">
            <span class="preview-label">Sizes:</span>
            {#each previewSizes as size}
              <div class="size-sample" title="{size}px">
                <i class={selectedIcon.faClass} style="font-size: {size}px; color: {colors[primitive.id]}" aria-hidden="true"></i>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </section>

  <!-- Combination Preview -->
  <section class="combination-section">
    <h2>2. Preview Combinations</h2>
    <p>Toggle primitives to see how they look together</p>

    <div class="toggle-row">
      {#each primitives.filter(p => p.id !== "freeform") as primitive}
        <button
          class="toggle-btn"
          class:active={activePrimitives.has(primitive.id)}
          style="--color: {colors[primitive.id]}"
          onclick={() => togglePrimitive(primitive.id)}
        >
          {primitive.name}
        </button>
      {/each}
    </div>

    <div class="combination-preview">
      <h3>Active: {activePrimitives.size === 0 ? "None (Freeform)" : [...activePrimitives].map(id => primitives.find(p => p.id === id)?.name).join(" + ")}</h3>

      <!-- Layout Option A: Horizontal strip -->
      <div class="layout-demo">
        <h4>Layout A: Icon Strip (only active shown)</h4>
        <div class="icon-strip">
          {#each primitives.filter(p => p.id !== "freeform") as primitive}
            {@const icon = getSelectedIcon(primitive.id)}
            {#if icon && activePrimitives.has(primitive.id)}
              <div class="strip-icon">
                <i class={icon.faClass} style="font-size: 28px; color: {colors[primitive.id]}" aria-hidden="true"></i>
              </div>
            {/if}
          {/each}
          {#if activePrimitives.size === 0}
            {@const freeformIcon = getSelectedIcon("freeform")}
            {#if freeformIcon}
              <div class="strip-icon">
                <i class={freeformIcon.faClass} style="font-size: 28px; color: {colors.freeform}" aria-hidden="true"></i>
              </div>
            {/if}
          {/if}
        </div>
      </div>

      <!-- Layout Option B: 2x3 Grid -->
      <div class="layout-demo">
        <h4>Layout B: 2x3 Grid (all visible, inactive dimmed)</h4>
        <div class="icon-grid">
          {#each primitives.filter(p => p.id !== "freeform") as primitive}
            {@const icon = getSelectedIcon(primitive.id)}
            <div
              class="grid-icon"
              class:inactive={!activePrimitives.has(primitive.id)}
            >
              {#if icon}
                <i class={icon.faClass} style="font-size: 24px; color: {colors[primitive.id]}" aria-hidden="true"></i>
              {:else}
                <span class="placeholder">?</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- Layout Option C: Circular -->
      <div class="layout-demo">
        <h4>Layout C: Circular Arrangement</h4>
        <div class="icon-circle">
          {#each primitives.filter(p => p.id !== "freeform") as primitive, i}
            {@const icon = getSelectedIcon(primitive.id)}
            {@const angle = (i * 60) - 90}
            {@const x = 50 + 35 * Math.cos(angle * Math.PI / 180)}
            {@const y = 50 + 35 * Math.sin(angle * Math.PI / 180)}
            <div
              class="circle-icon"
              class:inactive={!activePrimitives.has(primitive.id)}
              style="left: {x}%; top: {y}%"
            >
              {#if icon}
                <i class={icon.faClass} style="font-size: 20px; color: {colors[primitive.id]}" aria-hidden="true"></i>
              {:else}
                <span class="placeholder">?</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  </section>

  <!-- Summary -->
  <section class="summary-section">
    <h2>3. Your Selections</h2>
    <div class="summary-grid">
      {#each primitives as primitive}
        {@const icon = getSelectedIcon(primitive.id)}
        <div class="summary-item" class:unselected={!icon}>
          <span class="summary-name" style="color: {colors[primitive.id]}">{primitive.name}:</span>
          {#if icon}
            <span class="summary-value">{icon.name}</span>
            <i class={icon.faClass} style="font-size: 20px; color: {colors[primitive.id]}" aria-hidden="true"></i>
          {:else}
            <span class="summary-value unselected">Not selected</span>
          {/if}
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  .lab {
    min-height: 100%;
    padding: 24px;
    background: var(--theme-panel-bg, #1a1a2e);
    color: var(--theme-text, #ffffff);
    overflow-y: auto;
  }

  .lab.dark {
    background: #0d0d1a;
  }

  .lab:not(.dark) {
    background: #f5f5f5;
    color: #1a1a2e;
  }

  .lab-header {
    text-align: center;
    margin-bottom: 40px;
    padding-bottom: 24px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }

  .lab-header h1 {
    font-size: 2rem;
    margin: 0 0 8px;
    background: linear-gradient(135deg, #36c3ff, #6F2DA8, #eb7d00);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .lab-header p {
    opacity: 0.7;
    margin: 0;
  }

  .header-controls {
    margin-top: 16px;
    display: flex;
    gap: 12px;
    justify-content: center;
  }

  .header-controls button {
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.05);
    color: inherit;
    cursor: pointer;
    font-size: 14px;
  }

  .header-controls button:hover {
    background: rgba(255,255,255,0.1);
  }

  .export-btn {
    background: rgba(99, 102, 241, 0.2) !important;
    border-color: rgba(99, 102, 241, 0.5) !important;
  }

  section {
    margin-bottom: 48px;
  }

  h2 {
    font-size: 1.5rem;
    margin: 0 0 24px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }

  .primitive-row {
    margin-bottom: 32px;
    padding: 20px;
    background: rgba(255,255,255,0.03);
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.05);
  }

  .primitive-info {
    margin-bottom: 16px;
  }

  .primitive-info h3 {
    margin: 0 0 4px;
    font-size: 1.25rem;
  }

  .primitive-info p {
    margin: 0;
    opacity: 0.6;
    font-size: 14px;
  }

  .color-picker {
    margin-top: 8px;
  }

  .color-picker label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    opacity: 0.7;
  }

  .color-picker input[type="color"] {
    width: 32px;
    height: 24px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .icon-options {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
  }

  .icon-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px;
    background: rgba(255,255,255,0.02);
    border: 2px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 90px;
    color: inherit;
  }

  .icon-option:hover {
    background: rgba(255,255,255,0.05);
    border-color: rgba(255,255,255,0.2);
  }

  .icon-option.selected {
    background: rgba(99, 102, 241, 0.15);
    border-color: #6366f1;
    box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
  }

  .option-name {
    font-size: 11px;
    opacity: 0.7;
    text-align: center;
  }

  .size-preview {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px;
    background: rgba(0,0,0,0.2);
    border-radius: 8px;
  }

  .preview-label {
    font-size: 13px;
    opacity: 0.6;
  }

  .size-sample {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    background: rgba(255,255,255,0.03);
    border-radius: 4px;
  }

  /* Combination section */
  .toggle-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 24px;
  }

  .toggle-btn {
    padding: 8px 16px;
    border: 2px solid var(--color);
    background: transparent;
    color: var(--color);
    border-radius: 20px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
  }

  .toggle-btn:hover {
    background: color-mix(in srgb, var(--color) 20%, transparent);
  }

  .toggle-btn.active {
    background: var(--color);
    color: white;
  }

  .combination-preview {
    padding: 24px;
    background: rgba(255,255,255,0.02);
    border-radius: 12px;
  }

  .combination-preview h3 {
    margin: 0 0 24px;
    text-align: center;
  }

  .layout-demo {
    margin-bottom: 32px;
    padding: 20px;
    background: rgba(0,0,0,0.2);
    border-radius: 8px;
  }

  .layout-demo h4 {
    margin: 0 0 16px;
    font-size: 14px;
    opacity: 0.7;
  }

  .icon-strip {
    display: flex;
    gap: 8px;
    min-height: 40px;
    align-items: center;
  }

  .strip-icon {
    padding: 4px;
    background: rgba(255,255,255,0.05);
    border-radius: 6px;
  }

  .icon-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    max-width: 150px;
  }

  .grid-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    background: rgba(255,255,255,0.05);
    border-radius: 6px;
    transition: opacity 0.2s;
  }

  .grid-icon.inactive {
    opacity: 0.2;
  }

  .icon-circle {
    position: relative;
    width: 160px;
    height: 160px;
    margin: 0 auto;
  }

  .circle-icon {
    position: absolute;
    transform: translate(-50%, -50%);
    padding: 6px;
    background: rgba(255,255,255,0.05);
    border-radius: 50%;
    transition: opacity 0.2s;
  }

  .circle-icon.inactive {
    opacity: 0.2;
  }

  .placeholder {
    font-size: 16px;
    opacity: 0.3;
  }

  /* Summary */
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  .summary-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(255,255,255,0.03);
    border-radius: 8px;
  }

  .summary-item.unselected {
    opacity: 0.5;
  }

  .summary-name {
    font-weight: 600;
  }

  .summary-value {
    flex: 1;
    font-size: 14px;
    opacity: 0.7;
  }

  .summary-value.unselected {
    font-style: italic;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .lab {
      padding: 16px;
    }

    .lab-header h1 {
      font-size: 1.5rem;
    }

    .icon-options {
      justify-content: center;
    }
  }
</style>

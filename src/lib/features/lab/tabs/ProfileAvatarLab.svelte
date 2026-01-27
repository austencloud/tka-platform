<!--
  ProfileAvatarLab.svelte - Experiment with generated avatar designs

  Simulates the signup experience:
  - User has already picked their favorite prop
  - They see their generated avatar
  - Shuffle button cycles through gradient options
  - "Upload photo instead" option available
-->
<script lang="ts">
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import {
    PROP_TYPE_DISPLAY_REGISTRY,
    VARIANT_PROP_TYPES,
  } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";

  // ============ TYPES ============

  interface GradientOption {
    id: string;
    name: string;
    gradient: string;
  }

  interface PropOption {
    id: PropType;
    label: string;
    image: string;
  }

  // ============ GRADIENT LIBRARY ============

  // Visually interesting multi-stop gradients
  // These are independent of the app's theme system
  const GRADIENT_LIBRARY: GradientOption[] = [
    // Warm gradients
    {
      id: "sunset",
      name: "Sunset",
      gradient: "linear-gradient(135deg, #ff6b6b 0%, #feca57 50%, #ff9ff3 100%)",
    },
    {
      id: "ember",
      name: "Ember",
      gradient: "linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #fbbf24 100%)",
    },
    {
      id: "autumn",
      name: "Autumn",
      gradient: "linear-gradient(135deg, #92400e 0%, #dc2626 50%, #f59e0b 100%)",
    },
    {
      id: "coral",
      name: "Coral",
      gradient: "linear-gradient(135deg, #f43f5e 0%, #fb7185 50%, #fda4af 100%)",
    },

    // Cool gradients
    {
      id: "ocean",
      name: "Ocean",
      gradient: "linear-gradient(135deg, #0c4a6e 0%, #0891b2 50%, #22d3ee 100%)",
    },
    {
      id: "twilight",
      name: "Twilight",
      gradient: "linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #818cf8 100%)",
    },
    {
      id: "arctic",
      name: "Arctic",
      gradient: "linear-gradient(135deg, #1e3a5f 0%, #3b82f6 50%, #93c5fd 100%)",
    },
    {
      id: "mint",
      name: "Mint",
      gradient: "linear-gradient(135deg, #064e3b 0%, #10b981 50%, #6ee7b7 100%)",
    },

    // Vibrant multi-color gradients
    {
      id: "rainbow",
      name: "Rainbow",
      gradient: "linear-gradient(135deg, #ef4444 0%, #f59e0b 20%, #22c55e 40%, #3b82f6 60%, #8b5cf6 80%, #ec4899 100%)",
    },
    {
      id: "neon",
      name: "Neon",
      gradient: "linear-gradient(135deg, #f472b6 0%, #c084fc 33%, #60a5fa 66%, #34d399 100%)",
    },
    {
      id: "aurora",
      name: "Aurora",
      gradient: "linear-gradient(135deg, #0f766e 0%, #22d3ee 25%, #a78bfa 50%, #f472b6 75%, #fbbf24 100%)",
    },
    {
      id: "cosmic",
      name: "Cosmic",
      gradient: "linear-gradient(135deg, #1e1b4b 0%, #7c3aed 30%, #ec4899 60%, #fbbf24 100%)",
    },

    // Earthy/natural gradients
    {
      id: "forest",
      name: "Forest",
      gradient: "linear-gradient(135deg, #0d3320 0%, #166534 50%, #84cc16 100%)",
    },
    {
      id: "sakura",
      name: "Sakura",
      gradient: "linear-gradient(135deg, #831843 0%, #db2777 50%, #fbcfe8 100%)",
    },
    {
      id: "lavender",
      name: "Lavender",
      gradient: "linear-gradient(135deg, #4c1d95 0%, #8b5cf6 50%, #ddd6fe 100%)",
    },
    {
      id: "earth",
      name: "Earth",
      gradient: "linear-gradient(135deg, #78350f 0%, #a16207 50%, #84cc16 100%)",
    },

    // Dark/moody gradients
    {
      id: "midnight",
      name: "Midnight",
      gradient: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #3b82f6 100%)",
    },
    {
      id: "void",
      name: "Void",
      gradient: "linear-gradient(135deg, #18181b 0%, #3f3f46 50%, #a855f7 100%)",
    },
    {
      id: "shadow",
      name: "Shadow",
      gradient: "linear-gradient(135deg, #1c1917 0%, #44403c 50%, #78716c 100%)",
    },
    {
      id: "obsidian",
      name: "Obsidian",
      gradient: "linear-gradient(135deg, #0c0a09 0%, #292524 40%, #dc2626 100%)",
    },
  ];

  // ============ PROP OPTIONS ============

  // Props that are NOT actual spinning props (excluded from avatar options)
  const NON_PROP_TYPES = new Set([PropType.HAND]);

  // Build prop options - exclude variants and non-props
  const PROPS: PropOption[] = Object.entries(PROP_TYPE_DISPLAY_REGISTRY)
    .filter(([propType]) => {
      const pt = propType as PropType;
      return !VARIANT_PROP_TYPES.includes(pt) && !NON_PROP_TYPES.has(pt);
    })
    .map(([propType, info]) => ({
      id: propType as PropType,
      label: info.label,
      image: info.image,
    }));

  // ============ STATE ============

  let selectedGradientIndex = $state<number>(0);
  let selectedProp = $state<PropType>(PropType.STAFF);
  let showUploadPrompt = $state<boolean>(false);

  // Simulated user name for the preview
  const userName = "Austen Cloud";

  // ============ DERIVED ============

  const currentGradient = $derived(
    GRADIENT_LIBRARY[selectedGradientIndex] ?? GRADIENT_LIBRARY[0]!
  );

  const currentPropImage = $derived(
    PROPS.find((p) => p.id === selectedProp)?.image ?? ""
  );

  // ============ ACTIONS ============

  function shuffle() {
    // Pick a random gradient that's different from current
    let newIndex: number;
    do {
      newIndex = Math.floor(Math.random() * GRADIENT_LIBRARY.length);
    } while (newIndex === selectedGradientIndex && GRADIENT_LIBRARY.length > 1);
    selectedGradientIndex = newIndex;
  }

  function nextGradient() {
    selectedGradientIndex = (selectedGradientIndex + 1) % GRADIENT_LIBRARY.length;
  }

  function prevGradient() {
    selectedGradientIndex =
      (selectedGradientIndex - 1 + GRADIENT_LIBRARY.length) % GRADIENT_LIBRARY.length;
  }
</script>

<div class="avatar-lab">
  <!-- Signup Simulation -->
  <section class="signup-preview">
    <header class="preview-header">
      <h2>Almost done!</h2>
      <p>Here's how your profile will look</p>
    </header>

    <div class="profile-card">
      <div class="avatar-container">
        <div
          class="avatar-preview"
          style="background: {currentGradient.gradient};"
        >
          {#if currentPropImage}
            <img
              src={currentPropImage}
              alt="Prop silhouette"
              class="prop-silhouette"
            />
          {/if}
        </div>
      </div>

      <div class="user-info">
        <span class="user-name">{userName}</span>
        <span class="gradient-name">{currentGradient.name}</span>
      </div>

      <div class="avatar-controls">
        <button class="control-btn" onclick={prevGradient} title="Previous">
          <i class="fas fa-chevron-left"></i>
        </button>
        <button class="shuffle-btn" onclick={shuffle}>
          <i class="fas fa-random"></i>
          <span>Shuffle</span>
        </button>
        <button class="control-btn" onclick={nextGradient} title="Next">
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>

      <button
        class="upload-btn"
        onclick={() => (showUploadPrompt = !showUploadPrompt)}
      >
        <i class="fas fa-camera"></i>
        <span>Upload photo instead</span>
      </button>

      {#if showUploadPrompt}
        <div class="upload-prompt">
          <p>Photo upload would appear here</p>
        </div>
      {/if}
    </div>
  </section>

  <!-- Prop Selection (simulating "favorite prop" from earlier in signup) -->
  <section class="prop-section">
    <h3>Your Favorite Prop</h3>
    <p class="section-hint">This was selected earlier in signup</p>
    <div class="prop-options">
      {#each PROPS as prop}
        <button
          class="prop-option"
          class:selected={selectedProp === prop.id}
          onclick={() => (selectedProp = prop.id)}
          title={prop.label}
        >
          <img src={prop.image} alt={prop.label} />
        </button>
      {/each}
    </div>
  </section>

  <!-- All Gradients Grid -->
  <section class="gradient-gallery">
    <h3>All Gradient Options ({GRADIENT_LIBRARY.length})</h3>
    <div class="gradient-grid">
      {#each GRADIENT_LIBRARY as gradient, index}
        <button
          class="gradient-preview"
          class:selected={selectedGradientIndex === index}
          onclick={() => (selectedGradientIndex = index)}
          title={gradient.name}
        >
          <div
            class="gradient-avatar"
            style="background: {gradient.gradient};"
          >
            {#if currentPropImage}
              <img
                src={currentPropImage}
                alt="Prop"
                class="prop-silhouette small"
              />
            {/if}
          </div>
          <span class="gradient-label">{gradient.name}</span>
        </button>
      {/each}
    </div>
  </section>

  <!-- Size Variations -->
  <section class="size-demo">
    <h3>Size Variations</h3>
    <div class="size-row">
      {#each [32, 48, 64, 96, 128] as size}
        <div class="size-item">
          <div
            class="avatar-preview"
            style="
              width: {size}px;
              height: {size}px;
              background: {currentGradient.gradient};
            "
          >
            {#if currentPropImage}
              <img
                src={currentPropImage}
                alt="Prop"
                class="prop-silhouette"
              />
            {/if}
          </div>
          <span class="size-label">{size}px</span>
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  .avatar-lab {
    display: flex;
    flex-direction: column;
    gap: 32px;
    padding: 24px;
    overflow-y: auto;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, #ffffff);
  }

  /* Signup Preview Section */
  .signup-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }

  .preview-header {
    text-align: center;
  }

  .preview-header h2 {
    font-size: 24px;
    font-weight: 600;
    margin: 0 0 8px 0;
  }

  .preview-header p {
    font-size: 14px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  .profile-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 32px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    max-width: 320px;
    width: 100%;
  }

  .avatar-container {
    position: relative;
  }

  .avatar-preview {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  .prop-silhouette {
    width: 55%;
    height: 55%;
    object-fit: contain;
    filter: brightness(0) invert(1) opacity(0.9);
  }

  .prop-silhouette.small {
    width: 50%;
    height: 50%;
  }

  .user-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .user-name {
    font-size: 18px;
    font-weight: 600;
  }

  .gradient-name {
    font-size: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .avatar-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .control-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .control-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .shuffle-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .shuffle-btn:hover {
    filter: brightness(1.1);
    transform: scale(1.02);
  }

  .shuffle-btn:active {
    transform: scale(0.98);
  }

  .upload-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .upload-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .upload-prompt {
    padding: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
    width: 100%;
    text-align: center;
    font-size: 13px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* Prop Section */
  .prop-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .prop-section h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .section-hint {
    font-size: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    margin: 0 0 8px 0;
  }

  .prop-options {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .prop-option {
    width: 44px;
    height: 44px;
    padding: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .prop-option:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .prop-option.selected {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
  }

  .prop-option img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: brightness(0) invert(1);
  }

  /* Gradient Gallery */
  .gradient-gallery {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .gradient-gallery h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .gradient-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 12px;
  }

  .gradient-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px;
    background: transparent;
    border: 2px solid transparent;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .gradient-preview:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .gradient-preview.selected {
    border-color: var(--theme-accent, #6366f1);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .gradient-avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .gradient-label {
    font-size: 11px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* Size Demo */
  .size-demo {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .size-demo h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .size-row {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    flex-wrap: wrap;
  }

  .size-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .size-label {
    font-size: 11px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }
</style>

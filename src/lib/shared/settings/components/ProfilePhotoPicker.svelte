<!--
  ProfilePhotoPicker.svelte - Profile photo selection

  Options:
  1. Upload a photo
  2. Use Google photo (if linked)
  3. Use Facebook photo (if linked)
  4. Generate avatar (gradient + prop) - auto-matches user's theme

  Adaptive: Modal on desktop, drawer on mobile
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import RobustAvatar from "$lib/shared/components/avatar/RobustAvatar.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { container } from "$lib/shared/di";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import {
    PROP_TYPE_DISPLAY_REGISTRY,
    VARIANT_PROP_TYPES,
  } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { responsiveLayoutManager } from "$lib/features/create/shared/services/implementations/ResponsiveLayoutManager";
  import { constructGoogleAvatarUrl } from "$lib/shared/foundation/utils/google-avatar";
  import { BackgroundType } from "$lib/shared/background/shared/domain/enums/background-enums";
  import { BACKGROUND_THEME_COLORS } from "$lib/shared/settings/utils/background-theme-calculator";

  // ============ PROPS ============

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    onPhotoSelected: (photoData: PhotoSelection) => Promise<void>;
  }

  let { isOpen = $bindable(), onClose, onPhotoSelected }: Props = $props();

  // ============ TYPES ============

  export type PhotoSelectionType = "upload" | "google" | "facebook" | "generated";

  export interface PhotoSelection {
    type: PhotoSelectionType;
    file?: File;
    url?: string;
    generatedData?: {
      gradientId: string;
      gradient: string;
      propType: PropType;
    };
  }

  interface GradientOption {
    id: string;
    name: string;
    gradient: string;
    family: string;
  }

  interface ColorFamily {
    id: string;
    name: string;
    icon: string;
  }

  interface PropOption {
    id: PropType;
    label: string;
    image: string;
  }

  // ============ ALL GRADIENTS (organized by family) ============

  const ALL_GRADIENTS: GradientOption[] = [
    // Warm family
    { id: "sunset", name: "Sunset", gradient: "linear-gradient(135deg, #ff6b6b 0%, #feca57 50%, #ff9ff3 100%)", family: "warm" },
    { id: "ember", name: "Ember", gradient: "linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #fbbf24 100%)", family: "warm" },
    { id: "autumn", name: "Autumn", gradient: "linear-gradient(135deg, #92400e 0%, #dc2626 50%, #f59e0b 100%)", family: "warm" },
    { id: "coral", name: "Coral", gradient: "linear-gradient(135deg, #f43f5e 0%, #fb7185 50%, #fda4af 100%)", family: "warm" },
    // Cool family
    { id: "ocean", name: "Ocean", gradient: "linear-gradient(135deg, #0c4a6e 0%, #0891b2 50%, #22d3ee 100%)", family: "cool" },
    { id: "twilight", name: "Twilight", gradient: "linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #818cf8 100%)", family: "cool" },
    { id: "arctic", name: "Arctic", gradient: "linear-gradient(135deg, #1e3a5f 0%, #3b82f6 50%, #93c5fd 100%)", family: "cool" },
    { id: "mint", name: "Mint", gradient: "linear-gradient(135deg, #064e3b 0%, #10b981 50%, #6ee7b7 100%)", family: "cool" },
    // Vibrant family
    { id: "rainbow", name: "Rainbow", gradient: "linear-gradient(135deg, #ef4444 0%, #f59e0b 20%, #22c55e 40%, #3b82f6 60%, #8b5cf6 80%, #ec4899 100%)", family: "vibrant" },
    { id: "neon", name: "Neon", gradient: "linear-gradient(135deg, #f472b6 0%, #c084fc 33%, #60a5fa 66%, #34d399 100%)", family: "vibrant" },
    { id: "aurora", name: "Aurora", gradient: "linear-gradient(135deg, #0f766e 0%, #22d3ee 25%, #a78bfa 50%, #f472b6 75%, #fbbf24 100%)", family: "vibrant" },
    { id: "cosmic", name: "Cosmic", gradient: "linear-gradient(135deg, #1e1b4b 0%, #7c3aed 30%, #ec4899 60%, #fbbf24 100%)", family: "vibrant" },
    // Earth family
    { id: "forest", name: "Forest", gradient: "linear-gradient(135deg, #0d3320 0%, #166534 50%, #84cc16 100%)", family: "earth" },
    { id: "sakura", name: "Sakura", gradient: "linear-gradient(135deg, #831843 0%, #db2777 50%, #fbcfe8 100%)", family: "earth" },
    { id: "lavender", name: "Lavender", gradient: "linear-gradient(135deg, #4c1d95 0%, #8b5cf6 50%, #ddd6fe 100%)", family: "earth" },
    { id: "sand", name: "Sand", gradient: "linear-gradient(135deg, #78350f 0%, #a16207 50%, #84cc16 100%)", family: "earth" },
    // Dark family
    { id: "midnight", name: "Midnight", gradient: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #3b82f6 100%)", family: "dark" },
    { id: "void", name: "Void", gradient: "linear-gradient(135deg, #18181b 0%, #3f3f46 50%, #a855f7 100%)", family: "dark" },
    { id: "shadow", name: "Shadow", gradient: "linear-gradient(135deg, #1c1917 0%, #44403c 50%, #78716c 100%)", family: "dark" },
    { id: "obsidian", name: "Obsidian", gradient: "linear-gradient(135deg, #0c0a09 0%, #292524 40%, #dc2626 100%)", family: "dark" },
  ];

  const COLOR_FAMILIES: ColorFamily[] = [
    { id: "warm", name: "Warm", icon: "fa-fire" },
    { id: "cool", name: "Cool", icon: "fa-snowflake" },
    { id: "vibrant", name: "Vibrant", icon: "fa-rainbow" },
    { id: "earth", name: "Earth", icon: "fa-leaf" },
    { id: "dark", name: "Dark", icon: "fa-moon" },
  ];

  // Map background types to gradient families
  const THEME_TO_FAMILY: Record<BackgroundType, string> = {
    [BackgroundType.PRIDE]: "vibrant",
    [BackgroundType.SNOWFALL]: "cool",
    [BackgroundType.NIGHT_SKY]: "cool",
    [BackgroundType.DEEP_OCEAN]: "cool",
    [BackgroundType.EMBER_GLOW]: "warm",
    [BackgroundType.SAKURA_DRIFT]: "earth",
    [BackgroundType.FIREFLY_FOREST]: "earth",
    [BackgroundType.AUTUMN_DRIFT]: "warm",
    [BackgroundType.SOLID_COLOR]: "dark",
    [BackgroundType.LINEAR_GRADIENT]: "vibrant",
  };

  // Map background types to specific gradients for closer match
  const THEME_TO_GRADIENT: Record<BackgroundType, string> = {
    [BackgroundType.PRIDE]: "rainbow",
    [BackgroundType.SNOWFALL]: "arctic",
    [BackgroundType.NIGHT_SKY]: "twilight",
    [BackgroundType.DEEP_OCEAN]: "ocean",
    [BackgroundType.EMBER_GLOW]: "ember",
    [BackgroundType.SAKURA_DRIFT]: "sakura",
    [BackgroundType.FIREFLY_FOREST]: "forest",
    [BackgroundType.AUTUMN_DRIFT]: "autumn",
    [BackgroundType.SOLID_COLOR]: "void",
    [BackgroundType.LINEAR_GRADIENT]: "cosmic",
  };

  // ============ PROP OPTIONS ============

  const NON_PROP_TYPES = new Set([PropType.HAND]);

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

  let activeTab = $state<"options" | "generate">("options");
  let selectedGradientId = $state<string>("twilight");
  let selectedProp = $state<PropType>(PropType.STAFF);
  let saving = $state(false);
  let fileInputRef: HTMLInputElement | null = $state(null);
  let initialized = $state(false);

  // ============ DERIVED ============

  const user = $derived(authState.user);
  const profilePictureManager = container.items.profilePictureManager;
  const providerIds = $derived(user ? profilePictureManager.getProviderIds(user) : {});
  const hasGoogle = $derived(!!providerIds.googleId);
  const hasFacebook = $derived(!!providerIds.facebookId);

  const googlePhotoUrl = $derived(
    providerIds.googleId ? constructGoogleAvatarUrl(providerIds.googleId, 96) : null
  );

  let isDesktop = $state(false);
  $effect(() => {
    isDesktop = responsiveLayoutManager.shouldUseSideBySideLayout();
    const unsubscribe = responsiveLayoutManager.onLayoutChange(() => {
      isDesktop = responsiveLayoutManager.shouldUseSideBySideLayout();
    });
    return unsubscribe;
  });

  const selectedGradient = $derived(
    ALL_GRADIENTS.find((g) => g.id === selectedGradientId) ?? ALL_GRADIENTS[0]!
  );

  const selectedFamilyId = $derived(selectedGradient.family);

  const familyGradients = $derived(
    ALL_GRADIENTS.filter((g) => g.family === selectedFamilyId)
  );

  const currentPropImage = $derived(
    PROPS.find((p) => p.id === selectedProp)?.image ?? ""
  );

  // Initialize based on user's theme and prop preference
  $effect(() => {
    if (initialized) return;

    const settings = getSettings();

    // Set gradient based on user's background theme
    if (settings.backgroundType) {
      const matchingGradientId = THEME_TO_GRADIENT[settings.backgroundType];
      if (matchingGradientId) {
        selectedGradientId = matchingGradientId;
      }
    }

    // Set prop based on user's favorite
    if (settings.bluePropType && PROPS.some((p) => p.id === settings.bluePropType)) {
      selectedProp = settings.bluePropType;
    }

    initialized = true;
  });

  // ============ ACTIONS ============

  function handleClose() {
    activeTab = "options";
    onClose();
  }

  function handleBackdropClick() {
    handleClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && isOpen) {
      handleClose();
    }
  }

  function selectFamily(familyId: string) {
    // Pick the first gradient from this family
    const firstInFamily = ALL_GRADIENTS.find((g) => g.family === familyId);
    if (firstInFamily) {
      selectedGradientId = firstInFamily.id;
    }
  }

  function selectGradient(gradientId: string) {
    selectedGradientId = gradientId;
  }

  function shuffle() {
    // Shuffle within current family
    const options = familyGradients.filter((g) => g.id !== selectedGradientId);
    if (options.length > 0) {
      const randomIndex = Math.floor(Math.random() * options.length);
      selectedGradientId = options[randomIndex]!.id;
    }
  }

  function triggerFileUpload() {
    fileInputRef?.click();
  }

  async function handleFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    saving = true;
    try {
      await onPhotoSelected({ type: "upload", file });
      handleClose();
    } finally {
      saving = false;
      input.value = "";
    }
  }

  async function useGooglePhoto() {
    if (!googlePhotoUrl) return;
    saving = true;
    try {
      await onPhotoSelected({ type: "google", url: googlePhotoUrl });
      handleClose();
    } finally {
      saving = false;
    }
  }

  async function useFacebookPhoto() {
    if (!providerIds.facebookId) return;
    saving = true;
    try {
      const url = `https://graph.facebook.com/${providerIds.facebookId}/picture?type=large`;
      await onPhotoSelected({ type: "facebook", url });
      handleClose();
    } finally {
      saving = false;
    }
  }

  async function useGeneratedAvatar() {
    saving = true;
    try {
      await onPhotoSelected({
        type: "generated",
        generatedData: {
          gradientId: selectedGradient.id,
          gradient: selectedGradient.gradient,
          propType: selectedProp,
        },
      });
      handleClose();
    } finally {
      saving = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isDesktop}
  {#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="modal-overlay"
      onclick={handleBackdropClick}
      role="button"
      tabindex="-1"
      aria-label="Close"
    >
      <div
        class="modal-container"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-picker-title"
        tabindex="-1"
      >
        {@render pickerContent()}
      </div>
    </div>
  {/if}
{:else}
  <Drawer
    {isOpen}
    placement="bottom"
    respectLayoutMode={false}
    onclose={handleClose}
    ariaLabel="Change profile photo"
  >
    {@render pickerContent()}
  </Drawer>
{/if}

<input
  type="file"
  accept="image/*"
  onchange={handleFileSelected}
  bind:this={fileInputRef}
  class="sr-only"
/>

{#snippet pickerContent()}
  <div class="picker-container" class:modal={isDesktop}>
    <header class="picker-header">
      <h2 id="photo-picker-title">Profile Photo</h2>
      <button class="close-btn" onclick={handleClose} aria-label="Close">
        <i class="fas fa-times"></i>
      </button>
    </header>

    <!-- Wide layout: side-by-side. Narrow: tabbed -->
    <div class="picker-body themed-scrollbar">
      <!-- Left Panel: Choose Photo -->
      <div class="panel choose-panel" class:hidden-panel={isDesktop ? false : activeTab !== "options"}>
        <div class="panel-header">
          <div class="current-preview">
            <div class="avatar-preview-wrapper">
              <RobustAvatar
                src={user?.photoURL}
                name={user?.displayName || user?.email}
                googleId={providerIds.googleId}
                alt={user?.displayName || "Profile"}
                size="xl"
              />
            </div>
          </div>
          <h3 class="panel-title">Choose Photo</h3>
        </div>
        <div class="options-list">
          <button class="option-btn" onclick={triggerFileUpload} disabled={saving}>
            <div class="option-icon upload">
              <i class="fas fa-camera"></i>
            </div>
            <div class="option-text">
              <span class="option-label">Upload Photo</span>
              <span class="option-desc">Choose from your device</span>
            </div>
            <i class="fas fa-chevron-right option-arrow"></i>
          </button>

          {#if hasGoogle}
            <button class="option-btn" onclick={useGooglePhoto} disabled={saving}>
              <div class="option-icon google">
                <i class="fab fa-google"></i>
              </div>
              <div class="option-text">
                <span class="option-label">Use Google Photo</span>
                <span class="option-desc">From your Google account</span>
              </div>
              {#if googlePhotoUrl}
                <img
                  src={googlePhotoUrl}
                  alt="Google profile"
                  class="option-preview-img"
                  referrerpolicy="no-referrer"
                  crossorigin="anonymous"
                />
              {/if}
            </button>
          {/if}

          {#if hasFacebook}
            <button class="option-btn" onclick={useFacebookPhoto} disabled={saving}>
              <div class="option-icon facebook">
                <i class="fab fa-facebook-f"></i>
              </div>
              <div class="option-text">
                <span class="option-label">Use Facebook Photo</span>
                <span class="option-desc">From your Facebook account</span>
              </div>
              <img
                src="https://graph.facebook.com/{providerIds.facebookId}/picture?type=small"
                alt="Facebook profile"
                class="option-preview-img"
              />
            </button>
          {/if}
        </div>
      </div>

      <!-- Divider (wide layout only) -->
      <div class="panel-divider"></div>

      <!-- Right Panel: Create Avatar -->
      <div class="panel generate-panel" class:hidden-panel={isDesktop ? false : activeTab !== "generate"}>
        <div class="panel-header">
          <div class="current-preview">
            <div
              class="avatar-preview generated"
              style="background: {selectedGradient.gradient};"
            >
              {#if currentPropImage}
                <img src={currentPropImage} alt="Prop" class="prop-silhouette" />
              {/if}
            </div>
            <span class="gradient-name">{selectedGradient.name}</span>
          </div>
          <h3 class="panel-title">Create Avatar</h3>
        </div>

        <div class="generate-content">
          <!-- Color Family Selector -->
          <div class="section">
            <h3>Style</h3>
            <div class="family-row">
              {#each COLOR_FAMILIES as family}
                <button
                  class="family-chip"
                  class:selected={selectedFamilyId === family.id}
                  onclick={() => selectFamily(family.id)}
                >
                  <i class="fas {family.icon}"></i>
                  <span>{family.name}</span>
                </button>
              {/each}
            </div>
          </div>

          <!-- Gradients in Selected Family -->
          <div class="section">
            <div class="section-header">
              <h3>Shade</h3>
              <button class="shuffle-btn" onclick={shuffle} title="Shuffle">
                <i class="fas fa-random"></i>
              </button>
            </div>
            <div class="gradient-row">
              {#each familyGradients as gradient}
                <button
                  class="gradient-swatch"
                  class:selected={selectedGradientId === gradient.id}
                  onclick={() => selectGradient(gradient.id)}
                  title={gradient.name}
                  style="background: {gradient.gradient};"
                >
                  {#if selectedGradientId === gradient.id}
                    <i class="fas fa-check"></i>
                  {/if}
                </button>
              {/each}
            </div>
          </div>

          <!-- Prop Selection -->
          <div class="section">
            <h3>Prop</h3>
            <div class="prop-row">
              {#each PROPS as prop}
                <button
                  class="prop-btn"
                  class:selected={selectedProp === prop.id}
                  onclick={() => (selectedProp = prop.id)}
                  title={prop.label}
                >
                  <img src={prop.image} alt={prop.label} />
                </button>
              {/each}
            </div>
          </div>

          <button class="save-btn" onclick={useGeneratedAvatar} disabled={saving}>
            {#if saving}
              <i class="fas fa-circle-notch fa-spin"></i>
              <span>Saving...</span>
            {:else}
              <i class="fas fa-check"></i>
              <span>Use This Avatar</span>
            {/if}
          </button>
        </div>
      </div>
    </div>

    <!-- Tab Switcher (narrow layout only) -->
    <div class="tab-switcher">
      <button
        class="tab-btn"
        class:active={activeTab === "options"}
        onclick={() => (activeTab = "options")}
      >
        <i class="fas fa-image"></i>
        <span>Choose Photo</span>
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === "generate"}
        onclick={() => (activeTab = "generate")}
      >
        <i class="fas fa-magic"></i>
        <span>Create Avatar</span>
      </button>
    </div>
  </div>
{/snippet}

<style>
  /* Modal Overlay */
  .modal-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    z-index: 10000;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-container {
    container-type: inline-size;
    container-name: photo-modal;
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: min(90vw, 800px);
    max-height: calc(100vh - 40px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
    animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes slideUp {
    from { transform: translateY(16px) scale(0.98); opacity: 0; }
    to { transform: translateY(0) scale(1); opacity: 1; }
  }

  /* Container */
  .picker-container {
    container-type: inline-size;
    container-name: picker;
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, #ffffff);
    overflow: hidden;
  }

  .picker-container.modal {
    height: auto;
    max-height: calc(100vh - 80px);
  }

  /* Header */
  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .picker-header h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }

  .close-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
  }

  /* Body - holds panels */
  .picker-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    min-height: 0;
  }

  /* Panels */
  .panel {
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px;
  }

  .panel-title {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
    color: var(--theme-text-dim);
  }

  .panel-divider {
    display: none;
  }

  .hidden-panel {
    display: none;
  }

  /* Tab Switcher - shown on narrow layouts */
  .tab-switcher {
    display: flex;
    padding: 12px 16px;
    gap: 8px;
    flex-shrink: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tab-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .tab-btn.active {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: white;
  }

  /* Preview */
  .current-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .avatar-preview-wrapper {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    overflow: hidden;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    border: 3px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .avatar-preview-wrapper :global(.robust-avatar) {
    width: 100% !important;
    height: 100% !important;
  }

  .avatar-preview {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    border: 3px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .prop-silhouette {
    width: 55%;
    height: 55%;
    object-fit: contain;
    filter: brightness(0) invert(1) opacity(0.9);
  }

  .gradient-name {
    font-size: 12px;
    color: var(--theme-text-dim);
  }

  /* Options List */
  .options-list {
    padding: 0 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .option-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
    width: 100%;
  }

  .option-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .option-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .option-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
  }

  .option-icon.upload { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; }
  .option-icon.google { background: linear-gradient(135deg, #ea4335, #c1271a); color: white; }
  .option-icon.facebook { background: linear-gradient(135deg, #1877f2, #0d5bd9); color: white; }

  .option-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .option-label { font-size: 14px; font-weight: 500; }
  .option-desc { font-size: 12px; color: var(--theme-text-dim, rgba(255, 255, 255, 0.5)); }

  .option-preview-img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    background: var(--theme-card-bg);
  }

  .option-arrow {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: 12px;
  }

  /* Generate Content */
  .generate-content {
    padding: 0 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section h3 {
    font-size: 12px;
    font-weight: 600;
    margin: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .shuffle-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    color: var(--theme-text, #ffffff);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .shuffle-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
  }

  /* Family Row - all chips on one line */
  .family-row {
    display: flex;
    gap: 8px;
    flex-wrap: nowrap;
  }

  .family-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .family-chip:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text);
  }

  .family-chip.selected {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: white;
  }

  .family-chip i {
    font-size: 12px;
  }

  /* Gradient Row */
  .gradient-row {
    display: flex;
    gap: 12px;
  }

  .gradient-swatch {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 14px;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }

  .gradient-swatch:hover {
    transform: scale(1.08);
  }

  .gradient-swatch.selected {
    border-color: white;
    box-shadow: 0 0 0 3px var(--theme-accent, #6366f1);
  }

  /* Prop Row */
  .prop-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .prop-btn {
    width: 44px;
    height: 44px;
    padding: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .prop-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong);
  }

  .prop-btn.selected {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
  }

  .prop-btn img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: brightness(0) invert(1);
  }

  /* Save Button */
  .save-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px 20px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 12px;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .save-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  .save-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Utilities */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* ═══════════════════════════════════════════════════════════════════
     WIDE LAYOUT: Side-by-side panels (600px+)
     ═══════════════════════════════════════════════════════════════════ */
  @container picker (min-width: 580px) {
    .picker-body {
      flex-direction: row;
      overflow: hidden;
    }

    .panel {
      flex: 1;
      overflow-y: auto;
      min-width: 0;
    }

    .hidden-panel {
      display: flex;
    }

    .panel-divider {
      display: block;
      width: 1px;
      background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
      flex-shrink: 0;
    }

    .tab-switcher {
      display: none;
    }

    .panel-header {
      padding: 24px 24px 16px;
    }

    .avatar-preview,
    .avatar-preview-wrapper {
      width: 100px;
      height: 100px;
    }

    .options-list {
      padding: 0 24px 24px;
    }

    .generate-content {
      padding: 0 24px 24px;
    }
  }

  /* Mobile */
  @media (max-width: 480px) {
    .picker-container {
      padding-bottom: env(safe-area-inset-bottom, 0);
    }

    .avatar-preview,
    .avatar-preview-wrapper {
      width: 72px;
      height: 72px;
    }

    .family-chip {
      padding: 6px 10px;
      font-size: 11px;
    }

    .gradient-swatch {
      width: 44px;
      height: 44px;
    }
  }

  /* Accessibility */
  @media (prefers-reduced-motion: reduce) {
    .modal-overlay, .modal-container { animation: none; }
    .gradient-swatch:hover, .save-btn:hover { transform: none; }
  }
</style>

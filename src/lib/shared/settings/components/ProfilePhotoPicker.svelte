<!--
  ProfilePhotoPicker.svelte - Profile photo selection

  Options:
  1. Upload a photo
  2. Use Google photo (if linked)
  3. Use Facebook photo (if linked)
  4. Generate avatar (gradient + prop) - auto-matches user's theme

  Adaptive: Modal (BaseModal) on desktop, Drawer on mobile
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
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

  // Get Google photo from provider data directly (more reliable than constructing from ID)
  const googlePhotoUrl = $derived.by(() => {
    if (!user) return null;
    const googleProvider = user.providerData.find(
      (p) => p.providerId === "google.com"
    );
    return googleProvider?.photoURL ?? null;
  });

  // ============ LAYOUT MODE DETECTION ============

  // Breakpoint for modal vs drawer - simple threshold
  const DESKTOP_BREAKPOINT = 768;

  let viewportWidth = $state(typeof window !== "undefined" ? window.innerWidth : 800);

  // Set up resize listener
  $effect(() => {
    function handleResize() {
      viewportWidth = window.innerWidth;
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });

  // Desktop shows modal with side-by-side panels, mobile shows drawer with tabs
  const isDesktop = $derived(viewportWidth >= DESKTOP_BREAKPOINT);

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

{#if isDesktop}
  <BaseModal
    open={isOpen}
    onclose={handleClose}
    size="xl"
    labelledBy="photo-picker-title"
    class="profile-photo-modal"
  >
    {@render modalContent()}
  </BaseModal>
{:else}
  <Drawer
    {isOpen}
    placement="bottom"
    respectLayoutMode={false}
    onclose={handleClose}
    ariaLabel="Change profile photo"
  >
    {@render drawerContent()}
  </Drawer>
{/if}

<input
  type="file"
  accept="image/*"
  onchange={handleFileSelected}
  bind:this={fileInputRef}
  class="sr-only"
/>

{#snippet modalContent()}
  <!-- Modal: Side-by-side layout, generous spacing -->
  <div class="modal-layout">
    <header class="modal-header">
      <h2 id="photo-picker-title">Profile Photo</h2>
      <button class="close-btn" onclick={handleClose} aria-label="Close">
        <i class="fas fa-times"></i>
      </button>
    </header>

    <div class="modal-panels">
      <!-- Left Panel: Choose Photo -->
      <div class="panel choose-panel">
        {@render panelHeader("choose")}
        {@render optionsList()}
      </div>

      <div class="panel-divider"></div>

      <!-- Right Panel: Create Avatar -->
      <div class="panel generate-panel">
        {@render panelHeader("generate")}
        {@render generateContent()}
      </div>
    </div>
  </div>
{/snippet}

{#snippet drawerContent()}
  <!-- Drawer: Tabbed layout for mobile -->
  <div class="drawer-layout">
    <header class="drawer-header">
      <h2 id="photo-picker-title">Profile Photo</h2>
      <button class="close-btn" onclick={handleClose} aria-label="Close">
        <i class="fas fa-times"></i>
      </button>
    </header>

    <div class="drawer-body">
      {#if activeTab === "options"}
        {@render panelHeader("choose")}
        {@render optionsList()}
      {:else}
        {@render panelHeader("generate")}
        {@render generateContent()}
      {/if}
    </div>

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

{#snippet panelHeader(type: "choose" | "generate")}
  <div class="panel-header">
    {#if type === "choose"}
      <div class="avatar-preview-wrapper">
        <RobustAvatar
          src={user?.photoURL}
          name={user?.displayName || user?.email}
          googleId={providerIds.googleId}
          alt={user?.displayName || "Profile"}
          size="xl"
        />
      </div>
      <h3 class="panel-title">Choose Photo</h3>
    {:else}
      <div
        class="avatar-preview generated"
        style="background: {selectedGradient.gradient};"
      >
        {#if currentPropImage}
          <img src={currentPropImage} alt="Prop" class="prop-silhouette" />
        {/if}
      </div>
      <span class="gradient-name">{selectedGradient.name}</span>
      <h3 class="panel-title">Create Avatar</h3>
    {/if}
  </div>
{/snippet}

{#snippet optionsList()}
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
{/snippet}

{#snippet generateContent()}
  <div class="generate-content">
    <!-- Color Family Selector -->
    <div class="section">
      <h4 class="section-label">Style</h4>
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
        <h4 class="section-label">Shade</h4>
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
      <h4 class="section-label">Prop</h4>
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
{/snippet}

<style>
  /* ═══════════════════════════════════════════════════════════════════
     MODAL LAYOUT - Desktop side-by-side
     Uses BaseModal's "xl" size (min(90vw, 1400px)) for generous space
     ═══════════════════════════════════════════════════════════════════ */

  .modal-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--theme-text, #ffffff);
  }

  /* Modal Header */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--modal-padding, 24px);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .modal-header h2 {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    margin: 0;
  }

  /* Modal Panels Container - side-by-side */
  .modal-panels {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  /* Each panel takes half the space */
  .modal-panels .panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--modal-padding, 24px);
    min-width: 0;
  }

  /* Vertical divider between panels */
  .modal-panels .panel-divider {
    width: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
    align-self: stretch;
  }

  /* ═══════════════════════════════════════════════════════════════════
     DRAWER LAYOUT - Mobile tabbed
     ═══════════════════════════════════════════════════════════════════ */

  .drawer-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--theme-text, #ffffff);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    padding-bottom: env(safe-area-inset-bottom, 0);
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md, 16px) var(--spacing-lg, 20px);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .drawer-header h2 {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    margin: 0;
  }

  .drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-md, 16px);
  }

  /* Tab Switcher - drawer only */
  .tab-switcher {
    display: flex;
    padding: var(--spacing-sm, 12px) var(--spacing-md, 16px);
    gap: var(--spacing-sm, 8px);
    flex-shrink: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-sm, 10px);
    min-height: 48px; /* AAA touch target */
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-md, 10px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 13px);
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

  /* ═══════════════════════════════════════════════════════════════════
     SHARED COMPONENTS
     ═══════════════════════════════════════════════════════════════════ */

  /* Close Button */
  .close-btn {
    width: 40px;
    height: 40px;
    min-width: 48px; /* AAA touch target */
    min-height: 48px;
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

  /* Panel Header */
  .panel-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm, 12px);
    margin-bottom: var(--spacing-lg, 20px);
  }

  .panel-title {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    margin: 0;
    color: var(--theme-text-dim);
  }

  /* Avatar Previews */
  .avatar-preview-wrapper {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    overflow: hidden;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    border: 2px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
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
    border: 2px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .prop-silhouette {
    width: 55%;
    height: 55%;
    object-fit: contain;
    filter: brightness(0) invert(1) opacity(0.9);
  }

  .gradient-name {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
  }

  /* Options List */
  .options-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 10px);
  }

  .option-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 12px);
    padding: var(--spacing-sm, 12px) var(--spacing-md, 16px);
    min-height: 48px; /* AAA touch target */
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-md, 12px);
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
    border-radius: var(--radius-sm, 8px);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-md, 16px);
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

  .option-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
  }

  .option-desc {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .option-preview-img {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    background: var(--theme-card-bg);
  }

  .option-arrow {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-compact, 12px);
  }

  /* Generate Content */
  .generate-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg, 20px);
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 10px);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    margin: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .shuffle-btn {
    width: 36px;
    height: 36px;
    min-width: 48px; /* AAA touch target */
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-sm, 8px);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .shuffle-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
  }

  /* Family Row - style chips */
  .family-row {
    display: flex;
    gap: var(--spacing-sm, 10px);
    flex-wrap: wrap;
  }

  .family-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs, 6px);
    padding: var(--spacing-sm, 10px) var(--spacing-md, 16px);
    min-height: 48px; /* AAA touch target */
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 24px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 14px);
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
    font-size: var(--font-size-sm, 14px);
  }

  /* Gradient Row */
  .gradient-row {
    display: flex;
    gap: var(--spacing-sm, 10px);
    flex-wrap: wrap;
  }

  .gradient-swatch {
    width: 52px;
    height: 52px;
    border-radius: var(--radius-md, 12px);
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: var(--font-size-md, 16px);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }

  .gradient-swatch:hover {
    transform: scale(1.05);
  }

  .gradient-swatch.selected {
    border-color: white;
    box-shadow: 0 0 0 3px var(--theme-accent, #6366f1);
  }

  /* Prop Row */
  .prop-row {
    display: flex;
    gap: var(--spacing-sm, 8px);
    flex-wrap: wrap;
  }

  .prop-btn {
    width: 52px;
    height: 52px;
    padding: var(--spacing-xs, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-sm, 8px);
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
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-md, 14px) var(--spacing-lg, 20px);
    min-height: 48px; /* AAA touch target */
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: var(--radius-md, 12px);
    color: white;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-top: var(--spacing-sm, 8px);
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
     MODAL-SPECIFIC OVERRIDES
     Make the modal feel generous and spacious
     ═══════════════════════════════════════════════════════════════════ */

  /* Larger avatars in modal */
  .modal-layout .avatar-preview-wrapper,
  .modal-layout .avatar-preview {
    width: 96px;
    height: 96px;
  }

  /* More generous spacing in modal */
  .modal-layout .options-list {
    gap: var(--spacing-md, 14px);
  }

  .modal-layout .option-btn {
    padding: var(--spacing-md, 16px) var(--spacing-lg, 20px);
  }

  .modal-layout .option-icon {
    width: 48px;
    height: 48px;
    font-size: var(--font-size-lg, 18px);
  }

  /* Larger swatches in modal */
  .modal-layout .gradient-swatch {
    width: 60px;
    height: 60px;
  }

  .modal-layout .prop-btn {
    width: 60px;
    height: 60px;
  }

  /* ═══════════════════════════════════════════════════════════════════
     ACCESSIBILITY
     ═══════════════════════════════════════════════════════════════════ */

  @media (prefers-reduced-motion: reduce) {
    .gradient-swatch:hover,
    .save-btn:hover {
      transform: none;
    }
  }
</style>

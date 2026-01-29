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

  // Wizard mode for very small screens
  type WizardStep = "style" | "shade" | "prop" | "confirm";
  let wizardStep = $state<WizardStep>("style");
  const COMPACT_THRESHOLD = 400; // Use wizard below this width

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

  // Width breakpoint for modal vs drawer
  // 768px is the standard tablet/desktop breakpoint and matches when sidebar nav appears
  const DESKTOP_BREAKPOINT = 768;
  // Minimum height for side-by-side modal layout
  // The generate panel needs ~700px for all content (avatar preview + style + shade + props + button)
  // Modal is 90vh, so we need viewport of ~780px minimum, but with margins/padding we need more
  // At 930px viewport there was still overflow, so setting to 1000px to be safe
  const SIDE_BY_SIDE_MIN_HEIGHT = 1000;
  // Minimum height for any modal - below this use drawer
  const MIN_MODAL_HEIGHT = 500;

  let viewportWidth = $state(typeof window !== "undefined" ? window.innerWidth : 800);
  let viewportHeight = $state(typeof window !== "undefined" ? window.innerHeight : 600);

  // Set up resize listener
  $effect(() => {
    function handleResize() {
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });

  // Desktop shows modal, mobile shows drawer
  // Use modal if we have desktop width AND enough height for at least tabbed modal
  const isDesktop = $derived(
    viewportWidth >= DESKTOP_BREAKPOINT &&
    viewportHeight >= MIN_MODAL_HEIGHT
  );

  // Within modal: use side-by-side layout only if we have enough height
  // Otherwise use tabbed modal (same as drawer tabs but in modal container)
  const useSideBySide = $derived(
    viewportHeight >= SIDE_BY_SIDE_MIN_HEIGHT
  );

  // Use wizard (step-by-step) mode on very small screens
  const useWizardMode = $derived(viewportWidth < COMPACT_THRESHOLD);

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
    wizardStep = "style"; // Reset wizard
    onClose();
  }

  // Wizard navigation
  function wizardNext() {
    if (wizardStep === "style") wizardStep = "shade";
    else if (wizardStep === "shade") wizardStep = "prop";
    else if (wizardStep === "prop") wizardStep = "confirm";
  }

  function wizardBack() {
    if (wizardStep === "shade") wizardStep = "style";
    else if (wizardStep === "prop") wizardStep = "shade";
    else if (wizardStep === "confirm") wizardStep = "prop";
  }

  function wizardGoTo(step: WizardStep) {
    wizardStep = step;
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
  <!-- Modal: Side-by-side when tall enough, tabbed when constrained -->
  <div class="modal-layout" class:tabbed-modal={!useSideBySide}>
    <header class="modal-header">
      <h2 id="photo-picker-title">Profile Photo</h2>
      <button class="close-btn" onclick={handleClose} aria-label="Close">
        <i class="fas fa-times"></i>
      </button>
    </header>

    {#if useSideBySide}
      <!-- Side-by-side layout for tall viewports -->
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
    {:else}
      <!-- Tabbed layout for constrained heights -->
      <div class="modal-tabbed-body">
        {#if activeTab === "options"}
          {@render panelHeader("choose")}
          {@render optionsList()}
        {:else}
          {@render panelHeader("generate")}
          {@render generateContent()}
        {/if}
      </div>

      <div class="modal-tab-switcher">
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
    {/if}
  </div>
{/snippet}

{#snippet drawerContent()}
  <!-- Drawer: Tabbed layout for mobile, Wizard for compact -->
  <div class="drawer-layout">
    <header class="drawer-header">
      {#if useWizardMode && activeTab === "generate"}
        <button class="back-btn" onclick={wizardStep === "style" ? () => (activeTab = "options") : wizardBack} aria-label="Back">
          <i class="fas fa-arrow-left"></i>
        </button>
        <h2 id="photo-picker-title">
          {#if wizardStep === "style"}Pick Style
          {:else if wizardStep === "shade"}Pick Shade
          {:else if wizardStep === "prop"}Pick Prop
          {:else}Confirm
          {/if}
        </h2>
      {:else}
        <h2 id="photo-picker-title">Profile Photo</h2>
      {/if}
      <button class="close-btn" onclick={handleClose} aria-label="Close">
        <i class="fas fa-times"></i>
      </button>
    </header>

    <div class="drawer-body">
      {#if activeTab === "options"}
        {@render panelHeader("choose")}
        {@render optionsList()}
      {:else if useWizardMode}
        {@render wizardContent()}
      {:else}
        {@render panelHeader("generate")}
        {@render generateContent()}
      {/if}
    </div>

    {#if !useWizardMode || activeTab === "options"}
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
          onclick={() => { activeTab = "generate"; wizardStep = "style"; }}
        >
          <i class="fas fa-magic"></i>
          <span>Create Avatar</span>
        </button>
      </div>
    {/if}
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

{#snippet wizardContent()}
  <!-- Wizard: Step-by-step for compact screens -->
  <div class="wizard-content">
    <!-- Progress indicator -->
    <div class="wizard-progress">
      <button
        class="progress-dot"
        class:active={wizardStep === "style"}
        class:completed={["shade", "prop", "confirm"].includes(wizardStep)}
        onclick={() => wizardGoTo("style")}
        aria-label="Style"
      ></button>
      <div class="progress-line" class:filled={["shade", "prop", "confirm"].includes(wizardStep)}></div>
      <button
        class="progress-dot"
        class:active={wizardStep === "shade"}
        class:completed={["prop", "confirm"].includes(wizardStep)}
        onclick={() => wizardGoTo("shade")}
        aria-label="Shade"
      ></button>
      <div class="progress-line" class:filled={["prop", "confirm"].includes(wizardStep)}></div>
      <button
        class="progress-dot"
        class:active={wizardStep === "prop"}
        class:completed={wizardStep === "confirm"}
        onclick={() => wizardGoTo("prop")}
        aria-label="Prop"
      ></button>
      <div class="progress-line" class:filled={wizardStep === "confirm"}></div>
      <button
        class="progress-dot"
        class:active={wizardStep === "confirm"}
        onclick={() => wizardGoTo("confirm")}
        aria-label="Confirm"
      ></button>
    </div>

    <!-- Step container with animation wrapper -->
    <div class="wizard-step-container">
      {#key wizardStep}
        <div class="wizard-step-animated">
          {#if wizardStep === "style"}
            <!-- Step 1: Style -->
            <div class="wizard-step">
              <p class="wizard-subtitle">What vibe fits you?</p>
              <div class="wizard-options">
                {#each COLOR_FAMILIES as family}
                  <button
                    class="wizard-option"
                    class:selected={selectedFamilyId === family.id}
                    onclick={() => { selectFamily(family.id); wizardNext(); }}
                  >
                    <div class="wizard-option-icon">
                      <i class="fas {family.icon}"></i>
                    </div>
                    <span>{family.name}</span>
                  </button>
                {/each}
              </div>
            </div>

          {:else if wizardStep === "shade"}
            <!-- Step 2: Shade -->
            <div class="wizard-step">
              <p class="wizard-subtitle">Pick your shade</p>
              <div class="wizard-shades">
                {#each familyGradients as gradient}
                  <button
                    class="wizard-shade"
                    class:selected={selectedGradientId === gradient.id}
                    onclick={() => { selectGradient(gradient.id); wizardNext(); }}
                    style="background: {gradient.gradient};"
                  >
                    <span class="shade-name">{gradient.name}</span>
                    {#if selectedGradientId === gradient.id}
                      <i class="fas fa-check"></i>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>

          {:else if wizardStep === "prop"}
            <!-- Step 3: Prop -->
            <div class="wizard-step">
              <p class="wizard-subtitle">Choose your prop</p>
              <div class="wizard-props-scroll">
                <div class="wizard-props">
                  {#each PROPS as prop}
                    <button
                      class="wizard-prop"
                      class:selected={selectedProp === prop.id}
                      onclick={() => { selectedProp = prop.id; wizardNext(); }}
                    >
                      <img src={prop.image} alt={prop.label} />
                      <span>{prop.label}</span>
                    </button>
                  {/each}
                </div>
              </div>
            </div>

          {:else}
            <!-- Step 4: Confirm -->
            <div class="wizard-step wizard-confirm">
              <div
                class="wizard-preview"
                style="background: {selectedGradient.gradient};"
              >
                {#if currentPropImage}
                  <img src={currentPropImage} alt="Prop" class="prop-silhouette" />
                {/if}
              </div>
              <p class="wizard-preview-label">{selectedGradient.name}</p>

              <!-- Quick edit chips with labels -->
              <div class="quick-edit-section">
                <p class="quick-edit-label">Tap to change:</p>
                <div class="quick-edit-row">
                  <button class="quick-edit-chip" onclick={() => wizardGoTo("style")} aria-label="Change style">
                    <i class="fas {COLOR_FAMILIES.find(f => f.id === selectedFamilyId)?.icon}"></i>
                    <span class="chip-label">Style</span>
                  </button>
                  <button class="quick-edit-chip shade-chip" onclick={() => wizardGoTo("shade")} style="background: {selectedGradient.gradient};" aria-label="Change shade">
                    <span class="chip-label">Shade</span>
                  </button>
                  <button class="quick-edit-chip" onclick={() => wizardGoTo("prop")} aria-label="Change prop">
                    <img src={currentPropImage} alt="Prop" />
                    <span class="chip-label">Prop</span>
                  </button>
                </div>
              </div>

              <!-- Start Over button -->
              <button class="start-over-btn" onclick={() => wizardGoTo("style")}>
                <i class="fas fa-redo"></i>
                <span>Start Over</span>
              </button>

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
          {/if}
        </div>
      {/key}
    </div>
  </div>
{/snippet}

{#snippet generateContent()}
  <div class="generate-content">
    <!-- Combined Style & Shade row for compact mobile -->
    <div class="section style-shade-section">
      <div class="style-shade-row">
        <!-- Style dropdown - shows current family with icon -->
        <div class="compact-selector">
          <h4 class="section-label">Style</h4>
          <div class="family-row">
            {#each COLOR_FAMILIES as family}
              <button
                class="family-chip"
                class:selected={selectedFamilyId === family.id}
                onclick={() => selectFamily(family.id)}
                title={family.name}
              >
                <i class="fas {family.icon}"></i>
                <span class="family-label">{family.name}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Shade swatches -->
        <div class="compact-selector shade-selector">
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
      </div>
    </div>

    <!-- Prop Selection - horizontal scroll on mobile -->
    <div class="section prop-section">
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
    min-height: 0;
    overflow-y: auto;
  }

  /* Styled scrollbar for panels */
  .modal-panels .panel::-webkit-scrollbar {
    width: 6px;
  }

  .modal-panels .panel::-webkit-scrollbar-track {
    background: transparent;
  }

  .modal-panels .panel::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.15));
    border-radius: 3px;
  }

  .modal-panels .panel::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover, rgba(255, 255, 255, 0.25));
  }

  /* Vertical divider between panels */
  .modal-panels .panel-divider {
    width: 1px;
  }

  /* ═══════════════════════════════════════════════════════════════════
     TABBED MODAL - When viewport is wide but not tall enough for side-by-side
     Still a modal (not drawer), but shows one panel at a time with tabs
     ═══════════════════════════════════════════════════════════════════ */

  .tabbed-modal .modal-tabbed-body {
    flex: 1;
    padding: var(--modal-padding, 24px);
    overflow-y: auto;
    min-height: 0;
  }

  .modal-tab-switcher {
    display: flex;
    padding: var(--spacing-md, 16px) var(--modal-padding, 24px);
    gap: var(--spacing-sm, 8px);
    flex-shrink: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .modal-tab-switcher .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm, 8px);
    padding: var(--spacing-sm, 10px);
    min-height: 48px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-md, 10px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 13px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .modal-tab-switcher .tab-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .modal-tab-switcher .tab-btn.active {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: white;
  }

  /* ═══════════════════════════════════════════════════════════════════
     PANEL DIVIDER (moved declaration)
     ═══════════════════════════════════════════════════════════════════ */

  .modal-panels .panel-divider {
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
    /* Container for responsive queries */
    container-type: inline-size;
    container-name: drawer-content;
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
     WIZARD MODE - Step-by-step for compact screens
     ═══════════════════════════════════════════════════════════════════ */

  .back-btn {
    width: 40px;
    height: 40px;
    min-width: 48px;
    min-height: 48px;
    border-radius: 50%;
    background: transparent;
    border: none;
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease;
  }

  .back-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
  }

  .wizard-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: var(--spacing-md, 16px);
    overflow: hidden;
  }

  /* Step container for animation */
  .wizard-step-container {
    flex: 1;
    position: relative;
    overflow: hidden;
    min-height: 0;
  }

  /* Animated step wrapper */
  .wizard-step-animated {
    animation: wizardFadeSlideIn 0.25s ease-out forwards;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  @keyframes wizardFadeSlideIn {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .wizard-step-animated {
      animation: none;
    }
  }

  /* Progress indicator */
  .wizard-progress {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: var(--spacing-sm, 8px) 0;
  }

  .progress-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.2));
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 0;
  }

  .progress-dot.active {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    transform: scale(1.2);
  }

  .progress-dot.completed {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
  }

  .progress-line {
    width: 32px;
    height: 2px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.2));
    transition: background 0.2s ease;
  }

  .progress-line.filled {
    background: var(--theme-accent, #6366f1);
  }

  /* Wizard step container */
  .wizard-step {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md, 16px);
    min-height: 0;
    overflow: hidden;
  }

  .wizard-subtitle {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
    text-align: center;
  }

  /* Style options (Step 1) */
  .wizard-options {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 10px);
    width: 100%;
    max-width: 280px;
  }

  .wizard-option {
    display: flex;
    align-items: center;
    gap: var(--spacing-md, 14px);
    padding: var(--spacing-md, 16px);
    min-height: 56px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-md, 12px);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-md, 16px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    width: 100%;
  }

  .wizard-option:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .wizard-option.selected {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
  }

  .wizard-option-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-lg, 18px);
  }

  /* Shade options (Step 2) */
  .wizard-shades {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 10px);
    width: 100%;
    max-width: 280px;
  }

  .wizard-shade {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md, 16px) var(--spacing-lg, 20px);
    min-height: 56px;
    border: 2px solid transparent;
    border-radius: var(--radius-md, 12px);
    color: white;
    font-size: var(--font-size-md, 16px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }

  .wizard-shade:hover {
    transform: scale(1.02);
  }

  .wizard-shade.selected {
    border-color: white;
    box-shadow: 0 0 0 2px var(--theme-accent, #6366f1);
  }

  .shade-name {
    font-weight: 600;
  }

  /* Prop options (Step 3) */
  .wizard-props-scroll {
    flex: 1;
    overflow-y: auto;
    width: 100%;
    max-width: 320px;
    padding: var(--spacing-xs, 4px);
    /* Styled scrollbar */
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  .wizard-props-scroll::-webkit-scrollbar {
    width: 6px;
  }

  .wizard-props-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .wizard-props-scroll::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2));
    border-radius: 3px;
  }

  .wizard-props {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-sm, 10px);
    width: 100%;
  }

  .wizard-prop {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs, 6px);
    padding: var(--spacing-sm, 12px) var(--spacing-xs, 8px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-md, 12px);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-compact, 11px);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .wizard-prop:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong);
  }

  .wizard-prop.selected {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
  }

  .wizard-prop img {
    width: 40px;
    height: 40px;
    object-fit: contain;
    filter: brightness(0) invert(1);
  }

  /* Confirm step (Step 4) */
  .wizard-confirm {
    justify-content: center;
  }

  .wizard-preview {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    border: 3px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .wizard-preview .prop-silhouette {
    width: 55%;
    height: 55%;
    object-fit: contain;
    filter: brightness(0) invert(1) opacity(0.9);
  }

  .wizard-preview-label {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim);
    margin: 0;
  }

  /* Quick edit section with label */
  .quick-edit-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs, 6px);
    margin-top: var(--spacing-sm, 8px);
  }

  .quick-edit-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin: 0;
  }

  .quick-edit-row {
    display: flex;
    gap: var(--spacing-sm, 10px);
  }

  .quick-edit-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: var(--spacing-sm, 10px) var(--spacing-md, 14px);
    min-width: 60px;
    border-radius: var(--radius-md, 10px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    cursor: pointer;
    transition: all 0.15s ease;
    color: var(--theme-text);
    font-size: var(--font-size-md, 16px);
  }

  .quick-edit-chip:hover {
    border-color: var(--theme-accent, #6366f1);
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
  }

  .quick-edit-chip img {
    width: 24px;
    height: 24px;
    object-fit: contain;
    filter: brightness(0) invert(1);
  }

  .quick-edit-chip.shade-chip {
    /* Shade chip shows the gradient as background, needs white text */
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .chip-label {
    font-size: var(--font-size-compact, 11px);
    font-weight: 500;
  }

  /* Start over button */
  .start-over-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs, 6px);
    padding: var(--spacing-sm, 10px) var(--spacing-md, 16px);
    min-height: 44px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: var(--radius-md, 10px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 13px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-top: var(--spacing-md, 12px);
  }

  .start-over-btn:hover {
    color: var(--theme-text);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .start-over-btn i {
    font-size: var(--font-size-compact, 12px);
  }

  .wizard-confirm .save-btn {
    margin-top: var(--spacing-sm, 8px);
    width: 100%;
    max-width: 280px;
  }

  /* ═══════════════════════════════════════════════════════════════════
     COMPACT MOBILE LAYOUT (iPhone SE and similar)
     Uses container queries for component-level responsiveness
     ═══════════════════════════════════════════════════════════════════ */

  /* Compact mobile: viewport width < 400px */
  @container drawer-content (max-width: 400px) {
    /* Smaller avatar preview */
    .panel-header .avatar-preview {
      width: 64px;
      height: 64px;
    }

    .panel-header {
      gap: var(--spacing-xs, 8px);
      margin-bottom: var(--spacing-md, 14px);
    }

    .panel-title {
      font-size: var(--font-size-compact, 12px);
    }

    .gradient-name {
      font-size: 11px;
    }

    /* Tighter section spacing */
    .generate-content {
      gap: var(--spacing-md, 14px);
    }

    .section {
      gap: var(--spacing-xs, 6px);
    }

    .section-label {
      font-size: 11px;
    }

    /* Compact family chips - icon only with tooltip */
    .family-chip {
      padding: var(--spacing-xs, 8px) var(--spacing-sm, 10px);
      min-height: 40px;
      gap: 4px;
    }

    .family-chip .family-label {
      display: none;
    }

    .family-row {
      gap: var(--spacing-xs, 6px);
    }

    /* Smaller gradient swatches */
    .gradient-swatch {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-sm, 8px);
    }

    .gradient-row {
      gap: var(--spacing-xs, 6px);
    }

    /* Horizontal scrolling props */
    .prop-row {
      display: flex;
      flex-wrap: nowrap;
      overflow-x: auto;
      gap: var(--spacing-xs, 6px);
      padding-bottom: var(--spacing-xs, 6px);
      margin: 0 calc(-1 * var(--spacing-md, 16px));
      padding-left: var(--spacing-md, 16px);
      padding-right: var(--spacing-md, 16px);
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }

    .prop-row::-webkit-scrollbar {
      display: none;
    }

    .prop-btn {
      width: 44px;
      height: 44px;
      flex-shrink: 0;
      padding: var(--spacing-xs, 6px);
    }

    /* Smaller shuffle button */
    .shuffle-btn {
      width: 32px;
      height: 32px;
      min-width: 40px;
      min-height: 40px;
    }

    /* Compact save button */
    .save-btn {
      padding: var(--spacing-sm, 10px) var(--spacing-md, 16px);
      font-size: var(--font-size-compact, 12px);
      margin-top: var(--spacing-xs, 6px);
    }
  }

  /* Extra compact: very small screens (< 350px) */
  @container drawer-content (max-width: 350px) {
    .panel-header .avatar-preview {
      width: 56px;
      height: 56px;
    }

    .gradient-swatch {
      width: 36px;
      height: 36px;
    }

    .prop-btn {
      width: 40px;
      height: 40px;
    }

    .family-chip {
      padding: var(--spacing-xs, 6px) var(--spacing-xs, 8px);
      min-height: 36px;
    }
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

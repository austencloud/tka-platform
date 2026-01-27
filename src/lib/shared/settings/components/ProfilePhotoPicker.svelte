<!--
  ProfilePhotoPicker.svelte - Full-featured profile photo selection

  Options:
  1. Upload a photo
  2. Use Google photo (if Google linked)
  3. Use Facebook photo (if Facebook linked)
  4. Generate avatar (gradient + prop)

  Responsive: Modal on desktop, bottom drawer on mobile
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
  }

  interface PropOption {
    id: PropType;
    label: string;
    image: string;
  }

  // ============ GRADIENT LIBRARY ============

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
    // Vibrant multi-color
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
    // Earthy/natural
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
    // Dark/moody
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
  let selectedGradientIndex = $state<number>(0);
  let selectedProp = $state<PropType>(PropType.STAFF);
  let saving = $state(false);
  let fileInputRef: HTMLInputElement | null = $state(null);

  // ============ DERIVED ============

  const user = $derived(authState.user);
  const profilePictureManager = container.items.profilePictureManager;
  const providerIds = $derived(user ? profilePictureManager.getProviderIds(user) : {});
  const hasGoogle = $derived(!!providerIds.googleId);
  const hasFacebook = $derived(!!providerIds.facebookId);

  // Check if we're on desktop (side-by-side layout)
  let isDesktop = $state(false);
  $effect(() => {
    const unsubscribe = responsiveLayoutManager.onLayoutChange((layout) => {
      isDesktop = layout === "side-by-side";
    });
    isDesktop = responsiveLayoutManager.getLayoutMode() === "side-by-side";
    return unsubscribe;
  });

  const currentGradient = $derived(
    GRADIENT_LIBRARY[selectedGradientIndex] ?? GRADIENT_LIBRARY[0]!
  );

  const currentPropImage = $derived(
    PROPS.find((p) => p.id === selectedProp)?.image ?? ""
  );

  // Initialize with user's favorite prop if available
  $effect(() => {
    const settings = getSettings();
    if (settings.bluePropType && PROPS.some((p) => p.id === settings.bluePropType)) {
      selectedProp = settings.bluePropType;
    }
  });

  // ============ ACTIONS ============

  function handleClose() {
    activeTab = "options";
    onClose();
  }

  function shuffle() {
    let newIndex: number;
    do {
      newIndex = Math.floor(Math.random() * GRADIENT_LIBRARY.length);
    } while (newIndex === selectedGradientIndex && GRADIENT_LIBRARY.length > 1);
    selectedGradientIndex = newIndex;
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
    if (!providerIds.googleId) return;
    saving = true;
    try {
      // Pass the googleId, let the handler construct the URL
      await onPhotoSelected({ type: "google", url: providerIds.googleId });
      handleClose();
    } finally {
      saving = false;
    }
  }

  async function useFacebookPhoto() {
    if (!providerIds.facebookId) return;
    saving = true;
    try {
      // Construct Facebook graph API URL
      const url = `https://graph.facebook.com/${providerIds.facebookId}/picture?type=large&access_token=placeholder`;
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
          gradientId: currentGradient.id,
          gradient: currentGradient.gradient,
          propType: selectedProp,
        },
      });
      handleClose();
    } finally {
      saving = false;
    }
  }
</script>

<Drawer
  {isOpen}
  placement={isDesktop ? "right" : "bottom"}
  respectLayoutMode={false}
  onclose={handleClose}
  ariaLabel="Change profile photo"
  class="photo-picker-drawer {isDesktop ? 'desktop-modal' : ''}"
>
  <div class="picker-container" class:desktop={isDesktop}>
    <header class="picker-header">
      <h2>Profile Photo</h2>
      <button class="close-btn" onclick={handleClose} aria-label="Close">
        <i class="fas fa-times"></i>
      </button>
    </header>

    <!-- Current Photo Preview -->
    <div class="current-preview">
      {#if activeTab === "generate"}
        <div
          class="avatar-preview generated"
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
      {:else}
        <div class="avatar-preview-wrapper">
          <RobustAvatar
            src={user?.photoURL}
            name={user?.displayName || user?.email}
            googleId={providerIds.googleId}
            alt={user?.displayName || "Profile"}
            size="xl"
          />
        </div>
      {/if}
    </div>

    <!-- Tab Switcher -->
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

    <!-- Content based on active tab -->
    <div class="tab-content">
      {#if activeTab === "options"}
        <div class="options-list">
          <!-- Upload Photo -->
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

          <!-- Google Photo -->
          {#if hasGoogle}
            <button class="option-btn" onclick={useGooglePhoto} disabled={saving}>
              <div class="option-icon google">
                <i class="fab fa-google"></i>
              </div>
              <div class="option-text">
                <span class="option-label">Use Google Photo</span>
                <span class="option-desc">From your Google account</span>
              </div>
              <div class="option-preview-avatar">
                <RobustAvatar
                  src={null}
                  name={user?.displayName || user?.email}
                  googleId={providerIds.googleId}
                  alt="Google"
                  size="sm"
                />
              </div>
            </button>
          {/if}

          <!-- Facebook Photo -->
          {#if hasFacebook}
            <button class="option-btn" onclick={useFacebookPhoto} disabled={saving}>
              <div class="option-icon facebook">
                <i class="fab fa-facebook-f"></i>
              </div>
              <div class="option-text">
                <span class="option-label">Use Facebook Photo</span>
                <span class="option-desc">From your Facebook account</span>
              </div>
              <div class="option-preview-avatar">
                <RobustAvatar
                  src={`https://graph.facebook.com/${providerIds.facebookId}/picture?type=large`}
                  name={user?.displayName || user?.email}
                  alt="Facebook"
                  size="sm"
                />
              </div>
            </button>
          {/if}
        </div>
      {:else}
        <!-- Generate Avatar Tab -->
        <div class="generate-content">
          <!-- Gradient Selection -->
          <div class="section">
            <div class="section-header">
              <h3>Background</h3>
              <button class="shuffle-btn" onclick={shuffle}>
                <i class="fas fa-random"></i>
                <span>Shuffle</span>
              </button>
            </div>
            <div class="gradient-grid">
              {#each GRADIENT_LIBRARY as gradient, index}
                <button
                  class="gradient-btn"
                  class:selected={selectedGradientIndex === index}
                  onclick={() => (selectedGradientIndex = index)}
                  title={gradient.name}
                  style="background: {gradient.gradient};"
                >
                  {#if selectedGradientIndex === index}
                    <i class="fas fa-check"></i>
                  {/if}
                </button>
              {/each}
            </div>
          </div>

          <!-- Prop Selection -->
          <div class="section">
            <h3>Your Prop</h3>
            <div class="prop-grid">
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

          <!-- Save Button -->
          <button
            class="save-btn"
            onclick={useGeneratedAvatar}
            disabled={saving}
          >
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

    <!-- Hidden file input -->
    <input
      type="file"
      accept="image/*"
      onchange={handleFileSelected}
      bind:this={fileInputRef}
      class="sr-only"
    />
  </div>
</Drawer>

<style>
  .picker-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, #ffffff);
    overflow: hidden;
  }

  /* Desktop modal styling - fixed width and centered content */
  .picker-container.desktop {
    width: 400px;
    max-height: 85vh;
  }

  /* Header */
  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
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

  /* Current Preview */
  .current-preview {
    display: flex;
    justify-content: center;
    padding: 20px;
    flex-shrink: 0;
  }

  .avatar-preview-wrapper {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    border: 3px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .avatar-preview-wrapper :global(.robust-avatar) {
    width: 100% !important;
    height: 100% !important;
  }

  .avatar-preview {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .avatar-preview.generated {
    border: 3px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .prop-silhouette {
    width: 55%;
    height: 55%;
    object-fit: contain;
    filter: brightness(0) invert(1) opacity(0.9);
  }

  /* Tab Switcher */
  .tab-switcher {
    display: flex;
    padding: 0 16px;
    gap: 8px;
    flex-shrink: 0;
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

  /* Tab Content */
  .tab-content {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  /* Options List */
  .options-list {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
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

  .option-icon.upload {
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    color: white;
  }

  .option-icon.google {
    background: linear-gradient(135deg, #ea4335, #c1271a);
    color: white;
  }

  .option-icon.facebook {
    background: linear-gradient(135deg, #1877f2, #0d5bd9);
    color: white;
  }

  .option-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .option-label {
    font-size: 14px;
    font-weight: 500;
  }

  .option-desc {
    font-size: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .option-preview-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }

  .option-preview-avatar :global(.robust-avatar) {
    width: 100% !important;
    height: 100% !important;
  }

  .option-arrow {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: 12px;
  }

  /* Generate Content */
  .generate-content {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
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
    font-size: 13px;
    font-weight: 600;
    margin: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .shuffle-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    color: var(--theme-text, #ffffff);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .shuffle-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
  }

  /* Gradient Grid */
  .gradient-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
    gap: 6px;
  }

  .gradient-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 11px;
  }

  .gradient-btn:hover {
    transform: scale(1.1);
  }

  .gradient-btn.selected {
    border-color: white;
    box-shadow: 0 0 0 2px var(--theme-accent, #6366f1);
  }

  /* Prop Grid */
  .prop-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
    gap: 6px;
  }

  .prop-btn {
    width: 40px;
    height: 40px;
    padding: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .prop-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
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
    padding: 12px 20px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 10px;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-top: 8px;
  }

  .save-btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .save-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Screen reader only */
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

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .picker-container {
      padding-bottom: env(safe-area-inset-bottom, 0);
    }

    .current-preview {
      padding: 16px;
    }

    .avatar-preview,
    .avatar-preview-wrapper {
      width: 80px;
      height: 80px;
    }
  }

  /* Desktop drawer styling */
  :global(.photo-picker-drawer.desktop-modal) {
    --drawer-width: 420px;
  }
</style>

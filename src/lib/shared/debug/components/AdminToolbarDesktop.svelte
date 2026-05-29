<!--
  AdminToolbarDesktop - Desktop top bar admin tools

  Horizontal toolbar at top of screen with quick access chips,
  user search, and debug actions in a dropdown menu.

  Progressive collapse:
  - >1200px: Full layout
  - 900-1200px: Actions collapse to dropdown, chips scroll
  - <900px: Compact mode (handled by parent switching to mobile)
-->
<script lang="ts">
  import { slide, fly } from "svelte/transition";
  import UserSearchInput from "$lib/shared/user-search/UserSearchInput.svelte";
  import RobustAvatar from "$lib/shared/components/avatar/RobustAvatar.svelte";
  import type { QuickAccessUser } from "../services/types";
  import type { PreviewUserProfile } from "../state/user-preview-state.svelte";
  import type { UserRole } from "$lib/shared/auth/domain/models/UserRole";

  const ROLE_CONFIG: { role: UserRole; label: string; icon: string; color: string }[] = [
    { role: "admin", label: "Admin", icon: "fas fa-crown", color: "#ffd700" },
    { role: "tester", label: "Tester", icon: "fas fa-flask", color: "#10b981" },
    { role: "premium", label: "Premium", icon: "fas fa-gem", color: "#a855f7" },
    { role: "user", label: "Free User", icon: "fas fa-user", color: "#64748b" },
  ];

  interface Props {
    quickAccessUsers: QuickAccessUser[];
    previewProfile: PreviewUserProfile | null;
    isUserPreview: boolean;
    isSearchOpen: boolean;
    isLoading: boolean;
    introResetMessage: string | null;
    canResetIntro: boolean;
    currentIntroTitle: string | null;
    isCurrentUserInQuickAccess: boolean;
    onSelectUser: (user: {
      uid: string;
      displayName: string;
      username?: string;
      photoURL?: string;
    }) => void;
    onRemoveFromQuickAccess: (uid: string) => void;
    onAddToQuickAccess: () => void;
    onClearPreview: () => void;
    onToggleSearch: () => void;
    onResetTabIntro: () => void;
    onPreviewFirstRun: () => void;
    onPreviewCreateTutorial: () => void;
    onResetHelpDiscovery: () => void;
    onClearCloudThumbnails: () => void;
    isClearingThumbnails: boolean;
    onClearLocalCache: () => void;
    isClearingLocalCache: boolean;
    onClearTikaCache: () => void;
    isClearingTikaCache: boolean;
    onClearThumbnailCache: () => void;
    isClearingThumbnailCache: boolean;
    onShowPwaBanner: () => void;
    onClose: () => void;
    currentRole: UserRole;
    effectiveRole: UserRole;
    onSwitchRole: (role: UserRole) => void;
  }

  let {
    quickAccessUsers,
    previewProfile,
    isUserPreview,
    isSearchOpen,
    isLoading,
    introResetMessage,
    canResetIntro,
    currentIntroTitle,
    isCurrentUserInQuickAccess,
    onSelectUser,
    onRemoveFromQuickAccess,
    onAddToQuickAccess,
    onClearPreview,
    onToggleSearch,
    onResetTabIntro,
    onPreviewFirstRun,
    onPreviewCreateTutorial,
    onResetHelpDiscovery,
    onClearCloudThumbnails,
    isClearingThumbnails,
    onClearLocalCache,
    isClearingLocalCache,
    onClearTikaCache,
    isClearingTikaCache,
    onClearThumbnailCache,
    isClearingThumbnailCache,
    onShowPwaBanner,
    onClose,
    currentRole,
    effectiveRole,
    onSwitchRole,
  }: Props = $props();

  // Responsive: show inline action buttons when they fit, dropdown when they don't.
  // A hidden measuring strip always renders the action buttons offscreen.
  // We compare its width against the available space (toolbar minus fixed items).
  let measureEl: HTMLElement | null = $state(null);
  let toolbarEl: HTMLElement | null = $state(null);
  let useInline = $state(true);

  $effect(() => {
    if (!measureEl || !toolbarEl) return;

    function checkFit() {
      if (!measureEl || !toolbarEl) return;
      // The measure strip has the same action buttons. We need to check if
      // adding them to the toolbar would fit. The toolbar already has:
      // branding + roles + divider + users + search + spacer + right section
      // So: available = toolbar width - (everything except action buttons)
      // Simplification: the right section (dropdown + close) is ~100px.
      // The left items (branding + roles + users + search) we can measure from
      // the toolbar's existing children before the spacer.
      const spacer = toolbarEl.querySelector(".toolbar-spacer") as HTMLElement;
      if (!spacer) return;
      // Everything before the spacer is fixed content
      let fixedWidth = 0;
      for (const child of toolbarEl.children) {
        if (child === spacer) break;
        fixedWidth += (child as HTMLElement).offsetWidth + 6; // 6 = gap
      }
      // Right section (close button, potential dropdown)
      const rightSection = toolbarEl.querySelector(".toolbar-right") as HTMLElement;
      const rightWidth = rightSection ? 50 : 0; // just the close button when inline
      const available = toolbarEl.clientWidth - fixedWidth - rightWidth - 12;
      useInline = measureEl.scrollWidth <= available;
    }

    checkFit();
    window.addEventListener("resize", checkFit);
    return () => window.removeEventListener("resize", checkFit);
  });

  // Debug actions dropdown state
  let isActionsOpen = $state(false);

  function toggleActions() {
    isActionsOpen = !isActionsOpen;
  }

  function handleFirstRun() {
    onPreviewFirstRun();
    isActionsOpen = false;
  }

  function handleCreateTutorial() {
    onPreviewCreateTutorial();
    isActionsOpen = false;
  }

  function handleResetIntro() {
    onResetTabIntro();
    isActionsOpen = false;
  }

  function handleResetHelpDiscovery() {
    onResetHelpDiscovery();
    isActionsOpen = false;
  }

  function handleShowPwaBanner() {
    onShowPwaBanner();
    isActionsOpen = false;
  }

  function handleClearCloudThumbnails() {
    onClearCloudThumbnails();
    isActionsOpen = false;
  }

  function handleClearLocalCache() {
    onClearLocalCache();
    isActionsOpen = false;
  }

  function handleClearTikaCache() {
    onClearTikaCache();
    isActionsOpen = false;
  }

  function handleClearThumbnailCache() {
    onClearThumbnailCache();
    isActionsOpen = false;
  }

  function handlePointerDownOutside(event: PointerEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".actions-menu")) {
      isActionsOpen = false;
    }
  }
</script>

<svelte:window onpointerdown={handlePointerDownOutside} />

<div class="admin-toolbar" transition:slide={{ duration: 150 }}>
  <!-- Hidden measuring element - always rendered offscreen to get natural button width -->
  {#if !isUserPreview}
    <div class="measure-strip" bind:this={measureEl} aria-hidden="true">
      <span class="action-chip"><i class="fas fa-wand-magic-sparkles"></i><span>Preview First Run</span></span>
      <span class="action-chip"><i class="fas fa-graduation-cap"></i><span>Preview Tutorial</span></span>
      <span class="action-chip"><i class="fas fa-door-open"></i><span>Reset Intro</span></span>
      <span class="action-chip"><i class="fas fa-circle-question"></i><span>Reset Help Discovery</span></span>
      <span class="action-chip"><i class="fas fa-mobile-screen"></i><span>PWA Banner</span></span>
      <span class="toolbar-divider"></span>
      <span class="action-chip"><i class="fas fa-cloud-arrow-down"></i><span>Clear Cloud Thumbnails</span></span>
      <span class="action-chip"><i class="fas fa-database"></i><span>Clear Pictograph Cache</span></span>
      <span class="action-chip"><i class="fas fa-robot"></i><span>Clear TIKA Cache</span></span>
      <span class="action-chip"><i class="fas fa-images"></i><span>Clear Thumbnail Cache</span></span>
    </div>
  {/if}

  <div class="toolbar-row" bind:this={toolbarEl}>
    {#if isUserPreview && previewProfile}
      <!-- PREVIEW MODE: three-column layout -->
      <div class="toolbar-left">
        <div class="toolbar-branding">
          <i class="fas fa-shield-alt" aria-hidden="true"></i>
          <span class="branding-text">Admin</span>
        </div>
      </div>
      <div class="toolbar-center">
        <div class="preview-label">
          <i class="fas fa-eye" aria-hidden="true"></i>
          <span>Viewing as:</span>
        </div>
        <div class="preview-user">
          <RobustAvatar
            src={previewProfile.photoURL}
            name={previewProfile.displayName || "User"}
            customSize={32}
            alt=""
          />
          <span class="preview-user-name"
            >{previewProfile.displayName || previewProfile.email}</span
          >
          {#if !isCurrentUserInQuickAccess}
            <button
              type="button"
              class="preview-action save"
              onclick={onAddToQuickAccess}
              title="Save to quick access"
            >
              <i class="far fa-bookmark" aria-hidden="true"></i>
            </button>
          {/if}
        </div>
        <button type="button" class="exit-preview-btn" onclick={onClearPreview}>
          <i class="fas fa-times" aria-hidden="true"></i>
          <span>Exit Preview</span>
        </button>
      </div>
    {:else}
      <!-- NORMAL MODE: flat single row - everything is a direct child -->

      <!-- Branding -->
      <div class="toolbar-branding">
        <i class="fas fa-shield-alt" aria-hidden="true"></i>
        <span class="branding-text">Admin</span>
      </div>

      <!-- Role switch chips -->
      {#each ROLE_CONFIG as { role, label, icon, color } (role)}
        <button
          type="button"
          class="role-chip"
          class:active={effectiveRole === role}
          class:overridden={effectiveRole === role && currentRole !== role}
          onclick={() => onSwitchRole(role)}
          title={effectiveRole === role && currentRole !== role
            ? `Viewing as ${label} (actual: ${currentRole}). Click to reset.`
            : `Switch to ${label} view`}
          style="--role-color: {color}"
        >
          <i class={icon} aria-hidden="true"></i>
          <span class="chip-name">{label}</span>
        </button>
      {/each}

      <div class="toolbar-divider"></div>

      <!-- User quick access -->
      {#each quickAccessUsers as user (user.uid)}
        <button
          type="button"
          class="quick-chip"
          onclick={() => onSelectUser(user)}
          title="Preview as {user.displayName}"
        >
          <RobustAvatar
            src={user.photoURL}
            name={user.displayName}
            customSize={26}
            alt=""
          />
          <span class="chip-name">{user.displayName}</span>
        </button>
      {/each}

      <!-- Search button -->
      <button
        type="button"
        class="search-btn"
        class:active={isSearchOpen}
        onclick={onToggleSearch}
        title="Search users"
      >
        <i class="fas fa-search" aria-hidden="true"></i>
      </button>

      <!-- Spacer pushes actions to the right -->
      <div class="toolbar-spacer"></div>

      <!-- Inline action buttons (when they fit) -->
      {#if useInline}
        <button type="button" class="action-chip" onclick={handleFirstRun} title="Preview First Run Wizard">
          <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
          <span>Preview First Run</span>
        </button>
        <button type="button" class="action-chip" onclick={handleCreateTutorial} title="Preview Create Tutorial">
          <i class="fas fa-graduation-cap" aria-hidden="true"></i>
          <span>Preview Tutorial</span>
        </button>
        <button type="button" class="action-chip" onclick={handleResetIntro} disabled={!canResetIntro} title="Reset Tab Intro{currentIntroTitle ? ` (${currentIntroTitle})` : ''}">
          <i class="fas fa-door-open" aria-hidden="true"></i>
          <span>Reset Intro</span>
        </button>
        <button type="button" class="action-chip" onclick={handleResetHelpDiscovery} title="Reset Help Button Discovery">
          <i class="fas fa-circle-question" aria-hidden="true"></i>
          <span>Reset Help Discovery</span>
        </button>
        <button type="button" class="action-chip" onclick={handleShowPwaBanner} title="Show PWA Migration Banner">
          <i class="fas fa-mobile-screen" aria-hidden="true"></i>
          <span>PWA Banner</span>
        </button>
        <div class="toolbar-divider"></div>
        <button type="button" class="action-chip danger" onclick={handleClearCloudThumbnails} disabled={isClearingThumbnails} title="Clear Cloud Thumbnails">
          {#if isClearingThumbnails}<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>{:else}<i class="fas fa-cloud-arrow-down" aria-hidden="true"></i>{/if}
          <span>Clear Cloud Thumbnails</span>
        </button>
        <button type="button" class="action-chip danger" onclick={handleClearLocalCache} disabled={isClearingLocalCache} title="Clear Pictograph Cache">
          {#if isClearingLocalCache}<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>{:else}<i class="fas fa-database" aria-hidden="true"></i>{/if}
          <span>Clear Pictograph Cache</span>
        </button>
        <button type="button" class="action-chip danger" onclick={handleClearTikaCache} disabled={isClearingTikaCache} title="Clear TIKA Cache">
          {#if isClearingTikaCache}<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>{:else}<i class="fas fa-robot" aria-hidden="true"></i>{/if}
          <span>Clear TIKA Cache</span>
        </button>
        <button type="button" class="action-chip danger" onclick={handleClearThumbnailCache} disabled={isClearingThumbnailCache} title="Clear Thumbnail Cache">
          {#if isClearingThumbnailCache}<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>{:else}<i class="fas fa-images" aria-hidden="true"></i>{/if}
          <span>Clear Thumbnail Cache</span>
        </button>
      {/if}
    {/if}

    <!-- RIGHT: dropdown (fallback when inline doesn't fit) + close -->
    <div class="toolbar-right">
      <div class="actions-menu" class:hidden={useInline && !isUserPreview}>
        <button
          type="button"
          class="actions-trigger"
          class:active={isActionsOpen}
          onclick={toggleActions}
          title="Debug actions"
        >
          <i class="fas fa-wrench" aria-hidden="true"></i>
          <span class="trigger-label">Debug</span>
          <i
            class="fas fa-chevron-down chevron"
            class:open={isActionsOpen}
            aria-hidden="true"
          ></i>
        </button>

        {#if isActionsOpen}
          <div
            class="actions-dropdown"
            transition:fly={{ y: -8, duration: 150 }}
          >
            <button
              type="button"
              class="dropdown-item"
              onclick={handleFirstRun}
            >
              <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
              <span>Preview First Run Wizard</span>
            </button>

            <button
              type="button"
              class="dropdown-item"
              onclick={handleCreateTutorial}
            >
              <i class="fas fa-graduation-cap" aria-hidden="true"></i>
              <span>Preview Create Tutorial</span>
            </button>

            <button
              type="button"
              class="dropdown-item"
              onclick={handleResetIntro}
              disabled={!canResetIntro}
            >
              <i class="fas fa-door-open" aria-hidden="true"></i>
              <span>
                Reset Tab Intro
                {#if currentIntroTitle}
                  <span class="intro-hint">({currentIntroTitle})</span>
                {/if}
              </span>
            </button>

            <button
              type="button"
              class="dropdown-item"
              onclick={handleResetHelpDiscovery}
            >
              <i class="fas fa-circle-question" aria-hidden="true"></i>
              <span>Reset Help Button Discovery</span>
            </button>

            <button
              type="button"
              class="dropdown-item"
              onclick={handleShowPwaBanner}
            >
              <i class="fas fa-mobile-screen" aria-hidden="true"></i>
              <span>Show PWA Migration Banner</span>
            </button>

            <div class="dropdown-divider"></div>

            <button
              type="button"
              class="dropdown-item danger"
              onclick={handleClearCloudThumbnails}
              disabled={isClearingThumbnails}
            >
              {#if isClearingThumbnails}
                <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                <span>Clearing...</span>
              {:else}
                <i class="fas fa-cloud-arrow-down" aria-hidden="true"></i>
                <span>Clear Cloud Thumbnails</span>
              {/if}
            </button>

            <button
              type="button"
              class="dropdown-item danger"
              onclick={handleClearLocalCache}
              disabled={isClearingLocalCache}
            >
              {#if isClearingLocalCache}
                <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                <span>Clearing...</span>
              {:else}
                <i class="fas fa-database" aria-hidden="true"></i>
                <span>Clear Pictograph Cache</span>
              {/if}
            </button>

            <button
              type="button"
              class="dropdown-item danger"
              onclick={handleClearTikaCache}
              disabled={isClearingTikaCache}
            >
              {#if isClearingTikaCache}
                <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                <span>Clearing...</span>
              {:else}
                <i class="fas fa-robot" aria-hidden="true"></i>
                <span>Clear TIKA Pictograph Cache</span>
              {/if}
            </button>

            <button
              type="button"
              class="dropdown-item danger"
              onclick={handleClearThumbnailCache}
              disabled={isClearingThumbnailCache}
            >
              {#if isClearingThumbnailCache}
                <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                <span>Clearing...</span>
              {:else}
                <i class="fas fa-images" aria-hidden="true"></i>
                <span>Clear Thumbnail Cache</span>
              {/if}
            </button>
          </div>
        {/if}
      </div>

      <!-- Intro reset feedback toast -->
      {#if introResetMessage}
        <div class="toast" transition:fly={{ x: 20, duration: 200 }}>
          <i class="fas fa-check" aria-hidden="true"></i>
          {introResetMessage}
        </div>
      {/if}

      <!-- Close -->
      <button
        type="button"
        class="close-btn"
        onclick={onClose}
        title="Close (F9)"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
  </div>

  <!-- Search dropdown -->
  {#if isSearchOpen}
    <div class="search-panel" transition:slide={{ duration: 150 }}>
      <UserSearchInput
        onSelect={onSelectUser}
        selectedUserId={previewProfile?.uid || ""}
        selectedUserDisplay={previewProfile?.displayName || ""}
        placeholder="Search users to preview..."
        disabled={isLoading}
        autofocus={true}
      />
    </div>
  {/if}
</div>

<style>
  .admin-toolbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: var(--z-debug);
    background: linear-gradient(
      180deg,
      rgba(15, 23, 42, 0.98) 0%,
      rgba(15, 23, 42, 0.95) 100%
    );
    border-bottom: 1px solid rgba(59, 130, 246, 0.3);
    box-shadow: 0 2px 12px var(--theme-shadow);
  }

  .toolbar-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    height: var(--min-touch-target);
    flex-wrap: nowrap;
  }

  /* Three-column layout used only in preview mode */
  .toolbar-left {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    height: 40px;
  }

  .toolbar-center {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 40px;
  }

  .toolbar-right {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 40px;
  }

  .toolbar-spacer {
    flex: 1 1 auto;
    min-width: 8px;
  }

  .toolbar-divider {
    width: 1px;
    height: 22px;
    background: rgba(255, 255, 255, 0.12);
    flex-shrink: 0;
  }

  .toolbar-branding {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--semantic-info);
    flex-shrink: 0;
  }

  .preview-label {
    display: flex;
    align-items: center;
    gap: 6px;
    color: rgba(147, 197, 253, 0.8);
    font-size: var(--font-size-compact);
    font-weight: 500;
  }

  .preview-label i {
    color: var(--semantic-info);
  }

  .preview-user {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .preview-user-name {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: white;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .preview-action.save {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.6);
    font-size: var(--font-size-compact);
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .preview-action.save:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
  }

  .exit-preview-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 6px;
    color: #fca5a5;
    font-size: var(--font-size-compact);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .exit-preview-btn:hover {
    background: rgba(239, 68, 68, 0.35);
    border-color: rgba(239, 68, 68, 0.6);
    color: white;
  }

  /* ============================================
     CHIPS (role switch + quick access users)
     ============================================ */

  .role-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 32px;
    padding: 0 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    cursor: pointer;
    transition: all var(--duration-fast);
    flex-shrink: 0;
  }

  .role-chip i {
    font-size: 11px;
    color: var(--role-color);
  }

  .role-chip:hover {
    background: color-mix(in srgb, var(--role-color) 12%, transparent);
    border-color: color-mix(in srgb, var(--role-color) 30%, transparent);
    color: var(--theme-text);
  }

  .role-chip.active {
    background: color-mix(in srgb, var(--role-color) 18%, transparent);
    border-color: color-mix(in srgb, var(--role-color) 45%, transparent);
    color: white;
  }

  .role-chip.overridden {
    border-style: dashed;
  }

  .quick-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 10px 0 5px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 18px;
    color: var(--theme-text);
    font-size: var(--font-size-compact);
    cursor: pointer;
    transition: all var(--duration-fast);
    flex-shrink: 0;
  }

  .quick-chip:hover {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.4);
  }

  .chip-name {
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .search-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--theme-stroke);
    border-radius: 18px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--duration-fast);
    flex-shrink: 0;
  }

  .search-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .search-btn.active {
    background: rgba(59, 130, 246, 0.25);
    border-color: rgba(59, 130, 246, 0.5);
    color: var(--semantic-info);
  }

  /* Debug Actions Dropdown */
  .actions-menu {
    position: relative;
    flex-shrink: 0;
  }

  .actions-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    height: 40px;
    background: rgba(139, 92, 246, 0.1);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 8px;
    color: #c4b5fd;
    font-size: var(--font-size-compact);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .actions-trigger:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.4);
  }

  .actions-trigger.active {
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(139, 92, 246, 0.5);
  }

  .actions-trigger .chevron {
    font-size: 10px;
    transition: transform var(--duration-fast);
  }

  .actions-trigger .chevron.open {
    transform: rotate(180deg);
  }

  .actions-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    min-width: 220px;
    background: rgba(20, 20, 35, 0.98);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    z-index: 10;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 12px 14px;
    background: transparent;
    border: none;
    color: var(--theme-text);
    font-size: var(--font-size-sm);
    text-align: left;
    cursor: pointer;
    transition: all var(--duration-fast);
  }

  .dropdown-item:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.15);
  }

  .dropdown-item:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .dropdown-item i {
    width: 16px;
    text-align: center;
    color: var(--theme-accent);
  }

  .dropdown-item .intro-hint {
    font-size: var(--font-size-xs);
    color: var(--theme-text-dim);
    margin-left: 4px;
  }

  .dropdown-item.danger {
    color: #fca5a5;
  }

  .dropdown-item.danger i {
    color: #ef4444;
  }

  .dropdown-item.danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.15);
  }

  .dropdown-divider {
    height: 1px;
    margin: 4px 8px;
    background: rgba(255, 255, 255, 0.1);
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid rgba(34, 197, 94, 0.4);
    border-radius: 6px;
    font-size: var(--font-size-compact);
    color: #86efac;
    flex-shrink: 0;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--duration-fast);
    flex-shrink: 0;
  }

  .close-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: var(--semantic-error);
  }

  .search-panel {
    padding: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .search-panel :global(.search-input) {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    color: white;
  }

  .search-panel :global(.search-input::placeholder) {
    color: rgba(255, 255, 255, 0.5);
  }

  /* ============================================
     ACTION CHIPS (debug actions)
     ============================================ */
  .action-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 32px;
    padding: 0 10px;
    background: rgba(139, 92, 246, 0.08);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 6px;
    color: #c4b5fd;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast);
    flex-shrink: 0;
    white-space: nowrap;
  }

  .action-chip i {
    font-size: 11px;
  }

  .action-chip:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.18);
    border-color: rgba(139, 92, 246, 0.4);
    color: white;
  }

  .action-chip:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .action-chip.danger {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .action-chip.danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.18);
    border-color: rgba(239, 68, 68, 0.4);
    color: white;
  }


  /* Hidden measuring strip - renders buttons offscreen to get natural width */
  .measure-strip {
    position: absolute;
    top: -9999px;
    left: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    pointer-events: none;
    visibility: hidden;
  }

  .actions-menu.hidden {
    display: none;
  }

  /* Progressive collapse: 900-1200px */
  @media (max-width: 1200px) {
    .trigger-label {
      display: none;
    }

    .actions-trigger {
      padding: 8px 10px;
    }
  }

  /* Compact mode: 768-900px */
  @media (max-width: 900px) {
    .toolbar-row {
      padding: 4px 8px;
      gap: 4px;
    }

    .branding-text {
      display: none;
    }

    .chip-name {
      display: none;
    }
  }
</style>

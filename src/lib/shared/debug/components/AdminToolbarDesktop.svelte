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
  import type { QuickAccessUser } from "../services/contracts/IQuickAccessPersister";
  import type { PreviewUserProfile } from "../state/user-preview-state.svelte";

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
  }: Props = $props();

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

  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".actions-menu")) {
      isActionsOpen = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="admin-toolbar" transition:slide={{ duration: 150 }}>
  <div class="toolbar-row">
    <!-- LEFT SECTION -->
    <div class="toolbar-left">
      <!-- Branding -->
      <div class="toolbar-branding">
        <i class="fas fa-shield-alt" aria-hidden="true"></i>
        <span class="branding-text">Admin</span>
      </div>

      <!-- Quick Access (only shown when NOT previewing) -->
      {#if !isUserPreview}
        <div class="quick-access">
          <span class="quick-access-label">Quick switch:</span>
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
        </div>
      {/if}
    </div>

    <!-- CENTER SECTION (preview indicator) -->
    {#if isUserPreview && previewProfile}
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
      <!-- Empty center when not previewing -->
      <div class="toolbar-center"></div>
    {/if}

    <!-- RIGHT SECTION -->
    <div class="toolbar-right">
      <!-- Debug Actions Dropdown -->
      <div class="actions-menu">
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
    z-index: 9998;
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
    gap: 8px;
    padding: 4px 12px;
    height: var(--min-touch-target);
    /* Note: no overflow:hidden here - dropdown needs to escape */
  }

  /* Three-column layout: left and right flex equally, center is fixed content */
  .toolbar-left {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    justify-content: flex-start;
    height: 40px;
    /* Note: no overflow:hidden - allow content to escape if needed */
  }

  .toolbar-center {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 40px;
  }

  .toolbar-right {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    justify-content: flex-end;
    height: 40px;
    /* Note: no overflow:hidden here - dropdown needs to escape */
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
     QUICK ACCESS (when NOT previewing)
     ============================================ */
  .quick-access {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 1;
    min-width: 0;
    max-width: 600px;
    height: 40px;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .quick-access {
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  .quick-access::-webkit-scrollbar {
    width: 8px;
  }

  .quick-access::-webkit-scrollbar-track {
    background: var(--scrollbar-track, transparent);
  }

  .quick-access::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2));
    border-radius: 4px;
  }

  .quick-access::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover, rgba(255, 255, 255, 0.35));
  }

  .quick-access-label {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    white-space: nowrap;
    flex-shrink: 0;
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

  /* Progressive collapse: 900-1200px */
  @media (max-width: 1200px) {
    .quick-access {
      max-width: 350px;
    }

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
      gap: 6px;
    }

    .branding-text {
      display: none;
    }

    .quick-access {
      max-width: 200px;
    }

    .chip-name {
      max-width: 60px;
    }
  }
</style>

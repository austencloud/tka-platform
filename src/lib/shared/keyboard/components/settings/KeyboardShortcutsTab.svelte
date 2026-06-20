<!--
  KeyboardShortcutsTab.svelte

  Settings tab for managing keyboard shortcuts.
  Organized by WHERE shortcuts work (context), not what they do.
  2026 design: clean, scannable, zero friction.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { getShortcutCustomizer } from "../../get-shortcut-customizer";
  import type { ShortcutCustomizer } from "../../services/shortcut-customizer";
import type { ShortcutWithBinding } from "../../services/types";
  import type {
    ShortcutContext,
    ShortcutConflict,
  } from "../../domain/types/keyboard-types";
  import ShortcutContextSection from "./ShortcutContextSection.svelte";
  import ShortcutKeyCapture from "./ShortcutKeyCapture.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";

  // Services
  let customizationService: ShortcutCustomizer | null = $state(null);

  // State
  let searchQuery = $state("");
  let allShortcuts = $state<ShortcutWithBinding[]>([]);
  let expandedContexts = $state<Set<string>>(new Set(["global"]));

  // Edit modal state
  let editingItem = $state<ShortcutWithBinding | null>(null);
  let isEditModalOpen = $state(false);

  // Mobile detection
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // Admin check
  const isAdmin = $derived(authState.isAdmin);

  // Context configuration - ordered by frequency of use
  // "global" always first, then module-specific contexts
  const contextConfig: Array<{
    context: ShortcutContext | "all";
    label: string;
    icon: string;
    adminOnly?: boolean;
  }> = [
    { context: "global", label: "Global", icon: "fa-globe" },
    { context: "create", label: "Create", icon: "fa-plus-circle" },
    { context: "edit-panel", label: "Edit Panel", icon: "fa-pen" },
    { context: "browse", label: "Browse", icon: "fa-compass" },
    { context: "compose", label: "Compose", icon: "fa-music" },
    { context: "learn", label: "Learn", icon: "fa-graduation-cap" },
    { context: "realm", label: "Realm", icon: "fa-vr-cardboard" },
    { context: "admin", label: "Admin", icon: "fa-crown", adminOnly: true },
  ];

  // Filter contexts based on admin status
  const visibleContexts = $derived(
    contextConfig.filter((c) => !c.adminOnly || isAdmin)
  );

  onMount(() => {
    try {
      customizationService = getShortcutCustomizer();
      refreshShortcuts();
    } catch (error) {
      console.warn("Failed to resolve shortcut customization service:", error);
    }
  });

  function refreshShortcuts() {
    if (!customizationService) return;
    allShortcuts = customizationService.getAllShortcutsWithBindings();
  }

  // Filter by search
  const filteredShortcuts = $derived(() => {
    if (!searchQuery.trim()) return allShortcuts;

    const query = searchQuery.toLowerCase();
    return allShortcuts.filter(
      (item) =>
        item.shortcut.label.toLowerCase().includes(query) ||
        item.shortcut.description?.toLowerCase().includes(query) ||
        item.shortcut.id.toLowerCase().includes(query)
    );
  });

  // Group shortcuts by their PRIMARY context
  // A shortcut with context: ["create", "edit-panel"] goes in "create"
  // A shortcut with context: "global" goes in "global"
  const groupedByContext = $derived(() => {
    const groups = new Map<string, ShortcutWithBinding[]>();

    for (const item of filteredShortcuts()) {
      const contexts = Array.isArray(item.shortcut.context)
        ? item.shortcut.context
        : [item.shortcut.context];

      // Use the first context as primary (or "global" if it's there)
      const primaryContext = contexts.includes("global")
        ? "global"
        : contexts[0] || "global";

      if (!groups.has(primaryContext)) {
        groups.set(primaryContext, []);
      }
      groups.get(primaryContext)!.push(item);
    }

    return groups;
  });

  // Customization count - use function to avoid TypeScript narrowing issues
  function getCustomizedCount(): number {
    return customizationService?.getCustomizedCount() ?? 0;
  }
  const customizedCount = $derived(getCustomizedCount());

  // Edit handlers
  function handleEditShortcut(item: ShortcutWithBinding) {
    editingItem = item;
    isEditModalOpen = true;
  }

  function handleResetShortcut(item: ShortcutWithBinding) {
    if (!customizationService) return;
    customizationService.resetBinding(item.shortcut.id);
    refreshShortcuts();
  }

  function handleSaveBinding(keyCombo: string) {
    if (!customizationService || !editingItem) return;
    customizationService.setCustomBinding(editingItem.shortcut.id, keyCombo);
    refreshShortcuts();
    editingItem = null;
  }

  function handleClearBinding() {
    if (!customizationService || !editingItem) return;
    customizationService.disableShortcut(editingItem.shortcut.id);
    refreshShortcuts();
    editingItem = null;
  }

  function handleResetAll() {
    if (!customizationService) return;
    if (!confirm("Reset all shortcuts to their default bindings?")) return;
    customizationService.resetAllBindings();
    refreshShortcuts();
  }

  function detectConflict(keyCombo: string): ShortcutConflict | null {
    if (!customizationService || !editingItem) return null;
    return customizationService.detectConflict(
      editingItem.shortcut.id,
      keyCombo
    );
  }

  function toggleContext(context: string) {
    const newSet = new Set(expandedContexts);
    if (newSet.has(context)) {
      newSet.delete(context);
    } else {
      newSet.add(context);
    }
    expandedContexts = newSet;
  }

  function clearSearch() {
    searchQuery = "";
  }
</script>

<div class="keyboard-tab themed-scrollbar">
  <!-- Search -->
  <div class="search-section">
    <div class="search-wrapper">
      <i class="fas fa-search search-icon" aria-hidden="true"></i>
      <input
        type="text"
        class="search-input"
        placeholder="Search shortcuts..."
        bind:value={searchQuery}
      />
      {#if searchQuery}
        <button
          type="button"
          class="clear-btn"
          onclick={clearSearch}
          aria-label="Clear search"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      {/if}
    </div>

    {#if customizedCount > 0}
      <button type="button" class="reset-all-btn" onclick={handleResetAll}>
        Reset all ({customizedCount})
      </button>
    {/if}
  </div>

  <!-- Shortcuts list -->
  <div class="shortcuts-list">
    {#if filteredShortcuts().length === 0}
      <div class="empty-state">
        <i class="fas fa-keyboard" aria-hidden="true"></i>
        <p>No shortcuts found</p>
        {#if searchQuery}
          <span>Try a different search term</span>
        {/if}
      </div>
    {:else}
      {#each visibleContexts as { context, label, icon }}
        {#if groupedByContext().has(context)}
          {@const shortcuts = groupedByContext().get(context)!}
          <ShortcutContextSection
            {context}
            {label}
            {icon}
            {shortcuts}
            isExpanded={expandedContexts.has(context)}
            onEditShortcut={handleEditShortcut}
            onResetShortcut={handleResetShortcut}
          />
        {/if}
      {/each}
    {/if}
  </div>
</div>

<!-- Key capture modal -->
<ShortcutKeyCapture
  bind:isOpen={isEditModalOpen}
  item={editingItem}
  {isMobile}
  onSave={handleSaveBinding}
  onCancel={() => (isEditModalOpen = false)}
  onClear={handleClearBinding}
  {detectConflict}
/>

<style>
  .keyboard-tab {
    flex: 1 1 0%;
    min-height: 0;
    width: 100%;
    max-width: 1000px;
    margin: 0 auto;
    padding: 0 12px;
    box-sizing: border-box;
    overflow-y: auto; /* Scroll the entire tab content */
  }

  /* Search section - prominent header */
  .search-section {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 12px;
    margin-bottom: 8px;
    background: var(
      --theme-panel-bg,
      color-mix(in srgb, var(--theme-shadow, #000) 30%, transparent)
    );
    backdrop-filter: blur(16px);
    border-radius: 16px;
    border: 1px solid
      var(
        --theme-stroke,
        color-mix(in srgb, var(--theme-text, #fff) 8%, transparent)
      );
    flex-shrink: 0;
  }

  .search-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 14px;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    height: var(--min-touch-target);
    padding: 0 44px 0 42px;
    background: var(
      --theme-card-bg,
      color-mix(in srgb, var(--theme-text, #fff) 6%, transparent)
    );
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text);
    font-size: var(--font-size-sm);
    outline: none;
    transition: all var(--duration-fast) ease;
  }

  .search-input::placeholder {
    color: var(--theme-text-dim);
  }

  .search-input:focus {
    border-color: var(--theme-accent);
    background: var(--theme-card-bg);
    box-shadow: 0 0 0 3px
      color-mix(
        in srgb,
        var(--theme-accent, var(--theme-accent)) 15%,
        transparent
      );
  }

  .clear-btn {
    position: absolute;
    right: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target); /* WCAG AA touch target */
    height: var(--min-touch-target);
    padding: 0;
    background: var(
      --theme-card-bg,
      color-mix(in srgb, var(--theme-text, #fff) 10%, transparent)
    );
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all var(--duration-instant) ease;
  }

  .clear-btn:hover {
    background: var(
      --theme-card-hover-bg,
      color-mix(in srgb, var(--theme-text, #fff) 15%, transparent)
    );
    color: var(--theme-text, var(--theme-text));
  }

  .reset-all-btn {
    flex-shrink: 0;
    padding: 12px 18px;
    height: var(--min-touch-target);
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 12%,
      transparent
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--semantic-error, var(--semantic-error)) 30%,
        transparent
      );
    border-radius: 12px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--semantic-error, var(--semantic-error));
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    white-space: nowrap;
  }

  .reset-all-btn:hover {
    background: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 20%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-error, var(--semantic-error)) 45%,
      transparent
    );
    transform: translateY(-1px);
  }

  /* Shortcuts list - container for sections, expands naturally */
  .shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 24px;
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 40px 20px;
    text-align: center;
  }

  .empty-state i {
    font-size: var(--font-size-3xl);
    color: var(--theme-text-dim);
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .empty-state span {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  /* Mobile */
  @media (max-width: 480px) {
    .search-section {
      flex-wrap: wrap;
    }

    .search-wrapper {
      width: 100%;
    }

    .reset-all-btn {
      width: 100%;
    }
  }
</style>

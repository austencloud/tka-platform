<!-- VersionDetailContent - Changelog content for a single version, usable inline or in a drawer -->
<script lang="ts">
  import { onMount } from "svelte";
  import type {
    AppVersion,
    ChangelogCategory,
    ChangelogEntry,
  } from "$lib/shared/versioning/domain/models/version-models";
  import { CHANGELOG_CATEGORIES } from "$lib/shared/versioning/domain/constants/changelog-constants";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import type { FeedbackItem } from "$lib/shared/feedback/domain/models/feedback-models";
  import { feedbackService } from "$lib/shared/feedback/services/feedback-repository";
  import { createFeedbackManageState } from "$lib/shared/feedback/state/feedback-manage-state.svelte";
  import EditableReleaseNotes from "./EditableReleaseNotes.svelte";
  import ChangeGroupSection from "./ChangeGroupSection.svelte";
  import VersionHeader from "./VersionHeader.svelte";
  import NoChangelogState from "./NoChangelogState.svelte";
  import ActionToast from "./ActionToast.svelte";
  import ContributorBadge from "./ContributorBadge.svelte";
  import { getContributorLoader } from "$lib/shared/feedback/get-contributor-loader";
  import type { Contributor } from "$lib/shared/versioning/domain/models/contributor-models";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { changelogEditState } from "./state/changelog-edit-state.svelte";
  import * as versionService from "$lib/shared/feedback/services/version-service";

  let {
    version,
    onVersionUpdated,
    showCloseButton = true,
    onClose,
  }: {
    version: AppVersion;
    onVersionUpdated?: () => void;
    showCloseButton?: boolean;
    onClose?: () => void;
  } = $props();

  // Contributor state
  let allContributors = $state<Contributor[]>([]);
  const contributorMap = $derived(
    new Map(allContributors.map((c) => [c.id, c]))
  );

  // UI state
  let currentlyEditingId = $state<string | null>(null);
  let selectedFeedback = $state<FeedbackItem | null>(null);
  let isLoadingFeedback = $state(false);
  let feedbackPanelOpen = $state(false);
  let addingToCategory = $state<ChangelogCategory | null>(null);
  let newEntryText = $state("");

  // Create a manage state for editing feedback in release notes context
  const manageState = createFeedbackManageState();

  // Toast
  type ToastType = "action" | "undone" | "redone";
  let toastMessage = $state<string | null>(null);
  let toastType = $state<ToastType>("action");
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;

  // Reset UI state when version changes (user clicked different release)
  $effect(() => {
    // Read version to create dependency
    const _ = version;
    // Reset all edit/add states
    addingToCategory = null;
    newEntryText = "";
    currentlyEditingId = null;
  });

  // Derived
  const isAdmin = $derived(authState.isEffectiveAdmin);
  const hasChangelog = $derived(
    version?.changelogEntries && version.changelogEntries.length > 0
  );

  const groupedChangelog = $derived.by(() => {
    const entries = version?.changelogEntries;
    if (!entries) return { fixed: [], added: [], improved: [] };
    return {
      fixed: entries.filter((e) => e.category === "fixed"),
      added: entries.filter((e) => e.category === "added"),
      improved: entries.filter((e) => e.category === "improved"),
    };
  });

  function showToast(msg: string, type: ToastType) {
    toastMessage = msg;
    toastType = type;
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => (toastMessage = null), 3000);
  }

  // Edit state
  function startEdit(id: string) {
    if (addingToCategory) {
      cancelAdd();
    }
    currentlyEditingId = id;
  }
  function endEdit() {
    currentlyEditingId = null;
  }

  function openFeedback(entry: ChangelogEntry) {
    if (addingToCategory) {
      cancelAdd();
    }
    if (entry.feedbackId) {
      void loadAndOpenFeedback(entry.feedbackId);
    }
  }

  async function loadAndOpenFeedback(feedbackId: string) {
    isLoadingFeedback = true;
    try {
      const feedback = await feedbackService.getFeedback(feedbackId);
      if (feedback) {
        selectedFeedback = feedback;
        feedbackPanelOpen = true;
      }
    } catch (err) {
      console.error("Failed to load feedback:", err);
    } finally {
      isLoadingFeedback = false;
    }
  }

  function closeFeedbackPanel() {
    feedbackPanelOpen = false;
    selectedFeedback = null;
  }

  function handlePanelClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (currentlyEditingId && !target.closest(".edit-container")) {
      endEdit();
    }
    if (
      addingToCategory &&
      !target.closest(".add-entry-form") &&
      !target.closest(".add-entry-btn")
    ) {
      cancelAdd();
    }
  }

  // Add entry
  function startAdd(cat: ChangelogCategory) {
    addingToCategory = cat;
    newEntryText = "";
  }
  function cancelAdd() {
    addingToCategory = null;
    newEntryText = "";
  }

  async function confirmAdd() {
    if (!version || !addingToCategory || !newEntryText.trim()) return;
    const entry: ChangelogEntry = {
      category: addingToCategory,
      text: newEntryText.trim(),
    };
    await versionService.addChangelogEntry(version.version, entry);
    version.changelogEntries = [...(version.changelogEntries || []), entry];
    cancelAdd();
    onVersionUpdated?.();
  }

  // Save/delete
  async function handleSave(cat: ChangelogCategory, idx: number, text: string) {
    if (!version) return;
    const entries = version.changelogEntries || [];
    const catEntries = entries.filter((e) => e.category === cat);
    const entry = catEntries[idx];
    if (!entry) return;

    const absIdx = entries.indexOf(entry);
    const oldText = entry.text;
    const updated: ChangelogEntry = {
      category: cat,
      text,
      ...(entry.feedbackId && { feedbackId: entry.feedbackId }),
    };

    await versionService.updateChangelogEntry(version.version, absIdx, updated);
    version.changelogEntries![absIdx] = updated;
    changelogEditState.pushUndo({
      type: "edit",
      oldText,
      absoluteIndex: absIdx,
    });
    onVersionUpdated?.();
  }

  async function handleDelete(cat: ChangelogCategory, idx: number) {
    if (!version) return;
    const entries = version.changelogEntries || [];
    const catEntries = entries.filter((e) => e.category === cat);
    const entry = catEntries[idx];
    if (!entry) return;

    const absIdx = entries.indexOf(entry);
    const deleted = { ...entry };

    await versionService.deleteChangelogEntry(version.version, absIdx);
    version.changelogEntries!.splice(absIdx, 1);
    version.changelogEntries = [...version.changelogEntries!];

    changelogEditState.pushUndo({
      type: "delete",
      entry: deleted,
      absoluteIndex: absIdx,
    });
    showToast("Entry deleted", "action");
    onVersionUpdated?.();
  }

  async function handleSaveReleaseNotes(text: string) {
    if (!version) return;
    const oldText = version.releaseNotes || "";
    await versionService.updateReleaseNotes(version.version, text);
    version.releaseNotes = text;
    changelogEditState.pushUndo({ type: "editReleaseNotes", oldText });
    onVersionUpdated?.();
  }

  // Undo/redo
  async function handleUndo() {
    if (!version) return;
    try {
      const msg = await changelogEditState.undo(version);
      if (msg) showToast(msg, "undone");
      onVersionUpdated?.();
    } catch {
      showToast("Undo failed", "action");
    }
  }

  async function handleRedo() {
    if (!version) return;
    try {
      const msg = await changelogEditState.redo(version);
      if (msg) showToast(msg, "redone");
      onVersionUpdated?.();
    } catch {
      showToast("Redo failed", "action");
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === "z" && !e.shiftKey && changelogEditState.canUndo) {
      e.preventDefault();
      void handleUndo();
    }
    if (
      mod &&
      ((e.key === "z" && e.shiftKey) || e.key === "y") &&
      changelogEditState.canRedo
    ) {
      e.preventDefault();
      void handleRedo();
    }
  }

  function formatReleaseNotesForCopy(): string {
    if (!version) return "";
    const lines: string[] = [];

    lines.push(`TKA Composer v${version.version}`);
    lines.push(
      `Released ${version.releasedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`
    );
    lines.push("");

    if (version.releaseNotes) {
      lines.push(version.releaseNotes);
      lines.push("");
    }

    const cats = [
      { key: "added", label: "Added" },
      { key: "improved", label: "Improved" },
      { key: "fixed", label: "Fixed" },
    ] as const;

    for (const { key, label } of cats) {
      const entries = groupedChangelog[key];
      if (entries.length > 0) {
        lines.push(`${label}:`);
        for (const entry of entries) {
          lines.push(`• ${entry.text}`);
        }
        lines.push("");
      }
    }

    return lines.join("\n").trim();
  }

  async function handleUpdateEntryContributors(
    cat: ChangelogCategory,
    catIdx: number,
    contributorIds: string[]
  ) {
    if (!version) return;
    const entries = version.changelogEntries || [];
    const catEntries = entries.filter((e) => e.category === cat);
    const entry = catEntries[catIdx];
    if (!entry) return;
    const absIdx = entries.indexOf(entry);

    await versionService.updateEntryContributors(
      version.version,
      absIdx,
      contributorIds
    );

    // Update local state so the UI reflects the change immediately
    version.changelogEntries![absIdx] = {
      ...version.changelogEntries![absIdx]!,
      contributorIds: contributorIds.length > 0 ? contributorIds : undefined,
    };
    version.changelogEntries = [...version.changelogEntries!];

    // Recompute version-level contributors as union of all entries
    const allIds = new Set<string>();
    for (const e of version.changelogEntries!) {
      if (e.contributorIds) {
        for (const id of e.contributorIds) allIds.add(id);
      }
    }
    version.contributorIds = allIds.size > 0 ? [...allIds] : undefined;

    onVersionUpdated?.();
  }

  onMount(() => {
    const loader = getContributorLoader();
    loader.getAll().then((list) => {
      allContributors = list;
    });

    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
      if (toastTimeout) clearTimeout(toastTimeout);
    };
  });
</script>

<div
  class="version-detail-body"
  onclick={handlePanelClick}
  role="presentation"
>
  <VersionHeader
    version={version.version}
    releasedAt={version.releasedAt}
    onClose={showCloseButton ? onClose : undefined}
    getCopyData={formatReleaseNotesForCopy}
    layout={showCloseButton ? "drawer" : "inline"}
  />

  {#if version.releaseNotes}
    <section>
      <h3>Release Notes</h3>
      <EditableReleaseNotes
        text={version.releaseNotes}
        canEdit={isAdmin}
        onSave={handleSaveReleaseNotes}
        itemId="release-notes"
        isEditing={currentlyEditingId === "release-notes"}
        onStartEdit={startEdit}
        onEndEdit={endEdit}
      />
    </section>
  {/if}

  {#if hasChangelog || isAdmin}
    <section>
      <h3>What Changed</h3>
      {#if !hasChangelog && isAdmin}<p class="hint">
          No entries yet. Add some below:
        </p>{/if}
      {#each CHANGELOG_CATEGORIES as cat}
        {#if groupedChangelog[cat].length > 0 || isAdmin}
          <ChangeGroupSection
            category={cat}
            entries={groupedChangelog[cat]}
            {isAdmin}
            isAddingEntry={addingToCategory === cat}
            bind:newEntryText
            {currentlyEditingId}
            onSaveEntry={(i, t) => handleSave(cat, i, t)}
            onDeleteEntry={(i) => handleDelete(cat, i)}
            onOpenFeedback={openFeedback}
            onStartAdd={() => startAdd(cat)}
            onCancelAdd={cancelAdd}
            onConfirmAdd={confirmAdd}
            onStartEdit={startEdit}
            onEndEdit={endEdit}
            {allContributors}
            {contributorMap}
            onUpdateEntryContributors={(i, ids) => handleUpdateEntryContributors(cat, i, ids)}
          />
        {/if}
      {/each}
    </section>
  {:else}
    <NoChangelogState />
  {/if}

  {#if version?.contributorIds?.length && contributorMap.size > 0}
    <section>
      <h3>Contributors</h3>
      <div class="contributors-grid">
        {#each version.contributorIds as cid (cid)}
          {@const contrib = contributorMap.get(cid)}
          {#if contrib}
            <ContributorBadge contributor={contrib} size="md" />
          {/if}
        {/each}
      </div>
    </section>
  {/if}
</div>

{#if selectedFeedback}
  <Drawer
    bind:isOpen={feedbackPanelOpen}
    placement="right"
    showHandle={false}
    ariaLabel={`Edit feedback: ${selectedFeedback.title}`}
  >
    {#await import("$lib/features/feedback/components/manage/FeedbackDetailPanel.svelte") then mod}
      <mod.default
        item={selectedFeedback}
        {manageState}
        onClose={closeFeedbackPanel}
        readOnly={!isAdmin}
      />
    {/await}
  </Drawer>
{/if}

{#if toastMessage}
  <ActionToast
    message={toastMessage}
    showUndo={toastType === "action" && changelogEditState.canUndo}
    showRedo={toastType === "undone" && changelogEditState.canRedo}
    onUndo={() => void handleUndo()}
    onRedo={() => void handleRedo()}
  />
{/if}

<style>
  .version-detail-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    padding: 24px 32px;
    overflow-y: auto;
    max-width: 800px;
  }

  section {
    margin-bottom: 24px;
  }

  section h3 {
    margin: 0 0 12px 0;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .contributors-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .hint {
    margin: 0 0 16px 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    font-style: italic;
  }

  @media (max-width: 768px) {
    .version-detail-body {
      padding: 16px;
      flex: 1;
      min-height: 0;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-y: contain;
    }
  }
</style>

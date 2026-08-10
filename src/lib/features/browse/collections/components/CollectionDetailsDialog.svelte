<!--
CollectionDetailsDialog.svelte

Edits the three things a collection says about itself: its name, its notes,
and who to credit.

Credit exists because the person who authored the material often isn't on the
platform. "Gage's 12-step CAPs" is Gage DeMello's handpath work, and he has no
profile to link to. The card already renders a `by …` line for collections
owned by someone with an account; this fills that same line by hand until the
real profile exists.
-->
<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import type { LibraryCollection } from "$lib/shared/library/domain/models/collection";
  import { collectionsState } from "$lib/features/library/state/collections-state.svelte";
  import { communityCollectionsState } from "../state/community-collections-state.svelte";

  let {
    collection,
    open = $bindable(false),
  }: {
    collection: LibraryCollection;
    open?: boolean;
  } = $props();

  let name = $state("");
  let description = $state("");
  let credit = $state("");
  let saving = $state(false);

  // Reload the fields from the collection each time the dialog opens, so a
  // cancelled edit doesn't linger into the next one.
  $effect(() => {
    if (!open) return;
    name = collection.name;
    description = collection.description ?? "";
    credit = collection.credit ?? "";
  });

  const dirty = $derived(
    name.trim() !== collection.name ||
      description.trim() !== (collection.description ?? "") ||
      credit.trim() !== (collection.credit ?? "")
  );

  async function save() {
    if (saving || !name.trim()) return;
    saving = true;
    try {
      const ok = await collectionsState.saveDetails(collection.id, {
        name,
        description,
        credit,
      });
      // A public collection shows all three of these in the Community feed.
      if (ok && collection.isPublic) communityCollectionsState.invalidate();
      if (ok) open = false;
    } finally {
      saving = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    // Enter saves from the single-line fields; the notes textarea keeps Enter
    // for newlines.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void save();
    }
  }
</script>

<DialogPrimitive.Root bind:open>
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay class="dialog-backdrop" />
    <DialogPrimitive.Content class="dialog-container details-dialog">
      <DialogPrimitive.Title class="details-title"
        >Collection details</DialogPrimitive.Title
      >

      <label class="field">
        <span class="field-label">Name</span>
        <input
          type="text"
          class="field-input"
          bind:value={name}
          onkeydown={handleKeydown}
          maxlength="60"
        />
      </label>

      <label class="field">
        <span class="field-label">Notes</span>
        <textarea
          class="field-input field-notes"
          bind:value={description}
          rows="4"
          maxlength="500"
          placeholder="What this collection is, and where it came from."
        ></textarea>
      </label>

      <label class="field">
        <span class="field-label">Credit</span>
        <input
          type="text"
          class="field-input"
          bind:value={credit}
          onkeydown={handleKeydown}
          maxlength="80"
          placeholder="Concepts by Gage DeMello"
        />
        <span class="field-hint">
          Shows on the card as a "by" line. Use it for someone who doesn't have
          a profile yet.
        </span>
      </label>

      <div class="details-actions">
        <button
          type="button"
          class="details-button cancel"
          onclick={() => (open = false)}
        >
          Cancel
        </button>
        <button
          type="button"
          class="details-button save"
          disabled={saving || !name.trim() || !dirty}
          onclick={save}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>

<style>
  :global(.dialog-container.details-dialog) {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 28px;
    text-align: left;
  }

  :global(.details-title) {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .field-input {
    min-height: 44px;
    padding: 10px 14px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
    font-size: var(--font-size-base, 16px);
    font-family: inherit;
  }

  .field-notes {
    resize: vertical;
    line-height: 1.5;
  }

  .field-input:focus {
    outline: none;
    border-color: var(--theme-accent, #8b6cff);
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--theme-accent, #8b6cff) 16%, transparent);
  }

  .field-hint {
    font-size: var(--font-size-xs, 12px);
    line-height: 1.4;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }

  .details-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .details-button {
    min-height: 44px;
    min-width: 110px;
    padding: 0 24px;
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 10px;
    font-size: var(--font-size-base, 16px);
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
  }

  .details-button.cancel {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
  }

  .details-button.cancel:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
  }

  .details-button.save {
    background: linear-gradient(
      135deg,
      var(--theme-accent, #8b6cff) 0%,
      var(--theme-accent-strong, #6d4dff) 100%
    );
    color: white;
  }

  .details-button.save:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .details-button.save:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--theme-accent, #8b6cff) 40%, transparent);
  }
</style>

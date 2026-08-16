<script lang="ts">
  import { AVATAR_DEFINITIONS } from "@austencloud/scene-3d";
  import type { AvatarInstanceState } from "../../state/avatar-instance-state.svelte";
  import {
    reportViewerControlChange,
    type ViewerControlSink,
  } from "$lib/shared/sequence-viewer/domain/viewer-control-analytics";

  interface Props {
    performer: AvatarInstanceState | null;
    performerCount: number;
    performerColor: string;
    sequenceWord: string | null;
    sequenceSteps: number | null;
    canRemove: boolean;
    onRemove: () => void;
    onSettingChange?: ViewerControlSink;
  }

  let {
    performer,
    performerCount,
    performerColor,
    sequenceWord,
    sequenceSteps,
    canRemove,
    onRemove,
    onSettingChange,
  }: Props = $props();

  const isAllMode = $derived(performer === null);
  const avatarDefinition = $derived(
    AVATAR_DEFINITIONS.find(
      (avatar) => avatar.id === performer?.avatarModelId
    ) ?? AVATAR_DEFINITIONS[0]
  );
  const performerName = $derived(
    performer?.displayName ?? avatarDefinition?.name ?? "—"
  );
  const avatarInitials = $derived(
    performerName !== "—" ? performerName.slice(0, 2).toUpperCase() : "?"
  );

  let isEditingName = $state(false);
  let nameDraft = $state("");
  let nameInput = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (isEditingName && nameInput) {
      nameInput.focus();
      nameInput.select();
    }
  });

  function startEditName(): void {
    if (!performer) return;
    nameDraft = performerName === "—" ? "" : performerName;
    isEditingName = true;
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_performer",
      "name_editor_open",
      false,
      true
    );
  }

  function commitName(): void {
    if (!isEditingName) return;
    performer?.setDisplayName(nameDraft);
    isEditingName = false;
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_performer",
      "display_name_changed",
      false,
      true
    );
  }

  function cancelEditName(): void {
    isEditingName = false;
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_performer",
      "name_editor_open",
      true,
      false
    );
  }

  function handleNameKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      commitName();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelEditName();
    }
  }
</script>

<div class="header" style:--performer-color={performerColor}>
  {#if isAllMode}
    <div class="identity">
      <div class="avatar-circle all-mode" aria-hidden="true">
        <i class="fas fa-users"></i>
      </div>
      <div class="identity-meta">
        <span class="performer-name">All Performers</span>
        <div class="sub-row">
          <span class="count-badge" style:background-color={performerColor}
            >{performerCount}</span
          >
          <span class="all-hint">Changes apply to everyone</span>
        </div>
      </div>
    </div>
  {:else if performer}
    <div class="identity">
      <div class="avatar-circle" aria-hidden="true">
        <span class="avatar-initials">{avatarInitials}</span>
      </div>
      <div class="identity-meta">
        {#if isEditingName}
          <input
            bind:this={nameInput}
            class="name-input"
            bind:value={nameDraft}
            onblur={commitName}
            onkeydown={handleNameKeydown}
            maxlength="24"
            placeholder={avatarDefinition?.name ?? "Name"}
            aria-label="Performer name"
          />
        {:else}
          <button
            class="performer-name-btn"
            type="button"
            onclick={startEditName}
            title="Rename performer"
          >
            <span class="performer-name">{performerName}</span>
            <i class="fas fa-pen edit-hint" aria-hidden="true"></i>
          </button>
        {/if}
        <div class="sub-row">
          {#if sequenceWord}
            <span class="sequence-chip">{sequenceWord}</span>
            <span class="sequence-dot" aria-hidden="true">·</span>
          {/if}
          <span class:muted={sequenceSteps === null} class="sequence-steps">
            {sequenceSteps === null ? "No sequence" : `${sequenceSteps} steps`}
          </span>
        </div>
      </div>
    </div>
    {#if canRemove}
      <button
        class="remove-button"
        type="button"
        onclick={onRemove}
        aria-label={`Remove ${performerName}`}
        title="Remove performer"
      >
        <i class="fas fa-trash-alt" aria-hidden="true"></i>
        <span>Remove</span>
      </button>
    {/if}
  {/if}
</div>

<style>
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 58px 10px 14px;
  }
  .identity {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex: 1;
  }
  .avatar-circle {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    border: 2px solid var(--performer-color);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: color-mix(in srgb, var(--performer-color) 14%, transparent);
    box-shadow: 0 0 12px
      color-mix(in srgb, var(--performer-color) 20%, transparent);
  }
  .avatar-circle.all-mode {
    color: color-mix(in srgb, var(--performer-color) 60%, white);
    font-size: 14px;
  }
  .avatar-initials {
    color: var(--performer-color);
    font-size: 13px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: 0.03em;
  }
  .identity-meta {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .performer-name {
    color: var(--theme-text);
    font-size: 18px;
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .performer-name-btn {
    min-height: 44px;
    padding: 1px 4px 1px 0;
    margin: 0 0 1px;
    border: none;
    border-radius: 6px;
    background: transparent;
    cursor: text;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    max-width: 100%;
  }
  .performer-name-btn:hover {
    background: var(--theme-card-hover-bg);
  }
  .edit-hint {
    color: var(--theme-text-tertiary);
    font-size: 12px;
    opacity: 0;
    transition: opacity 140ms ease;
  }
  .performer-name-btn:hover .edit-hint,
  .performer-name-btn:focus-visible .edit-hint {
    opacity: 1;
  }
  .name-input {
    max-width: 100%;
    margin: 0 0 1px;
    padding: 1px 6px;
    border: 1.5px solid var(--performer-color);
    border-radius: 6px;
    background: var(--theme-input-bg);
    color: var(--theme-text);
    font-size: 18px;
    font-weight: 800;
    line-height: 1.15;
    outline: none;
  }
  .sub-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .count-badge {
    padding: 1px 6px;
    border-radius: 4px;
    color: var(--text-on-accent);
    font-size: 13px;
    font-weight: 800;
    line-height: 1.3;
  }
  .all-hint,
  .sequence-chip,
  .sequence-dot,
  .sequence-steps {
    color: var(--theme-text-dim);
    font-size: 14px;
  }
  .all-hint {
    font-style: italic;
  }
  .sequence-chip {
    font-weight: 650;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sequence-dot {
    color: var(--theme-text-tertiary);
  }
  .sequence-steps {
    font-weight: 550;
    white-space: nowrap;
  }
  .sequence-steps.muted {
    color: var(--theme-text-tertiary);
    font-style: italic;
  }
  .remove-button {
    min-width: 88px;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--theme-danger-border);
    border-radius: 9px;
    background: var(--theme-danger-bg);
    color: var(--semantic-error);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    flex-shrink: 0;
    font-size: 14px;
    font-weight: 700;
  }
  .remove-button:hover {
    background: var(--theme-danger-hover-bg);
    border-color: var(--theme-danger-hover-border);
    color: var(--theme-text);
  }
  button:focus-visible {
    outline: 2px solid var(--performer-color);
    outline-offset: 2px;
  }
  @container (max-width: 460px) {
    .header {
      padding-right: 52px;
    }
    .remove-button {
      min-width: 44px;
      width: 44px;
      padding: 0;
    }
    .remove-button span {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .edit-hint {
      transition: none;
    }
  }
</style>

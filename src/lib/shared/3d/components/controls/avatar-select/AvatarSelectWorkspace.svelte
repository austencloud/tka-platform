<script lang="ts">
  import { AVATAR_DEFINITIONS, type AvatarId } from "@austencloud/scene-3d";
  import type { AvatarInstanceState } from "$lib/shared/3d/state/avatar-instance-state.svelte";
  import PerformerAvatarPicker from "../PerformerAvatarPicker.svelte";

  interface Props {
    currentAvatarId: AvatarId | null;
    pendingAvatarId?: AvatarId | null;
    performerColor?: string;
    previewPerformer: AvatarInstanceState | null;
    previewPerformerNumber: number;
    onIntent: (id: AvatarId) => void;
    onCancelIntent: () => void;
    onSelect: (id: AvatarId) => void;
  }

  let {
    currentAvatarId,
    pendingAvatarId = null,
    performerColor = "var(--theme-accent)",
    previewPerformer,
    previewPerformerNumber,
    onIntent,
    onCancelIntent,
    onSelect,
  }: Props = $props();

  const currentDefinition = $derived(
    AVATAR_DEFINITIONS.find(
      (definition) => definition.id === currentAvatarId
    ) ?? null
  );
  const pendingDefinition = $derived(
    AVATAR_DEFINITIONS.find(
      (definition) => definition.id === pendingAvatarId
    ) ?? null
  );
</script>

<div class="avatar-select-shell" style:--performer-color={performerColor}>
  <div class="picker-heading">
    <strong>Choose an avatar</strong>
    <span>
      Hover to preview {previewPerformerNumber === 1
        ? "Performer 1's"
        : `Performer ${previewPerformerNumber}'s`} sequence. Select to apply instantly.
    </span>
  </div>

  <span class="selection-status" aria-live="polite">
    {pendingDefinition
      ? `Loading ${pendingDefinition.name}`
      : currentDefinition
        ? `${currentDefinition.name} is active`
        : "Performers use different avatars"}
  </span>

  <PerformerAvatarPicker
    selectedAvatarId={currentAvatarId}
    groupLabel="Choose an avatar"
    {previewPerformer}
    {pendingAvatarId}
    {onSelect}
    {onIntent}
    {onCancelIntent}
  />
</div>

<style>
  .avatar-select-shell {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
    container-type: inline-size;
  }

  .picker-heading {
    display: flex;
    flex-direction: column;
    gap: 0.1875rem;
  }

  .picker-heading strong {
    color: var(--theme-text);
    font-size: 1rem;
    font-weight: 650;
  }

  .picker-heading span {
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 14px);
    line-height: 1.4;
  }

  .selection-status {
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
</style>

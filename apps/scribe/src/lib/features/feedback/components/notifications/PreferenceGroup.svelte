<script lang="ts">
  import type { NotificationPreferences } from "../../domain/models/notification-models";
  import PreferenceItemCard from "./PreferenceItemCard.svelte";
  import type { PreferenceItem } from "./PreferenceItem";

  interface Props {
    title: string;
    description: string;
    items: PreferenceItem[];
    preferences: NotificationPreferences;
    isBusyKey: (key: keyof NotificationPreferences) => boolean;
    onToggle: (key: keyof NotificationPreferences) => void;
    disabled?: boolean;
  }

  let {
    title,
    description,
    items,
    preferences,
    isBusyKey,
    onToggle,
    disabled = false,
  }: Props = $props();
</script>

<div class="preference-group">
  <div class="group-header">
    <h3>{title}</h3>
    <p class="group-description">{description}</p>
  </div>

  <div class="preference-items">
    {#each items as item}
      <PreferenceItemCard
        label={item.label}
        description={item.description}
        enabled={preferences[item.key]}
        isBusy={isBusyKey(item.key)}
        {disabled}
        onToggle={() => onToggle(item.key)}
      />
    {/each}
  </div>
</div>

<style>
  .preference-group {
    display: flex;
    flex-direction: column;
  }

  .group-header {
    margin-bottom: 10px;
  }

  .group-header h3 {
    font-size: var(--font-size-sm);
    font-weight: 700;
    color: rgba(255, 255, 255, 0.92);
    margin: 0 0 2px 0;
  }

  .group-description {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    margin: 0;
    line-height: 1.4;
  }

  .preference-items {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
</style>

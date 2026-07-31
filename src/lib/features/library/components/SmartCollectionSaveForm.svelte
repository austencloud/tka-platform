<script lang="ts">
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import type { SmartFilterSpec } from "$lib/shared/library/domain/models/collection";
  import SmartCollectionRuleSummary from "./SmartCollectionRuleSummary.svelte";

  interface Props {
    spec: SmartFilterSpec;
    matchCount?: number | null;
    name?: string;
    saving?: boolean;
    autofocus?: boolean;
    inputId?: string;
    onSave: () => void;
  }

  let {
    spec,
    matchCount = null,
    name = $bindable(""),
    saving = false,
    autofocus = false,
    inputId = "smart-collection-name",
    onSave,
  }: Props = $props();

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (name.trim() && !saving) onSave();
  }
</script>

<form
  class="save-form"
  onsubmit={(event) => {
    event.preventDefault();
    onSave();
  }}
>
  <SmartCollectionRuleSummary {spec} {matchCount} draft />

  <label class="name-label" for={inputId}> Collection name </label>
  <!-- svelte-ignore a11y_autofocus -->
  <input
    id={inputId}
    name="smart-collection-name"
    class="name-field"
    type="text"
    bind:value={name}
    onkeydown={handleKeydown}
    placeholder="Example: Level 1 practice"
    maxlength="60"
    {autofocus}
    autocomplete="off"
  />

  <p class="save-note">
    New matching sequences join this collection automatically.
  </p>

  <PanelButton
    type="submit"
    variant="primary"
    fullWidth
    disabled={!name.trim() || saving || spec.filters.length === 0}
  >
    <i
      class={`fas ${saving ? "fa-circle-notch fa-spin" : "fa-wand-magic-sparkles"}`}
      aria-hidden="true"
    ></i>
    {saving ? "Saving collection" : "Save Smart Collection"}
  </PanelButton>
</form>

<style>
  .save-form {
    display: flex;
    width: min(560px, 100%);
    flex-direction: column;
    gap: 12px;
    padding: clamp(16px, 4cqi, 24px);
  }

  .name-label {
    margin-top: 2px;
    color: var(--theme-text, white);
    font-size: var(--font-size-sm, 14px);
    font-weight: 650;
  }

  .name-field {
    width: 100%;
    min-width: 0;
    height: 48px;
    padding: 0 14px;
    border: 1.5px solid
      color-mix(
        in srgb,
        var(--theme-accent, #8b6cff) 42%,
        var(--theme-stroke, rgba(255, 255, 255, 0.1))
      );
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
    font-family: inherit;
    font-size: var(--font-size-sm, 14px);
  }

  .name-field::placeholder {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }

  .name-field:focus-visible {
    border-color: var(--theme-accent, #8b6cff);
    outline: none;
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--theme-accent, #8b6cff) 18%, transparent);
  }

  .save-note {
    margin: -2px 0 2px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
    font-size: var(--font-size-sm, 14px);
    line-height: 1.45;
  }
</style>

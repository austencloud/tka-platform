<script lang="ts">
  /**
   * Notes Input
   *
   * Reusable text input for optional notes in any review workflow.
   */
  interface Props {
    value: string;
    onInput: (value: string) => void;
    placeholder?: string;
    label?: string;
  }

  let {
    value = $bindable(""),
    onInput,
    placeholder = "Any observations...",
    label = "Notes (optional)",
  }: Props = $props();

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    value = target.value;
    onInput(target.value);
  }
</script>

<div class="notes-section">
  <label class="notes-label">
    <span class="label-text">{label}</span>
    <input
      type="text"
      class="notes-input"
      {value}
      oninput={handleInput}
      {placeholder}
    />
  </label>
</div>

<style>
  .notes-section {
    margin-top: var(--spacing-md);
  }

  .notes-label {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .label-text {
    font-size: var(--font-size-xs);
    font-weight: 500;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .notes-input {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--surface-dark);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 8px;
    color: var(--foreground);
    font-size: var(--font-size-sm);
    transition: var(--transition-fast);
  }

  .notes-input:focus {
    outline: none;
    border-color: var(--primary-color);
    background: var(--surface-color);
  }

  .notes-input::placeholder {
    color: var(--muted);
  }
</style>

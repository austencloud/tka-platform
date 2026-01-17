<script lang="ts">
  /**
   * PanelSearch - Search input component
   *
   * Provides consistent search input styling.
   */

  interface Props {
    /** Current search value */
    value: string;
    /** Placeholder text */
    placeholder?: string;
    /** Input handler */
    oninput?: (value: string) => void;
    /** Optional max width */
    maxWidth?: string;
  }

  let {
    value = $bindable(""),
    placeholder = "Search...",
    oninput,
    maxWidth = "600px",
  }: Props = $props();

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value = target.value;
    oninput?.(target.value);
  }
</script>

<div class="panel-search" style:max-width={maxWidth}>
  <i class="fas fa-search panel-search__icon" aria-hidden="true"></i>
  <input
    type="text"
    class="panel-search__input"
    {placeholder}
    {value}
    oninput={handleInput}
    aria-label="Search"
  />
</div>

<style>
  .panel-search {
    position: relative;
    width: 100%;
    padding: 0 20px;
  }

  .panel-search__icon {
    position: absolute;
    left: 32px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--theme-text-dim, var(--theme-text-dim));
    pointer-events: none;
  }

  .panel-search__input {
    width: 100%;
    padding: 10px 12px 10px 40px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    color: var(--theme-text, white);
    font-size: var(--font-size-sm);
    transition: all var(--duration-normal) ease;
  }

  .panel-search__input:focus {
    outline: none;
    background: var(--theme-card-hover-bg, var(--theme-card-bg));
    border-color: var(--theme-stroke-strong);
    box-shadow: 0 0 0 3px
      color-mix(
        in srgb,
        var(--theme-accent, var(--theme-accent-strong)) 15%,
        transparent
      );
  }

  .panel-search__input::placeholder {
    color: var(--theme-text-dim);
  }

  @media (max-width: 640px) {
    .panel-search {
      padding: 0 16px;
    }

    .panel-search__icon {
      left: 28px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .panel-search__input {
      transition: none;
    }
  }
</style>

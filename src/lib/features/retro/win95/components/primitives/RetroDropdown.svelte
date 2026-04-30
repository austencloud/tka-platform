<!--
  RetroDropdown - 98.css-styled <select> element

  Wraps a native <select> with 98.css's sunken field styling.
  Value is bindable for two-way data flow.
-->
<script lang="ts">
  let {
    id,
    value = $bindable(""),
    options,
    disabled = false,
  }: {
    id?: string;
    value?: string;
    options: { label: string; value: string }[];
    disabled?: boolean;
  } = $props();

  function handleChange(event: Event & { currentTarget: HTMLSelectElement }) {
    value = event.currentTarget.value;
  }
</script>

<select
  class="retro-dropdown"
  {id}
  {disabled}
  onchange={handleChange}
  {value}
>
  {#each options as option (option.value)}
    <option value={option.value} selected={option.value === value}>
      {option.label}
    </option>
  {/each}
</select>

<style>
  .retro-dropdown {
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-field-text, #000);
    background: var(--retro-field-bg, #fff);
    min-width: 100px;
    padding: var(--retro-padding-sm, 2px) var(--retro-padding-md, 4px);
    box-sizing: border-box;
  }

  .retro-dropdown:disabled {
    color: var(--retro-disabled-text, #808080);
    background: var(--retro-button-face, #c0c0c0);
  }

  .retro-dropdown:focus-visible {
    outline: 1px dotted var(--retro-black, #000);
    outline-offset: -1px;
  }
</style>

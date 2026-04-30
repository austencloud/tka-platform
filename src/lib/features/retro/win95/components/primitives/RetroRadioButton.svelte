<!--
  RetroRadioButton - 98.css-styled radio button with label

  Uses a shared `name` attribute for radio grouping.
  The `selected` bindable reflects whether THIS option is the active one.
-->
<script lang="ts">
  let {
    selected = $bindable(false),
    label,
    name,
    value,
    disabled = false,
    onchange,
  }: {
    selected?: boolean;
    label: string;
    name: string;
    value: string;
    disabled?: boolean;
    onchange?: (value: string) => void;
  } = $props();

  function handleChange() {
    if (!disabled) {
      selected = true;
      onchange?.(value);
    }
  }
</script>

<label class="retro-radio" class:disabled>
  <input
    type="radio"
    {name}
    {value}
    checked={selected}
    {disabled}
    onchange={handleChange}
  />
  <span class="retro-radio-label">{label}</span>
</label>

<style>
  .retro-radio {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
    cursor: default;
    user-select: none;
  }

  .retro-radio.disabled {
    color: var(--retro-disabled-text, #808080);
  }

  .retro-radio-label {
    line-height: 1;
  }

  input[type="radio"]:focus-visible {
    outline: 1px dotted var(--retro-black, #000);
    outline-offset: 1px;
  }
</style>

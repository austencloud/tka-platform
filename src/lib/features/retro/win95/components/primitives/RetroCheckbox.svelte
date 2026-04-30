<!--
  RetroCheckbox - 98.css-styled checkbox with label

  Checked state is bindable. 98.css handles the visual styling
  of the checkbox indicator via the standard input[type="checkbox"].
-->
<script lang="ts">
  let {
    checked = $bindable(false),
    label,
    disabled = false,
  }: {
    checked?: boolean;
    label: string;
    disabled?: boolean;
  } = $props();
</script>

<label class="retro-checkbox" class:disabled>
  <input
    type="checkbox"
    bind:checked
    {disabled}
  />
  <span class="retro-checkbox-label">{label}</span>
</label>

<style>
  .retro-checkbox {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-black, #000);
    cursor: default;
    user-select: none;
  }

  .retro-checkbox.disabled {
    color: var(--retro-disabled-text, #808080);
  }

  .retro-checkbox-label {
    line-height: 1;
  }

  input[type="checkbox"]:focus-visible {
    outline: 1px dotted var(--retro-black, #000);
    outline-offset: 1px;
  }
</style>

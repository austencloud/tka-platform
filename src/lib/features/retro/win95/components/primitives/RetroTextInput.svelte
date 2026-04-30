<!--
  RetroTextInput - Sunken 3D text field using 98.css styling

  Renders as <input> or <textarea> depending on the multiline prop.
  Value is bindable for two-way data flow.
-->
<script lang="ts">
  let {
    id,
    value = $bindable(""),
    placeholder = "",
    disabled = false,
    multiline = false,
    maxLength,
    onchange,
  }: {
    id?: string;
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    multiline?: boolean;
    maxLength?: number;
    onchange?: (value: string) => void;
  } = $props();

  function handleInput(
    event: Event & { currentTarget: HTMLInputElement | HTMLTextAreaElement },
  ) {
    value = event.currentTarget.value;
    onchange?.(value);
  }
</script>

{#if multiline}
  <textarea
    class="retro-textarea"
    {id}
    {placeholder}
    {disabled}
    maxlength={maxLength}
    oninput={handleInput}
    {value}
  ></textarea>
{:else}
  <input
    type="text"
    class="retro-input"
    {id}
    {placeholder}
    {disabled}
    maxlength={maxLength}
    oninput={handleInput}
    {value}
  />
{/if}

<style>
  .retro-input,
  .retro-textarea {
    font-family: var(--retro-font-family, "Microsoft Sans Serif", Arial, sans-serif);
    font-size: var(--retro-font-size, 11px);
    color: var(--retro-field-text, #000);
    background: var(--retro-field-bg, #fff);
    width: 100%;
    box-sizing: border-box;
    padding: var(--retro-padding-sm, 2px) var(--retro-padding-md, 4px);
  }

  .retro-textarea {
    resize: vertical;
    min-height: 60px;
  }

  .retro-input:disabled,
  .retro-textarea:disabled {
    color: var(--retro-disabled-text, #808080);
    background: var(--retro-button-face, #c0c0c0);
  }

  .retro-input:focus-visible,
  .retro-textarea:focus-visible {
    outline: none;
  }
</style>

<script lang="ts">
  /**
   * AdminFormField
   * Form input wrapper with label and validation
   */

  import type {
    AdminFormFieldType,
    SelectOption,
  } from "../types/admin-component-types";

  interface AdminFormFieldProps {
    label: string;
    type?: AdminFormFieldType;
    value: any;
    onChange: (value: any) => void;
    error?: string;
    helpText?: string;
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    options?: SelectOption[];
    class?: string;
  }

  let {
    label,
    type = "text",
    value = $bindable(),
    onChange,
    error,
    helpText,
    required = false,
    disabled = false,
    placeholder,
    options = [],
    class: className = "",
  }: AdminFormFieldProps = $props();

  // Generate unique IDs for accessibility - derived from label prop
  const baseId = $derived(
    `field-${label.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2, 7)}`
  );
  const fieldId = $derived(baseId);
  const errorId = $derived(`${baseId}-error`);
  const helpId = $derived(`${baseId}-help`);

  // Build aria-describedby value from available descriptions
  const describedBy = $derived.by(() => {
    const ids: string[] = [];
    if (error) ids.push(errorId);
    if (helpText) ids.push(helpId);
    return ids.length > 0 ? ids.join(" ") : undefined;
  });

  function handleChange(e: Event) {
    const target = e.target as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement;

    if (type === "toggle") {
      const checked = (target as HTMLInputElement).checked;
      value = checked;
      onChange(checked);
    } else if (type === "number") {
      const num = Number(target.value);
      value = num;
      onChange(num);
    } else {
      value = target.value;
      onChange(target.value);
    }
  }
</script>

<div class="admin-form-field {className}" class:has-error={error}>
  <label class="field-label" for={fieldId}>
    {label}
    {#if required}
      <span class="required">*</span>
    {/if}
  </label>

  {#if type === "text" || type === "number"}
    <input
      id={fieldId}
      class="field-input"
      {type}
      bind:value
      {placeholder}
      {required}
      {disabled}
      aria-required={required}
      aria-invalid={!!error}
      aria-describedby={describedBy}
      onchange={handleChange}
    />
  {:else if type === "textarea"}
    <textarea
      id={fieldId}
      class="field-textarea"
      bind:value
      {placeholder}
      {required}
      {disabled}
      aria-required={required}
      aria-invalid={!!error}
      aria-describedby={describedBy}
      onchange={handleChange}
      rows="3"
    ></textarea>
  {:else if type === "select"}
    <select
      id={fieldId}
      class="field-select"
      bind:value
      {disabled}
      onchange={handleChange}
    >
      {#each options as option}
        <option value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      {/each}
    </select>
  {:else if type === "toggle"}
    <label class="field-toggle">
      <input
        type="checkbox"
        aria-label={label}
        checked={value}
        {disabled}
        onchange={handleChange}
      />
      <span class="toggle-slider" aria-hidden="true"></span>
    </label>
  {/if}

  {#if helpText}
    <span id={helpId} class="field-help">{helpText}</span>
  {/if}

  {#if error}
    <span id={errorId} class="field-error" role="alert" aria-live="assertive"
      >{error}</span
    >
  {/if}
</div>

<style>
  .admin-form-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field-label {
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--theme-text);
  }

  .required {
    color: var(--semantic-error);
  }

  .field-input,
  .field-textarea,
  .field-select {
    padding: 10px 12px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 6px;
    color: var(--theme-text, white);
    font-size: var(--font-size-sm);
    transition: all var(--duration-normal) ease;
  }

  .field-input:focus,
  .field-textarea:focus,
  .field-select:focus {
    outline: none;
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    background: var(--theme-card-hover-bg, var(--theme-card-bg));
  }

  .field-textarea {
    resize: vertical;
    min-height: 60px;
    font-family: inherit;
  }

  .field-select {
    cursor: pointer;
  }

  /* Toggle */
  .field-toggle {
    position: relative;
    display: inline-block;
    width: var(--min-touch-target);
    height: 24px;
    cursor: pointer;
  }

  .field-toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--theme-card-bg);
    transition: var(--duration-emphasis);
    border-radius: 24px;
  }

  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: var(--duration-emphasis);
    border-radius: 50%;
  }

  input:checked + .toggle-slider {
    background-color: var(--semantic-success);
  }

  input:checked + .toggle-slider:before {
    transform: translateX(24px);
  }

  /* Help and error text */
  .field-help {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .field-error {
    font-size: var(--font-size-compact);
    color: #fca5a5;
  }

  .has-error .field-input,
  .has-error .field-textarea,
  .has-error .field-select {
    border-color: var(--semantic-error);
  }

  /* Disabled state */
  .field-input:disabled,
  .field-textarea:disabled,
  .field-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

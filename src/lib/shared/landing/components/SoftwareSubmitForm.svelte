<!--
  SoftwareSubmitForm — public "add your tool to the list" capture into
  software_submissions, modeled on the store's WaitlistForm (same reserved-slot
  layout so form -> confirmation never shifts the page; no-layout-shift rule).
-->
<script lang="ts">
  import { submitSoftware } from "../services/software-submissions";

  interface Props {
    /** Tags which surface captured the submission. */
    source?: string;
  }
  let { source = "roots-software" }: Props = $props();

  let name = $state("");
  let url = $state("");
  let notes = $state("");
  let status = $state<"idle" | "submitting" | "done" | "error">("idle");
  let errorMessage = $state("");

  const canSubmit = $derived(name.trim().length > 1 && status !== "submitting");

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (name.trim().length < 2) {
      status = "error";
      errorMessage = "Give the tool a name.";
      return;
    }
    status = "submitting";
    errorMessage = "";
    try {
      await submitSoftware(name, url, notes, source);
      status = "done";
    } catch (err) {
      console.error("[SoftwareSubmitForm] submission write failed:", err);
      status = "error";
      errorMessage = "Couldn't save that just now. Try again in a moment.";
    }
  }
</script>

<div class="submit-slot">
  {#if status === "done"}
    <div class="confirmed" role="status">
      <i class="fas fa-circle-check" aria-hidden="true"></i>
      <span>Got it. Every submission gets reviewed, and additions are credited.</span>
    </div>
  {:else}
    <form class="submit-form" onsubmit={handleSubmit}>
      <label class="field">
        <span class="field-label">Tool name</span>
        <input
          class="text-input"
          type="text"
          bind:value={name}
          maxlength="120"
          placeholder="What is it called?"
          aria-invalid={status === "error" && name.trim().length < 2}
        />
      </label>
      <label class="field">
        <span class="field-label">Link (optional)</span>
        <input
          class="text-input"
          type="url"
          inputmode="url"
          autocapitalize="off"
          spellcheck="false"
          bind:value={url}
          maxlength="500"
          placeholder="https://"
        />
      </label>
      <label class="field">
        <span class="field-label">Anything we should know (optional)</span>
        <textarea
          class="text-input"
          rows="3"
          bind:value={notes}
          maxlength="2000"
          placeholder="Who built it, what it does, where it lives now"
        ></textarea>
      </label>
      <button class="submit-btn" type="submit" disabled={!canSubmit}>
        {#if status === "submitting"}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        {:else}
          <i class="fas fa-paper-plane" aria-hidden="true"></i>
        {/if}
        <span>Submit it</span>
      </button>
      <p class="error-line" class:visible={status === "error"} aria-live="polite">
        {errorMessage}
      </p>
    </form>
  {/if}
</div>

<style>
  .submit-slot {
    /* Reserves the form's height; the confirmation renders in the same box. */
    min-height: 400px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    margin-top: 1.2rem;
  }

  .submit-form {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    max-width: 30rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .field-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: oklch(0.72 0.02 270);
  }

  .text-input {
    width: 100%;
    padding: 12px 16px;
    min-height: var(--min-touch-target, 44px);
    background: rgba(255, 255, 255, 0.06);
    border: 2px solid rgba(255, 255, 255, 0.14);
    border-radius: 12px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 0.95rem);
    font-family: inherit;
    transition:
      border-color 0.2s ease,
      background 0.2s ease;
  }
  textarea.text-input {
    resize: vertical;
    min-height: 84px;
  }
  .text-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
  .text-input:focus {
    outline: none;
    border-color: #8b6cff;
    background: rgba(255, 255, 255, 0.09);
  }
  .text-input[aria-invalid="true"] {
    border-color: var(--semantic-error, #ef4444);
  }

  .submit-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    align-self: flex-start;
    padding: 0 22px;
    min-height: var(--min-touch-target, 44px);
    border: none;
    border-radius: 12px;
    background: linear-gradient(135deg, #6f8cff, #8b6cff);
    color: #fff;
    font-size: var(--font-size-sm, 0.95rem);
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition:
      filter 0.18s ease,
      transform 0.18s ease;
  }
  .submit-btn:hover:not(:disabled) {
    filter: brightness(1.08);
    transform: translateY(-1px);
  }
  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-line {
    margin: 0;
    min-height: 1.2em; /* reserved so the page never jumps */
    font-size: var(--font-size-sm, 0.85rem);
    color: var(--semantic-error, #ff8a8a);
    opacity: 0;
  }
  .error-line.visible {
    opacity: 1;
  }

  .confirmed {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 16px 22px;
    border-radius: 14px;
    background: rgba(52, 211, 153, 0.12);
    border: 1px solid rgba(52, 211, 153, 0.4);
    color: #a7f3d0;
    font-size: var(--font-size-sm, 0.95rem);
    font-weight: 600;
    align-self: flex-start;
  }
  .confirmed i {
    font-size: 1.2rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .text-input,
    .submit-btn {
      transition: none;
    }
  }
</style>

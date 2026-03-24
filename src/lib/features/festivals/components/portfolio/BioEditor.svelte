<script lang="ts">
  import { getFestivalContext } from "../../context/festival-context";
  import { auth } from "$lib/shared/auth/firebase";
  import type { BioVersion, TeachingPortfolio } from "../../domain/models/teaching-portfolio";

  const { state: festivalState } = getFestivalContext();

  // Which bio is in inline edit mode (by id)
  let editingId = $state<string | null>(null);
  let editingText = $state("");
  let editingLabel = $state("");
  // Confirm delete pending
  let deletingId = $state<string | null>(null);

  function startEdit(bio: BioVersion) {
    editingId = bio.id;
    editingText = bio.text;
    editingLabel = bio.label;
    deletingId = null;
  }

  function cancelEdit() {
    editingId = null;
    editingText = "";
    editingLabel = "";
  }

  function saveEdit(bio: BioVersion) {
    const uid = auth.currentUser?.uid;
    if (!uid || !festivalState.portfolio) return;
    const updated: TeachingPortfolio = {
      ...festivalState.portfolio,
      bios: festivalState.portfolio.bios.map((b) =>
        b.id === bio.id ? { ...b, text: editingText, label: editingLabel } : b
      ),
    };
    festivalState.savePortfolio(uid, updated);
    cancelEdit();
  }

  function deleteBio(bioId: string) {
    const uid = auth.currentUser?.uid;
    if (!uid || !festivalState.portfolio) return;
    const updated: TeachingPortfolio = {
      ...festivalState.portfolio,
      bios: festivalState.portfolio.bios.filter((b) => b.id !== bioId),
    };
    festivalState.savePortfolio(uid, updated);
    deletingId = null;
  }

  function addBio() {
    const uid = auth.currentUser?.uid;
    if (!uid || !festivalState.portfolio) return;
    const newBio: BioVersion = {
      id: crypto.randomUUID(),
      label: "New Bio",
      text: "",
    };
    const updated: TeachingPortfolio = {
      ...festivalState.portfolio,
      bios: [...festivalState.portfolio.bios, newBio],
    };
    festivalState.savePortfolio(uid, updated);
    startEdit(newBio);
  }

  function copyBio(bio: BioVersion) {
    navigator.clipboard.writeText(bio.text);
  }
</script>

<div class="bio-editor">
  {#if festivalState.portfolio && festivalState.portfolio.bios.length > 0}
    <ul class="bio-list" role="list">
      {#each festivalState.portfolio.bios as bio (bio.id)}
        <li class="bio-item">
          {#if editingId === bio.id}
            <div class="bio-edit-form">
              <input
                class="label-input"
                type="text"
                value={editingLabel}
                oninput={(e) => (editingLabel = (e.target as HTMLInputElement).value)}
                placeholder="Label (e.g. Teaching Bio)"
                aria-label="Bio label"
              />
              <textarea
                class="bio-textarea"
                value={editingText}
                oninput={(e) => (editingText = (e.target as HTMLTextAreaElement).value)}
                placeholder="Bio text..."
                rows={6}
                aria-label="Bio text"
              ></textarea>
              <div class="char-count">{editingText.length} characters</div>
              <div class="edit-actions">
                <button class="save-btn" onclick={() => saveEdit(bio)}>Save</button>
                <button class="cancel-btn" onclick={cancelEdit}>Cancel</button>
              </div>
            </div>
          {:else}
            <div class="bio-view">
              <div class="bio-meta">
                <span class="bio-label">{bio.label}</span>
                <span class="bio-char-count">{bio.text.length} chars</span>
              </div>
              <p class="bio-text">{bio.text}</p>
              <div class="bio-actions">
                <button class="action-btn" onclick={() => copyBio(bio)} title="Copy bio text">
                  <i class="fas fa-copy" aria-hidden="true"></i>
                  Copy
                </button>
                <button class="action-btn" onclick={() => startEdit(bio)} title="Edit bio">
                  <i class="fas fa-pencil-alt" aria-hidden="true"></i>
                  Edit
                </button>
                {#if deletingId === bio.id}
                  <span class="confirm-delete-label">Delete?</span>
                  <button class="action-btn danger" onclick={() => deleteBio(bio.id)}>Yes</button>
                  <button class="action-btn" onclick={() => (deletingId = null)}>No</button>
                {:else}
                  <button
                    class="action-btn danger"
                    onclick={() => (deletingId = bio.id)}
                    title="Delete bio"
                  >
                    <i class="fas fa-trash" aria-hidden="true"></i>
                    Delete
                  </button>
                {/if}
              </div>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="no-bios">No bios yet. Add one below.</p>
  {/if}

  <button class="add-btn" onclick={addBio}>
    <i class="fas fa-plus" aria-hidden="true"></i>
    Add Bio
  </button>
</div>

<style>
  .bio-editor {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .bio-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .bio-item {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    padding: 14px;
  }

  .bio-view {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .bio-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .bio-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .bio-char-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.5));
  }

  .bio-text {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    line-height: 1.6;
  }

  .bio-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .bio-edit-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .label-input {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 5px;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    padding: 6px 10px;
    width: 100%;
    box-sizing: border-box;
  }

  .label-input:focus {
    outline: none;
    border-color: var(--theme-accent, #6366f1);
  }

  .bio-textarea {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 5px;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    padding: 8px 10px;
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    line-height: 1.5;
    font-family: inherit;
  }

  .bio-textarea:focus {
    outline: none;
    border-color: var(--theme-accent, #6366f1);
  }

  .char-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.5));
    text-align: right;
  }

  .edit-actions {
    display: flex;
    gap: 8px;
  }

  .save-btn {
    padding: 6px 14px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: 5px;
    color: #fff;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
  }

  .save-btn:hover {
    opacity: 0.85;
  }

  .cancel-btn {
    padding: 6px 14px;
    background: none;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 5px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
  }

  .cancel-btn:hover {
    color: var(--theme-text, #ffffff);
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    background: none;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 5px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
  }

  .action-btn:hover {
    color: var(--theme-text, #ffffff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .action-btn.danger:hover {
    color: var(--semantic-error, #ef4444);
    border-color: var(--semantic-error, #ef4444);
  }

  .action-btn i {
    font-size: 11px;
  }

  .confirm-delete-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--semantic-error, #ef4444);
    align-self: center;
  }

  .no-bios {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.5));
    font-style: italic;
  }

  .add-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: none;
    border: 1px dashed var(--theme-stroke, rgba(255, 255, 255, 0.2));
    border-radius: 6px;
    color: var(--theme-accent, #6366f1);
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    align-self: flex-start;
    transition: border-color 0.15s;
  }

  .add-btn:hover {
    border-color: var(--theme-accent, #6366f1);
  }
</style>

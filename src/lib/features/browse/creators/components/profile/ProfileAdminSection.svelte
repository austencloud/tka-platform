<script lang="ts">
  /**
   * ProfileAdminSection - Admin controls for user profile
   *
   * Self-contained admin actions that call Firestore directly.
   * Only visible to admins viewing another user's profile.
   */

  import {
    doc,
    updateDoc,
    writeBatch,
    collection,
    getDocs,
    deleteDoc,
  } from "firebase/firestore";
  import { ref, remove } from "firebase/database";
  import { getFirestoreInstance, getDatabaseInstance } from "$lib/shared/auth/firebase";
  import type { UserRole } from "$lib/shared/auth/domain/models/UserRole";
  import {
    ROLE_DISPLAY,
    ROLE_HIERARCHY,
  } from "$lib/shared/auth/domain/models/UserRole";
  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import { generateAvatarUrl } from "$lib/shared/foundation/utils/avatar-generator";
  import { getContributorLoader } from "$lib/shared/feedback/getContributorLoader";
  import { onDestroy } from "svelte";

  interface Props {
    userProfile: EnhancedUserProfile;
    onUserUpdated?: (updates: Partial<EnhancedUserProfile>) => void;
    onUserDeleted?: () => void;
  }

  let { userProfile, onUserUpdated, onUserDeleted }: Props = $props();

  // State
  let isActionPending = $state(false);
  let actionError = $state<string | null>(null);
  let confirmAction = $state<{ type: string; message: string } | null>(null);
  let editNameModal = $state<{ open: boolean; value: string }>({ open: false, value: "" });
  let deleteConfirmText = $state("");

  // Admin label state (quick identifier like "Jake from Tuesday jam")
  let adminLabel = $state("");
  let labelSaveStatus = $state<"idle" | "saving" | "saved">("idle");

  // Admin notes state
  let adminNotes = $state("");
  let notesSaveStatus = $state<"idle" | "saving" | "saved">("idle");
  let notesDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let labelResetTimer: ReturnType<typeof setTimeout> | null = null;
  let notesResetTimer: ReturnType<typeof setTimeout> | null = null;

  onDestroy(() => {
    if (labelResetTimer) clearTimeout(labelResetTimer);
    if (notesResetTimer) clearTimeout(notesResetTimer);
    if (notesDebounceTimer) clearTimeout(notesDebounceTimer);
  });

  // Contributor state
  let isContributor = $state(false);
  let contributorDocId = $state<string | null>(null);
  let isTogglingContributor = $state(false);

  // Sync local state with prop changes
  $effect(() => {
    adminLabel = userProfile.adminLabel ?? "";
    adminNotes = userProfile.adminNotes ?? "";
    // Check contributor status when user changes
    void checkContributorStatus(userProfile.id);
  });

  async function checkContributorStatus(userId: string) {
    try {
      const loader = getContributorLoader();
      const all = await loader.getAll();
      const match = all.find((c) => c.userId === userId);
      isContributor = !!match;
      contributorDocId = match?.id ?? null;
    } catch {
      isContributor = false;
      contributorDocId = null;
    }
  }

  async function toggleContributor() {
    if (isTogglingContributor) return;
    isTogglingContributor = true;
    actionError = null;

    try {
      const loader = getContributorLoader();

      if (isContributor && contributorDocId) {
        await loader.delete(contributorDocId);
        isContributor = false;
        contributorDocId = null;
      } else {
        const newId = await loader.addByUserId(userProfile.id);
        isContributor = true;
        contributorDocId = newId;
      }
    } catch (err) {
      console.error("[ProfileAdminSection] Failed to toggle contributor:", err);
      actionError = "Failed to update contributor status";
    } finally {
      isTogglingContributor = false;
    }
  }

  async function changeRole(newRole: UserRole) {
    if (isActionPending || userProfile.role === newRole) return;

    isActionPending = true;
    actionError = null;

    try {
      const firestore = await getFirestoreInstance();
      const userRef = doc(firestore, "users", userProfile.id);
      await updateDoc(userRef, {
        role: newRole,
        isAdmin: newRole === "admin",
      });
      onUserUpdated?.({ role: newRole });
    } catch (err) {
      console.error("[ProfileAdminSection] Failed to change role:", err);
      actionError = "Failed to update role";
    } finally {
      isActionPending = false;
    }
  }

  async function toggleDisabled() {
    if (isActionPending) return;

    isActionPending = true;
    actionError = null;

    try {
      const firestore = await getFirestoreInstance();
      const currentlyDisabled = userProfile.isDisabled ?? false;
      const userRef = doc(firestore, "users", userProfile.id);
      await updateDoc(userRef, {
        isDisabled: !currentlyDisabled,
      });
      onUserUpdated?.({ isDisabled: !currentlyDisabled });
    } catch (err) {
      console.error("[ProfileAdminSection] Failed to toggle disabled:", err);
      actionError = "Failed to update account status";
    } finally {
      isActionPending = false;
      confirmAction = null;
    }
  }

  async function resetUserData() {
    if (isActionPending) return;

    isActionPending = true;
    actionError = null;

    try {
      const firestore = await getFirestoreInstance();
      const batch = writeBatch(firestore);

      // Reset user stats
      const userRef = doc(firestore, "users", userProfile.id);
      batch.update(userRef, {
        totalXP: 0,
        currentLevel: 1,
        achievementCount: 0,
        currentStreak: 0,
        longestStreak: 0,
      });

      // Delete XP document
      const xpRef = doc(firestore, `users/${userProfile.id}/xp/current`);
      batch.delete(xpRef);

      // Delete streak document
      const streakRef = doc(
        firestore,
        `users/${userProfile.id}/streak/current`
      );
      batch.delete(streakRef);

      await batch.commit();

      onUserUpdated?.({
        totalXP: 0,
        currentLevel: 1,
      });
    } catch (err) {
      console.error("[ProfileAdminSection] Failed to reset data:", err);
      actionError = "Failed to reset user data";
    } finally {
      isActionPending = false;
      confirmAction = null;
    }
  }

  /**
   * Delete user completely from Firestore.
   * Note: This deletes Firestore data only. The Firebase Auth user remains
   * (they'll get a fresh profile on next sign-in, good for testing).
   */
  async function deleteUser() {
    if (isActionPending) return;

    isActionPending = true;
    actionError = null;

    try {
      const firestore = await getFirestoreInstance();
      const userId = userProfile.id;

      // Delete subcollections first (Firestore doesn't cascade deletes)
      // These must match the actual subcollection names in firestore.rules
      const subcollections = [
        "xp",
        "streak",
        "achievements",
        "gallery", // User's library sequences
        "activityLog", // Activity logging
        "notifications",
        "settings",
        "tags",
        "xpEvents",
        "challengeProgress",
        "dismissedAnnouncements",
        "sessions",
        "onboarding",
        "drafts",
        "following",
        "followers",
        "weeklyProgress",
        "skillProgress",
        "trainProgress",
      ];

      for (const subcol of subcollections) {
        try {
          const subcolRef = collection(firestore, `users/${userId}/${subcol}`);
          const snapshot = await getDocs(subcolRef);
          const batch = writeBatch(firestore);
          let count = 0;

          for (const docSnap of snapshot.docs) {
            batch.delete(docSnap.ref);
            count++;
            // Firestore batch limit is 500
            if (count >= 500) {
              await batch.commit();
              count = 0;
            }
          }

          if (count > 0) {
            await batch.commit();
          }
        } catch {
          // Subcollection might not exist, that's fine
        }
      }

      // Delete the user document itself
      const userRef = doc(firestore, "users", userId);
      await deleteDoc(userRef);

      // Remove from Realtime Database presence (this is where active users come from)
      try {
        const database = await getDatabaseInstance();
        const presenceRef = ref(database, `presence/${userId}`);
        await remove(presenceRef);
      } catch (err) {
        console.warn(
          `[ProfileAdminSection] Could not remove RTDB presence:`,
          err
        );
      }

      onUserDeleted?.();
    } catch (err) {
      console.error("[ProfileAdminSection] Failed to delete user:", err);
      actionError = "Failed to delete user";
    } finally {
      isActionPending = false;
      confirmAction = null;
    }
  }

  function handleConfirm() {
    if (!confirmAction) return;

    switch (confirmAction.type) {
      case "disable":
        toggleDisabled();
        break;
      case "reset":
        resetUserData();
        break;
      case "delete":
        deleteUser();
        break;
    }
  }

  function openEditNameModal() {
    editNameModal = { open: true, value: userProfile.displayName || "" };
  }

  async function saveAdminLabel() {
    if (labelSaveStatus === "saving") return;

    labelSaveStatus = "saving";

    try {
      const firestore = await getFirestoreInstance();
      const userRef = doc(firestore, "users", userProfile.id);
      await updateDoc(userRef, { adminLabel: adminLabel.trim() || null });
      onUserUpdated?.({ adminLabel: adminLabel.trim() || undefined });
      labelSaveStatus = "saved";
      if (labelResetTimer) clearTimeout(labelResetTimer);
      labelResetTimer = setTimeout(() => {
        labelSaveStatus = "idle";
      }, 1500);
    } catch (err) {
      console.error("[ProfileAdminSection] Failed to save admin label:", err);
      actionError = "Failed to save label";
      labelSaveStatus = "idle";
    }
  }

  async function saveAdminNotes() {
    if (notesSaveStatus === "saving") return;

    notesSaveStatus = "saving";

    try {
      const firestore = await getFirestoreInstance();
      const userRef = doc(firestore, "users", userProfile.id);
      await updateDoc(userRef, { adminNotes: adminNotes.trim() || null });
      onUserUpdated?.({ adminNotes: adminNotes.trim() || undefined });
      notesSaveStatus = "saved";
      if (notesResetTimer) clearTimeout(notesResetTimer);
      notesResetTimer = setTimeout(() => {
        notesSaveStatus = "idle";
      }, 1500);
    } catch (err) {
      console.error("[ProfileAdminSection] Failed to save admin notes:", err);
      actionError = "Failed to save notes";
      notesSaveStatus = "idle";
    }
  }

  function handleNotesInput() {
    // Debounce auto-save
    if (notesDebounceTimer) {
      clearTimeout(notesDebounceTimer);
    }
    notesDebounceTimer = setTimeout(() => {
      saveAdminNotes();
    }, 1000);
  }

  async function saveDisplayName() {
    if (isActionPending) return;

    const newName = editNameModal.value.trim();
    if (!newName || newName === userProfile.displayName) {
      editNameModal = { open: false, value: "" };
      return;
    }

    isActionPending = true;
    actionError = null;

    try {
      const firestore = await getFirestoreInstance();
      const userRef = doc(firestore, "users", userProfile.id);

      // Generate new avatar with correct initials from the new name
      const newAvatar = generateAvatarUrl(newName, 200);

      await updateDoc(userRef, {
        displayName: newName,
        avatar: newAvatar,
        photoURL: newAvatar,
      });
      onUserUpdated?.({ displayName: newName, avatar: newAvatar });
      editNameModal = { open: false, value: "" };
    } catch (err) {
      console.error("[ProfileAdminSection] Failed to update display name:", err);
      actionError = "Failed to update display name";
    } finally {
      isActionPending = false;
    }
  }
</script>

<section class="admin-section">
  <h3 class="section-title">
    <i class="fas fa-shield-halved" aria-hidden="true"></i>
    Admin Controls
  </h3>

  <!-- Admin Label (prominent quick identifier) -->
  <div class="admin-label-row">
    <label class="admin-label-label" for="admin-label-input">
      <i class="fas fa-user-tag" aria-hidden="true"></i>
      Known As
    </label>
    <div class="admin-label-input-wrapper">
      <input
        id="admin-label-input"
        type="text"
        class="admin-label-input"
        bind:value={adminLabel}
        onblur={saveAdminLabel}
        onkeydown={(e) => e.key === "Enter" && saveAdminLabel()}
        placeholder="Real name or identifier..."
        maxlength="100"
      />
      {#if labelSaveStatus === "saving"}
        <span class="label-status saving">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        </span>
      {:else if labelSaveStatus === "saved"}
        <span class="label-status saved">
          <i class="fas fa-check" aria-hidden="true"></i>
        </span>
      {/if}
    </div>
  </div>

  {#if actionError}
    <div class="error-banner">
      <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
      {actionError}
      <button onclick={() => (actionError = null)} aria-label="Dismiss">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
  {/if}

  <!-- Role Management -->
  <div class="control-group" role="group" aria-labelledby="role-label">
    <span id="role-label" class="control-label">User Role</span>
    <div class="role-buttons">
      {#each ROLE_HIERARCHY as role}
        <button
          class="role-btn"
          class:active={userProfile.role === role}
          disabled={isActionPending}
          onclick={() => changeRole(role)}
          style="--role-color: {ROLE_DISPLAY[role].color}"
          aria-label="Set role to {ROLE_DISPLAY[role].label}"
        >
          <i class="fas {ROLE_DISPLAY[role].icon}" aria-hidden="true"></i>
          {ROLE_DISPLAY[role].label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Admin Notes -->
  <div class="control-group" role="group" aria-labelledby="notes-label">
    <span id="notes-label" class="control-label">
      Admin Notes
      {#if notesSaveStatus === "saving"}
        <span class="save-status saving">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Saving...
        </span>
      {:else if notesSaveStatus === "saved"}
        <span class="save-status saved">
          <i class="fas fa-check" aria-hidden="true"></i>
          Saved
        </span>
      {/if}
    </span>
    <textarea
      class="admin-notes-input"
      bind:value={adminNotes}
      oninput={handleNotesInput}
      onblur={saveAdminNotes}
      placeholder="Private notes about this user (real name, how you know them, etc.)"
      rows="3"
    ></textarea>
  </div>

  <!-- Account Actions -->
  <div class="control-group" role="group" aria-labelledby="actions-label">
    <span id="actions-label" class="control-label">Account Actions</span>
    <div class="action-buttons">
      <button
        class="action-btn"
        disabled={isActionPending}
        onclick={openEditNameModal}
        aria-label="Edit display name"
      >
        <i class="fas fa-pen" aria-hidden="true"></i>
        Edit Name
      </button>

      <button
        class="action-btn"
        class:contributor-active={isContributor}
        disabled={isTogglingContributor}
        onclick={toggleContributor}
        aria-label={isContributor ? "Remove contributor status" : "Add as contributor"}
      >
        {#if isTogglingContributor}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        {:else}
          <i class="fas {isContributor ? 'fa-star' : 'fa-user-plus'}" aria-hidden="true"></i>
        {/if}
        {isContributor ? "Release Contributor" : "Add as Contributor"}
      </button>

      <button
        class="action-btn"
        class:danger={!userProfile.isDisabled}
        class:success={userProfile.isDisabled}
        disabled={isActionPending}
        aria-label={userProfile.isDisabled ? "Enable account" : "Disable account"}
        onclick={() => {
          confirmAction = {
            type: "disable",
            message: userProfile.isDisabled
              ? `Enable ${userProfile.displayName}'s account?`
              : `Disable ${userProfile.displayName}'s account? They won't be able to log in.`,
          };
        }}
      >
        <i
          class="fas {userProfile.isDisabled ? 'fa-check-circle' : 'fa-ban'}"
          aria-hidden="true"
        ></i>
        {userProfile.isDisabled ? "Enable Account" : "Disable Account"}
      </button>

      <button
        class="action-btn danger"
        disabled={isActionPending}
        aria-label="Reset user progress"
        onclick={() => {
          confirmAction = {
            type: "reset",
            message: `Reset all progress for ${userProfile.displayName}? This will clear XP, level, achievements, and streaks.`,
          };
        }}
      >
        <i class="fas fa-rotate-left" aria-hidden="true"></i>
        Reset Progress
      </button>

      <button
        class="action-btn destructive"
        disabled={isActionPending}
        aria-label="Delete user account"
        onclick={() => {
          deleteConfirmText = "";
          confirmAction = {
            type: "delete",
            message: `DELETE ${userProfile.displayName}'s account?`,
          };
        }}
      >
        <i class="fas fa-trash-alt" aria-hidden="true"></i>
        Delete User
      </button>
    </div>
  </div>
</section>

<!-- Confirmation Modal -->
{#if confirmAction}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={() => { confirmAction = null; deleteConfirmText = ""; }}
    onkeydown={(e) => e.key === "Escape" && (confirmAction = null, deleteConfirmText = "")}
  >
    <div
      class="modal"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <p class="modal-message">{confirmAction.message}</p>

      {#if confirmAction.type === "delete"}
        <div class="delete-warning">
          <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
          <span>This will permanently delete all of their data: sequences, XP, achievements, streaks, followers, and settings. This cannot be undone.</span>
        </div>
        <label class="delete-confirm-label" for="delete-confirm-input">
          Type <strong>{userProfile.displayName}</strong> to confirm:
        </label>
        <input
          id="delete-confirm-input"
          type="text"
          class="delete-confirm-input"
          bind:value={deleteConfirmText}
          placeholder={userProfile.displayName}
          autocomplete="off"
        />
      {/if}

      <div class="modal-actions">
        <button
          class="modal-btn cancel"
          onclick={() => { confirmAction = null; deleteConfirmText = ""; }}
          disabled={isActionPending}
          aria-label="Cancel action"
        >
          Cancel
        </button>
        <button
          class="modal-btn confirm"
          onclick={handleConfirm}
          disabled={isActionPending || (confirmAction.type === "delete" && deleteConfirmText !== userProfile.displayName)}
          aria-label="Confirm action"
        >
          {#if isActionPending}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          {:else if confirmAction.type === "delete"}
            Delete Forever
          {:else}
            Confirm
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Name Modal -->
{#if editNameModal.open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={() => (editNameModal = { open: false, value: "" })}
    onkeydown={(e) => e.key === "Escape" && (editNameModal = { open: false, value: "" })}
  >
    <div
      class="modal"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-name-title"
      tabindex="-1"
    >
      <h4 id="edit-name-title" class="modal-title">Edit Display Name</h4>
      <input
        type="text"
        class="name-input"
        bind:value={editNameModal.value}
        placeholder="Display name"
        maxlength="50"
        onkeydown={(e) => e.key === "Enter" && saveDisplayName()}
      />
      <div class="modal-actions">
        <button
          class="modal-btn cancel"
          onclick={() => (editNameModal = { open: false, value: "" })}
          disabled={isActionPending}
          aria-label="Cancel name edit"
        >
          Cancel
        </button>
        <button
          class="modal-btn save"
          onclick={saveDisplayName}
          disabled={isActionPending || !editNameModal.value.trim()}
          aria-label="Save display name"
        >
          {#if isActionPending}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          {:else}
            Save
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .admin-section {
    margin-top: 24px;
    padding: 20px;
    background: color-mix(in srgb, var(--semantic-error) 5%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-error) 20%, transparent);
    border-radius: 12px;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 16px 0;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--semantic-error);
  }

  .admin-label-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid color-mix(in srgb, var(--semantic-error) 15%, transparent);
  }

  .admin-label-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--theme-text-dim);
    white-space: nowrap;
  }

  .admin-label-input-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .admin-label-input {
    width: 100%;
    padding: 10px 14px;
    padding-right: 36px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text);
    font-size: var(--font-size-sm);
    font-weight: 500;
    outline: none;
    transition: border-color var(--duration-normal) ease;
  }

  .admin-label-input:focus {
    border-color: var(--theme-accent);
  }

  .admin-label-input::placeholder {
    color: var(--theme-text-dim);
    font-weight: 400;
  }

  .label-status {
    position: absolute;
    right: 12px;
    display: flex;
    align-items: center;
    font-size: var(--font-size-compact);
  }

  .label-status.saving {
    color: var(--theme-text-dim);
  }

  .label-status.saved {
    color: var(--semantic-success);
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    margin-bottom: 16px;
    background: color-mix(in srgb, var(--semantic-error) 15%, transparent);
    border-radius: 8px;
    color: var(--semantic-error);
    font-size: var(--font-size-compact);
  }

  .error-banner button {
    margin-left: auto;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 12px;
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .control-group {
    margin-bottom: 16px;
  }

  .control-group:last-child {
    margin-bottom: 0;
  }

  .control-label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .save-status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-xs);
    text-transform: none;
    letter-spacing: normal;
  }

  .save-status.saving {
    color: var(--theme-text-dim);
  }

  .save-status.saved {
    color: var(--semantic-success);
  }

  .admin-notes-input {
    width: 100%;
    padding: 12px 14px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text);
    font-size: var(--font-size-sm);
    font-family: inherit;
    line-height: 1.5;
    resize: vertical;
    min-height: 80px;
    outline: none;
    transition: border-color var(--duration-normal) ease;
  }

  .admin-notes-input:focus {
    border-color: var(--theme-accent);
  }

  .admin-notes-input::placeholder {
    color: var(--theme-text-dim);
  }

  .role-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .role-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .role-btn:hover:not(:disabled) {
    background: var(--surface-color, rgba(255, 255, 255, 0.08));
    border-color: var(--role-color, rgba(255, 255, 255, 0.2));
  }

  .role-btn.active {
    background: color-mix(in srgb, var(--role-color) 20%, transparent);
    border-color: var(--role-color);
    color: var(--role-color);
  }

  .role-btn:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .action-btn:hover:not(:disabled) {
    background: var(--surface-color, rgba(255, 255, 255, 0.08));
  }

  .action-btn.danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--semantic-error) 10%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error) 30%, transparent);
    color: var(--semantic-error);
  }

  .action-btn.success:hover:not(:disabled) {
    background: color-mix(in srgb, var(--semantic-success) 10%, transparent);
    border-color: color-mix(in srgb, var(--semantic-success) 30%, transparent);
    color: var(--semantic-success);
  }

  .action-btn.contributor-active {
    background: color-mix(in srgb, var(--semantic-warning, #f59e0b) 15%, transparent);
    border-color: color-mix(in srgb, var(--semantic-warning, #f59e0b) 35%, transparent);
    color: var(--semantic-warning, #f59e0b);
  }

  .action-btn.contributor-active:hover:not(:disabled) {
    background: color-mix(in srgb, var(--semantic-warning, #f59e0b) 25%, transparent);
    border-color: color-mix(in srgb, var(--semantic-warning, #f59e0b) 50%, transparent);
  }

  /* Destructive action - more severe than danger */
  .action-btn.destructive {
    background: color-mix(in srgb, var(--semantic-error) 15%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error) 40%, transparent);
    color: var(--semantic-error);
  }

  .action-btn.destructive:hover:not(:disabled) {
    background: color-mix(in srgb, var(--semantic-error) 25%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error) 60%, transparent);
    color: var(--semantic-error);
  }

  .action-btn:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: var(--theme-backdrop, rgba(0, 0, 0, 0.7));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal);
    padding: 20px;
  }

  .modal {
    background: var(--theme-panel-bg, #1a1a2e);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    width: 100%;
  }

  .modal-message {
    margin: 0 0 20px 0;
    font-size: var(--font-size-sm);
    line-height: 1.5;
    color: var(--theme-text);
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .modal-btn {
    padding: 10px 18px;
    border-radius: 8px;
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .modal-btn.cancel {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    color: var(--theme-text-dim);
  }

  .modal-btn.cancel:hover {
    background: var(--surface-hover, rgba(255, 255, 255, 0.1));
  }

  .modal-btn.confirm {
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-error) 40%, transparent);
    color: var(--semantic-error);
  }

  .modal-btn.confirm:hover:not(:disabled) {
    background: color-mix(in srgb, var(--semantic-error) 30%, transparent);
  }

  .delete-warning {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    margin-bottom: 16px;
    background: color-mix(in srgb, var(--semantic-error) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-error) 25%, transparent);
    border-radius: 8px;
    color: var(--semantic-error);
    font-size: var(--font-size-compact);
    line-height: 1.5;
  }

  .delete-warning i {
    margin-top: 2px;
    flex-shrink: 0;
  }

  .delete-confirm-label {
    display: block;
    margin-bottom: 8px;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
  }

  .delete-confirm-input {
    width: 100%;
    padding: 10px 14px;
    margin-bottom: 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text);
    font-size: var(--font-size-sm);
    outline: none;
    transition: border-color var(--duration-normal) ease;
  }

  .delete-confirm-input:focus {
    border-color: var(--semantic-error);
  }

  .modal-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .modal-title {
    margin: 0 0 16px 0;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text);
  }

  .name-input {
    width: 100%;
    padding: 12px 14px;
    margin-bottom: 20px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text);
    font-size: var(--font-size-sm);
    outline: none;
    transition: border-color var(--duration-normal) ease;
  }

  .name-input:focus {
    border-color: var(--theme-accent);
  }

  .name-input::placeholder {
    color: var(--theme-text-dim);
  }

  .modal-btn.save {
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent) 40%, transparent);
    color: var(--theme-accent);
  }

  .modal-btn.save:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }
</style>

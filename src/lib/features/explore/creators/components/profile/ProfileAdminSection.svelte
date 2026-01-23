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
        "sequences", // User's library sequences
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
      await updateDoc(userRef, { displayName: newName });
      onUserUpdated?.({ displayName: newName });
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
        >
          <i class="fas {ROLE_DISPLAY[role].icon}" aria-hidden="true"></i>
          {ROLE_DISPLAY[role].label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Account Actions -->
  <div class="control-group" role="group" aria-labelledby="actions-label">
    <span id="actions-label" class="control-label">Account Actions</span>
    <div class="action-buttons">
      <button
        class="action-btn"
        disabled={isActionPending}
        onclick={openEditNameModal}
      >
        <i class="fas fa-pen" aria-hidden="true"></i>
        Edit Name
      </button>

      <button
        class="action-btn"
        class:danger={!userProfile.isDisabled}
        class:success={userProfile.isDisabled}
        disabled={isActionPending}
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
        onclick={() => {
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
    onclick={() => (confirmAction = null)}
    onkeydown={(e) => e.key === "Escape" && (confirmAction = null)}
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
      <div class="modal-actions">
        <button
          class="modal-btn cancel"
          onclick={() => (confirmAction = null)}
          disabled={isActionPending}
        >
          Cancel
        </button>
        <button
          class="modal-btn confirm"
          onclick={handleConfirm}
          disabled={isActionPending}
        >
          {#if isActionPending}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
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
        >
          Cancel
        </button>
        <button
          class="modal-btn save"
          onclick={saveDisplayName}
          disabled={isActionPending || !editNameModal.value.trim()}
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
    min-width: 48px;
    min-height: 48px;
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
    display: block;
    margin-bottom: 8px;
    font-size: var(--font-size-compact);
    font-weight: 500;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
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
    background: rgba(255, 255, 255, 0.08);
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
    background: rgba(255, 255, 255, 0.08);
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
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .modal {
    background: #1a1a2e;
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
    background: rgba(255, 255, 255, 0.1);
  }

  .modal-btn.confirm {
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-error) 40%, transparent);
    color: var(--semantic-error);
  }

  .modal-btn.confirm:hover {
    background: color-mix(in srgb, var(--semantic-error) 30%, transparent);
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

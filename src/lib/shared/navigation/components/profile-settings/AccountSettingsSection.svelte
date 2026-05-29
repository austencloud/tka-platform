<!--
  AccountSettingsSection Component

  Orchestrator for account settings: display name, username, and password.
  Each editor is a separate component with its own state and styles.
-->
<script lang="ts">
  import type { HapticFeedback } from "../../../application/services/haptic-feedback";
  import type { User } from "firebase/auth";
  import DisplayNameEditor from "./DisplayNameEditor.svelte";
  import UsernameEditor from "./UsernameEditor.svelte";
  import InstagramUsernameEditor from "./InstagramUsernameEditor.svelte";
  import PronounsEditor from "./PronounsEditor.svelte";
  import PasswordChangeForm from "./PasswordChangeForm.svelte";

  interface Props {
    user: User;
    hasPasswordProvider: boolean;
    onChangePassword: () => Promise<void>;
    hapticService: HapticFeedback | null;
    onPronounsChanged?: (pronouns: string) => void;
  }

  let { user, hasPasswordProvider, onChangePassword, hapticService, onPronounsChanged }: Props =
    $props();
</script>

<div class="account-settings">
  <DisplayNameEditor {user} {hapticService} />

  <div class="divider"></div>

  <UsernameEditor {user} {hapticService} />

  <div class="divider"></div>

  <InstagramUsernameEditor {user} {hapticService} />

  <div class="divider"></div>

  <PronounsEditor {user} {hapticService} {onPronounsChanged} />

  {#if hasPasswordProvider}
    <div class="divider"></div>
    <PasswordChangeForm {onChangePassword} {hapticService} />
  {/if}
</div>

<style>
  .account-settings {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .divider {
    height: 1px;
    background: var(--theme-stroke);
    margin: 16px 0;
  }
</style>

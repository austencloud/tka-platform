<!--
  AccountSettingsSection Component

  Orchestrator for account settings: display name, username, and password.
  Each editor is a separate component with its own state and styles.
-->
<script lang="ts">
  import type { IHapticFeedback } from "../../../application/services/contracts/IHapticFeedback";
  import type { User } from "firebase/auth";
  import DisplayNameEditor from "./DisplayNameEditor.svelte";
  import UsernameEditor from "./UsernameEditor.svelte";
  import PasswordChangeForm from "./PasswordChangeForm.svelte";

  interface Props {
    user: User;
    hasPasswordProvider: boolean;
    onChangePassword: () => Promise<void>;
    hapticService: IHapticFeedback | null;
  }

  let { user, hasPasswordProvider, onChangePassword, hapticService }: Props =
    $props();
</script>

<div class="account-settings">
  <DisplayNameEditor {user} {hapticService} />

  <div class="divider"></div>

  <UsernameEditor {user} {hapticService} />

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

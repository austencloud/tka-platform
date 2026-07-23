<script lang="ts">
  /**
   * Post-Save Activation Host
   *
   * SP3 Part B (first-session activation) — the root-mounted surface for the
   * "keep on first save" nudge. `postSaveActivation` (module singleton, see
   * `../state/post-save-activation-state.svelte.ts`) queues an eligible prompt
   * after a guest's first durable save; this host renders it and is the ONLY
   * place that calls `markPresented()`, which is what actually consumes the
   * guest's one-shot guard. That two-phase split means a blocked or failed
   * mount never burns the guard — see the design doc's "Two-phase guard".
   *
   * Reuse: mirrors the BaseModal + AuthNudge wiring already used for the
   * beat-cap nudge (`CreateModule.svelte`, chromeless fit-sized modal wrapping
   * a presentational AuthNudge) and the self-driven root-modal pattern
   * `<SupportModal />` uses in `MainApplication.svelte`. No new modal
   * primitive, no new nudge card — same two pieces, new trigger.
   */
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import AuthNudge from "$lib/shared/auth/components/AuthNudge.svelte";
  import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";
  import { postSaveActivation } from "../state/post-save-activation-state.svelte";

  const visible = $derived(postSaveActivation.visible);

  // Fires once the nudge has actually mounted into the DOM for this visible
  // state — not before. Guards against consuming the guest's one-shot guard
  // for a prompt that was queued but never actually shown (e.g. the host
  // itself unmounts before paint).
  $effect(() => {
    if (visible) {
      postSaveActivation.markPresented();
    }
  });

  function acceptAndOpenSignup() {
    postSaveActivation.dismissPrompt();
    authDrawerState.show("signup", "guest-first-save");
  }

  function loginInstead() {
    postSaveActivation.dismissPrompt();
    authDrawerState.show("signin", "guest-first-save");
  }
</script>

<!-- Post-save activation nudge - fires once after a guest's first save
     persists. Backdrop click / Escape dismiss via BaseModal; the card itself
     never propagates to the backdrop. -->
<BaseModal
  open={visible}
  size="fit"
  class="chromeless"
  onclose={() => postSaveActivation.dismissPrompt()}
>
  <AuthNudge
    trigger="guest-first-save"
    onCreateAccount={acceptAndOpenSignup}
    onLogin={loginInstead}
    onDismiss={() => postSaveActivation.dismissPrompt()}
  />
</BaseModal>

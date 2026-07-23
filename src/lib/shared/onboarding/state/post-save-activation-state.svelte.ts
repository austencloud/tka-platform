/**
 * Post-Save Activation State (SP3, Part B)
 *
 * Module singleton — same pattern as authDrawerState / firstRunState, not a
 * factory/context. There's exactly one of these per app instance and every
 * consumer (host that renders AuthNudge, signout cascade) reaches it the
 * same way those do.
 *
 * Two-phase by design:
 *
 *   1. onGuestSaveSucceeded(sequenceId) — called right after a guest save
 *      persists. Checks eligibility (flag on, still a guest, hasn't seen the
 *      prompt) and, if eligible, QUEUES it (`pending = true`). It does NOT
 *      consume the once-only guard and does NOT emit the "_shown" analytics
 *      event yet - at this point nothing has been shown to the user.
 *
 *   2. markPresented() — called by the host once AuthNudge has actually
 *      mounted on screen. THIS is what consumes the guard (guestFirstSaveGuard.
 *      markSeen) and fires the "_shown" event, exactly once. Splitting queue
 *      from presented means a save that triggers a prompt which never
 *      actually renders (host unmounts, navigation races it away) doesn't
 *      burn the user's one-shot guard - they'll be eligible again next save.
 *
 * Gate gets its answers from single sources of truth: authState for
 * guest/full-account status, the PostHog capability flag for the rollout
 * switch, and guestFirstSaveGuard for the once-only guard.
 */

import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";
import { postHogFeatureFlagService } from "$lib/shared/auth/services/post-hog-feature-flag-service.svelte";
import { captureEvent } from "$lib/shared/analytics/services/posthog";
import { hasSeen, markSeen } from "$lib/shared/onboarding/state/guest-first-save-guard";

// The single SP3-wide rollout flag (Part A + Part B), defaulted off. Registered
// in onboarding-feature-flags.ts → DEFAULT_FEATURE_FLAGS, read via canAccess().
const ACTIVATION_FLAG = "capability:onboarding:first-session-activation" as const;

function logPrompt(
  name: "onboarding_guest_first_save_prompt_shown"
    | "onboarding_guest_first_save_prompt_accepted"
    | "onboarding_guest_first_save_prompt_login"
    | "onboarding_guest_first_save_prompt_declined",
  sequenceId: string | null
): void {
  captureEvent(name, { sequenceId });
}

let _pending = $state(false);
let _sequenceId = $state<string | null>(null);
// Latch so markPresented() fires exactly once per queued prompt. The host calls
// it from a reactive $effect whose tracked deps include authState.effectiveUserId
// (read below), so a silent uid-swap / token refresh while the nudge is open
// re-runs the effect — without this latch that would double-emit _shown and
// re-mark the guard on the new uid.
let _presented = $state(false);

export const postSaveActivation = {
  /** Whether an eligible prompt is queued and ready for the host to render. */
  get visible() {
    return _pending && _sequenceId !== null;
  },

  /** The sequence id the queued prompt was triggered by, for copy/logging. */
  get sequenceId() {
    return _sequenceId;
  },

  /**
   * Phase 1 — call right after a guest save succeeds. Queues an eligible
   * prompt without consuming the guard or emitting analytics.
   */
  onGuestSaveSucceeded(sequenceId: string) {
    // Already queued (or mid-flow) - don't re-evaluate on top of it.
    if (_pending) return;

    // Not a guest (or the account resolved to full access some other way) -
    // nothing to activate.
    if (authState.isFullAccount) return;

    const uid = authState.effectiveUserId;
    if (!uid) return;

    // Rollout switch, defaulted off.
    if (!postHogFeatureFlagService.canAccess(ACTIVATION_FLAG)) return;

    // Once-only per guest uid.
    if (hasSeen(uid)) return;

    _sequenceId = sequenceId;
    _presented = false;
    _pending = true;
  },

  /**
   * Phase 2 — call once the host has actually mounted AuthNudge for this
   * queued prompt. Consumes the guard and fires the shown event. Idempotent:
   * only the first call per queued prompt does anything (the _presented latch),
   * so a reactive re-run of the host effect can't double-emit.
   */
  markPresented() {
    if (!_pending || _presented) return;
    _presented = true;

    const uid = authState.effectiveUserId;
    if (uid) markSeen(uid);

    logPrompt("onboarding_guest_first_save_prompt_shown", _sequenceId);
  },

  /** User chose "Create account". */
  accept() {
    logPrompt("onboarding_guest_first_save_prompt_accepted", _sequenceId);
    authDrawerState.show("signup", "guest-first-save");
    this.hide();
  },

  /** User chose "Log in" (already has an account). */
  login() {
    logPrompt("onboarding_guest_first_save_prompt_login", _sequenceId);
    authDrawerState.show("signin");
    this.hide();
  },

  /** User dismissed the prompt without acting. */
  dismissPrompt() {
    logPrompt("onboarding_guest_first_save_prompt_declined", _sequenceId);
    this.hide();
  },

  /** Internal: clear the queued/visible state without logging anything. */
  hide() {
    _pending = false;
    _sequenceId = null;
    _presented = false;
  },

  /** Full reset — called on signout so a new session starts clean. */
  reset() {
    _pending = false;
    _sequenceId = null;
    _presented = false;
  },
};

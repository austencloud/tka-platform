# Account Settings Redesign Implementation

**Spec:** `docs/superpowers/specs/active/2026-08-06-account-settings-redesign.md`

**Status:** Implemented and verified

## Second Visual Pass

1. Replace the separate identity and section cards with one workspace whose
   source order is identity, Personal details, then access/security.
2. Recompose the workspace into three connected columns above the large
   container seam, two columns for wide-short layouts, and one column on narrow
   screens.
3. Keep identity bounded and vertically composed instead of stretching it into
   a full-width banner.
4. Keep provider rows static by default. Add a stable-width Manage/Done control
   and reserve the row action slot so entering management mode does not resize
   the surrounding composition.
5. Increase content-surface opacity and vertically center the completed default
   state when the viewport has spare height.
6. Re-run the focused provider/account tests, repository check, runtime
   interaction checks, exact DOM measurements, and the required seven-viewport
   screenshot sweep before replacing the evidence below.

## Completion Evidence

- Repository-wide `npm run check`: 0 errors and 0 warnings.
- Focused account, setup, provider, and local-data tests: 13 passed.
- Lighthouse snapshot on the authenticated Account page: Accessibility 100,
  Best Practices 100, and SEO 100.
- The authenticated page produced no console warnings or errors after cold-load,
  management-mode, and inline-edit interaction checks.
- A cold reload populated the identity summary after delayed authentication,
  proving the account-detail loader no longer depends on authentication being
  ready when ProfileTab mounts.
- Management mode revealed explicit Disconnect actions without layout shift:
  the 2328.5 x 892.8 workspace, 755 x 371.7 sign-in section, and three
  703 x 81.8 provider rows retained their exact dimensions. Provider actions
  measured 130.6 x 46.5 CSS pixels.
- Display-name editing showed a distinct bordered input, focused it on entry,
  and restored focus to Edit when Escape canceled the edit.
- Visual verification completed at 1920 x 1080, 2560 x 1440, 3840 x 2160,
  1440 x 900, 820 x 1180, 960 x 412, and 375 x 667. Desktop default states fit
  without vertical scrolling; every tested viewport avoided horizontal
  overflow.
- At 3840 x 2160, the workspace measured 3566.9 x 1248 with three scaled
  columns, 24px local base type, a 144px avatar, and a 54px account name. The
  document and Settings scroll heights both measured exactly 2160.
- At 1280 x 800, the Account surface remained inside the Settings module with
  no horizontal clipping.

## 0. Reconcile the Shared Workspace

- Capture path-scoped diffs for every profile file before editing.
- Treat the current widened Profile work as rejected visual work in progress. Reconcile it against the spec instead of layering another layout over it.
- Preserve the unrelated live changes in `src/lib/features/settings/SettingsModule.svelte`. The Account redesign does not need that file because the internal tab id remains `profile`.
- Do not revert whole files. Apply targeted edits so unrelated work in shared components survives.
- Confirm that `https://localhost:5173/settings/profile` still opens the `profile` tab before changing presentation.

## 1. Lock the Navigation and Behavior Contracts

- Keep `SETTINGS_TABS[].id` as `profile` in `src/lib/shared/navigation/config/tab-definitions.ts`.
- Change the fallback label and description to **Account** and account-focused copy.
- Update `tab_settings_profile` values in `messages/*.json` to the correct localized form of Account while keeping the translation key stable.
- Run `tests/unit/onboarding/account-setup-navigation-contract.test.ts` before and after the rename. No destination migration should be necessary.
- Add focused tests for the silent behavior most likely to regress:
  - completed setup produces no setup surface;
  - incomplete setup exposes only unresolved tasks and still dispatches the existing task actions;
  - provider availability respects web, native, Facebook, and Instagram gates;
  - Instagram refresh still updates deletion reauthentication provider data;
  - reset-local-data retains the existing account-manager call and confirmation.

## 2. Replace the Dashboard With the Account Composition

### ProfileTab shell

- Rewrite the signed-in branch of `ProfileTab.svelte` into these source-ordered regions:
  1. identity header;
  2. incomplete-setup prompt when needed;
  3. Personal details;
  4. Sign-in methods;
  5. Security.
- Remove the Account, Storage, Connected Accounts, and Danger GlassCard grid wrappers.
- Remove Storage imports, cache-reset state, and the cache confirmation from ProfileTab after the capability is relocated.
- Remove `overflow-y: auto` from ProfileTab so `.settings-module-body` is the only vertical scroll owner.
- Replace `max-width: 92vw` with a full-width, container-relative band and a `cqi` gutter. Keep the existing local 1680px to 3840px type ramp, but use ProfileTab container queries for composition.
- Use one larger left column for Personal details and one smaller right column containing Sign-in methods and Security. Stack in the same source order below the desktop container breakpoint.
- Remove the `danger-card` host gradient and every style that only supported the rejected equal-card grid.

### Identity and setup

- Refine `ProfileHeroSection.svelte` into a compact identity header with photo, display name, username, email, optional pronouns, and a bounded Sign out button.
- Keep the existing photo picker, saved Google photo, profile color, upload, and sign-out behavior.
- Add a focused `IncompleteAccountSetupPrompt.svelte` under the account-setup feature or give `AccountSetupChecklist.svelte` an explicit incomplete-only presentation without changing other consumers.
- Derive unresolved tasks from the existing account-setup state. Do not duplicate completion rules in ProfileTab.
- Preserve the existing display-name edit request, photo picker, prop drawer, and Theme navigation actions.
- Add browser-component coverage for complete, incomplete, loading, and unavailable setup states.

## 3. Turn Personal Details Into Readable Settings Rows

- Add one presentation-only `AccountValueRow.svelte` under `profile-settings` after confirming no newer equivalent has landed.
- Give the row a label, current value or **Not set**, and a bounded Edit button. The container remains static and has no click or keyboard handler.
- Refactor `DisplayNameEditor.svelte`, `UsernameEditor.svelte`, `InstagramUsernameEditor.svelte`, and `PronounsEditor.svelte` to compose that row while keeping each editor's existing data, validation, normalization, and asynchronous logic.
- Keep `editRequest` support so account-setup actions can open display-name editing directly.
- Give true edit controls a distinct theme input surface, visible border, readable text, and focus ring. Remove input-shaped background treatment from read state.
- Make every Save, Cancel, and Edit target at least 44 by 44 CSS pixels where touch applies.
- Restore focus to Edit after Save or Cancel.
- Add an adjacent inline `role="alert"` for each failed save. Fix display-name save specifically, which currently reports only to the console.
- Add co-located `vitest-browser-svelte` tests for read state, edit entry, keyboard focus, validation, cancel, successful save, and visible save failure.

## 4. Rebuild Sign-in Methods Around Explicit Actions

### Provider presentation

- Add a shared `ProviderStatusRow.svelte` used by both `ConnectedAccounts.svelte` and `ConnectedAccountsPreview.svelte`.
- Keep the row static. Render a separate Connect or Disconnect button at the trailing edge.
- Show provider name, connected identity or status, and the reason an account cannot be disconnected.
- Reuse `GoogleIcon.svelte` and `FacebookIcon.svelte`.
- Add `InstagramIcon.svelte` beside the existing auth icon components using a verified reusable vector asset. Do not keep brand identity in a Font Awesome class string.
- Render Email with the established semantic mail icon treatment.
- Reduce `connected-accounts.providers.ts` to provider semantics and visual tokens that remain useful. Do not use its current icon-font strings for brand rendering.
- Make Connect and Disconnect actions at least 44 by 44 CSS pixels and size them to their labels rather than the grid track.

### Authentication behavior

- Preserve Google, Facebook, Instagram, and Email linking paths.
- Preserve `FACEBOOK_LOGIN_ENABLED`, `INSTAGRAM_LOGIN_ENABLED`, and native-shell restrictions.
- Preserve provider-specific error mapping, confirmation delay, last-provider protection, and per-provider busy state.
- Preserve Instagram's separate `refreshInstagramLink()` path and `onInstagramChange` propagation into `ProfileTab.connectedProviderIds`.
- Keep `EmailLinkingDrawer.svelte` as the Email connect flow.
- Show provider failures adjacent to the provider list with `role="alert"`; retain dismiss behavior only if it remains useful with the new layout.
- Add component tests covering rendered icons, explicit labels, row non-interactivity, feature-gated absence, native absence, busy isolation, failure, allowed unlink, and protected last provider.

## 5. Integrate Security Without a Danger Banner

- Place the existing password flow and DangerZone behavior in a compact Security section in ProfileTab's right column.
- Keep `PasswordChangeForm.svelte`, the account-manager password call, validation, busy state, and errors.
- Keep `DangerZone.svelte` disclosure, reason selection, provider-specific reauthentication, confirmation delay, and deletion call.
- Remove the surrounding danger GlassCard and full-width red host treatment. Use destructive color only on Delete account and its revealed confirmation state.
- Keep Delete account bounded to its label. It must not stretch to the section width.
- Verify Google, Facebook, Instagram, and password reauthentication states with focused tests or existing service tests plus runtime inspection.

## 6. Move Offline and Local Data to Preferences > Advanced

- Extract the behavior in `profile/StorageSection.svelte` into `tabs/preferences/OfflineLocalDataSection.svelte` without its GlassCard shell or Storage title.
- Let the extracted component own offline stats, download progress, environment support, result messaging, reset confirmation, and the `getAccountManager().clearCache()` call.
- Mount it at the end of `PreferencesTab.svelte` inside a `bits-ui` `Collapsible.Root`, `Collapsible.Trigger`, and `Collapsible.Content` structure. Keep it collapsed by default.
- Label the disclosure **Advanced** and the content section **Offline and local data**.
- Rename **Clear Cache** to **Reset local app data** in the trigger and confirmation. State before confirmation that the action signs the user out, clears device data, reloads the app, and leaves cloud data intact.
- Preserve environment-aware offline messaging and cache statistics.
- Change download and reset failures to visible announced alerts. Keep progress and successful informational results in polite status regions.
- Delete `StorageSection.svelte` only after `rg` proves there are no consumers.
- Add component tests for collapsed default state, disclosure semantics, offline-supported and unsupported states, progress, failure, confirmation, and reset invocation.

## 7. Align Preview and Remove Obsolete Presentation

- Update ProfileTab's preview branch to use the same region composition without functioning actions.
- Adapt `ConnectedAccountsPreview.svelte` to the shared provider row through an explicit preview-data adapter rather than casting preview data to Firebase types.
- Remove Storage from preview.
- Keep representative password and deletion rows visibly inactive or descriptive without attaching account actions.
- Remove obsolete profile-only GlassCard usage and imports. Change `GlassCard.svelte` itself only if a remaining shared consumer requires a compatible cleanup.
- Run `rg` for stale user-facing **Profile**, **Storage**, **Clear Cache**, `danger-card`, provider icon-font mappings, and removed component imports. Resolve only references owned by this redesign.

## 8. Verify the Finished Surface

### Automated checks

- Run the focused account-setup, account-manager clear-cache, account deletion, and new component test files first.
- Run the repository's machine-safe TypeScript and Svelte check gate after focused tests pass.
- Re-run failed checks after fixing issues until the touched scope is green or a genuine external blocker is documented.

### Runtime behavior

- Reuse `https://localhost:5173` and the shared Chrome debug process. Open one task-owned background tab at `/settings/profile`.
- Verify the Account label and stable URL, complete and incomplete setup, all four provider types permitted by the current runtime, one personal-detail save and failure, password change entry, deletion reveal, Advanced disclosure, offline download state, and reset confirmation.
- Inspect the console after every exercised failure and destructive confirmation path.

### Measurements and visual pass

- At 1280 x 800 with the sidebar pinned, verify the Account bounding box stays inside `.settings-module` with no horizontal clipping.
- At 1440 x 900, 1920 x 1080, 2560 x 1440, and 3840 x 2160, record `.settings-module-body.clientHeight` and `.scrollHeight`. For the completed, collapsed default state, require `scrollHeight <= clientHeight`.
- At every viewport, record ProfileTab computed overflow, content width, column count, section bounds, control widths, and minimum target sizes.
- Capture and inspect WebP screenshots at 1920 x 1080, 2560 x 1440, 3840 x 2160, 1440 x 900, 820 x 1180, 960 x 412, and 375 x 667.
- Read every frame for dead rail, weak hierarchy, pseudo-input read states, oversized actions, missing provider marks, nested scrolling, clipping, horizontal overflow, wrapping, and focus visibility.
- Iterate until measurements and screenshots satisfy the spec. Clear emulation and close only the task-owned tab.

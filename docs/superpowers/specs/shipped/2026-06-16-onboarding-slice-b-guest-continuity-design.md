# Slice B — Guest Continuity (Anonymous Identity + In-Place Upgrade)

**Date:** 2026-06-16
**Umbrella:** `2026-06-16-user-onboarding-overhaul-umbrella.md`
**Status:** Design approved; ready for implementation plan
**Build order:** First (anchor slice)

## Problem

A guest builds a sequence in local working state. There is no wiring to carry
that draft into a Firestore-backed account on signup. `LibraryRepository`
(`src/lib/shared/library/services/library-repository.ts:69`) is Firestore-only,
keyed by `getUserId()`; a guest has no uid, so the draft is orphaned and lost
the moment they sign up. Silent loss of just-made work is the highest
trust-cost defect in the onboarding funnel.

## Decision

Give guests a **lazily-created anonymous Firebase identity**. On signup, upgrade
that identity **in place** using the link primitives already in the repo. The
guest's Firestore documents are written under the anonymous uid, which is
preserved by the link, so every document already belongs to the now-permanent
account. No migration code on the happy path.

Two ground-truth findings shape this:

1. **Anon users already satisfy ownership rules.** `firestore.rules` defines
   `isAuthenticated()` as `request.auth != null` and `isOwner(userId)` as
   `request.auth.uid == userId`. A Firebase anonymous user has both. So writing
   a guest's own library/learning/XP needs **zero rule changes**.
2. **The link machinery already exists.** `authenticator.ts` imports and uses
   `linkWithPopup` (lines 114, 128) and `linkWithCredential` (line 154) for the
   email-linking flow. Anonymous→permanent upgrade reuses exactly these.

## Architecture

### B1 — Identity lifecycle (lazy creation)

Anonymous sign-in fires on the **first persistable action**, not on app load.
The landing page, endless spinner, and "Play With It" draw heavy anonymous
traffic; eager sign-in would create an anon account per random visitor and flood
the auth roster. Triggers (whichever comes first):

- First beat committed to a sequence in Create.
- First save / favorite / publish attempt.

Mechanism: a single guard, `ensureGuestIdentity()`, that calls
`signInAnonymously(auth)` only if `auth.currentUser == null`. Idempotent; safe to
call from every persistable-action entry point. Firebase persists the anonymous
session in browser storage, so the uid survives refresh and the library
re-resolves. Residual loss is limited to a full browser-storage clear *before*
signup, which is exactly what the in-place upgrade closes.

New file: `src/lib/shared/auth/services/guest-identity.ts` exporting
`ensureGuestIdentity(): Promise<void>`. Wire it via the existing service-getter
pattern (cross-ref `service-naming`, `state-management` skills).

### B2 — Persistence (reuse, no new layer)

Once an anon uid exists, `LibraryRepository` works unchanged. Guests get a real
cloud library; saved sequences survive refresh. No new persistence code. The
`save` `AuthNudgeTrigger` (`auth-nudge-trigger.ts`) stops firing for the save
action; it re-points to export only. Keep the `module:library` nudge — the
Library *module* can stay gated to full accounts even while the underlying save
works, if product wants the library tab as a signup carrot (decide at plan
time; default: open the Library module to anon users since their data now lives
there).

### B3 — Tier model refactor

`resolveAccessTier` (`src/lib/shared/auth/domain/access-tier.ts:9`) currently:

```ts
export function resolveAccessTier(isAuthenticated: boolean, isPremium: boolean): AccessTier {
  if (!isAuthenticated) return "guest";
  if (isPremium) return "premium";
  return "user";
}
```

With anonymous auth, `isAuthenticated` is true for guests. New signature:

```ts
export function resolveAccessTier(
  isAuthenticated: boolean,
  isAnonymous: boolean,
  isPremium: boolean
): AccessTier {
  if (!isAuthenticated || isAnonymous) return "guest";
  if (isPremium) return "premium";
  return "user";
}
```

Work: thread `user.isAnonymous` (from `auth-state.svelte.ts`) into every caller
of `resolveAccessTier`. Tier is computed in one place, so blast radius is the
caller list, not the logic. Beat caps (`getMaxBeats`: 8/16/64) unchanged.

**Audit task:** grep all `resolveAccessTier(` call sites and every place that
infers "guest" from `!user` / `!authState.user` / `isAuthenticated`. Each must
switch to the tier function or to an explicit `user?.isAnonymous` check.

### B4 — Signup as in-place link

When `auth.currentUser?.isAnonymous === true` and the user triggers signup,
branch the signup handlers to **link** instead of **sign in**:

| Provider | Anonymous present → use | Else |
|---|---|---|
| Google | `linkWithPopup(currentUser, googleProvider)` | `signInWithPopup` |
| Facebook | `linkWithPopup(currentUser, facebookProvider)` | `signInWithPopup` |
| Email/password | `linkWithCredential(currentUser, EmailAuthProvider.credential(...))` | `createUserWithEmailAndPassword` |

These call the functions already imported in `authenticator.ts`. Add an
`isAnonymous` branch to the signup entry points (`AuthSheet` / `AuthDrawer` and
their handlers). uid is preserved across the link, so the user's Firestore data
needs no move.

**Collision handling (mandatory).** If the linked credential already belongs to
a permanent account, Firebase throws `auth/credential-already-in-use` (or
`auth/email-already-in-use`). Flow:

1. Catch the collision.
2. Sign into the **existing** account with that credential.
3. Read the anonymous draft(s) the user just made (held in memory / resolvable
   by the pre-link anon uid for the current session).
4. Prompt: "Import the N beats you just made into this account?" → on yes, copy
   those sequences into the existing account's library via `LibraryRepository`.
5. The orphaned anon account is left to the B6 cleanup sweep.

This is the **only** path that copies data; it fires solely on collision. A
small, well-bounded merge, not a general migrator.

New file: `src/lib/shared/auth/services/anonymous-upgrade.ts` —
`upgradeAnonymous(provider)` orchestrating link → collision-catch → sign-in →
optional import. Reuses `authenticator.ts` functions; does not duplicate them.

### B5 — Security: close the anon abuse surface (core work)

Anonymous sessions satisfy `isAuthenticated()`. Today many community/abuse-prone
paths gate only on that, so they would silently open to throwaway anon accounts.
Add a helper to `firestore.rules`:

```
function isFullUser() {
  return request.auth != null
    && request.auth.token.firebase.sign_in_provider != 'anonymous';
}
```

Swap `isAuthenticated()` → `isFullUser()` (keep the existing extra conditions) on
these write paths:

- `feedback` create (`firestore.rules` ~822)
- `shortcodes` create (~888)
- `conversations` create/update + `messages` create (~651, ~696)
- `users/{userId}/following` and root `followers` create (~427, ~437)
- `userLocations` create/update (~1051)  — community map
- `festivalSubmissions` create (~1324)
- `videos` create (~859)
- `hallOfShame*` create paths (age-gated; also require full user)
- `userReports` create (~1088)
- `usernames` claim create/update (~228) — usernames are a permanent-account concept
- `presence` create/update (~764) — optional; low risk, decide at plan time

**Leave as-is** (anon users keep their own data): everything under
`users/{uid}/…` owned via `isOwner` (sequences, drafts, learningProgress,
quizHistory, xp, achievements, streak, sessions, onboarding, tikaConversations,
mandala-collection, handPaths, soloProps, etc.), plus public reads (`if true`).

Anon users must **not** be able to publish to public indexes
(`publicSequences`, `publicHandPaths`, `publicSoloProps`) — these gate on
`ownerId == request.auth.uid` today; add `isFullUser()` so anon drafts cannot
reach Browse. Publishing is a take-it-home action, correctly gated.

This section is security-sensitive. It gets a threat-model note in the plan and
an **emulator-based rules test suite** as its verification gate (see B7).

### B6 — Anonymous account lifecycle

Firebase does not auto-delete anonymous accounts. Scheduled Cloud Function
(`functions/`), daily: delete anonymous accounts **idle > 30 days** with no
linked credential, cascading their `/users/{uid}` Firestore subtree and any
Storage objects. 30 days is generous enough that a returning guest keeps an
unlinked draft for a month, while bounding auth-roster growth and quota. Logged,
not silent (emits a metric of accounts swept). Document the policy in the plan;
this is an ops commitment, not a hidden GC.

### B7 — Edge cases and verification

Edge cases to cover in the plan and tests:

- Multi-tab anonymous session (same uid across tabs; no double sign-in).
- `ensureGuestIdentity()` called concurrently from two persistable actions
  (idempotent; single anon user).
- Anon → link race (user taps signup mid-write).
- Offline at link time (queue / clear error, no silent loss).
- Collision import path (B4) end-to-end.
- Cache-clear before signup (acceptable loss; verify no crash, clean re-entry).

Verification gate (cross-ref `verification-protocol.md`,
`fast-iteration-loop.md`):

1. **Firebase emulator rules tests** proving: an anon user **can** write
   `users/{uid}/sequences`, `learningProgress`, `xp`; an anon user **cannot**
   create `feedback`, `shortcodes`, `following`, `userLocations`,
   `festivalSubmissions`, `publicSequences`, claim a `username`. A full user
   can do all of the above.
2. **Runtime proof** via Chrome DevTools MCP (with permission): guest builds →
   `auth.currentUser.isAnonymous === true` after first beat; saves; refreshes;
   library still present; signs up with Google; `isAnonymous === false`, same
   uid, same library. Captured as console/query output, not asserted blind.
3. One full `npm run check` at the commit gate.

## Files

**New**
- `src/lib/shared/auth/services/guest-identity.ts` — `ensureGuestIdentity()`
  (grep first: confirm no existing anon-session helper).
- `src/lib/shared/auth/services/anonymous-upgrade.ts` — `upgradeAnonymous()`.
- `functions/` — scheduled stale-anon cleanup (locate existing functions dir;
  follow its conventions, do not scaffold a new one).
- Emulator rules test file under the existing rules-test location (grep for one).

**Modified**
- `src/lib/shared/auth/domain/access-tier.ts` — new `isAnonymous` param.
- All `resolveAccessTier(` call sites + `!user`-as-guest inferences (audit).
- `authenticator.ts` / `AuthSheet` / `AuthDrawer` signup handlers — anon link branch.
- `firestore.rules` — `isFullUser()` + swaps in B5.
- Persistable-action entry points in Create (first-beat, save) — call
  `ensureGuestIdentity()`.

## Non-goals

- A general guest→account migrator. The only copy path is the collision import
  (B4); the happy path moves nothing.
- Cross-device guest continuity. Anonymous identity is per-device by design;
  cross-device is a take-it-home (account) benefit.
- Changing beat caps or the premium tier definition.

## Open items for the plan

- Whether the Library *module* opens to anon users (default: yes) vs stays a
  signup carrot.
- `presence` rule: gate to full users or leave (low risk).
- Exact Cloud Functions location + existing scheduled-function pattern to follow.

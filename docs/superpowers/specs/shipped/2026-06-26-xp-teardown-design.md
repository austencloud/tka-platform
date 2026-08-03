---
title: XP / Achievement System Teardown
date: 2026-06-26
status: design
---

# XP / Achievement System Teardown

## Context

Saving a sequence fires a "+10 XP" toast. Austen believed the XP/gamification
system was already removed. It was not — only the *display* surfaces were torn
out (or never mounted). The *award engine* still runs on every save, login,
training session, and feedback submission, writing to Firestore and popping a
toast, while delivering no visible progression payoff. Worst of both worlds:
the system gamifies without rewarding, and the "+10 XP" reads as dated
over-gamification that fights the product's "play with everything, pay to take
it home" / educational-resource brand.

Decision (2026-06-26): **full teardown** of the XP / achievement / streak /
challenge-XP system. Keep the prop-collection unlock feature (independent,
actively developed). Remove the Train Challenges tab entirely (Train → Practice
+ Progress).

## Current state (as mapped)

### The engine — `src/lib/shared/gamification/` (XP sub-tree)
`AchievementManager`, `streak-tracker`, daily/weekly `*-challenge-manager`,
`challenge-coordinator`, `skill-progression-tracker` + `skill-progression/`,
`gamification-notifier`, `xp-constants`, `achievement-definitions`,
`skill-definitions`, `achievement-models`, `challenge-models`, `xp-toast-state`,
`notification-state`, `gamification-initializer`, `data/firestore-collections`,
the `get-*` getters, and the `XPToast` / `AchievementNotificationToast`
components. Booted for signed-in users from `MainApplication.svelte`
(`initializeGamification`). Persists `users/{uid}/xp`, `/achievements`,
`/xpEvents`, `/notifications`, plus denormalized `totalXP` / `currentLevel` /
`achievementCount` on the user doc, mirrored to Dexie tables `userXP`,
`userAchievements`, `xpEvents`, `achievementNotifications`.

### Award sites (`trackAction` / `trackXP`)
| Action | XP | Site |
|---|---|---|
| Save sequence | +10 | `library-repository.ts:481` (the reported toast) |
| Publish sequence | +50 | `library-repository.ts:868` |
| Daily login + streak | +15 | `gamification-initializer.ts:44` |
| Submit feedback | +25 | `feedback-submission-service.ts:156` |
| Train session / perfect / combo / 150bpm / drill | varies | `session-completion-processor.ts`, `train-challenge-manager.ts` |
| Skill level / mastery | +75 / +250 | `skill-progression-mutations.ts` |
| Daily / weekly challenges | varies | `challenge-coordinator.ts` |

### Visible surfaces — only two were live
1. Global `XPToast` (`MainApplication.svelte`) — every award.
2. Train `ResultsScreen` XP breakdown — only after a training session.

### Dead / never-mounted (the already-removed display layer)
`ProfileRankings.svelte` (orphan), `leaderboard-manager` (no UI consumer),
shared `community/challenges/*` (daily/weekly cards + skill-progression list,
unmounted), `COMMUNITY_TABS` challenges entry (registry-only). No achievements
gallery exists anywhere.

### Independent — survives untouched
- **Prop collection**: `prop-pool`, `prop-collection`, `prop-unlock-manager`,
  `prop-collection-persistence`, `prop-collection-state`,
  `prop-celebration-state`, `get-prop-unlock-manager`, `PropUnlockCelebration`,
  `prop-demo-loop`. Verified: zero imports from the XP sub-tree.
- **Train Practice + Progress tabs**: Progress reads `performance-history-tracker`
  (sessions / accuracy / combo / personal bests), not XP. Practice is
  independent. Both stay.

## Goal

Clean removal: no dead code, no orphaned imports, build + typecheck green, the
"+10 XP" toast gone, prop-collection and the Inbox untouched.

## Approach: staged phases (build green at each)

Each phase compiles and is independently committable, isolating the riskier
Train + infra work from the bulk engine deletion.

### Phase 1 — Stop the awards + unmount the toast
Removes the user-visible symptom immediately.
- `library-repository.ts`: drop `trackAction("sequence_created")` and
  `trackAction("sequence_published")`; remove the injected `achievementService`
  field + its wiring in `get-library-repository.ts`.
- `feedback-submission-service.ts`: drop `trackXP("feedback_submitted")`.
- `MainApplication.svelte`: remove `XPToast` + `AchievementNotificationToast`
  imports and mounts; remove the `initializeGamification` boot block.

### Phase 2 — Delete the engine + dead display UI
- Delete the XP sub-tree of `src/lib/shared/gamification/` (list above). **Keep**
  every prop-collection file.
- Delete `ProfileRankings.svelte`, `leaderboard-manager.ts` +
  `get-leaderboard-manager.ts`, shared `community/challenges/`.
- Remove the `COMMUNITY_TABS` challenges entry (and `COMMUNITY_TABS` itself if it
  has no remaining live consumer).

### Phase 3 — Remove the Train Challenges tab
- Delete `train/components/challenges/`, `train-challenge-manager` + getter,
  `seed-challenges`, `train-challenge-models`, `active-challenge-state`,
  `train-challenges-state`.
- `TRAIN_TABS`: drop the `challenges` section. `TrainModule.svelte`: drop the
  Challenges branch → Practice + Progress only. Fix the `TrainSection` union and
  the nav sync `$effect`.
- `session-completion-processor.ts`: remove all `trackAction` calls (keep the
  performance-history recording).
- `ResultsScreen.svelte`: remove the XP-breakdown section; keep accuracy / combo
  / score.
- Admin: remove `TrainChallengeManager.svelte` and `challenge-scheduler/`, plus
  their `ADMIN_TABS` entries.

### Phase 4 — Infrastructure + data
- **Dexie** (`tka-database.ts`, `database_constants.ts`): bump
  `DATABASE_VERSION`; in the new version set the `userXP`, `userAchievements`,
  `xpEvents`, `achievementNotifications` stores to `null` (Dexie table delete);
  drop the table declarations; update `clearAllData()` and the count helpers.
- **firestore.rules**: remove root `userAchievements`, `userXP`, `xpEvents`,
  `dailyChallenges`, `weeklyChallenges`, `trainChallenges`,
  `userChallengeProgress`, `userStreaks`; remove per-user `achievements`, `xp`,
  `xpEvents`, `challengeProgress`, `streak`, `weeklyProgress`, `trainProgress`.
  **KEEP** `gamification/{docId}` (prop collection) and `/notifications` (shared
  with Inbox + moderation).
- **Denormalized user fields**: stop writing `totalXP` / `currentLevel` /
  `achievementCount` in `user-repository`, `user-document-manager`,
  `enhanced-user-profile`, `user-firestore-schemas`. Existing field values on
  live docs are left orphaned (harmless, no destructive migration).
- **Analytics**: remove `xp_earn` and `achievement_unlock` from
  `activity-event.ts` types + any emit sites; drop XP metrics from the admin
  `user-metrics-analyzer`.
- **i18n**: remove orphaned keys (`train_*challenge*`, `train_sort_xp`, XP /
  achievement / streak labels, `tab_*_challenges`) across `messages/en.json`
  and the nine other locale files.

## Risks (addressed)
1. **Inbox `/notifications` collision** — gamification's `getUserNotificationsPath`
   writes to `users/{uid}/notifications`, the same collection the Inbox +
   moderation use (with a different `UserNotification` shape). Keep that
   Firestore rule; only stop the gamification writes. The Dexie
   `achievementNotifications` table is gamification-only and deletes safely.
2. **Prop-collection isolation** — verified clean (no XP-tree imports); the prop
   files survive the wholesale sub-tree deletion.
3. **Dexie table deletion** — requires a version bump + null-store migration,
   not just removing an index.

## Out of scope / explicitly untouched
- Prop-collection unlock system (entire).
- Train Practice + Progress, `performance-history-tracker`.
- `retro/winxp/xp-renderer.ts` (Windows-XP era skin — unrelated to points).
- store / merch `xp` matches (= "expires" / "export").
- No destructive wipe of existing Firestore XP/achievement documents.

## Verification
- `npm run check` green (no orphaned imports / dead refs).
- `npm run build` green.
- Grep proof: no remaining `trackAction(` / `trackXP(` / `XP_REWARDS` /
  `XPToast` references outside deleted files; no `type="checkbox"`-style
  regressions (N/A here).
- Runtime: save a sequence on localhost → plain "Sequence saved" toast, no XP
  toast. Prop unlock celebration still fires. Inbox notifications still load.

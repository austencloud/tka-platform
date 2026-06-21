# Profile Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the creator profile page from a stacked layout into a 2026-grade creator portfolio with horizontal hero, inline stats, pinned showcase strip, content-type tabs, thumbnail-only gallery cards with star overlays, and 4K-native responsive scaling.

**Architecture:** Component-driven rewrite. ProfileHeroSection gets a full rewrite (horizontal + profileColor ambient). ProfileStatsGrid is deleted (stats merge into hero). New ProfileShowcase component for pinned items. ProfileTabs rewritten for content-type filtering with stripped gallery cards. New FollowersModal replaces tab-based follower/following display. UserProfilePanel rewired as orchestrator. Each section owns its own max-width for 4K scaling.

**Tech Stack:** Svelte 5 ($props, $state, $derived, $effect), CSS container queries, CSS color-mix(), native `<dialog>` via BaseModal, Firestore (users/{id} doc), existing PanelTabs component, existing PropAwareThumbnail component.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/shared/community/domain/models/pinned-item.ts` | `PinnableContentType` union + `PinnedItem` type |
| `src/lib/features/browse/creators/components/profile/ProfileShowcase.svelte` | Horizontal pinned showcase strip (1-6 cards) |
| `src/lib/features/browse/creators/components/profile/FollowersModal.svelte` | Modal for followers/following lists |

### Modified Files
| File | Changes |
|------|---------|
| `src/lib/shared/community/domain/models/enhanced-user-profile.ts` | Add `pinnedItems` field to `UserProfile` |
| `src/lib/features/browse/creators/components/profile/ProfileHeroSection.svelte` | Full rewrite: horizontal layout, stats inline, profileColor ambient, avatar glow |
| `src/lib/features/browse/creators/components/profile/ProfileTabs.svelte` | Full rewrite: content-type tabs, thumbnail-only cards, star overlay |
| `src/lib/features/browse/creators/components/UserProfilePanel.svelte` | Remove ProfileStatsGrid, add ProfileShowcase, wire FollowersModal, restructure layout |

### Deleted Files
| File | Reason |
|------|--------|
| `src/lib/features/browse/creators/components/profile/ProfileStatsGrid.svelte` | Stats merged into hero section |

---

### Task 1: PinnedItem Type + UserProfile Extension

**Files:**
- Create: `src/lib/shared/community/domain/models/pinned-item.ts`
- Modify: `src/lib/shared/community/domain/models/enhanced-user-profile.ts:14-59`

- [ ] **Step 1: Create PinnedItem type file**

```typescript
// src/lib/shared/community/domain/models/pinned-item.ts

export type PinnableContentType =
  | "sequence"
  | "collection"
  | "act"
  | "composition"
  | "mandala";

export interface PinnedItem {
  readonly type: PinnableContentType;
  readonly id: string;
}
```

- [ ] **Step 2: Add pinnedItems to UserProfile interface**

In `src/lib/shared/community/domain/models/enhanced-user-profile.ts`, add the import at the top:

```typescript
import type { PinnedItem } from "./pinned-item";
```

Then add to the `UserProfile` interface, after the `profileColor` field (line ~44):

```typescript
  /** Pinned showcase items (1-6, any content type) */
  pinnedItems?: PinnedItem[];
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/community/domain/models/pinned-item.ts src/lib/shared/community/domain/models/enhanced-user-profile.ts
git commit -m "feat(profile): add PinnedItem type and pinnedItems field to UserProfile"
```

---

### Task 2: ProfileHeroSection Rewrite

**Files:**
- Modify: `src/lib/features/browse/creators/components/profile/ProfileHeroSection.svelte` (full rewrite)

The current hero is a centered vertical stack (avatar on top, info below). The new hero is horizontal on wide screens (avatar left, info+stats center, follow button right), collapsing to centered vertical on mobile. Stats from ProfileStatsGrid merge here. profileColor drives an ambient radial gradient behind the avatar. Avatar gets a glow ring using profileColor.

- [ ] **Step 1: Rewrite ProfileHeroSection.svelte**

The component keeps the same props interface. Full replacement:

```svelte
<script lang="ts">
  import { fade } from "svelte/transition";
  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import AvatarImage from "./AvatarImage.svelte";
  import { reportModalState } from "$lib/features/moderation/state/report-modal-state.svelte";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/PropTypeDisplayRegistry";

  let {
    userProfile,
    currentUserId,
    isOwnProfile,
    followInProgress,
    onFollowToggle,
    onFollowersClick,
    onFollowingClick,
  }: {
    userProfile: EnhancedUserProfile;
    currentUserId?: string | null;
    isOwnProfile: boolean;
    followInProgress: boolean;
    onFollowToggle: () => void;
    onFollowersClick?: () => void;
    onFollowingClick?: () => void;
  } = $props();

  const accentColor = $derived(userProfile.profileColor || "var(--theme-accent)");

  function handleReportUser() {
    reportModalState.open({
      id: userProfile.id,
      displayName: userProfile.displayName,
    });
  }
</script>

<div
  class="hero-section"
  transition:fade={{ duration: 300 }}
  style:--profile-color={accentColor}
>
  <div class="hero-ambient"></div>

  <div class="hero-content">
    <div class="avatar-container">
      <div class="avatar-glow"></div>
      <AvatarImage
        src={userProfile.avatar}
        alt={userProfile.displayName}
        size={120}
        className="avatar"
      />
    </div>

    <div class="info-block">
      <div class="name-row">
        <h1 class="display-name">{userProfile.displayName}</h1>
        <span class="username">@{userProfile.username}</span>
        {#if userProfile.propsISpinWith && userProfile.propsISpinWith.length > 0}
          <div class="props-row">
            {#each userProfile.propsISpinWith as prop}
              <div
                class="profile-prop-icon"
                class:favorite={prop === userProfile.favoriteProp}
                title={getPropTypeDisplayInfo(prop).label}
              >
                <img
                  src={getPropTypeDisplayInfo(prop).image}
                  alt={getPropTypeDisplayInfo(prop).label}
                />
                {#if prop === userProfile.favoriteProp}
                  <span class="favorite-star" aria-label="Favorite">&#9733;</span>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      {#if userProfile.bio}
        <p class="bio">{userProfile.bio}</p>
      {/if}

      {#if userProfile.instagramUsername}
        <a
          href="https://instagram.com/{userProfile.instagramUsername}"
          target="_blank"
          rel="noopener noreferrer"
          class="instagram-link"
          aria-label="View {userProfile.displayName}'s Instagram profile"
        >
          <i class="fab fa-instagram" aria-hidden="true"></i>
          <span>@{userProfile.instagramUsername}</span>
        </a>
      {/if}

      <div class="stats-row">
        <div class="stat">
          <span class="stat-value">{userProfile.sequenceCount}</span>
          <span class="stat-label">Sequences</span>
        </div>
        <div class="stat">
          <span class="stat-value">{userProfile.collectionCount}</span>
          <span class="stat-label">Collections</span>
        </div>
        <button class="stat stat-clickable" onclick={() => onFollowersClick?.()}>
          <span class="stat-value">{userProfile.followerCount}</span>
          <span class="stat-label">Followers</span>
        </button>
        <button class="stat stat-clickable" onclick={() => onFollowingClick?.()}>
          <span class="stat-value">{userProfile.followingCount}</span>
          <span class="stat-label">Following</span>
        </button>
      </div>
    </div>

    {#if currentUserId && !isOwnProfile}
      <div class="actions-block">
        <button
          class="follow-button"
          class:following={userProfile.isFollowing}
          class:loading={followInProgress}
          disabled={followInProgress}
          onclick={onFollowToggle}
          aria-label={userProfile.isFollowing ? "Unfollow {userProfile.displayName}" : "Follow {userProfile.displayName}"}
        >
          {#if followInProgress}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          {:else}
            {userProfile.isFollowing ? "Following" : "Follow"}
          {/if}
        </button>

        <button
          class="report-button"
          onclick={handleReportUser}
          aria-label="Report {userProfile.displayName}"
          title="Report user"
        >
          <i class="fas fa-flag" aria-hidden="true"></i>
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .hero-section {
    --instagram-brand: #E4405F;

    container-type: inline-size;
    container-name: hero-section;

    position: relative;
    overflow: hidden;
    padding: clamp(20px, 4cqi, 32px);
    border-radius: 16px;
    margin-bottom: 24px;
    max-width: 900px;
    margin-inline: auto;
  }

  .hero-ambient {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(
        ellipse 60% 80% at 10% 50%,
        color-mix(in srgb, var(--profile-color) 15%, transparent),
        transparent 70%
      );
    pointer-events: none;
    z-index: 0;
  }

  .hero-content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .avatar-container {
    position: relative;
    width: 120px;
    height: 120px;
    flex-shrink: 0;
  }

  .avatar-glow {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--profile-color) 30%, transparent);
    filter: blur(8px);
    z-index: -1;
  }

  .info-block {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .name-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
  }

  .display-name {
    margin: 0;
    font-size: var(--font-size-3xl);
    font-weight: 700;
    color: var(--theme-text, white);
  }

  .username {
    font-size: var(--font-size-base);
    color: var(--theme-text-dim);
  }

  .bio {
    margin: 4px 0 0 0;
    font-size: var(--font-size-sm);
    line-height: 1.6;
    color: var(--theme-text-dim);
    max-width: min(400px, 100%);
  }

  .instagram-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: color-mix(in srgb, var(--instagram-brand) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--instagram-brand) 25%, transparent);
    border-radius: 20px;
    color: var(--instagram-brand);
    font-size: var(--font-size-sm);
    font-weight: 500;
    text-decoration: none;
    transition: all var(--duration-normal) ease;
    width: fit-content;
  }

  .instagram-link:hover {
    background: color-mix(in srgb, var(--instagram-brand) 20%, transparent);
    border-color: color-mix(in srgb, var(--instagram-brand) 40%, transparent);
    transform: translateY(-1px);
  }

  .instagram-link i {
    font-size: 16px;
  }

  .stats-row {
    display: flex;
    gap: 24px;
    margin-top: 8px;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    color: inherit;
  }

  .stat-clickable {
    cursor: pointer;
  }

  .stat-clickable:hover .stat-label {
    color: var(--theme-text);
  }

  .stat-value {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--theme-text, white);
  }

  .stat-label {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    transition: color var(--duration-normal) ease;
  }

  .stat-clickable .stat-label {
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 3px;
  }

  .actions-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .follow-button {
    padding: 12px 32px;
    background: var(--theme-accent);
    border: 1px solid var(--theme-accent);
    border-radius: 8px;
    color: var(--text-on-accent, white);
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    white-space: nowrap;
  }

  .follow-button:hover {
    filter: brightness(0.9);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent) 40%, transparent);
  }

  .follow-button.following {
    background: var(--theme-card-bg);
    border-color: var(--theme-stroke);
    color: var(--theme-text);
  }

  .follow-button.following:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    filter: none;
  }

  .follow-button.loading {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .follow-button:disabled {
    pointer-events: none;
  }

  .report-button {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .report-button:hover {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 10%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
    color: var(--semantic-error, #ef4444);
  }

  .report-button:focus-visible {
    outline: 2px solid var(--semantic-error, #ef4444);
    outline-offset: 2px;
  }

  .props-row {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    align-items: center;
    margin-left: 4px;
  }

  .profile-prop-icon {
    position: relative;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
  }

  .profile-prop-icon.favorite {
    opacity: 1;
  }

  .profile-prop-icon img {
    width: 22px;
    height: 22px;
    object-fit: contain;
  }

  .favorite-star {
    position: absolute;
    bottom: -4px;
    right: -4px;
    font-size: 0.65rem;
    color: gold;
  }

  /* ═══ Mobile: collapse to centered vertical stack ═══ */
  @container hero-section (max-width: 640px) {
    .hero-content {
      flex-direction: column;
      text-align: center;
    }

    .avatar-container {
      width: 80px;
      height: 80px;
    }

    .name-row {
      justify-content: center;
    }

    .display-name {
      font-size: var(--font-size-2xl);
    }

    .bio {
      text-align: center;
      margin-inline: auto;
    }

    .instagram-link {
      margin-inline: auto;
    }

    .stats-row {
      justify-content: center;
    }

    .actions-block {
      flex-direction: row;
      gap: 12px;
    }

    .follow-button {
      padding: 10px 24px;
    }

    .props-row {
      justify-content: center;
      margin-left: 0;
    }
  }

  /* ═══ Very narrow ═══ */
  @container hero-section (max-width: 400px) {
    .hero-section {
      padding: 14px;
    }

    .stats-row {
      gap: 16px;
      flex-wrap: wrap;
    }

    .display-name {
      font-size: var(--font-size-xl);
    }

    .username {
      font-size: var(--font-size-sm);
    }
  }

  .instagram-link:focus-visible {
    outline: 3px solid var(--instagram-brand);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .follow-button,
    .instagram-link,
    .report-button {
      transition: none;
    }

    .follow-button:hover,
    .instagram-link:hover {
      transform: none;
    }
  }
</style>
```

Note the two new props added: `onFollowersClick` and `onFollowingClick`. These will be wired from UserProfilePanel in Task 7 to open the FollowersModal.

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Errors in UserProfilePanel.svelte about missing props (expected — we haven't wired them yet). No errors in ProfileHeroSection itself.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/browse/creators/components/profile/ProfileHeroSection.svelte
git commit -m "feat(profile): rewrite hero section — horizontal layout, inline stats, profileColor ambient"
```

---

### Task 3: Delete ProfileStatsGrid

**Files:**
- Delete: `src/lib/features/browse/creators/components/profile/ProfileStatsGrid.svelte`
- Modify: `src/lib/features/browse/creators/components/UserProfilePanel.svelte:27,282-284`

- [ ] **Step 1: Remove ProfileStatsGrid import and usage from UserProfilePanel**

In `UserProfilePanel.svelte`, remove the import line:
```typescript
import ProfileStatsGrid from "./profile/ProfileStatsGrid.svelte";
```

And remove the usage:
```svelte
<ProfileStatsGrid {userProfile} />
```

- [ ] **Step 2: Delete ProfileStatsGrid.svelte**

```bash
rm src/lib/features/browse/creators/components/profile/ProfileStatsGrid.svelte
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors from ProfileStatsGrid removal (stats now live in hero).

- [ ] **Step 4: Commit**

```bash
git add -u src/lib/features/browse/creators/components/profile/ProfileStatsGrid.svelte src/lib/features/browse/creators/components/UserProfilePanel.svelte
git commit -m "refactor(profile): delete ProfileStatsGrid — stats merged into hero section"
```

---

### Task 4: ProfileShowcase Component

**Files:**
- Create: `src/lib/features/browse/creators/components/profile/ProfileShowcase.svelte`

This is the compact horizontal strip of 1-6 pinned items below the hero. Each card shows a type badge (color-coded). Own profile with no pins shows a prompt. Others' empty showcase is hidden.

- [ ] **Step 1: Create ProfileShowcase.svelte**

```svelte
<script lang="ts">
  import type { PinnedItem, PinnableContentType } from "$lib/shared/community/domain/models/pinned-item";

  let {
    pinnedItems = [],
    isOwnProfile,
  }: {
    pinnedItems: PinnedItem[];
    isOwnProfile: boolean;
  } = $props();

  const typeConfig: Record<PinnableContentType, { label: string; color: string; icon: string }> = {
    sequence: { label: "Sequence", color: "#3b82f6", icon: "fa-list" },
    composition: { label: "Composition", color: "#8b5cf6", icon: "fa-th" },
    mandala: { label: "Mandala", color: "#10b981", icon: "fa-circle-notch" },
    act: { label: "Act", color: "#f59e0b", icon: "fa-film" },
    collection: { label: "Collection", color: "#ec4899", icon: "fa-folder" },
  };

  const hasItems = $derived(pinnedItems.length > 0);
</script>

{#if hasItems}
  <section class="showcase" aria-label="Pinned showcase">
    <div class="showcase-header">
      <i class="fas fa-thumbtack" aria-hidden="true"></i>
      <span>Showcase</span>
    </div>
    <div class="showcase-strip">
      {#each pinnedItems as item (item.id)}
        {@const config = typeConfig[item.type]}
        <button class="showcase-card" style:--card-accent={config.color}>
          <div class="card-placeholder">
            <i class="fas {config.icon}" aria-hidden="true"></i>
          </div>
          <div class="type-badge">
            {config.label}
          </div>
        </button>
      {/each}
    </div>
  </section>
{:else if isOwnProfile}
  <section class="showcase showcase-empty" aria-label="Pinned showcase">
    <div class="empty-prompt">
      <i class="fas fa-thumbtack" aria-hidden="true"></i>
      <span>Pin your best work to showcase it here</span>
    </div>
  </section>
{/if}

<style>
  .showcase {
    container-type: inline-size;
    container-name: showcase;
    margin-bottom: 24px;
    width: 100%;
  }

  .showcase-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text-dim);
  }

  .showcase-header i {
    font-size: var(--font-size-compact);
  }

  .showcase-strip {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255,255,255,0.15)) transparent;
  }

  .showcase-card {
    flex: 0 0 200px;
    height: 160px;
    background: var(--theme-card-bg);
    border: 1px solid color-mix(in srgb, var(--card-accent) 25%, transparent);
    border-radius: 12px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    position: relative;
    overflow: hidden;
  }

  .showcase-card:hover {
    border-color: color-mix(in srgb, var(--card-accent) 50%, transparent);
    background: var(--theme-card-hover-bg);
    transform: translateY(-2px);
    box-shadow: 0 4px 16px color-mix(in srgb, var(--card-accent) 15%, transparent);
  }

  .card-placeholder {
    font-size: 2rem;
    color: color-mix(in srgb, var(--card-accent) 30%, transparent);
  }

  .type-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: var(--font-size-xs, 11px);
    font-weight: 600;
    background: color-mix(in srgb, var(--card-accent) 20%, transparent);
    color: var(--card-accent);
    letter-spacing: 0.02em;
  }

  .showcase-empty {
    display: flex;
    justify-content: center;
  }

  .empty-prompt {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 24px;
    border: 1px dashed var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
  }

  .empty-prompt i {
    font-size: var(--font-size-sm);
    opacity: 0.6;
  }

  /* ═══ Mobile ═══ */
  @container showcase (max-width: 640px) {
    .showcase-card {
      flex: 0 0 160px;
      height: 130px;
    }
  }

  /* ═══ 4K / Ultrawide ═══ */
  @container showcase (min-width: 2000px) {
    .showcase-card {
      flex: 0 0 240px;
      height: 180px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .showcase-card {
      transition: none;
    }

    .showcase-card:hover {
      transform: none;
    }
  }
</style>
```

Note: This is the data-model-aware shell. The actual thumbnail rendering inside each card will be wired when the pin management UI ships (out of scope per spec). For now, cards show the type icon as placeholder and the type badge. When a user has pinned items, the component renders them. The pin-management UI itself (the ability to add/remove pins) is a follow-up task that needs its own design session.

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/browse/creators/components/profile/ProfileShowcase.svelte
git commit -m "feat(profile): add ProfileShowcase component — pinned items strip"
```

---

### Task 5: FollowersModal Component

**Files:**
- Create: `src/lib/features/browse/creators/components/profile/FollowersModal.svelte`

Modal showing followers or following list, triggered by tapping stat counts in the hero. Reuses existing BaseModal + ModalHeader + the user-list-card pattern from the old ProfileTabs.

- [ ] **Step 1: Create FollowersModal.svelte**

```svelte
<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import ModalHeader from "$lib/shared/foundation/ui/modal/ModalHeader.svelte";
  import PanelState from "$lib/shared/components/panel/PanelState.svelte";
  import AvatarImage from "./AvatarImage.svelte";
  import type { UserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";

  type ListType = "followers" | "following";

  let {
    open = $bindable(false),
    listType,
    users,
    isLoading,
    onUserClick,
  }: {
    open: boolean;
    listType: ListType;
    users: readonly UserProfile[];
    isLoading: boolean;
    onUserClick: (user: UserProfile) => void;
  } = $props();

  const title = $derived(listType === "followers" ? "Followers" : "Following");
  const icon = $derived(listType === "followers" ? "fa-users" : "fa-user-plus");
  const emptyTitle = $derived(listType === "followers" ? "No Followers Yet" : "Not Following Anyone");
  const emptyMessage = $derived(
    listType === "followers"
      ? "This user doesn't have any followers yet"
      : "This user isn't following anyone yet"
  );

  function handleUserClick(user: UserProfile) {
    open = false;
    onUserClick(user);
  }
</script>

<BaseModal bind:open size="md" animation="pop">
  {#snippet header()}
    <ModalHeader
      {title}
      icon={icon}
      showClose
      onClose={() => (open = false)}
    />
  {/snippet}

  <div class="followers-list">
    {#if isLoading}
      <PanelState type="loading" message="Loading {listType}..." />
    {:else if users.length === 0}
      <PanelState
        type="empty"
        icon={icon}
        title={emptyTitle}
        message={emptyMessage}
      />
    {:else}
      <div class="user-list">
        {#each users as user (user.id)}
          <button
            class="user-card"
            onclick={() => handleUserClick(user)}
            aria-label="View profile of {user.displayName}"
          >
            <div class="user-avatar">
              <AvatarImage src={user.avatar} alt={user.displayName} size={48} />
            </div>
            <div class="user-info">
              <h4 class="user-name">{user.displayName}</h4>
              <p class="user-username">@{user.username}</p>
            </div>
            <div class="user-stats">
              <span class="user-stat">
                <i class="fas fa-list" aria-hidden="true"></i>
                {user.sequenceCount}
              </span>
              <span class="user-stat">
                <i class="fas fa-users" aria-hidden="true"></i>
                {user.followerCount}
              </span>
            </div>
            <i class="fas fa-chevron-right user-arrow" aria-hidden="true"></i>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</BaseModal>

<style>
  .followers-list {
    padding: 16px;
  }

  .user-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .user-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    text-align: left;
    width: 100%;
  }

  .user-card:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    transform: translateX(4px);
  }

  .user-avatar {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    flex-shrink: 0;
  }

  .user-info {
    flex: 1;
    min-width: 0;
  }

  .user-name {
    margin: 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text, white);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-username {
    margin: 2px 0 0 0;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-stats {
    display: flex;
    gap: 12px;
    flex-shrink: 0;
  }

  .user-stat {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .user-stat i {
    font-size: var(--font-size-compact);
  }

  .user-arrow {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
    flex-shrink: 0;
    transition: transform var(--duration-normal) ease;
  }

  .user-card:hover .user-arrow {
    transform: translateX(4px);
  }

  @media (prefers-reduced-motion: reduce) {
    .user-card {
      transition: none;
    }

    .user-card:hover {
      transform: none;
    }

    .user-arrow,
    .user-card:hover .user-arrow {
      transition: none;
      transform: none;
    }
  }
</style>
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/browse/creators/components/profile/FollowersModal.svelte
git commit -m "feat(profile): add FollowersModal — followers/following via hero stat taps"
```

---

### Task 6: ProfileTabs Rewrite

**Files:**
- Modify: `src/lib/features/browse/creators/components/profile/ProfileTabs.svelte` (full rewrite)

Replace the 3-tab layout (gallery/followers/following) with content-type tabs (All | Sequences | Compositions | Mandalas | Acts). Only show tabs for types the user has content for. Gallery cards stripped to thumbnail-only with star count overlay. Followers/Following tabs removed (now in FollowersModal).

- [ ] **Step 1: Rewrite ProfileTabs.svelte**

```svelte
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import { onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import PanelTabs from "$lib/shared/components/panel/PanelTabs.svelte";
  import PanelState from "$lib/shared/components/panel/PanelState.svelte";
  import type { LibrarySequence } from "$lib/features/library/domain/models/LibrarySequence";
  import PropAwareThumbnail from "$lib/features/browse/sequences/display/components/PropAwareThumbnail.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

  let {
    userSequences = [],
    onSequenceClick,
  }: {
    userSequences?: readonly LibrarySequence[];
    onSequenceClick: (sequence: LibrarySequence) => void;
  } = $props();

  let hapticService: IHapticFeedback | undefined;

  let reducedMotion = $state(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  $effect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => { reducedMotion = e.matches; };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  });

  const visibilityManager = getAnimationVisibilityManager();
  let lightMode = $state(!visibilityManager.isDarkMode());

  function handleVisibilityChange() {
    lightMode = !visibilityManager.isDarkMode();
  }

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  $effect(() => {
    visibilityManager.registerObserver(handleVisibilityChange);
    return () => visibilityManager.unregisterObserver(handleVisibilityChange);
  });

  // Content-type tab state
  let activeTab = $state("all");

  // For now, only sequences are loaded. Future: compositions, mandalas, acts.
  // Tabs only shown if that content type has items.
  const tabs = $derived(() => {
    const result: { value: string; label: string; icon: string }[] = [
      { value: "all", label: `All (${userSequences.length})`, icon: "fa-th" },
    ];

    if (userSequences.length > 0) {
      result.push({
        value: "sequences",
        label: `Sequences (${userSequences.length})`,
        icon: "fa-list",
      });
    }

    // Placeholder tabs for future content types.
    // Uncomment when compositions/mandalas/acts are loaded:
    // if (compositions.length > 0) result.push(...)
    // if (mandalas.length > 0) result.push(...)
    // if (acts.length > 0) result.push(...)

    return result;
  });

  const filteredSequences = $derived(() => {
    if (activeTab === "all" || activeTab === "sequences") {
      return userSequences;
    }
    return [];
  });

  function getDisplayName(sequence: LibrarySequence): string {
    if (sequence.word) return sequence.word;

    if (sequence.name) {
      const cleaned = sequence.name
        .replace(/^Circular\s+/i, "")
        .replace(/\s+Sequence$/i, "");
      if (cleaned && !/^Sequence\s+/i.test(cleaned)) return cleaned;
    }

    if (sequence.steps && sequence.steps.length > 0) {
      return `${sequence.steps.length} beats`;
    }

    return "Untitled";
  }

  function handleSequenceClick(sequence: LibrarySequence) {
    hapticService?.trigger("selection");
    onSequenceClick(sequence);
  }
</script>

<div class="tabs-wrapper" transition:fly={{ y: reducedMotion ? 0 : 20, duration: reducedMotion ? 0 : 300, delay: reducedMotion ? 0 : 200 }}>
  {#if tabs().length > 1}
    <PanelTabs
      tabs={tabs()}
      {activeTab}
      onchange={(tab: string) => (activeTab = tab)}
    />
  {/if}
</div>

<div class="gallery-content">
  {#if filteredSequences().length === 0}
    <PanelState
      type="empty"
      icon="fa-list"
      title="No Sequences"
      message="This creator hasn't published any sequences yet."
    />
  {:else}
    <div class="gallery-grid">
      {#each filteredSequences() as sequence (sequence.id)}
        <button
          class="gallery-card"
          onclick={() => handleSequenceClick(sequence)}
          transition:fade={{ duration: reducedMotion ? 0 : 200 }}
          aria-label="View sequence {getDisplayName(sequence)}"
        >
          <div class="card-thumbnail">
            <PropAwareThumbnail {sequence} {lightMode} />
          </div>

          {#if sequence.starCount > 0}
            <div class="star-pill">
              <span class="star-icon">&#9733;</span>
              <span class="star-count">{sequence.starCount}</span>
            </div>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tabs-wrapper {
    container-type: inline-size;
    container-name: tabs-wrapper;
    display: flex;
    justify-content: center;
    margin-bottom: 16px;
  }

  .gallery-content {
    container-type: inline-size;
    container-name: gallery;
    min-height: 300px;
    width: 100%;
  }

  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
  }

  .gallery-card {
    position: relative;
    display: flex;
    flex-direction: column;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    overflow: hidden;
    padding: 0;
    text-align: left;
  }

  .gallery-card:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    transform: translateY(-2px);
    box-shadow: var(--shadow-glass-hover, 0 4px 12px rgba(0,0,0,0.3));
  }

  .card-thumbnail {
    width: 100%;
    container-type: inline-size;
    container-name: sequence-card;
  }

  .star-pill {
    position: absolute;
    bottom: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(8px);
    border-radius: 6px;
    opacity: 0;
    transform: translateY(4px);
    transition: all var(--duration-normal) ease;
    pointer-events: none;
  }

  .gallery-card:hover .star-pill {
    opacity: 1;
    transform: translateY(0);
  }

  .star-icon {
    font-size: 0.7rem;
    color: #f59e0b;
  }

  .star-count {
    font-size: var(--font-size-xs, 11px);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
  }

  /* ═══ Mobile: smaller cards, star always visible ═══ */
  @container gallery (max-width: 640px) {
    .gallery-grid {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 8px;
    }

    .star-pill {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* ═══ 4K / Ultrawide: larger cards ═══ */
  @container gallery (min-width: 2000px) {
    .gallery-grid {
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .gallery-card {
      transition: none;
    }

    .gallery-card:hover {
      transform: none;
    }

    .star-pill {
      opacity: 1;
      transform: none;
      transition: none;
    }
  }

  /* Touch devices: star always visible */
  @media (hover: none) {
    .star-pill {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
```

Key changes from the old ProfileTabs:
- Removed: `activeTab` prop (now internal), `followerUsers`/`followingUsers`/`followersLoading`/`followingLoading` props, `onTabChange` prop, `onUserClick` prop, followers/following tab content, sequence-info/sequence-meta markup, `ProfileTab` type, `AvatarImage` import
- Added: Content-type tab generation (only shows types with content), star-pill overlay, hover reveal animation, touch/reduced-motion handling for star pills, `@container gallery` queries, 4K breakpoint at 2000px
- Renamed: `.sequences-grid` → `.gallery-grid`, `.sequence-card` → `.gallery-card`

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Errors in UserProfilePanel.svelte about removed props (expected — we fix those in Task 7). No errors in ProfileTabs itself.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/browse/creators/components/profile/ProfileTabs.svelte
git commit -m "feat(profile): rewrite tabs — content-type filtering, thumbnail-only cards, star overlay"
```

---

### Task 7: Wire Everything in UserProfilePanel

**Files:**
- Modify: `src/lib/features/browse/creators/components/UserProfilePanel.svelte`

This task restructures the parent orchestrator: removes ProfileStatsGrid (already done in Task 3), adds ProfileShowcase, adds FollowersModal, rewires ProfileTabs with reduced props, adds followers/following modal state + lazy loading triggers, and passes new callbacks to ProfileHeroSection.

- [ ] **Step 1: Rewrite UserProfilePanel.svelte**

Replace the full file contents:

```svelte
<script lang="ts">
  import { getLibraryRepository } from "$lib/features/library/getLibraryRepository";
  import { getHapticFeedback } from "$lib/shared/application/getHapticFeedback";
  import { onMount } from "svelte";
  import { doc, setDoc } from "firebase/firestore";
  import { getUserRepository } from "$lib/shared/community/getUserRepository";
  import { getFirestoreInstance } from "$lib/shared/auth/firebase";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte.ts";
  import type { IUserRepository } from "$lib/shared/community/services/contracts/IUserRepository";
  import type { ILibraryRepository } from "$lib/features/library/services/contracts/ILibraryRepository";
  import type { LibrarySequence } from "$lib/features/library/domain/models/LibrarySequence";
  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import type { UserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import { creatorsViewState } from "../state/creators-view-state.svelte";
  import { browseNavigationState } from "../../shared/state/browse-navigation-state.svelte";
  import PanelState from "$lib/shared/components/panel/PanelState.svelte";
  import ProfileHeaderBar from "./profile/ProfileHeaderBar.svelte";
  import ProfileHeroSection from "./profile/ProfileHeroSection.svelte";
  import ProfileShowcase from "./profile/ProfileShowcase.svelte";
  import ProfileTabs from "./profile/ProfileTabs.svelte";
  import ProfileAdminSection from "./profile/ProfileAdminSection.svelte";
  import ProfileConnectionSection from "./profile/ProfileConnectionSection.svelte";
  import FollowersModal from "./profile/FollowersModal.svelte";
  import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/implementations/SequenceViewerNavigator";

  interface Props {
    userId: string;
    onUserDeleted?: () => void;
  }

  let { userId, onUserDeleted }: Props = $props();

  let userProfile = $state<EnhancedUserProfile | null>(null);
  let userSequences = $state<LibrarySequence[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let followInProgress = $state(false);

  // Followers/Following modal state
  let followersModalOpen = $state(false);
  let followersModalType = $state<"followers" | "following">("followers");
  let followerUsers = $state<UserProfile[]>([]);
  let followingUsers = $state<UserProfile[]>([]);
  let followersLoading = $state(false);
  let followingLoading = $state(false);
  let followersLoaded = $state(false);
  let followingLoaded = $state(false);

  // Services
  let userService: IUserRepository;
  let libraryService: ILibraryRepository;
  let hapticService: IHapticFeedback;

  const currentUserId = $derived(authState.user?.uid);
  const isOwnProfile = $derived(currentUserId === userId);
  const isAdmin = $derived(authState.isAdmin);

  const modalUsers = $derived(followersModalType === "followers" ? followerUsers : followingUsers);
  const modalLoading = $derived(followersModalType === "followers" ? followersLoading : followingLoading);

  function handleAdminUpdate(updates: Partial<EnhancedUserProfile>) {
    if (userProfile) {
      userProfile = { ...userProfile, ...updates };
    }
  }

  async function reconcileCount(uid: string, actualCount: number) {
    try {
      const firestore = await getFirestoreInstance();
      await setDoc(
        doc(firestore, `users/${uid}`),
        { sequenceCount: actualCount },
        { merge: true }
      );
    } catch (err) {
      console.warn("[UserProfilePanel] Failed to reconcile sequenceCount:", err);
    }
  }

  onMount(async () => {
    try {
      userService = getUserRepository();
      libraryService = getLibraryRepository();
      hapticService = getHapticFeedback();

      userProfile = await userService.getUserProfile(userId, currentUserId);

      if (!userProfile) {
        error = "User not found";
        isLoading = false;
        return;
      }

      userSequences = await libraryService.getUserSequences(userId, {
        visibility: isOwnProfile ? undefined : "public",
      });

      const actualCount = userSequences.length;
      if (userProfile.sequenceCount !== actualCount) {
        userProfile = { ...userProfile, sequenceCount: actualCount };
        void reconcileCount(userId, actualCount);
      }

      isLoading = false;
    } catch (err) {
      console.error(`[UserProfilePanel] Error loading profile:`, err);
      error = err instanceof Error ? err.message : "Failed to load profile";
      isLoading = false;
    }
  });

  function handleBack() {
    hapticService?.trigger("selection");
    const location = browseNavigationState.goBack();

    if (!location || location.view === "list") {
      creatorsViewState.goBack();
    } else if (
      location.view === "profile" &&
      location.contextId &&
      location.contextId !== userId
    ) {
      creatorsViewState.viewUserProfile(location.contextId);
    } else {
      creatorsViewState.goBack();
    }
  }

  async function handleFollowToggle() {
    if (!currentUserId || !userProfile) return;
    if (isOwnProfile || followInProgress) return;

    followInProgress = true;
    hapticService?.trigger("selection");

    try {
      if (userProfile.isFollowing) {
        await userService.unfollowUser(currentUserId, userId);
        userProfile = {
          ...userProfile,
          isFollowing: false,
          followerCount: Math.max(0, userProfile.followerCount - 1),
        };
      } else {
        await userService.followUser(currentUserId, userId);
        userProfile = {
          ...userProfile,
          isFollowing: true,
          followerCount: userProfile.followerCount + 1,
        };
      }
    } catch (err) {
      console.error("[UserProfilePanel] Error toggling follow:", err);
      error = "Failed to update follow status";
      userProfile = await userService.getUserProfile(userId, currentUserId);
    } finally {
      followInProgress = false;
    }
  }

  function handleSequenceClick(sequence: LibrarySequence) {
    hapticService?.trigger("selection");
    openSequenceViewer(sequence, {
      returnPath: `/browse/creators/${userId}`,
      returnLabel: userProfile?.displayName ?? "Creator",
      viewingContext: "creator-expression",
    });
  }

  async function loadFollowerUsers() {
    if (followersLoaded || followersLoading) return;
    followersLoading = true;
    try {
      followerUsers = await userService.getFollowers(userId, 50);
      followersLoaded = true;
    } catch (err) {
      console.error("[UserProfilePanel] Error loading followers:", err);
    } finally {
      followersLoading = false;
    }
  }

  async function loadFollowingUsers() {
    if (followingLoaded || followingLoading) return;
    followingLoading = true;
    try {
      followingUsers = await userService.getFollowing(userId, 50);
      followingLoaded = true;
    } catch (err) {
      console.error("[UserProfilePanel] Error loading following:", err);
    } finally {
      followingLoading = false;
    }
  }

  function openFollowersModal(type: "followers" | "following") {
    followersModalType = type;
    followersModalOpen = true;
    if (type === "followers") loadFollowerUsers();
    else loadFollowingUsers();
  }

  function handleUserCardClick(user: UserProfile) {
    hapticService?.trigger("selection");
    browseNavigationState.viewCreatorProfile(user.id, user.displayName);
  }
</script>

<div class="profile-panel">
  {#if isLoading}
    <PanelState type="loading" message="Loading profile..." />
  {:else if error || !userProfile}
    <div class="error-with-action">
      <PanelState
        type="error"
        title="Profile Not Found"
        message={error || "User not found"}
      />
      <PanelButton variant="secondary" onclick={handleBack}>
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        Go Back
      </PanelButton>
    </div>
  {:else}
    <ProfileHeaderBar onBack={handleBack} />

    <div class="profile-content">
      <ProfileHeroSection
        {userProfile}
        {currentUserId}
        {isOwnProfile}
        {followInProgress}
        onFollowToggle={handleFollowToggle}
        onFollowersClick={() => openFollowersModal("followers")}
        onFollowingClick={() => openFollowersModal("following")}
      />

      <ProfileShowcase
        pinnedItems={userProfile.pinnedItems ?? []}
        {isOwnProfile}
      />

      <ProfileTabs
        {userSequences}
        onSequenceClick={handleSequenceClick}
      />

      {#if currentUserId && !isOwnProfile}
        <ProfileConnectionSection
          targetUserId={userId}
          targetUserName={userProfile.displayName}
        />
      {/if}

      {#if isAdmin && !isOwnProfile}
        <ProfileAdminSection
          {userProfile}
          onUserUpdated={handleAdminUpdate}
          {onUserDeleted}
        />
      {/if}
    </div>

    <FollowersModal
      bind:open={followersModalOpen}
      listType={followersModalType}
      users={modalUsers}
      isLoading={modalLoading}
      onUserClick={handleUserCardClick}
    />
  {/if}
</div>

<style>
  .profile-panel {
    container-type: inline-size;
    container-name: profile-panel;

    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: transparent;
  }

  .error-with-action {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: 100%;
    height: 100%;
    padding: 40px 20px;
  }

  .profile-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;

    display: flex;
    flex-direction: column;
    align-items: center;
    padding: clamp(16px, 4cqi, 32px);
  }

  .profile-content > :global(*) {
    width: 100%;
    flex-shrink: 0;
  }

  @container profile-panel (max-width: 768px) {
    .profile-content {
      padding: clamp(12px, 3cqi, 20px);
    }
  }

  @container profile-panel (max-width: 480px) {
    .profile-content {
      padding: 12px;
    }
  }

  @container profile-panel (min-width: 1400px) {
    .profile-content {
      padding: clamp(32px, 5cqi, 48px);
    }
  }
</style>
```

Key changes:
- Removed: `ProfileStatsGrid` import/usage, `activeTab` state (now internal to ProfileTabs), follower/following tab switching `$effect`
- Added: `ProfileShowcase` import/usage, `FollowersModal` import/usage, `openFollowersModal()` function, `onFollowersClick`/`onFollowingClick` callbacks passed to hero
- Simplified: ProfileTabs gets only `userSequences` + `onSequenceClick` (no follower data, no tab change callback)

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Clean — all components wired with matching prop interfaces.

- [ ] **Step 3: Verify build passes**

Run: `npm run build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/browse/creators/components/UserProfilePanel.svelte
git commit -m "feat(profile): rewire UserProfilePanel — showcase, followers modal, simplified tabs"
```

---

### Task 8: Responsive and 4K Verification

**Files:**
- Possibly touch: all profile components if adjustments needed

This is the verification pass. No new code unless adjustments surface.

- [ ] **Step 1: Run full typecheck**

Run: `npx tsc --noEmit --pretty 2>&1 | head -50`
Expected: No profile-related errors.

- [ ] **Step 2: Run full build**

Run: `npm run build 2>&1 | tail -30`
Expected: Build succeeds.

- [ ] **Step 3: Run svelte-check**

Run: `npx svelte-check --output human 2>&1 | tail -30`
Expected: No new errors in profile components.

- [ ] **Step 4: Verify responsive behavior works**

Check the spec's responsive rules are implemented:
- Hero: `max-width: 900px`, collapses at `@container hero-section (max-width: 640px)` ✓
- Avatar shrinks to 80px on mobile ✓
- Gallery grid: `minmax(260px, 1fr)` default, `minmax(150px, 1fr)` at `max-width: 640px` ✓
- Showcase: `160px` cards at `max-width: 640px`, `240px` at `min-width: 2000px` ✓
- Star pills always visible on mobile (`@media (hover: none)` + `@container gallery (max-width: 640px)`) ✓
- `prefers-reduced-motion`: all transforms/transitions disabled ✓
- Connection section: `max-width: 800px` (already set) ✓
- Admin section: `max-width: 800px` (already set) ✓

- [ ] **Step 5: Commit any adjustments**

If any fixes were needed:
```bash
git add -u
git commit -m "fix(profile): responsive adjustments from verification pass"
```

If no fixes needed, skip this step.

---

## Spec Coverage Verification

| Spec Requirement | Task |
|---|---|
| Hero horizontal layout (avatar left, info right, follow far right) | Task 2 |
| Stats merged into hero (ProfileStatsGrid deleted) | Task 2, 3 |
| profileColor ambient radial gradient | Task 2 |
| Avatar glow ring using profileColor | Task 2 |
| No card border on hero | Task 2 |
| Hero max-width 900px, centered | Task 2 |
| Hero collapses to centered vertical on mobile (<=640px) | Task 2 |
| Instagram link, props row, bio present | Task 2 |
| Pinned Showcase (1-6 items, any content type) | Task 1, 4 |
| Showcase cards 200x160px desktop, scrollable if >4 | Task 4 |
| Type badges color-coded | Task 4 |
| Polymorphic pinnedItems data model | Task 1 |
| Empty state prompt on own profile | Task 4 |
| Content-type tabs (All, Sequences, etc.) | Task 6 |
| Only show tabs for types with content | Task 6 |
| Followers/Following via hero stat taps -> modal | Task 2, 5, 7 |
| Gallery: thumbnail only, no label, no date, no step count | Task 6 |
| Star count glassmorphic pill overlay, bottom-right | Task 6 |
| Hover reveal pill with translateY micro-animation | Task 6 |
| Always visible on mobile/touch | Task 6 |
| Only shown when starCount > 0 | Task 6 |
| Gallery grid auto-fill minmax(260px, 1fr) | Task 6 |
| 4K: gallery minmax bumps to 300px at 2000px+ | Task 6 |
| 4K: showcase cards grow to 240x180px at 2000px+ | Task 4 |
| Mobile: avatar shrinks to 80px | Task 2 |
| Mobile: gallery minmax(150px, 1fr) | Task 6 |
| Mobile: showcase 160x130px | Task 4 |
| prefers-reduced-motion: all transforms disabled | Task 2, 4, 5, 6 |
| Connection section max-width 800px | Already done |
| Admin section max-width 800px | Already done |

# Hall of Shame - Implementation Plan

## Concept

A curated gallery of the most creative, clever, and vulgar sequences. A place where the moderation system becomes a feature rather than a restriction. Users can lean into the fun of creating inappropriate content while keeping the main public gallery professional.

### The Vision

In the future 3D museum gallery, the Hall of Shame would be a literal corridor with vulgar sequences mounted on the walls like fine art - complete with museum-style placards explaining the "artistic merit" of SHITGIBBON.

---

## Architecture Overview

### Service Decomposition

Following project patterns (single responsibility, no "Service" suffix):

| Service | Responsibility |
|---------|----------------|
| `HallOfShameSubmitter` | Submit sequences, get user submissions, withdraw pending |
| `HallOfShameLoader` | Load approved sequences, filtering, pagination |
| `HallOfShameVoter` | Vote operations, vote counts |
| `AgeVerifier` | Age verification status, consent storage |
| `ShameQueueManager` | Admin queue operations, approve/reject |

### DI Container

```typescript
// src/lib/shared/di/containers/hall-of-shame-container.ts
import { createContainer } from "iti";

export interface HallOfShameContainerDeps {
  userRepository: IUserRepository;
  achievementManager: IAchievementManager;
}

export function createHallOfShameContainer(deps: HallOfShameContainerDeps) {
  return createContainer()
    .add({
      ageVerifier: () => new AgeVerifier(deps.userRepository),
    })
    .add((ctx) => ({
      hallOfShameSubmitter: () => new HallOfShameSubmitter(ctx.ageVerifier),
      hallOfShameLoader: () => new HallOfShameLoader(ctx.ageVerifier),
      hallOfShameVoter: () => new HallOfShameVoter(ctx.ageVerifier),
      shameQueueManager: () => new ShameQueueManager(),
    }))
    .add((ctx) => ({
      // Achievements integration (Phase 4)
      shameAchievementTracker: () => new ShameAchievementTracker(
        deps.achievementManager,
        ctx.hallOfShameLoader
      ),
    }));
}
```

### File Structure

```
src/lib/features/hall-of-shame/
├── domain/
│   └── models/
│       └── hall-of-shame-models.ts
├── services/
│   ├── contracts/
│   │   ├── IAgeVerifier.ts
│   │   ├── IHallOfShameSubmitter.ts
│   │   ├── IHallOfShameLoader.ts
│   │   ├── IHallOfShameVoter.ts
│   │   └── IShameQueueManager.ts
│   └── implementations/
│       ├── AgeVerifier.ts
│       ├── HallOfShameSubmitter.ts
│       ├── HallOfShameLoader.ts
│       ├── HallOfShameVoter.ts
│       └── ShameQueueManager.ts
├── components/
│   ├── HallOfShameGate.svelte
│   ├── HallOfShameGallery.svelte
│   ├── ShameSequenceCard.svelte
│   ├── ShameSubmissionFlow.svelte
│   └── CensoredWordReveal.svelte
└── guards/
    └── age-verification-guard.ts
```

---

## Phase 1: Age-Gated Adult Section

### Overview

Add an age-gated section of the Discover gallery specifically for flagged content. When content is caught by moderation, users can opt to submit it to the Hall of Shame instead of appealing.

### Firestore Structure

```typescript
// /hallOfShame/{sequenceId}
interface HallOfShameEntry {
  id: string;

  // Source reference
  sourceSequenceId: string;        // Original sequence ID
  ownerId: string;
  ownerDisplayName: string;
  ownerUsername?: string;

  // Content
  word: string;
  displayName?: string;            // Optional custom display name
  thumbnails: string[];
  sequenceLength: number;
  difficulty?: number;

  // Moderation
  flaggedTerms: FlaggedTerm[];
  category: ShameCategory;         // 'profanity' | 'sexual' | 'creative'

  // Lifecycle
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Timestamp;
  approvedAt?: Timestamp;
  approvedBy?: string;
  rejectedAt?: Timestamp;
  rejectedBy?: string;
  rejectionReason?: string;

  // Features
  featured: boolean;               // Editor's pick
  featuredAt?: Timestamp;
  featuredBy?: string;

  // Engagement
  voteCount: number;
  viewCount: number;

  // Safety
  reportCount: number;             // Post-approval reports
  lastReportedAt?: Timestamp;
  hidden: boolean;                 // Admin can hide without deleting
}

// /hallOfShameVotes/{odwnerId}_{sequenceId}
interface HallOfShameVote {
  odwnerId: string;        // Who cast the vote
  sequenceId: string;      // Which sequence was voted on
  votedAt: Timestamp;
}

// User profile addition
interface UserProfile {
  // ... existing fields
  ageVerifiedAt?: Timestamp;       // null = not verified
}
```

### Category Definitions

| Category | Description | Examples |
|----------|-------------|----------|
| `profanity` | Common swear words | FUCK, SHIT, DAMN |
| `sexual` | Sexual/anatomical content | PENIS, BOOBS |
| `creative` | Clever/cheeky but not vulgar | BUTTS (borderline), puns |

**Note:** Slurs and hate speech are NEVER allowed, even in Hall of Shame. The moderation system blocks these entirely.

---

## Service Contracts

### IAgeVerifier

```typescript
// services/contracts/IAgeVerifier.ts
export interface IAgeVerifier {
  /** Check if user has verified their age */
  isVerified(userId: string): Promise<boolean>;

  /** Record age verification consent */
  recordVerification(userId: string): Promise<void>;

  /** Get verification timestamp (null if not verified) */
  getVerificationDate(userId: string): Promise<Date | null>;
}
```

### IHallOfShameSubmitter

```typescript
// services/contracts/IHallOfShameSubmitter.ts
export interface IHallOfShameSubmitter {
  /** Submit a flagged sequence to Hall of Shame */
  submit(params: ShameSubmissionParams): Promise<string>;

  /** Get user's submissions (pending and approved) */
  getUserSubmissions(userId: string): Promise<HallOfShameEntry[]>;

  /** Withdraw a pending submission */
  withdraw(sequenceId: string, userId: string): Promise<void>;

  /** Check if sequence is already submitted */
  isSubmitted(sourceSequenceId: string): Promise<boolean>;
}

export interface ShameSubmissionParams {
  sourceSequenceId: string;
  userId: string;
  word: string;
  thumbnails: string[];
  sequenceLength: number;
  flaggedTerms: FlaggedTerm[];
  category: ShameCategory;
  displayName?: string;
}
```

### IHallOfShameLoader

```typescript
// services/contracts/IHallOfShameLoader.ts
export interface IHallOfShameLoader {
  /** Load approved sequences with filtering */
  loadApproved(params: ShameLoadParams): Promise<PaginatedResult<HallOfShameEntry>>;

  /** Load featured sequences */
  loadFeatured(limit?: number): Promise<HallOfShameEntry[]>;

  /** Get single entry by ID */
  getEntry(sequenceId: string): Promise<HallOfShameEntry | null>;

  /** Get entry count by category */
  getCategoryCounts(): Promise<Record<ShameCategory, number>>;
}

export interface ShameLoadParams {
  category?: ShameCategory;
  sortBy: 'newest' | 'mostVoted' | 'mostViewed';
  limit: number;
  cursor?: string;
}
```

### IHallOfShameVoter

```typescript
// services/contracts/IHallOfShameVoter.ts
export interface IHallOfShameVoter {
  /** Vote for a sequence (idempotent) */
  vote(sequenceId: string, odwnerId: string): Promise<void>;

  /** Check if user has voted */
  hasVoted(sequenceId: string, odwnerId: string): Promise<boolean>;

  /** Get vote count for sequence */
  getVoteCount(sequenceId: string): Promise<number>;
}
```

### IShameQueueManager

```typescript
// services/contracts/IShameQueueManager.ts
export interface IShameQueueManager {
  /** Get pending submissions for admin review */
  getPendingQueue(): Promise<HallOfShameEntry[]>;

  /** Approve a submission */
  approve(sequenceId: string, adminId: string, category?: ShameCategory): Promise<void>;

  /** Reject a submission */
  reject(sequenceId: string, adminId: string, reason: string): Promise<void>;

  /** Feature/unfeature a sequence */
  setFeatured(sequenceId: string, adminId: string, featured: boolean): Promise<void>;

  /** Hide a sequence (for post-approval issues) */
  setHidden(sequenceId: string, adminId: string, hidden: boolean): Promise<void>;

  /** Get pending count for admin badge */
  getPendingCount(): Promise<number>;
}
```

---

## Components

### HallOfShameGate.svelte

Age verification modal using existing `BaseModal` pattern.

```svelte
<script lang="ts">
  import BaseModal from '$lib/shared/foundation/ui/modal/BaseModal.svelte';
  import ModalHeader from '$lib/shared/foundation/ui/modal/ModalHeader.svelte';
  import ModalFooter from '$lib/shared/foundation/ui/modal/ModalFooter.svelte';
  import { container } from '$lib/shared/di';

  interface Props {
    onVerified: () => void;
    onCancel: () => void;
  }

  let { onVerified, onCancel }: Props = $props();

  let isOpen = $state(true);
  let confirmed = $state(false);
  let isSubmitting = $state(false);

  async function handleConfirm() {
    if (!confirmed) return;

    isSubmitting = true;
    try {
      const ageVerifier = container.items.ageVerifier;
      const userId = container.items.authenticator?.currentUser?.uid;
      if (userId) {
        await ageVerifier.recordVerification(userId);
      }
      onVerified();
    } finally {
      isSubmitting = false;
    }
  }
</script>

<BaseModal bind:open={isOpen} onclose={onCancel} size="sm">
  {#snippet header()}
    <ModalHeader
      title="Age Verification Required"
      subtitle="This section contains adult content"
      icon="fa-skull"
      iconColor="#ef4444"
      onClose={onCancel}
    />
  {/snippet}

  <div class="gate-content">
    <p class="warning-text">
      The Hall of Shame contains vulgar and adult-themed content
      that has been flagged by our moderation system.
    </p>

    <label class="checkbox-label">
      <input type="checkbox" bind:checked={confirmed} />
      <span>I confirm I am 18 years or older</span>
    </label>
  </div>

  {#snippet footer()}
    <ModalFooter>
      <button class="secondary" onclick={onCancel}>Cancel</button>
      <button
        class="primary danger"
        onclick={handleConfirm}
        disabled={!confirmed || isSubmitting}
      >
        Enter Hall of Shame
      </button>
    </ModalFooter>
  {/snippet}
</BaseModal>
```

### HallOfShameGallery.svelte

Gallery view with loading/empty/error states.

**Required states:**
- Loading: Skeleton cards
- Empty: "No sequences yet. Be the first to submit something shameful!"
- Error: "Failed to load. Try again." with retry button
- Success: Grid of `ShameSequenceCard` components

**Features:**
- Category tabs: All | Profanity | Sexual | Creative
- Sort dropdown: Newest | Most Voted | Most Viewed
- Featured section at top (if any featured exist)
- Infinite scroll or "Load More" pagination

### ShameSequenceCard.svelte

Card component for gallery display.

**Features:**
- Blurred/censored thumbnail by default
- "Reveal" button that shows content (with animation respecting `prefers-reduced-motion`)
- Vote button with count
- Creator attribution
- Featured badge if applicable
- Category badge

### ShameSubmissionFlow.svelte

Integrated into `SaveToLibraryPanel.svelte` when content is flagged.

```svelte
<!-- Within moderation warning section -->
<div class="moderation-actions">
  <button class="action-btn secondary" onclick={handleKeepPrivate}>
    <i class="fas fa-lock" aria-hidden="true"></i>
    Keep Private
  </button>

  <button class="action-btn shame" onclick={handleSubmitToShame}>
    <i class="fas fa-skull" aria-hidden="true"></i>
    Hall of Shame
  </button>

  <button class="action-btn" onclick={handleOpenAppeal}>
    <i class="fas fa-gavel" aria-hidden="true"></i>
    Appeal
  </button>
</div>
```

---

## Deep-Link Prevention

**Problem:** Users could share URLs to Hall of Shame content, bypassing the age gate.

**Solution:** Route guard that checks verification before rendering.

```typescript
// guards/age-verification-guard.ts
export async function requireAgeVerification(): Promise<boolean> {
  const ageVerifier = container.items.ageVerifier;
  const userId = container.items.authenticator?.currentUser?.uid;

  if (!userId) {
    // Not logged in - redirect to login
    goto('/login?redirect=/hall-of-shame');
    return false;
  }

  const isVerified = await ageVerifier.isVerified(userId);
  if (!isVerified) {
    // Show gate modal - don't navigate away
    showAgeGateModal();
    return false;
  }

  return true;
}
```

**Route protection in `+page.svelte`:**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { requireAgeVerification } from '../guards/age-verification-guard';

  let verified = $state(false);
  let checking = $state(true);

  onMount(async () => {
    verified = await requireAgeVerification();
    checking = false;
  });
</script>

{#if checking}
  <LoadingSpinner />
{:else if verified}
  <HallOfShameGallery />
{:else}
  <!-- Gate modal is shown by the guard -->
  <div class="blocked-placeholder">
    <p>Age verification required to view this content.</p>
  </div>
{/if}
```

**SEO protection:**
- Add `<meta name="robots" content="noindex, nofollow">` to Hall of Shame pages
- Exclude from sitemap

---

## Firestore Rules

```javascript
// Add to firestore.rules

// Helper function for age verification
function isAgeVerified() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.ageVerifiedAt != null;
}

// Hall of Shame entries
match /hallOfShame/{sequenceId} {
  // Age-verified users can read approved, non-hidden entries
  allow read: if isAuthenticated()
    && isAgeVerified()
    && (resource.data.status == 'approved' || resource.data.ownerId == request.auth.uid)
    && resource.data.hidden != true;

  // Users can submit their own sequences (pending status only)
  allow create: if isAuthenticated()
    && request.resource.data.ownerId == request.auth.uid
    && request.resource.data.status == 'pending'
    && request.resource.data.voteCount == 0
    && request.resource.data.viewCount == 0
    && request.resource.data.reportCount == 0
    && request.resource.data.featured == false
    && request.resource.data.hidden == false;

  // Only admins can approve/reject/feature/hide
  allow update: if isAdmin();

  // Users can delete their own pending submissions
  allow delete: if isAuthenticated()
    && resource.data.ownerId == request.auth.uid
    && resource.data.status == 'pending';
}

// Hall of Shame votes
match /hallOfShameVotes/{voteId} {
  // Age-verified users can read and create votes
  allow read: if isAuthenticated() && isAgeVerified();

  // One vote per user per sequence (voteId = odwnerId_sequenceId)
  allow create: if isAuthenticated()
    && isAgeVerified()
    && voteId == request.auth.uid + '_' + request.resource.data.sequenceId
    && request.resource.data.odwnerId == request.auth.uid;

  // Votes cannot be changed or deleted
  allow update, delete: if false;
}
```

### Required Indexes

```
// firestore.indexes.json additions
{
  "collectionGroup": "hallOfShame",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "submittedAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "hallOfShame",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "category", "order": "ASCENDING" },
    { "fieldPath": "voteCount", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "hallOfShame",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "featured", "order": "DESCENDING" },
    { "fieldPath": "featuredAt", "order": "DESCENDING" }
  ]
}
```

---

## Admin Interface

### ShameQueuePanel.svelte

Admin panel for reviewing submissions. Integrated into existing admin module.

**Features:**
- List of pending submissions with preview
- Approve button (opens category selector if needed)
- Reject button (requires reason)
- Feature toggle for approved content
- Hide toggle for problematic approved content
- Pending count badge in admin nav

### Admin Notification

**In-app notification:**
- Badge on admin nav item showing pending count
- Use existing notification pattern from feedback module

**Optional email (future):**
- Daily digest if pending > 0
- Configurable in admin settings

---

## Phase 2: Integration with Moderation

### Modified Flow

When content is flagged:

1. **Current**: Show warning, offer appeal
2. **New**: Show warning, offer three options:
   - Keep Private (saves privately, no public visibility)
   - Submit to Hall of Shame (enters moderation queue, requires age verification)
   - Appeal (existing flow for false positives)

### Update SaveToLibraryPanel.svelte

The moderation warning section already exists. Add "Hall of Shame" button:

```svelte
{#if isFlagged && flaggedTerms.length > 0}
  <div class="moderation-warning" data-animate="warning">
    <!-- existing warning content -->

    <div class="moderation-actions">
      <button class="action-btn" onclick={handleOpenAppeal}>
        <i class="fas fa-gavel" aria-hidden="true"></i>
        Appeal Decision
      </button>

      <button class="action-btn shame" onclick={handleSubmitToShame}>
        <i class="fas fa-skull" aria-hidden="true"></i>
        Hall of Shame
      </button>
    </div>

    <p class="action-hint">
      Think it's actually funny? Submit it to the Hall of Shame for other adults to enjoy.
    </p>
  </div>
{/if}
```

### Age Verification Flow

1. User clicks "Hall of Shame" button
2. Check `ageVerifier.isVerified(userId)`
3. If not verified: show `HallOfShameGate.svelte` modal
4. On verification: proceed to submission
5. Store `ageVerifiedAt` in user profile (persists across sessions)

---

## Phase 3: 3D Museum Integration (Future)

When the 3D museum gallery is built (using `infinite-worlds` module):

### Hall of Shame Corridor

- Separate wing of the museum with distinct atmosphere
- Dark, dramatic lighting with red accents
- Sequences displayed in ornate gilded frames
- Museum-style placards with:
  - Sequence name in elegant serif font
  - Creator attribution
  - "Flagged for: profanity, 2025"
  - Upvote count displayed as "appreciation cards"

### Integration Point

```typescript
// Interface for museum gallery destinations
export interface IMuseumDestination {
  id: string;
  name: string;
  description: string;
  position: Vector3;
  loadContent: () => Promise<GalleryContent[]>;
  atmosphereSettings: AtmosphereConfig;
}

// Hall of Shame as a destination
const hallOfShameDestination: IMuseumDestination = {
  id: 'hall-of-shame',
  name: 'Hall of Shame',
  description: 'A curated collection of creative vulgarity',
  position: new Vector3(-50, 0, 0), // West wing
  loadContent: async () => {
    const loader = container.items.hallOfShameLoader;
    const entries = await loader.loadApproved({ sortBy: 'mostVoted', limit: 50 });
    return entries.items.map(toGalleryContent);
  },
  atmosphereSettings: {
    ambientColor: '#1a0a0a',
    accentColor: '#ef4444',
    lightIntensity: 0.6,
  },
};
```

### Interactive Elements

- Walk up to a frame to see full sequence animation
- "Visitor Comments" section (heavily moderated)
- Monthly "Artist of Shame" spotlight
- Special audio ambiance (subtle, ominous)

---

## Phase 4: Gamification

### Achievement Integration

Uses existing `AchievementManager` from gamification module.

```typescript
// New achievements to register
const SHAME_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-shame',
    name: 'First Shame',
    description: 'Get a sequence approved to the Hall of Shame',
    icon: 'skull',
    category: 'hall-of-shame',
    criteria: { type: 'shame-approved', count: 1 },
  },
  {
    id: 'shame-artist',
    name: 'Shame Artist',
    description: 'Have 5 sequences in the Hall of Shame',
    icon: 'skull-crossbones',
    category: 'hall-of-shame',
    criteria: { type: 'shame-approved', count: 5 },
  },
  {
    id: 'vulgarity-virtuoso',
    name: 'Vulgarity Virtuoso',
    description: 'Have 10 sequences in the Hall of Shame',
    icon: 'poop',
    category: 'hall-of-shame',
    criteria: { type: 'shame-approved', count: 10 },
  },
  {
    id: 'editors-disgrace',
    name: "Editor's Disgrace",
    description: 'Get featured as an Editor\'s Pick',
    icon: 'crown',
    category: 'hall-of-shame',
    criteria: { type: 'shame-featured', count: 1 },
  },
  {
    id: 'crowd-pleaser',
    name: 'Crowd Pleaser',
    description: 'Get 100+ upvotes on a Hall of Shame sequence',
    icon: 'fire',
    category: 'hall-of-shame',
    criteria: { type: 'shame-votes', count: 100 },
  },
];
```

### ShameAchievementTracker

```typescript
// services/implementations/ShameAchievementTracker.ts
export class ShameAchievementTracker {
  constructor(
    private achievementManager: IAchievementManager,
    private hallOfShameLoader: IHallOfShameLoader
  ) {}

  async onSequenceApproved(userId: string): Promise<void> {
    const submissions = await this.hallOfShameLoader.loadApproved({
      odwnerId: userId,
      sortBy: 'newest',
      limit: 100,
    });

    const count = submissions.items.length;

    if (count >= 1) await this.achievementManager.unlock(userId, 'first-shame');
    if (count >= 5) await this.achievementManager.unlock(userId, 'shame-artist');
    if (count >= 10) await this.achievementManager.unlock(userId, 'vulgarity-virtuoso');
  }

  async onSequenceFeatured(userId: string): Promise<void> {
    await this.achievementManager.unlock(userId, 'editors-disgrace');
  }

  async onVoteReceived(userId: string, sequenceId: string): Promise<void> {
    const entry = await this.hallOfShameLoader.getEntry(sequenceId);
    if (entry && entry.voteCount >= 100) {
      await this.achievementManager.unlock(userId, 'crowd-pleaser');
    }
  }
}
```

### Leaderboard (Optional)

"Most Shameful Creators" - opt-in leaderboard:
- Shows creators ranked by total upvotes across all Hall of Shame sequences
- Only visible to age-verified users
- Requires explicit opt-in from user (privacy setting)

---

## Rejection & Reporting Flow

### When Admin Rejects a Submission

1. Entry status changes to `rejected`
2. `rejectedAt`, `rejectedBy`, `rejectionReason` populated
3. User receives notification (if notifications enabled)
4. Entry remains in user's submission history (marked as rejected)
5. User can resubmit with modifications if desired

### Post-Approval Reporting

If users report approved content:

1. `reportCount` increments, `lastReportedAt` updated
2. At threshold (e.g., 5 reports), admin notified
3. Admin can:
   - Dismiss reports (no action)
   - Hide entry (`hidden: true`) - still exists but not visible
   - Delete entry (permanent removal)

### Content Removal by Owner

- Users can delete their own **pending** submissions
- Users **cannot** delete their own **approved** submissions (preserves integrity)
- Users can request admin delete approved content (via support)

---

## Rate Limiting

### Submission Limits

- 3 submissions per user per day
- Prevents spam while allowing genuine creative expression
- Counter resets at midnight UTC

### Vote Limits

- No limit on total votes
- One vote per user per sequence (enforced by Firestore rules)
- No un-voting (votes are permanent)

---

## Implementation Order

### MVP (Phase 1.5)

**Week 1:**
1. [ ] Create domain models (`hall-of-shame-models.ts`)
2. [ ] Create service interfaces (all 5 contracts)
3. [ ] Implement `AgeVerifier` service
4. [ ] Add `isAgeVerified()` helper to Firestore rules
5. [ ] Create `HallOfShameGate.svelte` component

**Week 2:**
6. [ ] Implement `HallOfShameSubmitter` service
7. [ ] Add "Hall of Shame" button to `SaveToLibraryPanel.svelte`
8. [ ] Create `ShameSubmissionFlow.svelte` (minimal)
9. [ ] Implement `ShameQueueManager` service
10. [ ] Create `ShameQueuePanel.svelte` in admin module

**Week 3:**
11. [ ] Implement `HallOfShameLoader` service
12. [ ] Create `HallOfShameGallery.svelte` with all states
13. [ ] Create `ShameSequenceCard.svelte`
14. [ ] Add route with age verification guard
15. [ ] Add pending count badge to admin nav

### Full Feature (Phase 2)

16. [ ] Implement `HallOfShameVoter` service
17. [ ] Add voting UI to cards
18. [ ] Add category filtering and sorting
19. [ ] Featured sequences section
20. [ ] View count tracking

### Gamification (Phase 4)

21. [ ] Register shame achievements
22. [ ] Implement `ShameAchievementTracker`
23. [ ] Achievement unlock triggers
24. [ ] Optional leaderboard

### 3D Museum (Phase 3 - depends on infinite-worlds)

25. [ ] Define museum destination interface
26. [ ] Create Hall of Shame corridor assets
27. [ ] Implement content loading for museum
28. [ ] Atmosphere and lighting setup

---

## Answered Questions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Submission limit? | 3 per day | Prevents spam, allows creativity |
| Multiple categories? | No, single category | Simpler UX, admin picks best fit |
| User-generated categories? | No | Too complex, moderation burden |
| Commenting/reactions? | Not in MVP | Could get out of hand, revisit later |
| Excluded from search? | Yes | SEO exclusion, no indexing |
| Can users delete approved? | No | Preserves gallery integrity |
| How are admins notified? | Badge + optional email | Non-intrusive but visible |

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Content moderation system | ✅ Implemented | Provides flaggedTerms |
| User profile system | ✅ Exists | Add ageVerifiedAt field |
| Admin module | ✅ Exists | Add ShameQueuePanel |
| Achievement system | ✅ Exists | Register new achievements |
| BaseModal pattern | ✅ Exists | Use for HallOfShameGate |
| 3D museum (infinite-worlds) | 🚧 In progress | Phase 3 depends on this |

---

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Age verification is honor-system | Acceptable - we can't truly verify age. Legal disclaimer sufficient. |
| Deep-link bypass | Route guard + server-side age check before returning data |
| Vote manipulation | One vote per user enforced by Firestore rules + document ID pattern |
| Admin impersonation | isAdmin() check in Firestore rules |
| Slurs/hate speech in Hall | ContentModerator blocks these entirely - they can't be submitted |
| SEO indexing | noindex meta tag + sitemap exclusion |
| Post-approval abuse | Report system + admin hide capability |

---

## Testing Checklist

### Unit Tests

- [ ] AgeVerifier: isVerified, recordVerification
- [ ] HallOfShameSubmitter: submit, withdraw, validation
- [ ] HallOfShameVoter: vote idempotency, hasVoted
- [ ] ShameQueueManager: approve, reject, state transitions

### Integration Tests

- [ ] Full submission flow: flag -> submit -> approve -> display
- [ ] Age gate blocks unverified users
- [ ] Deep-link protection works
- [ ] Votes increment correctly

### Manual Testing

- [ ] Submit sequence with profanity, verify appears in queue
- [ ] Admin approve, verify appears in gallery
- [ ] Vote as different user, verify count updates
- [ ] Try to access without age verification, verify gate appears
- [ ] Share URL to friend, verify they must verify age too

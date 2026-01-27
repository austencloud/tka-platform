# PostHog Analytics Integration Plan

**Goal:** Replace homebrew activity tracking with PostHog for generational-quality analytics infrastructure.

**Why PostHog:**
- 1M events/month free tier (won't pay for years)
- First-class SvelteKit support
- Open source (self-hostable if they disappear in 20 years)
- All-in-one: analytics, session replay, feature flags, A/B tests, error tracking
- HogQL for SQL-like queries via API
- 7-year data retention on paid plans

---

## Current State Assessment

### What We Have

**Event Model** (`src/lib/shared/analytics/domain/models/ActivityEvent.ts`):
- 8 categories: session, navigation, sequence, share, social, learn, achievement, settings
- 40+ typed events with rich metadata
- Well-structured ActivityMetadata fields

**Dual Logging Architecture:**
1. **Firestore** (`users/{userId}/activityLog`) - Per-user queryable history
2. **Firebase Analytics** - Aggregate metrics, demographics, geography

**Services:**
- `IActivityLogger` - Main logging interface with buffering
- `ISessionTracker` - Session management with 30-min timeout
- `IUserActivityTracker` - Admin queries for user activity
- `IAnalyticsDataProvider` - Dashboard data aggregation

**What Works Well:**
- Typed event model with rich metadata
- Service-based architecture with DI
- Session grouping built-in

**What Doesn't Work:**
- Raw event streams in admin UI aren't useful
- No cohort analysis, retention curves, funnels
- No session replay
- Building our own aggregation layer is reinventing the wheel
- Firebase Analytics console is clunky and limited

---

## Architecture Decision

### Keep vs Replace

| Component | Decision | Rationale |
|-----------|----------|-----------|
| Event type definitions | **KEEP** | Well-designed, map directly to PostHog events |
| `IActivityLogger` interface | **ADAPT** | Interface stays, implementation changes to PostHog |
| `ISessionTracker` | **REMOVE** | PostHog handles sessions automatically |
| Firestore `activityLog` | **REMOVE** | PostHog stores all events |
| Firebase Analytics | **REMOVE** | PostHog replaces it entirely |
| `IUserActivityTracker` | **ADAPT** | Fetches from PostHog API instead |
| `IAnalyticsDataProvider` | **SIMPLIFY** | Much simpler - PostHog does the heavy lifting |
| Admin UserDetailModal | **REDESIGN** | Show meaningful metrics, not raw events |

### New Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SvelteKit App                           │
├─────────────────────────────────────────────────────────────┤
│  IActivityLogger (PostHog implementation)                   │
│    └── posthog.capture(event, properties)                   │
├─────────────────────────────────────────────────────────────┤
│  PostHog JS SDK                                             │
│    - Auto-captures pageviews, clicks                        │
│    - Session recording                                      │
│    - Feature flags                                          │
├─────────────────────────────────────────────────────────────┤
│                     PostHog Cloud                           │
│    - Event storage (7 years)                                │
│    - HogQL queries                                          │
│    - Cohort analysis                                        │
│    - Retention, funnels, paths                              │
│    - Session replays                                        │
└─────────────────────────────────────────────────────────────┘
           │
           │ API (HogQL queries)
           ▼
┌─────────────────────────────────────────────────────────────┐
│  Admin Dashboard                                            │
│    - Per-user metrics via Persons API                       │
│    - Aggregate stats via Insights API                       │
│    - Session replay embeds                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: PostHog Setup & Basic Integration

**Tasks:**
1. Create PostHog account and project
2. Get project API key and host URL
3. Install `posthog-js` package
4. Initialize PostHog in `+layout.js`
5. Configure session recording (opt-in for now)
6. Set up reverse proxy via SvelteKit hooks (avoid ad blockers)

**Files to create/modify:**
- `src/routes/+layout.js` - PostHog initialization
- `src/hooks.server.ts` - Reverse proxy for PostHog
- `.env` - Add `PUBLIC_POSTHOG_KEY` and `PUBLIC_POSTHOG_HOST`
- `svelte.config.js` - Disable relative paths for session recording

**Verification:**
- Events appear in PostHog dashboard
- Session recordings capture correctly
- No ad blocker interference via proxy

---

### Phase 2: Migrate Event Logging

**Tasks:**
1. Create `PostHogActivityLogger` implementing `IActivityLogger`
2. Map existing event types to PostHog events
3. Preserve metadata structure as PostHog properties
4. Update DI container to use new implementation
5. Keep interface unchanged - consumers don't know the difference

**Event Mapping:**

```typescript
// Current: activityLogger.log('sequence_create', 'sequence', metadata)
// PostHog: posthog.capture('sequence_create', {
//   category: 'sequence',
//   sequence_id: metadata.sequenceId,
//   word: metadata.sequenceWord,
//   length: metadata.sequenceLength,
//   ...
// })
```

**User Identification:**

```typescript
// On auth state change
posthog.identify(userId, {
  email: user.email,
  name: user.displayName,
  role: user.role,
  created_at: user.createdAt
});

// On logout
posthog.reset();
```

**Files to create/modify:**
- `src/lib/shared/analytics/services/implementations/PostHogActivityLogger.ts` - New implementation
- `src/lib/shared/di/containers/analytics-container.ts` - Switch to PostHog logger
- `src/lib/shared/auth/state/authState.svelte.ts` - User identification

**Verification:**
- All 40+ event types appear in PostHog
- User profiles link to events
- Properties searchable/filterable

---

### Phase 3: Remove Legacy Infrastructure

**Tasks:**
1. Remove `SessionTracker` (PostHog handles this)
2. Remove Firestore `activityLog` writes
3. Remove Firebase Analytics logging
4. Remove buffer/flush logic (PostHog SDK handles batching)
5. Clean up dead code

**Files to delete:**
- `src/lib/shared/analytics/services/implementations/SessionTracker.ts`
- `src/lib/shared/analytics/services/contracts/ISessionTracker.ts`

**Files to modify:**
- `src/lib/shared/analytics/services/implementations/ActivityLogger.ts` - Delete entirely
- `src/lib/shared/di/containers/analytics-container.ts` - Remove SessionTracker

**Data Migration:**
- Historical Firestore data stays (read-only archive)
- New events only go to PostHog
- Consider one-time import of historical events to PostHog (optional)

---

### Phase 4: Admin User Detail Redesign

**The big win.** Replace raw event streams with meaningful metrics.

**New UserDetailModal Activity Section:**

```
┌─────────────────────────────────────────────────────────────┐
│  ENGAGEMENT SUMMARY                                         │
├─────────────────────────────────────────────────────────────┤
│  Last active: 2 hours ago                                   │
│  Member since: 3 months ago                                 │
│  Sessions this week: 4  │  Avg duration: 12 min            │
├─────────────────────────────────────────────────────────────┤
│  ACTIVITY BREAKDOWN                    [This Week ▼]        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ████████████████████░░░░░  Browse      60%         │   │
│  │ ██████████░░░░░░░░░░░░░░░  Create      30%         │   │
│  │ ███░░░░░░░░░░░░░░░░░░░░░░  Learn       10%         │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  CONTENT METRICS                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │    12    │ │     8    │ │     3    │ │     1    │       │
│  │ Created  │ │  Saved   │ │ Exported │ │Collection│       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
├─────────────────────────────────────────────────────────────┤
│  RECENT SESSIONS                        [Watch Replay ▶]    │
│  Today 2:30pm      12 min    Browse, Create                 │
│  Yesterday 8pm     18 min    Create, Learn                  │
│  Jan 24 4pm         5 min    Browse                         │
└─────────────────────────────────────────────────────────────┘
```

**Data Sources (PostHog API):**

1. **Engagement Summary** - Persons API + HogQL
   ```sql
   SELECT
     max(timestamp) as last_active,
     min(timestamp) as first_seen,
     count(distinct $session_id) as sessions_this_week,
     avg(session_duration) as avg_duration
   FROM events
   WHERE person_id = '{userId}'
     AND timestamp > now() - interval 7 day
   ```

2. **Activity Breakdown** - HogQL aggregation
   ```sql
   SELECT
     properties.module,
     count(*) as count
   FROM events
   WHERE person_id = '{userId}'
     AND event = 'module_view'
     AND timestamp > now() - interval 7 day
   GROUP BY properties.module
   ```

3. **Content Metrics** - HogQL counts
   ```sql
   SELECT
     countIf(event = 'sequence_create') as created,
     countIf(event = 'sequence_save') as saved,
     countIf(event = 'sequence_export') as exported,
     countIf(event = 'collection_create') as collections
   FROM events
   WHERE person_id = '{userId}'
   ```

4. **Recent Sessions** - Sessions API with replay links

**New Service:**

```typescript
// src/lib/features/admin/services/contracts/IPostHogUserAnalytics.ts
interface IPostHogUserAnalytics {
  getEngagementSummary(userId: string): Promise<EngagementSummary>;
  getActivityBreakdown(userId: string, days: number): Promise<ActivityBreakdown[]>;
  getContentMetrics(userId: string): Promise<ContentMetrics>;
  getRecentSessions(userId: string, limit: number): Promise<SessionInfo[]>;
  getSessionReplayUrl(sessionId: string): string;
}
```

---

### Phase 5: Admin Dashboard Upgrade

**Replace custom analytics with PostHog embeds + API.**

**Options:**

1. **Embed PostHog dashboards** - Fastest, but less customizable
2. **Build custom UI with PostHog API** - More work, but matches app design
3. **Hybrid** - Embeds for complex visualizations, custom for simple metrics

**Recommended: Hybrid approach**

- **Custom UI:** Summary cards, user lists, simple metrics
- **PostHog embeds:** Retention curves, funnels, user paths, cohort analysis

**New Dashboard Sections:**

```
┌─────────────────────────────────────────────────────────────┐
│  TKA ANALYTICS                                              │
├─────────────────────────────────────────────────────────────┤
│  OVERVIEW                               [Last 30 days ▼]    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │   847   │ │   124   │ │   2.4k  │ │  18 min │           │
│  │  Users  │ │  Active │ │ Sessions│ │Avg Time │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
├─────────────────────────────────────────────────────────────┤
│  USER RETENTION              [PostHog embed - retention]    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Week 0: ████████████████████████████████  100%     │   │
│  │  Week 1: ████████████████████░░░░░░░░░░░░   62%     │   │
│  │  Week 2: ██████████████░░░░░░░░░░░░░░░░░░   45%     │   │
│  │  Week 3: ██████████░░░░░░░░░░░░░░░░░░░░░░   32%     │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  FEATURE USAGE              [PostHog embed - bar chart]     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  USER SEGMENTS                                              │
│  ┌──────────────┬───────┬────────────────────────────────┐ │
│  │ Creators     │  45   │ Created 5+ sequences           │ │
│  │ Consumers    │ 312   │ Viewed 10+ but created 0       │ │
│  │ Learners     │  89   │ Completed 3+ lessons           │ │
│  │ Lurkers      │ 401   │ <5 sessions, no content        │ │
│  └──────────────┴───────┴────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

### Phase 6: Feature Flags & A/B Testing

**Future capability unlocked by PostHog.**

Once analytics is stable:
1. Enable feature flags for gradual rollouts
2. Run A/B tests on UI changes
3. Target features by user segment (creators vs consumers)

---

## Implementation Timeline

| Phase | Scope | Estimate |
|-------|-------|----------|
| 1 | PostHog setup & basic integration | 1 session |
| 2 | Migrate event logging | 1 session |
| 3 | Remove legacy infrastructure | 1 session |
| 4 | Admin UserDetailModal redesign | 2 sessions |
| 5 | Admin dashboard upgrade | 2 sessions |
| 6 | Feature flags (optional) | Future |

**Total: 7 sessions** (can be spread across other work)

---

## Environment Setup

```bash
# .env
PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxxx
PUBLIC_POSTHOG_HOST=https://us.i.posthog.com  # or eu.i.posthog.com

# For reverse proxy (optional but recommended)
POSTHOG_PERSONAL_API_KEY=phx_xxxxxxxxxxxxx
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| PostHog goes away | Open source - can self-host |
| Free tier exceeded | 1M events/month is huge; if exceeded, paying ~$50/M is fine |
| Ad blockers | Reverse proxy through our domain |
| Data loss during migration | Keep Firestore data read-only, don't delete |
| API rate limits | 240/min, 1200/hr - cache aggressively |

---

## Success Metrics

**Phase 1-3 complete when:**
- [ ] All 40+ event types flowing to PostHog
- [ ] Session recordings capturing
- [ ] User identification working
- [ ] No more Firestore activity writes
- [ ] Firebase Analytics removed

**Phase 4-5 complete when:**
- [ ] UserDetailModal shows meaningful aggregated metrics
- [ ] Admin dashboard has retention curves
- [ ] Can answer "is this user engaged?" in 2 seconds
- [ ] Can watch session replays for bug reports

---

## Decisions (Resolved 2026-01-26)

1. **PostHog region:** US (`https://us.i.posthog.com`)
2. **Session replay:** Enabled by default. Terms of Service updated to disclose session recording for product improvement. PostHog's default masking for sensitive fields is sufficient.
3. **Historical data:** Import existing Firestore events after main integration is stable. One-time batch script.
4. **Priority:** Phases 1-3 sequential (dependency), then Phases 4-5 in parallel via subagents.

---

## References

- [PostHog SvelteKit Docs](https://posthog.com/docs/libraries/svelte)
- [PostHog API Overview](https://posthog.com/docs/api)
- [HogQL Documentation](https://posthog.com/docs/sql)
- [PostHog Pricing](https://posthog.com/pricing)

# Security Review: Uncommitted Changes

**Date:** 2026-05-23
**Scope:** firestore.rules, svelte.config.js, package.json, pnpm-lock.yaml, firestore-paths.ts, static data snapshots
**Reviewer:** Automated security audit

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1     |
| HIGH     | 2     |
| MEDIUM   | 2     |
| LOW      | 2     |

---

## CRITICAL

### C-1: `appMetrics` collection allows unrestricted write from anyone (line 1003)

```
match /appMetrics/{metricId} {
  allow read: if true;
  allow write: if true;
}
```

**Risk:** Any unauthenticated user can write arbitrary data to any document in `appMetrics`. This is not scoped to atomic increments -- a malicious actor can overwrite the entire document with any fields, delete all metrics documents, or create new documents with arbitrary content. The `write` permission includes `create`, `update`, and `delete`.

**Impact:** Data integrity loss, potential abuse vector for storing arbitrary payloads in your Firestore (storage cost attack), or wiping the counter data.

**Recommendation:** Restrict writes to specific field operations:
```
allow update: if request.resource.data.diff(resource.data).affectedKeys().hasOnly(['totalGenerated'])
  && request.resource.data.totalGenerated == resource.data.totalGenerated + 1;
allow create, delete: if false;
```
Or at minimum, require authentication and restrict to `update` only with field constraints.

---

## HIGH

### H-1: `scanEvents` wildcard path allows unauthenticated creates (line 922-924)

```
match /{path=**}/scanEvents/{eventId} {
  allow create: if true;
}
```

**Risk:** The recursive wildcard `/{path=**}/scanEvents/{eventId}` matches `scanEvents` subcollections under ANY document path in the entire database. An attacker can create `scanEvents` documents under any parent path, not just `shortcodes/{code}/scanEvents`. This could be used to:
- Inject telemetry data with forged parent paths
- Create documents in unexpected locations (e.g., `users/{uid}/scanEvents/{id}`)
- Accumulate storage costs via bulk document creation with no rate limiting

**Impact:** Storage cost abuse, data pollution, potential confusion in admin dashboards reading collectionGroup queries.

**Recommendation:** Narrow the wildcard to the intended parent:
```
match /shortcodes/{code}/scanEvents/{eventId} {
  allow create: if true;
  // ... rest unchanged
}
```
If the admin collectionGroup query requires the broader path, add field validation (e.g., require `shortcodeId` field matches a known pattern).

### H-2: Public sequences snapshot exposes Firebase UIDs and internal paths (public-sequences.json)

**File:** `static/data/snapshots/public-sequences.json` (3.9 MB, 460 documents)

The snapshot contains:
- **6 Firebase Auth UIDs** (e.g., `PBp3GSBO6igCKPwJyLZNmVEmamI3`)
- **`sourceRef` fields** with full internal Firestore paths (e.g., `users/{uid}/sequences/{id}`)
- **`ownerAvatarUrl`** with full Google profile image URLs
- **`thumbnails`** with Firebase Storage URLs including access tokens

While this data mirrors what Firestore already serves publicly, bundling it as a static JSON file in the repo means:
1. Firebase UIDs are indexed by search engines and cached in CDN/git history permanently
2. Firebase Storage tokens embedded in the file grant direct access to those files even if Firestore rules change later
3. The `sourceRef` field reveals the internal data model structure

**Impact:** Information disclosure. UIDs alone are not exploitable, but combined with the open `appMetrics` write or `scanEvents` create, they provide targeting information.

**Recommendation:**
- Strip `sourceRef` from the snapshot (it's an internal reference)
- Strip or truncate Firebase Storage tokens from `thumbnails` (serve via a proxy URL)
- Consider whether raw UIDs need to be in the static bundle vs. an opaque display ID

---

## MEDIUM

### M-1: `followerCount` update rule allows race-condition manipulation (line 291-298)

```
allow update: if isAuthenticated()
  && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['followerCount'])
  && request.resource.data.followerCount == resource.data.followerCount + 1
```

**Risk:** Any authenticated user can increment or decrement any other user's `followerCount` by exactly 1, without any server-side verification that a follow/unfollow actually occurred. Rapid sequential calls can inflate or deflate counts. There is no check that the caller is actually creating/deleting a corresponding `followers/{followerUserId}` document.

**Impact:** Follower count manipulation (social proof gaming or griefing).

**Recommendation:** Move follower count updates to a Cloud Function triggered by writes to the `followers` subcollection, rather than allowing direct client-side counter manipulation.

### M-2: No input sanitization on `firestore-paths.ts` path parameters

**File:** `src/lib/shared/library/data/firestore-paths.ts`

All path builder functions accept raw string parameters and interpolate them directly:
```typescript
export function getUserSequencePath(userId: string, sequenceId: string): string {
  return `users/${userId}/sequences/${sequenceId}`;
}
```

Firestore itself rejects paths with `/` in document IDs, but if a caller passes a crafted `userId` like `../admin`, the resulting path `users/../admin/sequences/...` could potentially resolve to unintended collections depending on the SDK's path normalization behavior.

**Impact:** Low probability due to Firestore SDK path validation, but the functions lack defensive guards against path traversal characters.

**Recommendation:** Add a validation guard:
```typescript
function assertSafeId(id: string): void {
  if (!id || id.includes('/') || id.includes('..') || id.includes('\\')) {
    throw new Error(`Invalid Firestore document ID: ${id}`);
  }
}
```

---

## LOW

### L-1: New dependency `@dgreenheck/ez-tree` is low-profile (package.json diff)

**Change:** Added `@dgreenheck/ez-tree@^1.1.0` (procedural tree generation for Three.js).

**Assessment:**
- MIT license, no dependencies, 23.9 MB unpacked
- Published via GitHub Actions (OIDC provenance), 7 versions total
- Single maintainer (`dgreenheck`)
- GitHub stars badge present, appears to be a legitimate Three.js ecosystem package

**Risk:** Low. Single-maintainer packages carry inherent supply chain risk, but this is a rendering utility with no network access, no postinstall scripts, and Three.js as its only peer dependency. The package size (23.9 MB) is notable -- likely includes model/texture assets.

**Recommendation:** Pin to exact version (`1.1.0` instead of `^1.1.0`) to prevent automatic minor version bumps from a single-maintainer package. Monitor for ownership transfers.

### L-2: svelte.config.js compiler change is cosmetic (no security impact)

**Change:** Replaced a comment block with a `warningFilter` function that suppresses `state_referenced_locally` warnings.

**Assessment:** This is a build-time compiler option that filters Svelte warnings. It has no runtime security implications. The `warningFilter` function only returns `true` or `false` based on warning codes -- it does not execute arbitrary logic, modify output, or change CSP/CORS behavior.

**Risk:** None.

---

## Existing Rules: Notable Design Decisions (Not Findings)

The following are intentional design decisions documented in the rules file. They are not findings but are noted for completeness:

1. **Public-readable user profiles** (`/users/{userId}` -- `allow read: if true`): Documented as intentional for social features. Sensitive data is in subcollections with auth gates.

2. **Public-readable sequences, collections, products**: Documented as intentional for browse/gallery functionality.

3. **Shortcodes public read**: Required for QR code scanning without auth.

4. **`liveBroadcast` read-only from client**: Clean pattern -- Cloud Functions write via Admin SDK.

5. **`config/effectPoints` and `config/fireDefaults` public read**: Documented as needed pre-auth. Contains non-sensitive rendering configuration.

---

## Shortcodes Snapshot Assessment

**File:** `static/data/snapshots/shortcodes.json` (793 KB, 6,672 documents)

Each document contains only `_id` and `encoded` fields. The encoded field contains compressed sequence data (not credentials or PII). The shortcodes are already publicly readable via Firestore rules. No sensitive data exposure beyond what's already public.

**Risk:** None identified.

---

## Recommendations Priority

| Priority | Item | Effort |
|----------|------|--------|
| 1 | C-1: Lock down `appMetrics` writes to field-level constraints | Small |
| 2 | H-1: Narrow `scanEvents` wildcard path | Small |
| 3 | H-2: Strip `sourceRef` and Storage tokens from public snapshot | Medium |
| 4 | M-1: Move followerCount to Cloud Function | Medium |
| 5 | M-2: Add path ID validation guards | Small |
| 6 | L-1: Pin ez-tree to exact version | Trivial |

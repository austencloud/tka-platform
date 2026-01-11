# Thumbnail Caching Architecture

## 4-Tier Loading Strategy

Thumbnails load through a prioritized 4-tier system for optimal performance:

### Tier 1: Static Bundled (Instant, Shared)
- **Location:** `/static/thumbnails/`
- **Speed:** Instant (0ms network latency)
- **Generated:** During release via `sync-static-thumbnails.cjs`
- **Format:** `{propType}/{sequenceName}_{mode}.webp`
- **Scope:** Default settings only (standard rendering)

### Tier 2: Local IndexedDB (Instant, Personalized)
- **Location:** Browser IndexedDB (`thumbnail-local-cache`)
- **Speed:** Instant (~1ms)
- **Generated:** Saved after cloud fetch or local render
- **Scope:** ALL thumbnails (cat-dog, custom settings, everything)
- **Limit:** 100 MB with LRU eviction

### Tier 3: Cloud Cache (Fast, Shared)
- **Location:** Firebase Storage (`thumbnails/`)
- **Speed:** ~100-300ms (CDN-cached)
- **Generated:** Crowd-sourced from user renders
- **Format:** `{variant}/{propType}/{sequenceName}_{mode}.webp`
- **Scope:** Default settings only (shared across users)

### Tier 4: Local Render (Slow)
- **Speed:** ~500-2000ms per thumbnail
- **When:** Cache miss on all tiers
- **Saves to:** Tier 2 (local) + Tier 3 (cloud, if default settings)

## How It Works

```
Request → Check Static Manifest → HIT? → Return /thumbnails/{key}.webp
                ↓ MISS
         Check Local IndexedDB → HIT? → Return blob URL
                ↓ MISS
         Check Cloud Cache → HIT? → Save to local, Return Firebase URL
                ↓ MISS
         Queue Local Render → Save to local + cloud → Return blob URL
```

## Unified Caching (No Special Cases)

The local IndexedDB cache uses the **hash key** from `ThumbnailKeyDeriver`, which encodes:
- Sequence name
- Prop configuration (single or cat-dog)
- Light/dark mode
- Variant (gallery/wordcard)
- All composition settings

This means **all thumbnails are cached the same way** - cat-dog mode, custom settings, everything gets the same instant-load treatment after first view.

## Release Integration

The release script (`scripts/release.js`) automatically:
1. Syncs all cloud thumbnails to `/static/thumbnails/`
2. Generates `manifest.json` listing all bundled thumbnails
3. Commits the manifest (NOT the images - they're gitignored)

**Important:** Static thumbnails are NOT committed to git. They're regenerated fresh during each release build.

## Scaling Strategy

| Scale | Count | Size | Approach |
|-------|-------|------|----------|
| Current | ~800 | ~40 MB | Bundle all |
| Medium | ~5,000 | ~250 MB | Bundle hot sequences only |
| Large | 50,000+ | 2+ GB | Cloud-only, no static |

### Size Budget
- **Hard limit:** 100 MB for static thumbnails
- **Monitor with:** Check `static/thumbnails/` size after sync
- **When exceeded:** Switch to cloud-first strategy

## Key Files

| File | Purpose |
|------|---------|
| `scripts/sync-static-thumbnails.cjs` | Downloads cloud → static |
| `scripts/generate-thumbnail-manifest.cjs` | Updates cloud manifest |
| `static/thumbnails/manifest.json` | Static thumbnail index |
| `ThumbnailRenderOrchestrator.ts` | 3-tier lookup logic |
| `ThumbnailKeyDeriver.ts` | Cache key generation |

## Cache Key Format

Static thumbnails use a simplified key (no variant level):
```
{propType}/{sequenceName}_{mode}
```

Examples:
- `buugeng/AABB_dark`
- `club/Butterfly_light`

## Default Settings

Static cache only applies when using **gallery defaults**:
- `addWord: true`
- `addBeatNumbers: true`
- `includeStartPosition: true`
- `addDifficultyLevel: true`
- `addUserInfo: false`
- `showCreatorName: true`

Custom settings bypass static cache and use cloud/render.

## Troubleshooting

### Static thumbnails not loading
1. Check console for `[Static] Loaded manifest:` log
2. If missing, run `node scripts/sync-static-thumbnails.cjs`
3. Check `usesDefaults` - custom settings skip static cache

### Manifest 404 in dev
Static thumbnails are synced during release. In dev:
- Run sync script manually, OR
- Rely on cloud cache (Tier 2)

### Key mismatch
Look for `[Static] Miss:` logs showing the key being searched.
Compare against keys in `static/thumbnails/manifest.json`.

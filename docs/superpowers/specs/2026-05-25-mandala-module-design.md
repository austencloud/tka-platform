# Mandala Module — Unified Hub Design

## Goal

Elevate mandalas from a sequence-viewer sub-pane to a first-class module at `/app/mandala`. Unifies generation (Studio), saved library (Collection), guided breathing (Meditate), and output (Export) into one cohesive experience. Top-level creative tool in primary nav alongside Create, Browse, Compose.

## Architecture

**Module ID:** `mandala`  
**Route:** `/app/mandala/{tab}`  
**Tabs:** Studio | Collection | Meditate | Export  
**Absorbs:** `src/lib/features/mandala-generator/`, `src/lib/features/mandala-collection/`, meditation code from `src/lib/shared/sequence-viewer/`

### Directory Structure

```
src/lib/features/mandala/
├── MandalaModule.svelte
├── tabs/
│   ├── studio/
│   │   ├── StudioTab.svelte
│   │   ├── components/
│   │   │   ├── MandalaCanvas.svelte
│   │   │   ├── MandalaElementView.svelte
│   │   │   ├── GridDotOverlay.svelte
│   │   │   ├── SymmetryControls.svelte
│   │   │   └── AssetLibrary.svelte
│   │   ├── domain/
│   │   │   ├── mandala-config.ts
│   │   │   ├── mandala-element.ts
│   │   │   ├── mandala-preset.ts
│   │   │   ├── mandala-enums.ts
│   │   │   ├── preset-definitions.ts
│   │   │   └── symmetry-constants.ts
│   │   ├── services/
│   │   │   ├── mandala-transformer.ts
│   │   │   └── types.ts
│   │   └── state/
│   │       ├── mandala-controller.ts
│   │       └── mandala-state.svelte.ts
│   ├── collection/
│   │   ├── CollectionTab.svelte
│   │   ├── components/
│   │   │   ├── MandalaCollectionCard.svelte
│   │   │   └── MandalaCollectionGallery.svelte
│   │   ├── domain/
│   │   │   └── mandala-collection-types.ts
│   │   ├── services/
│   │   │   ├── LocalMandalaCollectionRepository.ts
│   │   │   ├── FirebaseMandalaCollectionRepository.ts
│   │   │   └── firestore-paths.ts
│   │   └── state/
│   │       └── mandala-collection-state.svelte.ts
│   ├── meditate/
│   │   ├── MeditateTab.svelte
│   │   ├── components/
│   │   │   ├── MeditationOverlay.svelte
│   │   │   ├── MeditationControls.svelte
│   │   │   └── MandalaSelector.svelte
│   │   ├── domain/
│   │   │   ├── meditation-types.ts
│   │   │   └── default-mandalas.ts
│   │   ├── services/
│   │   │   └── meditation-audio.ts
│   │   └── state/
│   │       └── meditation-session.svelte.ts
│   └── export/
│       ├── ExportTab.svelte
│       ├── components/
│       │   ├── ExportPreview.svelte
│       │   └── FormatSelector.svelte
│       └── services/
│           └── mandala-export.ts
```

### Shared Infrastructure (unchanged)

`src/lib/shared/mandala/` stays in place — contains MandalaRenderer, GeometryCalculator, PathPreparer, OverlayCanvas. Consumed by both this module and the sequence-viewer's lightweight pane.

### Sequence Viewer Post-Migration

`MandalaPane.svelte` reverts to a lightweight read-only viewer:
- Renders current sequence's mandala
- Basic controls: tipDx slider, rotation toggle, easing picker, download button
- No meditation mode, no collection integration
- "Open in Mandala Studio" link to `/app/mandala/studio` (optional, low priority)

---

## Tab Specifications

### Studio Tab

The existing mandala-generator, relocated unchanged in behavior.

**Layout:**
- Desktop 3-column: Asset Library (left) | Canvas (center) | Controls (right)
- Mobile stacked: Canvas → Action bar → Collapsible panels

**Capabilities:**
- Place/transform elements on canvas with N-fold symmetry
- Adjust foldCount, mirror axis, color scheme
- Load/apply presets
- Undo/redo (50-entry history stack)
- "Save to Collection" button → persists via `FirebaseMandalaCollectionRepository`

**State:** Singleton `MandalaState` class with Svelte 5 `$state` runes, HMR-safe.

**No behavioral changes from current mandala-generator.** Pure file relocation + wiring Save action to collection tab's repository.

---

### Collection Tab

Gallery of user's saved mandalas.

**Layout:**
- Responsive grid of `MandalaCollectionCard` components
- Filter/sort: by creation date, source type, name
- Empty state: illustration + "Create your first mandala" CTA linking to Studio tab

**Card actions:**
- Edit in Studio — opens Studio tab with mandala loaded
- Use in Meditation — opens Meditate tab with this mandala pre-selected
- Export — opens Export tab with this mandala pre-selected
- Delete — confirmation dialog, removes from Firebase

**Source labels on cards:**
- "Created" — made in Studio
- "From Sequence" — generated from a sequence's path data
- "Default" — curated built-in (not deletable)

**State:** Singleton `MandalaCollectionState` class. Firebase-backed with localStorage migration for existing users.

**Data shape (existing):**
```ts
interface CollectedMandala {
  id: string;
  name: string;
  steps: StepData[];
  variant: "blue" | "red" | "both";
  bluePropType: string;
  redPropType: string;
  createdAt: number;
  source?: "studio" | "sequence" | "default";  // NEW optional field, backwards-compatible
}
```

---

### Meditate Tab

Full-viewport guided breathing meditation with mandala visual backdrop.

**Entry Flow:**
1. **Mandala selector** — grid of thumbnails. Top row: curated defaults (5-10 mandalas designed for breathing aesthetics — high symmetry, smooth paths, calming palettes). Below: user's collection. "Random" button.
2. **Session config** — breathing pattern, duration, ambient sound (same controls as current implementation)
3. **Start button** → transitions to immersive mode

**Active Session:**
- Mandala fills entire tab viewport (no rail, no chrome beyond minimal overlay)
- Breath overlay: phase label + arc progress indicator (existing MeditationOverlay)
- Timer in top-right corner (subtle, low-opacity)
- Mandala animates with breath: `tipDx` driven by session state (inhale = expand, exhale = contract, hold = micro-pulse)
- Tap/click anywhere → shows pause controls (stop, adjust volume)
- Screen wake lock held for session duration

**Session Complete:**
- Completion overlay: stats (duration, breath count), "Again" / "New Mandala" / "Back to Collection"
- Completion bell audio cue
- Session logged to history

**Curated Default Mandalas (`default-mandalas.ts`):**
- 5-10 pre-built `StepData[]` sequences that produce visually pleasing, high-symmetry mandalas
- Characteristics: even radial distribution, 8+ fold symmetry, smooth path transitions
- Bundled as static data (no network fetch needed)
- Marked `source: "default"` in collection, not deletable

**Breathing Engine:** Existing `meditation-session.svelte.ts` — RAF tick clock, phase computation, wake lock, visibility pause/resume. No changes needed.

**Audio:** Existing `meditation-audio.ts` — Web Audio with lazy AudioContext, ambient loops, completion bell. No changes needed.

**Accessibility:**
- `aria-live="polite"` region announces phase transitions
- `prefers-reduced-motion`: text counter replaces arc animation, no rotation
- All interactive elements ≥44px touch target
- Focus-visible indicators on all buttons

---

### Export Tab

Output mandalas in multiple formats.

**Layout:**
- Left: format selector + options
- Right: live preview at target resolution

**Source picker:** Select which mandala to export — current Studio mandala, or pick from Collection.

**Formats:**

| Format | Output | Options |
|--------|--------|---------|
| PNG | Raster image | Resolution (1x, 2x, 4x), background (transparent/black/white) |
| SVG | Vector | Include grid dots or not, stroke width |
| Wallpaper | Device-sized PNG | Preset device sizes (phone/tablet/desktop), background color |
| Print Sheet | Tiled PDF/PNG | Grid layout (2x2, 3x3), page size (letter/A4), margins |

**Implementation:**
- PNG/Wallpaper: Canvas-based render at target resolution using existing MandalaRenderer
- SVG: Direct SVG serialization from renderer output
- Print Sheet: CSS grid layout with multiple mandala renders, exported via html2canvas or similar

**Note:** This tab is lower priority than Studio/Collection/Meditate. Can ship as a minimal "Download PNG" initially and expand later.

---

## Module Registration

### module-definitions.ts

```ts
{
  id: "mandala",
  label: "Mandala",
  icon: '<i class="fas fa-dharmachakra" aria-hidden="true"></i>',
  color: "#f472b6",
  description: "Create, collect, and meditate with mandalas",
  isMain: true,
  sections: MANDALA_TABS,
}
```

### tab-definitions.ts

```ts
export const MANDALA_TABS: Section[] = [
  {
    id: "studio",
    label: "Studio",
    icon: '<i class="fas fa-palette" aria-hidden="true"></i>',
    description: "Create and customize mandalas",
    color: "#f472b6",
    gradient: "linear-gradient(135deg, #f9a8d4 0%, #f472b6 100%)",
  },
  {
    id: "collection",
    label: "Collection",
    icon: '<i class="fas fa-layer-group" aria-hidden="true"></i>',
    description: "Your saved mandala library",
    color: "#e879f9",
    gradient: "linear-gradient(135deg, #e879f9 0%, #c084fc 100%)",
  },
  {
    id: "meditate",
    label: "Meditate",
    icon: '<i class="fas fa-spa" aria-hidden="true"></i>',
    description: "Guided breathing with mandalas",
    color: "#818cf8",
    gradient: "linear-gradient(135deg, #a5b4fc 0%, #818cf8 100%)",
  },
  {
    id: "export",
    label: "Export",
    icon: '<i class="fas fa-download" aria-hidden="true"></i>',
    description: "Download and print mandalas",
    color: "#34d399",
    gradient: "linear-gradient(135deg, #6ee7b7 0%, #34d399 100%)",
  },
];
```

### ModuleRenderer.svelte

```ts
mandala: () => import("../../features/mandala/MandalaModule.svelte"),
```

### MODULE_ID_MIGRATIONS (backwards compat)

```ts
"mandala-generator": "mandala",
"mandala-collection": "mandala",
```

---

## Migration Checklist

1. Create `src/lib/features/mandala/` directory structure
2. Move files from `mandala-generator/` → `mandala/tabs/studio/`
3. Move files from `mandala-collection/` → `mandala/tabs/collection/`
4. Move meditation files from `src/lib/shared/sequence-viewer/` → `mandala/tabs/meditate/`
5. Create `MandalaModule.svelte` tab shell
6. Create `MandalaSelector.svelte` (new component for meditate tab)
7. Create `default-mandalas.ts` (curated mandala data)
8. Create Export tab (minimal MVP: PNG download)
9. Update `module-definitions.ts` — add mandala module entry
10. Update `tab-definitions.ts` — add `MANDALA_TABS`
11. Update `ModuleRenderer.svelte` — add loader, add migrations
12. Revert `MandalaPane.svelte` — strip meditation, keep lightweight viewer
13. Remove old `src/lib/features/mandala-generator/` directory
14. Remove old `src/lib/features/mandala-collection/` directory
15. Update any remaining imports across codebase referencing old paths
16. Remove mandala/collection tabs from Lab module's tab list (they currently live there)

---

## Scope Boundaries

**In scope:**
- Module creation and registration
- File migration (generator + collection + meditation)
- Tab shell with lazy-loaded tab content
- MandalaSelector for meditate tab (curated defaults + collection picker)
- Curated default mandalas (static data, 5-10 entries)
- Export tab MVP (PNG download only)
- Sequence viewer MandalaPane cleanup (remove meditation mode)
- Backwards-compat migrations for old module IDs

**Out of scope (future work):**
- Full export suite (SVG, wallpaper, print sheet) — beyond PNG MVP
- Session history / streak tracking UI
- Mandala sharing / social features
- Firebase persistence for mandala collection (already exists, just migrates)
- Audio files (graceful degradation already in place)
- New mandala generation algorithms

---

## Technical Notes

- **State singletons:** Both `MandalaState` and `MandalaCollectionState` are singleton classes. They stay as singletons — the module shell doesn't need to manage their lifecycle beyond calling `reset()` on teardown.
- **Code splitting:** Each tab component lazy-loads via dynamic import within `MandalaModule.svelte`. Studio tab (heaviest) only loads when user navigates to it.
- **HMR:** State classes already handle HMR via `import.meta.hot.data`. No changes needed.
- **Shared renderer:** `src/lib/shared/mandala/` services remain in place. Both this module and the sequence-viewer pane import from there.
- **Meditation session state:** Factory pattern (`createMeditationSession()`) — each mount of MeditateTab creates a fresh instance. Not a singleton.
- **Audio service:** Factory pattern (`createMeditationAudioService()`) — created on MeditateTab mount, disposed on unmount.

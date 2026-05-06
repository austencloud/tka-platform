# Videos Tab Empty State Design

**Date:** 2026-05-06
**Status:** Approved

## Problem

The sequence viewer split pane has a Videos tab in the content selector (Animation / Card / Videos). No video upload flow is wired — VideoGallery receives no `onUpload` callback, so the empty state is a dead end. The tab should provide a path to upload when no videos exist, and uploading to an ephemeral sequence should auto-persist that sequence.

## Design

### Three states

**1. Has videos (any user)**
Existing VideoGallery renders unchanged. Grid of video cards with inline playback. Upload button shown if user owns the sequence.

**2. No videos + signed in**
Empty state: video icon, "No videos yet", prominent "Record your performance" CTA button.

On CTA tap:
- Sequence already in user's library → open VideoUploadSheet drawer directly
- Sequence is ephemeral (not saved, or owned by someone else) → confirmation prompt: "This sequence isn't in your library yet. Save it to attach a video?" On confirm → save sequence to library → open VideoUploadSheet

**3. No videos + guest**
Empty state: video icon, "No videos yet", text line: "Sign in to upload performances." No upload button.

### Component changes

#### VideoGallery.svelte
- Read `authState.user` to determine guest vs signed-in
- Guest + empty: render sign-in message, no CTA
- Signed-in + empty: render upload CTA button, call `onUpload` on tap

#### ViewerSplitPane.svelte
- Pass `onUpload` callback to VideoGallery instances
- `onUpload` handler checks if sequence is persisted:
  - If yes → set `showUploadSheet = true`
  - If no → set `showSaveConfirm = true`
- Mount VideoUploadSheet with `show={showUploadSheet}`, pass sequence + close/uploaded handlers
- Mount save confirmation (simple modal/drawer) with save-then-upload flow

#### Sequence persistence check
- Determine "is persisted" by checking if sequence has a Firestore document ID and the current user owns it, or if it exists in their library
- Reuse existing save-to-library logic (same flow as the Save button in the viewer)

### Not in scope
- In-app video recording (upload only)
- Changes to PaneContentSelector options
- Changes to VideoUploadSheet internals
- Changes to ContentType union or persistence layer
- Changes to video collaboration infrastructure (R2, Firestore, collaborators)

### Files involved
- `src/lib/shared/sequence-viewer/components/VideoGallery.svelte` — auth-aware empty state
- `src/lib/shared/sequence-viewer/components/ViewerSplitPane.svelte` — wire onUpload, mount upload sheet + save confirm
- `src/lib/shared/video-collaboration/components/VideoUploadSheet.svelte` — already built, mount it
- Existing save-to-library service — reuse for ephemeral sequence persistence

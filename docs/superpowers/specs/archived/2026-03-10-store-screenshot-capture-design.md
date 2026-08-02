---
status: backlog
value: 2
effort: M
remaining: "Admin capture button, Firebase gallery drawer, Play Store slots"
depends_on: ""
plan_path: plans/backlog/2026-03-10-store-screenshot-capture.md
tags: []
last_triaged: 2026-04-26
---
# Store Screenshot Capture Tool — Design Spec

**Date:** 2026-03-10
**Status:** Approved

## Problem

Getting screenshots for the Google Play Store listing requires switching between the app, screenshot tools, and file management. For an ADHD workflow, this context-switching kills momentum. We need an in-app capture-and-organize tool that makes the whole process one continuous flow.

## Solution

An admin-only in-app screenshot capture system with a gallery drawer that maps directly to Play Store submission slots.

## Components

### 1. Capture Button + Hotkey

- Camera icon in top-right corner, admin-only
- `Ctrl+Shift+S` hotkey to capture
- Uses `html2canvas` to capture the full viewport (content + background, no browser chrome)
- Brief shutter flash animation on capture
- Small toast with thumbnail preview, fades after 2 seconds

### 2. Firebase Storage + Firestore Metadata

**Storage path:** `screenshots/{userId}/{timestamp}.png`

**Firestore document** at `screenshots/{docId}`:

```typescript
{
  userId: string;
  url: string;              // Firebase Storage download URL
  capturedAt: Timestamp;
  module: string;           // "create", "browse", etc.
  tab: string;              // "construct", "gallery", etc.
  deviceCategory?: "phone" | "tablet";
  storeSlot?: string;       // "phone-1", "phone-2", "tablet-1", etc.
  background: string;       // active background at capture time
  width: number;
  height: number;
}
```

### 3. Gallery Drawer

- Opens from `Ctrl+Q` hotkey
- Right-side drawer, full height
- Admin-only visibility

**Layout (top to bottom):**

1. **Progress header:** "3/8 phone slots filled" with "Download All Assigned" button
2. **Phone slots (required):** 8 numbered slots, first 2 marked required. Empty = dashed border. Filled = thumbnail + module/tab label.
3. **Tablet slots (optional):** 8 numbered slots, all optional. Same empty/filled pattern.
4. **Unassigned captures:** Scrollable grid of all captures not yet assigned to slots. Sorted newest first. Shows module, tab, timestamp per thumbnail.

**Interactions:**
- Drag from unassigned pool to slot (or tap capture, tap slot)
- Delete a capture
- Download individual PNG
- "Download All Assigned" zips slotted screenshots

### 4. Background Strategy

- Phone screenshots: one consistent background for cohesive store listing
- Tablet screenshots: different background per screenshot to show off theming

### 5. Target Screens

1. Create > Construct (sequence builder)
2. Create > Generate (AI generation)
3. Browse > Gallery (community content)
4. Compose > Arrange (timeline/animation)
5. Learn > Concepts (educational value)

## Constraints

- Admin-only (camera icon + hotkeys hidden from regular users)
- Uses existing drawer infrastructure (DrawerStack)
- Uses existing keyboard shortcut system (ShortcutRegistry)
- Firebase Storage + Firestore (already configured)
- No new modules — this is a drawer overlay

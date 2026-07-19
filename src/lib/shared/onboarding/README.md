# Tab Intro System

Lightweight, per-tab introductions that replace the heavy multi-page module onboarding carousel.

## Philosophy

- **Less disruptive**: Single card, one dismiss action
- **Contextual**: Users see the intro for the tab they're actually using
- **Just-in-time**: Learn about features when you need them
- **Persistent**: Once dismissed, never shows again (unless forced)

## Usage

### 1. Add intro content for your tab

In `config/tab-intro-content.ts`:

```typescript
export const MY_MODULE_TAB_INTROS: Record<string, TabIntroContent> = {
  myTab: {
    icon: "fa-star",
    color: "#8b5cf6",
    title: "My Tab",
    description: "Brief explanation of what this tab does.",
    features: ["Key feature one", "Key feature two", "Key feature three"],
  },
};
```

### 2. Use TabIntro in your tab component

```svelte
<script lang="ts">
  import TabIntro from "$lib/shared/onboarding/components/TabIntro.svelte";
  import { getTabIntroContent } from "$lib/shared/onboarding/config/tab-intro-content";

  const introContent = getTabIntroContent("myModule", "myTab");
</script>

<!-- Your tab content -->
<div class="my-tab">
  <!-- ... -->
</div>

<!-- Tab intro (renders nothing if already seen) -->
{#if introContent}
  <TabIntro
    moduleId="myModule"
    tabId="myTab"
    icon={introContent.icon}
    color={introContent.color}
    title={introContent.title}
    description={introContent.description}
    features={introContent.features}
  />
{/if}
```

### 3. Optional: Add a help button to re-show

```svelte
<script lang="ts">
  let showIntro = $state(false);
</script>

<button onclick={() => (showIntro = true)}>
  <i class="fas fa-question-circle"></i>
</button>

{#if introContent}
  <TabIntro
    moduleId="myModule"
    tabId="myTab"
    {...introContent}
    forceShow={showIntro}
    onDismiss={() => (showIntro = false)}
  />
{/if}
```

## Storage

Dismissal is persisted to localStorage:

```
tabIntroSeen:create:constructor → "true"
tabIntroSeen:create:generator → "true"
tabIntroSeen:learn:concepts → "true"
```

## History: migration from ModuleOnboarding

`TabIntro` replaced the old `ModuleOnboarding.svelte` carousel. That
component, its content type (`ModuleOnboardingContent`/`TabInfo` in
`domain/types.ts`), and its Firestore-synced per-module completion storage
(`markModuleOnboardingComplete`/`hasCompletedModuleOnboarding` + a `modules`
sub-object on the onboarding status doc, in `config/storage-keys.ts` and
`services/onboarding-persister.ts`) were all removed 2026-07-19 as dead
code — the migration below was never carried out for any tab, so
`ModuleOnboarding.svelte` had already been deleted with zero remaining
callers, and the storage layer it used outlived it.

**Current state:** `TabIntro.svelte` itself has zero mount points anywhere
in the app — it isn't rendered by any tab today. Its dismissal tracking is
local-only (`tabIntroSeen:${moduleId}:${tabId}` in localStorage, set inline
in `TabIntro.svelte`'s `dismiss()`), with no cloud sync. If/when a tab
adopts it, follow the usage guide above; if cross-device dismissal sync is
wanted at that point, that's a fresh design decision, not a resurrection of
the removed per-module Firestore API (which never distinguished tabs within
a module — it only tracked module-level completion).

## Design Decisions

- **No carousel**: Users don't need to swipe through 5 pages to start using a tool
- **No choice step**: The tab they clicked is probably the one they want
- **Centered card modal**: Clear focus, easy to dismiss, works on all screen sizes
- **Click backdrop to dismiss**: Non-blocking, users can dismiss quickly
- **Escape/Enter/Space to dismiss**: Keyboard accessible

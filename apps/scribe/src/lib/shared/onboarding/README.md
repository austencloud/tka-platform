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

## Migration from ModuleOnboarding

The old `ModuleOnboarding.svelte` can be deprecated. To migrate:

1. Remove `ModuleOnboarding` usage from module components
2. Add `TabIntro` to each tab that needs an introduction
3. Define intro content in `tab-intro-content.ts`
4. Remove module-level onboarding state from `navigation-state.svelte.ts`

## Design Decisions

- **No carousel**: Users don't need to swipe through 5 pages to start using a tool
- **No choice step**: The tab they clicked is probably the one they want
- **Centered card modal**: Clear focus, easy to dismiss, works on all screen sizes
- **Click backdrop to dismiss**: Non-blocking, users can dismiss quickly
- **Escape/Enter/Space to dismiss**: Keyboard accessible

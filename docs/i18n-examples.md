# i18n Code Examples

Quick reference for common i18n patterns in TKA Scribe.

---

## Basic Usage

### Simple Translation

```svelte
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
</script>

<h1>{t("app_name")}</h1>
<!-- Output: "TKA Scribe" -->

<p>{t("dashboard_welcome_message")}</p>
<!-- Output: "Welcome to your sequence builder!" -->
```

### With Parameters

```svelte
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  let userName = $state("Austen");
  let sequenceCount = $state(42);
</script>

<p>{t("dashboard_welcome", { name: userName })}</p>
<!-- Output: "Welcome, Austen!" -->

<p>{t("library_sequence_count", { count: sequenceCount })}</p>
<!-- Output: "You have 42 sequences" -->
```

**Security:** Only pass trusted values (system data, user IDs). Never unsanitized user input.

---

## Advanced Patterns

### Dynamic Keys

When the key is computed at runtime:

```svelte
<script lang="ts">
  import { tDynamic } from "$lib/shared/i18n/i18n.svelte.js";

  let moduleId = $state("create");
</script>

<h2>{tDynamic(`module_${moduleId}`)}</h2>
<!-- Output: Translation for "module_create" -->
```

**Trade-off:** Loses TypeScript autocomplete. Use sparingly.

### Reactive Locale Display

```svelte
<script lang="ts">
  import { getLocale } from "$lib/shared/i18n/i18n.svelte.js";

  // Reactive - updates when locale changes
  const currentLocale = getLocale();
</script>

<p>Current language: {currentLocale}</p>
```

### Locale Switching

```svelte
<script lang="ts">
  import { setLocale, type Locale } from "$lib/shared/i18n/i18n.svelte.js";

  async function switchToSpanish() {
    await setLocale("es");
    // UI automatically updates - no page reload needed
  }
</script>

<button onclick={switchToSpanish}>Cambiar a Español</button>
```

### Language Selector Component

```svelte
<script lang="ts">
  import { getLocale, setLocale, locales, type Locale } from "$lib/shared/i18n/i18n.svelte.js";

  const currentLocale = getLocale();

  const languageNames: Record<Locale, { native: string; english: string }> = {
    en: { native: "English", english: "English" },
    es: { native: "Español", english: "Spanish" },
    fr: { native: "Français", english: "French" },
    // ... more locales
  };

  async function handleChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    await setLocale(select.value as Locale);
  }
</script>

<select value={currentLocale} onchange={handleChange}>
  {#each locales as locale}
    <option value={locale}>
      {languageNames[locale].native}
    </option>
  {/each}
</select>
```

---

## RTL Support

### Direction Detection

```svelte
<script lang="ts">
  import { getLocaleDirection } from "$lib/shared/i18n/i18n.svelte.js";

  const direction = getLocaleDirection(); // "ltr" or "rtl"
</script>

<div dir={direction}>
  {t("some_content")}
</div>
```

**Better approach:** Use CSS logical properties instead of inline styles.

### RTL-Aware CSS

```svelte
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
</script>

<div class="content-card">
  <img src="/icon.png" alt="" class="icon" />
  <p>{t("card_content")}</p>
</div>

<style>
  .content-card {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .icon {
    /* ✅ Uses logical properties - automatically mirrors in RTL */
    margin-inline-end: 8px;
  }

  /* ❌ WRONG - hardcoded direction */
  /* margin-right: 8px; */
</style>
```

When locale is Arabic, `margin-inline-end` becomes `margin-left` automatically.

---

## Forms and Inputs

### Form Labels

```svelte
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  let username = $state("");
</script>

<form>
  <label for="username">{t("login_username_label")}</label>
  <input
    id="username"
    type="text"
    bind:value={username}
    placeholder={t("login_username_placeholder")}
    aria-label={t("login_username_aria")}
  />

  <button type="submit">
    {t("login_submit_button")}
  </button>
</form>
```

### Error Messages

```svelte
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  let error = $state<string | null>(null);

  async function handleSubmit() {
    try {
      // ... validation
    } catch (e) {
      error = "validation_error_username_required";
    }
  }
</script>

{#if error}
  <div class="error" role="alert">
    {t(error)}
  </div>
{/if}
```

---

## Navigation and Menus

### Tab Labels

```svelte
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  const tabs = [
    { id: "profile", icon: "user", labelKey: "settings_tab_profile" },
    { id: "props", icon: "wand-magic-sparkles", labelKey: "settings_tab_props" },
    { id: "background", icon: "image", labelKey: "settings_tab_background" },
  ];
</script>

<nav>
  {#each tabs as tab}
    <button aria-label={t(tab.labelKey)}>
      <i class="fas fa-{tab.icon}" aria-hidden="true"></i>
      <span>{t(tab.labelKey)}</span>
    </button>
  {/each}
</nav>
```

### Breadcrumb Navigation

```svelte
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  let breadcrumbs = $state([
    { labelKey: "nav_home", href: "/" },
    { labelKey: "nav_library", href: "/library" },
    { labelKey: "nav_sequence_editor", href: "/edit/abc123" },
  ]);
</script>

<nav aria-label={t("breadcrumb_navigation")}>
  <ol>
    {#each breadcrumbs as crumb, index}
      <li>
        {#if index < breadcrumbs.length - 1}
          <a href={crumb.href}>{t(crumb.labelKey)}</a>
        {:else}
          <span aria-current="page">{t(crumb.labelKey)}</span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>
```

---

## Accessibility

### Screen Reader Announcements

```svelte
<script lang="ts">
  import { t, getLocale } from "$lib/shared/i18n/i18n.svelte.js";

  let previousLocale = $state<string>(getLocale());
  let localeChanged = $state(false);

  const currentLocale = getLocale();

  // Track locale changes for announcement
  $effect(() => {
    if (currentLocale !== previousLocale) {
      localeChanged = true;
      previousLocale = currentLocale;

      // Clear announcement after 3 seconds
      setTimeout(() => (localeChanged = false), 3000);
    }
  });
</script>

<!-- ARIA live region for screen readers -->
<div role="status" aria-live="polite" class="sr-only">
  {#if localeChanged}
    {t("settings_language_changed_to", { language: currentLocale })}
  {/if}
</div>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
```

### Button Labels

```svelte
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  let isLoading = $state(false);
</script>

<button
  onclick={handleSave}
  disabled={isLoading}
  aria-label={isLoading ? t("button_saving") : t("button_save")}
  aria-busy={isLoading}
>
  {#if isLoading}
    <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
  {/if}
  <span>{isLoading ? t("button_saving") : t("button_save")}</span>
</button>
```

---

## Lists and Collections

### Dynamic List Items

```svelte
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  let items = $state([
    { id: 1, type: "sequence", name: "My Flow" },
    { id: 2, type: "drill", name: "Practice Set" },
  ]);
</script>

<ul>
  {#each items as item}
    <li>
      <strong>{item.name}</strong>
      <span class="type-badge">
        {t(`library_type_${item.type}`)}
      </span>
    </li>
  {/each}
</ul>

<!-- Requires translation keys:
     - library_type_sequence
     - library_type_drill
-->
```

### Empty State

```svelte
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  let items = $state([]);
</script>

{#if items.length === 0}
  <div class="empty-state">
    <i class="fas fa-inbox" aria-hidden="true"></i>
    <p>{t("library_empty_state_title")}</p>
    <p class="subtitle">{t("library_empty_state_description")}</p>
    <button onclick={createNew}>
      {t("library_empty_state_cta")}
    </button>
  </div>
{/if}
```

---

## Conditional Content

### Feature Toggles with i18n

```svelte
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  let featureEnabled = $state(true);
</script>

<div class="feature-toggle">
  <h3>{t("settings_feature_title")}</h3>
  <p>
    {featureEnabled
      ? t("settings_feature_enabled_description")
      : t("settings_feature_disabled_description")}
  </p>

  <button onclick={() => featureEnabled = !featureEnabled}>
    {featureEnabled
      ? t("settings_feature_disable_button")
      : t("settings_feature_enable_button")}
  </button>
</div>
```

---

## Date and Number Formatting

### Using Native Intl API

```svelte
<script lang="ts">
  import { getLocale } from "$lib/shared/i18n/i18n.svelte.js";

  let date = $state(new Date());
  let number = $state(1234567.89);

  const currentLocale = getLocale();

  // Reactive formatters
  const dateFormatter = $derived(
    new Intl.DateTimeFormat(currentLocale, {
      dateStyle: "long",
    })
  );

  const numberFormatter = $derived(
    new Intl.NumberFormat(currentLocale, {
      style: "decimal",
      minimumFractionDigits: 2,
    })
  );
</script>

<p>Date: {dateFormatter.format(date)}</p>
<!-- EN: "January 18, 2026" -->
<!-- ES: "18 de enero de 2026" -->

<p>Number: {numberFormatter.format(number)}</p>
<!-- EN: "1,234,567.89" -->
<!-- ES: "1.234.567,89" -->
```

---

## Testing

### Testing Translated Components

```typescript
// MyComponent.test.ts
import { render } from "@testing-library/svelte";
import { setLocale } from "$lib/shared/i18n/i18n.svelte.js";
import MyComponent from "./MyComponent.svelte";

describe("MyComponent", () => {
  it("renders in English", () => {
    const { getByText } = render(MyComponent);
    expect(getByText("TKA Scribe")).toBeInTheDocument();
  });

  it("renders in Spanish", async () => {
    await setLocale("es");
    const { getByText } = render(MyComponent);
    expect(getByText("TKA Scribe")).toBeInTheDocument(); // Spanish translation
  });
});
```

---

## Common Patterns to Avoid

### ❌ Hardcoded Strings

```svelte
<!-- DON'T -->
<h1>Welcome to TKA Scribe</h1>

<!-- DO -->
<h1>{t("app_welcome_title")}</h1>
```

### ❌ String Concatenation

```svelte
<!-- DON'T -->
<p>{t("welcome")} + " " + userName + "!"}</p>

<!-- DO -->
<p>{t("welcome_message", { name: userName })}</p>
```

In JSON:
```json
{
  "welcome_message": "Welcome, {name}!"
}
```

### ❌ Inline Conditionals in Text

```svelte
<!-- DON'T -->
<p>{count === 1 ? "1 sequence" : `${count} sequences`}</p>

<!-- DO -->
<p>{count === 1 ? t("library_one_sequence") : t("library_many_sequences", { count })}</p>
```

In JSON:
```json
{
  "library_one_sequence": "1 sequence",
  "library_many_sequences": "{count} sequences"
}
```

### ❌ Untrusted Parameters

```svelte
<!-- DON'T - XSS RISK -->
<script>
  let userInput = $state(""); // From form input
</script>
<p>{t("message_from_user", { content: userInput })}</p>

<!-- DO - Sanitize first OR render differently -->
<p>{t("message_from_label")}: {userInput}</p>
```

---

## Quick Reference Card

| Task | Import | Usage |
|------|--------|-------|
| Translate | `import { t }` | `{t("key")}` |
| With params | `import { t }` | `{t("key", { name: "X" })}` |
| Dynamic key | `import { tDynamic }` | `{tDynamic(\`prefix_${id}\`)}` |
| Get locale | `import { getLocale }` | `const locale = getLocale()` |
| Switch locale | `import { setLocale }` | `await setLocale("es")` |
| RTL direction | `import { getLocaleDirection }` | `const dir = getLocaleDirection()` |

---

## Next Steps

- Read [Full i18n Guide](./I18N-SYSTEM.md) for architecture details
- Check [RTL Migration](./RTL-MIGRATION.md) for layout guidelines
- Run `npm run i18n:validate` to check translation completeness

# i18n Quick Start Guide

Get started with translations in TKA Scribe in 5 minutes.

---

## 1. Import and Use

```svelte
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
</script>

<h1>{t("app_name")}</h1>
<p>{t("nav_create")}</p>
```

**That's it.** TypeScript autocomplete shows all 1,398 available keys.

---

## 2. Add New Translation Keys

### Step 1: Add to English

Edit `messages/en.json`:

```json
{
  "my_new_feature_title": "My Cool Feature",
  "my_new_feature_description": "This feature does {action}."
}
```

### Step 2: Regenerate types

```bash
npm run i18n:types
```

### Step 3: Add to all other locales

```bash
npm run i18n:validate:fix
```

Auto-adds `[NEEDS TRANSLATION]` placeholders to all locales.

### Step 4: Use it

```svelte
<h2>{t("my_new_feature_title")}</h2>
```

---

## 3. Add New Locale

### Step 1: Create translation file

```bash
cp messages/en.json messages/hi.json
```

### Step 2: Register in i18n system

Edit `src/lib/shared/i18n/i18n.svelte.ts`:

```typescript
export const locales = [
  "en", "es", "fr", "de", "pt", "zh", "ja", "ko", "ar", "ru", "it",
  "hi", // Add here
] as const;
```

### Step 3: Add dynamic import

Same file:

```typescript
async function loadLocaleMessages(locale: Locale): Promise<Messages> {
  switch (locale) {
    // ... existing cases
    case "hi":
      return (await import("../../../../messages/hi.json")).default as Messages;
    // ...
  }
}
```

### Step 4: Add to language selector

Edit `src/lib/shared/settings/components/tabs/LanguageTab.svelte`:

```typescript
const languageNames: Record<Locale, { native: string; english: string }> = {
  // ... existing
  hi: { native: "हिन्दी", english: "Hindi" },
};
```

Done! Users can now select Hindi in settings.

---

## 4. RTL Languages (Arabic, Hebrew, etc.)

If adding RTL locale, register it:

Edit `src/lib/shared/i18n/i18n.svelte.ts`:

```typescript
export const rtlLocales: ReadonlyArray<Locale> = ["ar", "he", "ur"] as const;
```

The `<html dir="rtl">` attribute is automatically applied.

**CSS requirements:** Use logical properties. See [RTL Migration Guide](./RTL-MIGRATION.md).

---

## 5. Validation

### Check for missing translations

```bash
npm run i18n:validate
```

### Auto-fix missing keys

```bash
npm run i18n:validate:fix
```

### Check adoption rate

```bash
npm run i18n:coverage
```

Shows what % of components use translations.

---

## 6. Common Patterns

### Dynamic keys (computed at runtime)

```svelte
<script lang="ts">
  import { tDynamic } from "$lib/shared/i18n/i18n.svelte.js";

  let moduleId = $state("create");
</script>

<h2>{tDynamic(`module_${moduleId}`)}</h2>
```

### Switching locales programmatically

```svelte
<script lang="ts">
  import { setLocale } from "$lib/shared/i18n/i18n.svelte.js";

  async function switchToSpanish() {
    await setLocale("es");
    // UI updates automatically
  }
</script>
```

### Getting current locale

```svelte
<script lang="ts">
  import { getLocale } from "$lib/shared/i18n/i18n.svelte.js";

  const currentLocale = getLocale(); // Reactive
</script>

<p>Language: {currentLocale}</p>
```

---

## 7. Naming Conventions

**Prefix by module/feature:**

```json
{
  "generator_level": "Level",
  "generator_mode": "Mode",
  "browse_title": "Browse",
  "settings_profile": "Profile"
}
```

**Use snake_case:**
- ✅ `generator_level_no_turns`
- ❌ `generatorLevelNoTurns`
- ❌ `Generator Level - No Turns`

**Be specific:**
- ✅ `generator_level_whole_turns`
- ❌ `level_2`

---

## 8. Security Note

**Only pass trusted values as parameters:**

```svelte
<!-- ✅ SAFE - system data -->
{t("dashboard_welcome", { name: firebaseUserName })}
{t("sequence_count", { count: 42 })}

<!-- ❌ UNSAFE - user input -->
{t("message_from", { content: formInputValue })}
```

Unsanitized user input in translations = XSS risk.

---

## Need More Details?

- [Full i18n System Guide](./I18N-SYSTEM.md) - Architecture, performance, everything
- [Code Examples](./i18n-examples.md) - Copy-paste patterns
- [RTL Migration](./RTL-MIGRATION.md) - Right-to-left language support
- [ADR 001](./adr/001-json-based-i18n.md) - Why we chose JSON over Paraglide

---

## Troubleshooting

**"Missing translation key: X"**
```bash
npm run i18n:validate:fix
```

**TypeScript error on `t("key")`**
```bash
npm run i18n:types
```

**Locale won't switch**
- Check locale is in `locales` array
- Check dynamic import exists in `loadLocaleMessages()`
- Check `messages/{locale}.json` file exists

**RTL layout broken**
```bash
npm run css:rtl
```
Migrate properties shown in report to logical properties.

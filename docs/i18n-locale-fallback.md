# Locale Fallback Chains

Support regional language variants without duplicating all translations.

---

## Overview

**Problem:** Spanish speakers in Mexico and Argentina have different vocabulary preferences, but translating all 1,398 keys twice is wasteful.

**Solution:** Regional locales fall back to base locales, which fall back to English.

**Fallback chain:**
```
es-MX → es → en
```

If a translation key is missing in Mexican Spanish, use standard Spanish. If missing there too, use English.

---

## Supported Regional Locales

| Regional Locale | Base Locale | Description |
|-----------------|-------------|-------------|
| `es-MX` | `es` | Spanish (Mexico) |
| `es-AR` | `es` | Spanish (Argentina) |
| `pt-BR` | `pt` | Portuguese (Brazil) |
| `pt-PT` | `pt` | Portuguese (Portugal) |
| `zh-CN` | `zh` | Chinese (Simplified) |
| `zh-TW` | `zh` | Chinese (Traditional) |
| `fr-CA` | `fr` | French (Canada) |

---

## How It Works

### 1. Automatic Base Locale Loading

When a user selects a regional locale, the system automatically loads both files:

```typescript
// User selects es-MX
await setLocale("es-MX");

// System automatically loads:
// 1. messages/es.json (base Spanish)
// 2. messages/es-MX.json (Mexican overrides, if exists)
```

### 2. Fallback Chain in Translation

When translating a key:

```typescript
t("some_key");

// Lookup order:
// 1. messages/es-MX.json (if file exists)
// 2. messages/es.json (base locale)
// 3. messages/en.json (always available)
// 4. Return key name as fallback
```

This happens **automatically**. No special syntax needed.

### 3. Partial Override Files

Regional locale files **only need keys that differ** from the base locale.

**Example: Mexican Spanish overrides**

`messages/es-MX.json`:
```json
{
  "generator_slice_size_2": "2 tiempos",
  "generator_slice_size_4": "4 tiempos"
}
```

All other keys fall back to `messages/es.json`.

---

## Adding a New Regional Locale

### Step 1: Register the locale

Edit `src/lib/shared/i18n/i18n.svelte.ts`:

```typescript
export const regionalLocales = [
  "es-MX",
  "es-AR",
  "es-CL", // Add Chilean Spanish
] as const;
```

### Step 2: (Optional) Create override file

Only create this if you have region-specific translations:

`messages/es-CL.json`:
```json
{
  "greeting": "¡Hola, po!",
  "goodbye": "Chao"
}
```

**If you DON'T create this file**, the locale will simply use the base locale (`es`) for all keys.

### Step 3: Add to language selector

Edit `src/lib/shared/settings/components/tabs/LanguageTab.svelte`:

```typescript
const languageNames: Record<Locale, { native: string; english: string }> = {
  // ... existing
  "es-CL": { native: "Español (Chile)", english: "Spanish (Chile)" },
};
```

### Step 4: Test fallback chain

```typescript
// In component:
import { setLocale, t } from "$lib/shared/i18n/i18n.svelte.js";

await setLocale("es-CL");

// If key exists in es-CL.json:
t("greeting"); // "¡Hola, po!" (from es-CL.json)

// If key NOT in es-CL.json:
t("app_name"); // "TKA Scribe" (from es.json)

// If key NOT in es-CL.json OR es.json:
t("some_key"); // Value from en.json
```

---

## Use Cases

### 1. Regional Vocabulary

**Portuguese (Brazil) vs Portuguese (Portugal):**

`messages/pt-BR.json`:
```json
{
  "computer": "computador",
  "cell_phone": "celular"
}
```

`messages/pt-PT.json`:
```json
{
  "computer": "computador",
  "cell_phone": "telemóvel"
}
```

### 2. Cultural References

**Spanish (Argentina) - voseo verb forms:**

`messages/es-AR.json`:
```json
{
  "settings_save_prompt": "¿Querés guardar los cambios?"
}
```

vs standard Spanish (`messages/es.json`):
```json
{
  "settings_save_prompt": "¿Quieres guardar los cambios?"
}
```

### 3. Simplified vs Traditional Chinese

**Different character sets:**

`messages/zh-CN.json` - Simplified characters:
```json
{
  "app_name": "TKA 编码器"
}
```

`messages/zh-TW.json` - Traditional characters:
```json
{
  "app_name": "TKA 編碼器"
}
```

---

## Browser Language Detection

The system automatically detects regional locales from browser settings:

```javascript
navigator.languages = ["es-MX", "es", "en-US", "en"];

// System picks "es-MX" automatically on first visit
```

Fallback order if regional locale not supported:
1. Try exact match (`es-MX`) - ✅ Supported
2. Try base locale (`es`) - If regional not supported
3. Try next browser language
4. Default to English

---

## Performance

**No performance penalty for regional locales:**

| Scenario | Network Requests | Cache Hits |
|----------|------------------|------------|
| Load `es` (base) | 1 (es.json) | - |
| Load `es-MX` (first time) | 2 (es.json + es-MX.json) | - |
| Load `es-MX` (subsequent) | 0 | Both cached |
| Switch `es-MX` → `es-AR` | 1 (es-AR.json) | es.json cached |

Both locales share the base locale cache.

---

## Validation

### Check Regional Overrides

```bash
npm run i18n:validate
```

Ensures regional locale files are valid subsets of base locale.

**What it checks:**
- Keys in `es-MX.json` must exist in `es.json`
- Parameter placeholders match base locale
- JSON is valid

**Example validation error:**

```
❌ Regional locale es-MX contains invalid keys:
   - made_up_key (not in base locale es)
```

### Testing Fallback Behavior

```typescript
// tests/unit/i18n-fallback.test.ts
import { setLocale, t } from "$lib/shared/i18n/i18n.svelte.ts";

describe("Locale fallback chain", () => {
  it("falls back to base locale", async () => {
    await setLocale("es-MX");

    // Key exists in es.json but not es-MX.json
    expect(t("app_name")).toBe("TKA Scribe");
  });

  it("uses regional override when available", async () => {
    await setLocale("es-MX");

    // Key exists in es-MX.json
    expect(t("greeting")).toBe("¡Hola!"); // Mexican variant
  });

  it("falls back to English as final resort", async () => {
    await setLocale("es-MX");

    // Key missing from both es-MX.json and es.json
    expect(t("some_new_key")).toBe("Some New Key"); // English fallback
  });
});
```

---

## Migration from Single Locale

If you have a monolithic `messages/es.json` with regional variants mixed in:

### Before (mixed):
```json
{
  "greeting": "Hola",
  "greeting_argentina": "Che, ¿qué tal?",
  "greeting_mexico": "¿Qué onda?"
}
```

### After (split):

`messages/es.json` (neutral Spanish):
```json
{
  "greeting": "Hola"
}
```

`messages/es-AR.json` (Argentina only):
```json
{
  "greeting": "Che, ¿qué tal?"
}
```

`messages/es-MX.json` (Mexico only):
```json
{
  "greeting": "¿Qué onda?"
}
```

Components update automatically - no code changes needed.

---

## Future Enhancements

### 1. Automatic Translation Suggestions

For new keys added to base locale:

```bash
npm run i18n:suggest-regional es-MX
```

Use Claude API to suggest region-specific translations for new keys.

### 2. Regional Locale Coverage Reports

```bash
npm run i18n:coverage --regional
```

Show what % of keys have regional overrides:

```
Regional Locale Coverage:
  es-MX: 12/1,398 keys (0.9%) - mostly vocabulary
  pt-BR: 45/1,398 keys (3.2%) - includes cultural refs
```

### 3. Dialect-Aware Validation

Validate that regional overrides are actually different from base:

```
⚠️  es-MX override for "app_name" is identical to es.json
   Consider removing redundant key
```

---

## Best Practices

### 1. Start with Base Locale

Translate the full base locale (`es`, `pt`, `zh`) before creating regional variants.

### 2. Only Override When Necessary

Don't duplicate keys that are identical. Regional files should be small.

### 3. Document Regional Differences

Add comments to regional JSON files explaining why keys differ:

```json
{
  "_comment": "Mexican Spanish uses 'computadora' instead of 'ordenador'",
  "computer": "computadora"
}
```

### 4. Test with Native Speakers

Regional differences can be subtle. Have native speakers review overrides.

---

## Troubleshooting

### Regional locale not showing in selector

Check:
1. Is it in `regionalLocales` array?
2. Is it in `languageNames` mapping?
3. Restart dev server after adding

### Fallback not working

Check:
1. Is base locale loaded? (Check network tab)
2. Is key spelled correctly?
3. Run `npm run i18n:validate`

### Override file ignored

Check:
1. File named correctly? (`messages/es-MX.json`)
2. Valid JSON syntax?
3. Keys match exact spelling in base locale?

---

## References

- [IETF BCP 47 Language Tags](https://www.rfc-editor.org/rfc/bcp/bcp47.txt)
- [Navigator.languages API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/languages)
- [Main i18n Guide](./I18N-SYSTEM.md)

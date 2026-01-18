# Pluralization & Gender Support

How to handle plural forms and gender variants in translations.

---

## Current Status

TKA Scribe uses **simple parameter interpolation** without built-in pluralization or gender support.

**This is intentional** - the current system handles 100% of our use cases without the complexity of ICU MessageFormat.

**When to add full pluralization:** If user feedback requests support for languages with complex plural rules (Russian, Arabic, Polish, etc.).

---

## Current Workarounds

### 1. Separate Keys for Plural Forms

**Current approach:**

`messages/en.json`:
```json
{
  "library_one_sequence": "1 sequence",
  "library_many_sequences": "{count} sequences"
}
```

Usage:
```svelte
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  let count = $state(5);
</script>

<p>
  {count === 1
    ? t("library_one_sequence")
    : t("library_many_sequences", { count })}
</p>
```

**Pros:**
- Simple, explicit, no magic
- Works in all languages
- Type-safe

**Cons:**
- Verbose for languages with >2 plural forms
- Logic repeated in components

### 2. Helper Functions

Create domain-specific helpers:

```typescript
// src/lib/shared/i18n/pluralization-helpers.ts
import { t } from "./i18n.svelte.js";

export function sequenceCount(count: number): string {
  return count === 1
    ? t("library_one_sequence")
    : t("library_many_sequences", { count });
}
```

Usage:
```svelte
<p>{sequenceCount(count)}</p>
```

**Pros:**
- Centralizes logic
- Type-safe
- Easy to extend

**Cons:**
- Need a helper per pluralizable noun
- Doesn't handle complex plural rules

---

## Plural Rules by Language

| Language | Plural Forms | Example |
|----------|--------------|---------|
| English | 2 (one, other) | 1 cat, 2 cats |
| French | 2 (one, other) | 1 chat, 2 chats |
| Russian | 3 (one, few, many) | 1 кот, 2 кота, 5 котов |
| Arabic | 6 (zero, one, two, few, many, other) | Complex |
| Chinese | 1 (other) | No plurals |
| Polish | 3 (one, few, many) | 1 kot, 2 koty, 5 kotów |

**Languages we currently support:**
- English, Spanish, French, German, Portuguese, Italian, Russian, Japanese, Korean, Chinese, Arabic

**Of these, only Russian and Arabic have complex plural rules.**

---

## When to Implement Full Pluralization

### Indicators you need it:

1. **User feedback** - Russian/Arabic speakers request it
2. **Translator complaints** - "I can't translate this properly"
3. **Code duplication** - 20+ plural helper functions
4. **Conditional hell** - Components full of `count === 1 ? ... : ...`

### Current status: **Not needed yet**

The 11 supported languages work fine with current approach:
- 9/11 languages have simple plural rules (0-2 forms)
- Russian translations use workarounds successfully
- Arabic hasn't been requested by users

---

## Future: ICU MessageFormat Implementation

When pluralization becomes necessary, integrate `@formatjs/intl`.

### Step 1: Install dependencies

```bash
npm install @formatjs/intl @formatjs/icu-messageformat-parser
```

Bundle size impact: ~10-15KB gzipped

### Step 2: Update translation format

`messages/en.json`:
```json
{
  "library_sequence_count": "{count, plural, =0 {No sequences} one {# sequence} other {# sequences}}"
}
```

`messages/ru.json`:
```json
{
  "library_sequence_count": "{count, plural, one {# последовательность} few {# последовательности} many {# последовательностей}}"
}
```

### Step 3: Update `t()` function

```typescript
import { IntlMessageFormat } from "@formatjs/intl";

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  let text = messages[key];

  if (!text) {
    // ... fallback logic
  }

  // Check if message uses ICU syntax
  if (text.includes("{") && (text.includes("plural") || text.includes("select"))) {
    const msg = new IntlMessageFormat(text, currentLocale);
    return msg.format(params) as string;
  }

  // Simple interpolation for non-ICU messages
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramValue));
    }
  }

  return text;
}
```

### Step 4: Usage remains simple

```svelte
<p>{t("library_sequence_count", { count })}</p>
<!-- Automatically handles plurals for all languages -->
```

---

## Gender Support

### Current Approach

Use separate keys per gender:

`messages/en.json`:
```json
{
  "profile_they_created": "{name} created a sequence",
  "profile_activity_count": "{count} activities"
}
```

English doesn't have grammatical gender for most nouns.

### Languages with Grammatical Gender

**French example:**

Without ICU MessageFormat:
```json
{
  "profile_friend_male": "{name} est connecté",
  "profile_friend_female": "{name} est connectée"
}
```

With ICU MessageFormat:
```json
{
  "profile_friend": "{name} est {gender, select, male {connecté} female {connectée} other {connecté}}"
}
```

### When to implement: **When supporting French or German**

Currently, French translations avoid gender-specific wording where possible.

---

## Testing Pluralization

When ICU MessageFormat is added:

```typescript
// tests/unit/i18n-pluralization.test.ts
import { setLocale, t } from "$lib/shared/i18n/i18n.svelte.ts";

describe("Pluralization", () => {
  it("handles English plurals", async () => {
    await setLocale("en");
    expect(t("sequence_count", { count: 0 })).toBe("No sequences");
    expect(t("sequence_count", { count: 1 })).toBe("1 sequence");
    expect(t("sequence_count", { count: 5 })).toBe("5 sequences");
  });

  it("handles Russian plurals", async () => {
    await setLocale("ru");
    expect(t("sequence_count", { count: 1 })).toContain("последовательность");
    expect(t("sequence_count", { count: 2 })).toContain("последовательности");
    expect(t("sequence_count", { count: 5 })).toContain("последовательностей");
  });
});
```

---

## Performance Considerations

| Approach | Bundle Size | Runtime Cost |
|----------|-------------|--------------|
| Current (simple interpolation) | ~2KB | Negligible |
| ICU MessageFormat | +12KB | Small (parser + formatter) |
| Full Intl.PluralRules polyfill | +25KB | Medium |

**Recommendation:** Only add when needed. Current approach is 6x smaller.

---

## Migration Path

If/when we implement ICU MessageFormat:

### 1. Gradual Migration

Old syntax continues to work:
```json
{
  "old_key": "Simple {param} interpolation",
  "new_key": "{count, plural, one {# item} other {# items}}"
}
```

### 2. Validation Script

Add check to `scripts/validate-i18n.cjs`:

```javascript
// Detect keys that should use plural syntax
function detectPluralizableKeys(messages) {
  const suspects = [];

  for (const [key, value] of Object.entries(messages)) {
    // Check for patterns like "1 X" and "{count} Xs"
    if (key.includes("_one_") || key.includes("_many_")) {
      suspects.push(key);
    }
  }

  return suspects;
}
```

Output:
```
💡 Consider using plural syntax for these keys:
   - library_one_sequence
   - library_many_sequences
   → Migrate to: library_sequence_count with ICU plural syntax
```

### 3. Automated Conversion

```bash
npm run i18n:convert-to-icu
```

Finds paired `*_one_*` and `*_many_*` keys and suggests ICU equivalents.

---

## Alternatives to ICU MessageFormat

### Option 1: Fluent

Mozilla's Fluent syntax (simpler than ICU):

```fluent
sequence-count =
  { $count ->
      [one] { $count } sequence
     *[other] { $count } sequences
  }
```

**Pros:**
- Cleaner syntax than ICU
- Designed for localization

**Cons:**
- Different parser needed
- Less common than ICU

### Option 2: Custom Plural Helper

Lightweight custom implementation:

```typescript
export function plural(
  count: number,
  forms: { zero?: string; one: string; other: string }
): string {
  if (count === 0 && forms.zero) return forms.zero;
  if (count === 1) return forms.one;
  return forms.other.replace("#", String(count));
}
```

Usage:
```svelte
<p>{plural(count, {
  zero: "No sequences",
  one: "1 sequence",
  other: "# sequences"
})}</p>
```

**Pros:**
- Zero bundle size
- Type-safe
- Simple

**Cons:**
- Doesn't handle complex languages (Russian, Arabic)
- Not standards-based

---

## Best Practices

### 1. Avoid Pluralization When Possible

Instead of:
```
"You have {count} items"
```

Use:
```
"Items: {count}"
```

No plural needed.

### 2. Use Separate Keys for Now

Until user demand justifies ICU MessageFormat, separate keys work fine:

```json
{
  "one_item": "1 item",
  "many_items": "{count} items"
}
```

### 3. Document Plural Context

Add comments for translators:

```json
{
  "_library_sequence_count": "Plural context: 1 sequence / 5 sequences",
  "library_one_sequence": "1 sequence",
  "library_many_sequences": "{count} sequences"
}
```

### 4. Test with Edge Cases

Always test:
- 0 items (English: "0 items", but consider "No items")
- 1 item
- 2 items (different in some languages)
- 5 items
- Large numbers (1,000+)

---

## Decision Matrix

| Requirement | Recommendation |
|-------------|----------------|
| Only English/Spanish/French | Keep current system |
| Adding Russian/Polish/Arabic | Consider ICU MessageFormat |
| 50+ plural keys | Consider ICU MessageFormat |
| Bundle size critical | Stick with helpers |
| Translator feedback requests it | Implement ICU MessageFormat |

**Current status:** Keep current system until user/translator feedback.

---

## Resources

- [ICU MessageFormat Guide](https://formatjs.io/docs/core-concepts/icu-syntax/)
- [Unicode CLDR Plural Rules](https://www.unicode.org/cldr/charts/43/supplemental/language_plural_rules.html)
- [Mozilla Fluent](https://projectfluent.org/)
- [@formatjs/intl docs](https://formatjs.io/docs/intl-messageformat)

---

## Summary

**Current approach:** Simple interpolation + conditional logic
**When to change:** User feedback from Russian/Arabic speakers
**How to change:** Integrate @formatjs/intl with ICU MessageFormat
**Timeline:** Not needed yet - document for future

This pragmatic approach keeps the bundle small and code simple until complexity is justified by real user needs.

# Adding Your Photo to Premium Page

## Quick Instructions

1. **Find a good photo** - preferably square, showing your face clearly
2. **Name it `austen.jpg`** (or `austen.png`)
3. **Drop it in this directory** (`static/images/`)
4. **That's it** - the premium page will automatically display it

## Technical Details

- **Recommended size**: 400x400px minimum (will be scaled to 120x120px)
- **Supported formats**: JPG, PNG, WebP
- **Aspect ratio**: Square (1:1) works best
- **File size**: Keep under 500KB for performance
- **Backup**: If the image fails to load, a placeholder icon appears automatically

## Current Path

The PremiumShowcase component looks for:

```
/images/austen.jpg
```

Which maps to:

```
F:\_THE KINETIC ALPHABET\_TKA-SCRIBE\static\images\austen.jpg
```

## To Change the Filename

Edit `PremiumShowcase.svelte` line 57:

```svelte
<img
  src="/images/YOUR_FILENAME_HERE.jpg"
  alt="Austen Cloud"
  onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"
/>
```

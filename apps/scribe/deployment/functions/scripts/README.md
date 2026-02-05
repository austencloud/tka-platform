# YouTube Audio Extraction Setup

This guide walks you through setting up cookie-based authentication for YouTube audio extraction to bypass bot detection.

## Quick Start

### 1. Export YouTube Cookies

**Option A: Browser Extension (Recommended)**

For Chrome/Edge:

1. Install [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
2. Go to https://www.youtube.com and log in
3. Click the extension icon → "Export" → Save as `youtube-cookies.txt`

For Firefox:

1. Install [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)
2. Go to https://www.youtube.com and log in
3. Click the extension icon → Save as `youtube-cookies.txt`

**Option B: Using yt-dlp** (if installed)

```bash
yt-dlp --cookies-from-browser chrome --cookies youtube-cookies.txt https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

### 2. Upload Cookies to Cloud Storage

From the project root:

```bash
node deployment/scripts/upload-youtube-cookies.js path/to/youtube-cookies.txt
```

Or manually:

```bash
firebase storage:upload youtube-cookies.txt youtube-cookies.txt --project the-kinetic-alphabet
```

### 3. Deploy Updated Cloud Function

```bash
cd deployment
firebase deploy --only functions
```

### 4. Test

Try extracting audio from a YouTube video in your app. It should now work!

## Troubleshooting

### "Sign in to confirm you're not a bot" error

- Your cookies may have expired. Re-export and upload fresh cookies.
- Make sure you were logged into YouTube when exporting cookies.

### Function still failing after cookie upload

- Verify the cookies file was uploaded: check Firebase Console → Storage
- Check Cloud Function logs: `firebase functions:log --project the-kinetic-alphabet`
- Ensure you deployed the updated function code

### Cookies expire frequently

- YouTube cookies typically last 1-2 months
- Set a reminder to refresh cookies monthly
- Check logs for authentication errors

## Security Notes

- **Never commit `youtube-cookies.txt` to git** - it contains your YouTube session
- The `.gitignore` is configured to exclude `*.txt` files in this directory
- Cookies are stored in Cloud Storage with restricted access
- Only the Cloud Function service account can access the cookies

## How It Works

1. Cloud Function downloads cookies from Storage on each request
2. Passes cookies to `yt-dlp` via `--cookies` flag
3. YouTube accepts the request as authenticated
4. Cookies file is cleaned up after extraction

## Maintenance

Re-export and upload cookies when:

- Audio extraction starts failing with bot detection errors
- You change YouTube accounts
- It's been 1-2 months since last update

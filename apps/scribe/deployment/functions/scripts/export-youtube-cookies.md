# Export YouTube Cookies for Audio Extraction

YouTube requires authentication to prevent bot detection. Follow these steps to export your cookies:

## Method 1: Using Browser Extension (Easiest)

### Chrome/Edge

1. Install [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
2. Navigate to https://www.youtube.com
3. Make sure you're logged in
4. Click the extension icon
5. Click "Export" → Save as `youtube-cookies.txt`

### Firefox

1. Install [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)
2. Navigate to https://www.youtube.com
3. Make sure you're logged in
4. Click the extension icon
5. Save as `youtube-cookies.txt`

## Method 2: Using yt-dlp (Advanced)

If you have Chrome installed:

```bash
yt-dlp --cookies-from-browser chrome --cookies youtube-cookies.txt https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

This will extract cookies from your Chrome browser and save them.

## Upload to Firebase Storage

Once you have `youtube-cookies.txt`:

```bash
# From the deployment directory
firebase storage:upload youtube-cookies.txt youtube-cookies.txt --project the-kinetic-alphabet
```

**Security Note**: These cookies contain your YouTube session. Keep them private and never commit to git.

## Refresh Cookies

YouTube cookies expire periodically. If extraction starts failing again:

1. Re-export cookies using the steps above
2. Re-upload to Firebase Storage
3. The Cloud Function will automatically use the new cookies

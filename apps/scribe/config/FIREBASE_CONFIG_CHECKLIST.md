# Firebase Configuration Checklist

## ✅ Current Status

Your app is configured for:

- **Project ID**: `the-kinetic-alphabet`
- **Auth Domain**: `the-kinetic-alphabet.firebaseapp.com`

## 🔍 Step-by-Step Verification

### 1. App Configuration (Already Done)

Check `src/lib/shared/auth/firebase.ts` - it's hardcoded to use the correct project:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDKUM9pf0e_KgFjW1OBKChvrU75SnR12v4",
  authDomain: "the-kinetic-alphabet.firebaseapp.com",
  projectId: "the-kinetic-alphabet",
  storageBucket: "the-kinetic-alphabet.firebasestorage.app",
  messagingSenderId: "664225703033",
  appId: "1:664225703033:web:62e6c1eebe4fff3ef760a8",
  measurementId: "G-CQH94GGM6B",
};
```

✅ **This is correct**

### 2. Firebase Console Configuration

Go to https://console.firebase.google.com/

1. Select project: **the-kinetic-alphabet**
2. Click "Authentication" → "Sign-in method"
3. Verify these providers are ENABLED:
   - ✅ Google
   - ✅ Email/Password
   - (Optional) Facebook

4. Click "Authentication" → "Settings" → "Authorized domains"
5. Verify these domains are listed:
   - ✅ `localhost`
   - ✅ `the-kinetic-alphabet.firebaseapp.com`
   - ✅ `the-kinetic-alphabet.web.app`
   - ✅ Any custom domains you use

### 3. Google Cloud Console Configuration

Go to https://console.cloud.google.com/

1. Select project: **the-kinetic-alphabet**
2. Click "APIs & Services" → "Credentials"
3. Find your OAuth 2.0 Client ID (Web client)
4. Verify "Authorized JavaScript origins":
   - ✅ `http://localhost`
   - ✅ `http://localhost:5173`
   - ✅ `https://the-kinetic-alphabet.firebaseapp.com`
   - ✅ `https://the-kinetic-alphabet.web.app`

5. Verify "Authorized redirect URIs":
   - ✅ `http://localhost`
   - ✅ `http://localhost:5173`
   - ✅ `https://the-kinetic-alphabet.firebaseapp.com/__/auth/handler`
   - ✅ `https://the-kinetic-alphabet.web.app/__/auth/handler`

### 4. Firestore Rules

Go to Firebase Console → Firestore Database → Rules

Ensure your rules allow authenticated users to access their data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 🧹 Cache Diagnostics (NEW!)

### Access the Developer Tab

1. Open your app
2. Click your profile picture (top right)
3. Go to "Developer" tab
4. Click "🔍 Refresh Diagnostics"

### What to Check

**🚨 RED FLAGS:**

- Any database named `the-kinetic-constructor` (OLD PROJECT)
- Any localStorage keys referencing `the-kinetic-constructor`

**✅ GOOD:**

- Only `the-kinetic-alphabet` databases
- Clean localStorage/sessionStorage

### If You See Old Data

Click **💣 Nuclear Cache Clear** button - this will:

- Delete ALL IndexedDB databases
- Clear ALL localStorage
- Clear ALL sessionStorage
- Clear ALL cookies
- Reload the page

## 📱 Testing on Mobile

### To Access Diagnostics on Mobile:

1. Open app on your phone
2. Tap profile picture → Settings
3. Tap "Developer" tab
4. View diagnostics and clear cache if needed

### Copy Diagnostics:

Tap **📋 Copy Diagnostics** to copy the full report to clipboard, then paste it in Discord/email to share with me.

## 🐛 Debugging Auth Issues

### Check Browser Console

Look for these key messages after clicking "Sign in with Google":

```
✅ Good:
🔥 [authState] Firebase Config: {projectId: "the-kinetic-alphabet", ...}
📦 [authState] Firebase IndexedDB databases: [...]
✅ [authState] Sign-in redirect successful

❌ Bad:
🚨 [authState] OLD PROJECT DATABASE DETECTED: ...
❌ [authState] Redirect result error: ...
```

### Test Sequence

1. **Clear cache first** (Developer tab)
2. **Wait for page reload**
3. **Open Settings** → Developer tab
4. **Verify diagnostics** show NO old-project data
5. **Try signing in with Google**
6. **Check console** for success/error messages

## 🆘 Still Not Working?

If you still have issues after:

1. ✅ Verifying all Firebase/Google Cloud configs
2. ✅ Running Nuclear Cache Clear
3. ✅ Confirming NO `the-kinetic-constructor` references

Then copy the full diagnostics output and send it to me with:

- Browser console logs (from the moment you click Sign in to when it fails)
- Screenshot of the Developer tab diagnostics
- What browser/device you're using

## 📝 Quick Reference

| Config File            | Purpose                             |
| ---------------------- | ----------------------------------- |
| `firebase.ts`          | App Firebase config (hardcoded)     |
| `authState.svelte.ts`  | Auth state management + diagnostics |
| `nuclearCacheClear.ts` | Cache clearing utilities            |
| `DeveloperTab.svelte`  | UI for diagnostics                  |

**Current Project**: `the-kinetic-alphabet`
**Old Project** (should be gone): `the-kinetic-constructor`

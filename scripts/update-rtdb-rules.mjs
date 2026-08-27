import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const sa = JSON.parse(readFileSync('serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    databaseURL: 'https://the-kinetic-alphabet-default-rtdb.firebaseio.com'
  });
}

const newRules = {
  rules: {
    presence: {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && (auth.uid == $uid || auth.token.admin == true)"
      }
    },
    "gallery-sessions": {
      "$sessionId": {
        meta: {
          ".read": "auth != null",
          ".write": "auth != null && (!data.exists() || data.child('hostId').val() == auth.uid)"
        },
        players: {
          "$userId": {
            ".read": "auth != null",
            ".write": "auth != null && auth.uid == $userId"
          }
        },
        chat: {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      }
    },
    "sync-rooms": {
      // Any authenticated user can browse all sync rooms
      ".read": "auth != null",
      "$roomId": {
        // Any authenticated user can create/update/delete sync rooms
        ".write": "auth != null"
      }
    }
  }
};

try {
  await admin.database().setRules(newRules);
  console.log("RTDB rules updated successfully!");
  console.log("Added: sync-rooms — authenticated users can read all, write rooms.");

  const rules = await admin.database().getRules();
  const parsed = JSON.parse(rules);
  if (parsed.rules["sync-rooms"]) {
    console.log("Verified: sync-rooms rules present.");
  } else {
    console.error("WARNING: sync-rooms rules NOT found after update!");
  }
  process.exit(0);
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}

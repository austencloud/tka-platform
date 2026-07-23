/**
 * Submit Feedback - Reusable feedback submission script
 *
 * Usage:
 *   node scripts/submit-feedback.js <title> <description> [options]
 *
 * Options:
 *   --type <bug|feature|general>     Feedback type (default: feature)
 *   --priority <low|medium|high|critical>  Priority level (default: medium)
 *   --module <module>                Captured module (default: system)
 *   --tab <tab>                      Captured tab (default: general)
 *   --subtasks <json>                JSON array of subtasks
 *   --user <austen|claude|email|uid> User profile (default: austen)
 *
 * Examples:
 *   node scripts/submit-feedback.js "Fix login bug" "Users can't login with email"
 *   node scripts/submit-feedback.js "Add dark mode" "Support dark theme" --type feature --priority high
 *   node scripts/submit-feedback.js "Video drawer" "Implement video recording" --subtasks '[{"id":"1","title":"Create UI","description":"Build drawer UI","status":"pending"}]'
 */

import config from "../config/feedback.config.js";

// Known user profiles - use config for austen profile
const USER_PROFILES = {
  austen: {
    userId: config.ADMIN_USER.userId,
    userEmail: config.ADMIN_USER.email,
    userDisplayName: config.ADMIN_USER.displayName,
  },
  claude: {
    userId: "system",
    userEmail: "admin@thekineticalphabetapp.com",
    userDisplayName: "Claude Agent",
  },
};

import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFile } from "fs/promises";

const SERVICE_ACCOUNT_PATH = "serviceAccountKey.json";

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("❌ Error: Missing required arguments");
    console.error("");
    console.error("Usage:");
    console.error(
      "  node scripts/submit-feedback.js <title> <description> [options]"
    );
    console.error("");
    console.error("Options:");
    console.error(
      "  --type <bug|feature|general>              Feedback type (default: feature)"
    );
    console.error(
      "  --priority <low|medium|high|critical>     Priority level (default: medium)"
    );
    console.error(
      "  --module <module>                         Captured module (default: system)"
    );
    console.error(
      "  --tab <tab>                               Captured tab (default: general)"
    );
    console.error(
      "  --subtasks <json>                         JSON array of subtasks"
    );
    console.error(
      "  --user <austen|claude|email|uid>          User profile (default: austen)"
    );
    console.error("");
    console.error("Examples:");
    console.error(
      '  node scripts/submit-feedback.js "Fix login bug" "Users can\'t login"'
    );
    console.error(
      '  node scripts/submit-feedback.js "Add dark mode" "Support dark theme" --type feature --priority high'
    );
    process.exit(1);
  }

  const title = args[0];
  const description = args[1];

  const options = {
    type: "feature",
    priority: "medium",
    module: "system",
    tab: "general",
    subtasks: null,
    user: "austen", // Default to Austen's profile
  };

  // Parse options
  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--type" && args[i + 1]) {
      options.type = args[i + 1];
      i++;
    } else if (args[i] === "--priority" && args[i + 1]) {
      options.priority = args[i + 1];
      i++;
    } else if (args[i] === "--module" && args[i + 1]) {
      options.module = args[i + 1];
      i++;
    } else if (args[i] === "--tab" && args[i + 1]) {
      options.tab = args[i + 1];
      i++;
    } else if (args[i] === "--subtasks" && args[i + 1]) {
      try {
        options.subtasks = JSON.parse(args[i + 1]);
      } catch (err) {
        console.error("❌ Error: Invalid JSON for subtasks");
        process.exit(1);
      }
      i++;
    } else if (args[i] === "--user" && args[i + 1]) {
      options.user = args[i + 1];
      i++;
    }
  }

  // Validate type
  const validTypes = ["bug", "feature", "general"];
  if (!validTypes.includes(options.type)) {
    console.error(
      `❌ Error: Invalid type "${options.type}". Must be one of: ${validTypes.join(", ")}`
    );
    process.exit(1);
  }

  // Validate priority
  const validPriorities = ["low", "medium", "high", "critical"];
  if (!validPriorities.includes(options.priority)) {
    console.error(
      `❌ Error: Invalid priority "${options.priority}". Must be one of: ${validPriorities.join(", ")}`
    );
    process.exit(1);
  }

  return { title, description, ...options };
}

async function resolveUserProfile(db, userIdentifier) {
  const knownProfile = USER_PROFILES[userIdentifier.toLowerCase()];
  if (knownProfile) {
    return {
      ...knownProfile,
      userPhotoURL: null,
    };
  }

  const auth = getAuth();
  const userRecord = userIdentifier.includes("@")
    ? await auth.getUserByEmail(userIdentifier)
    : await auth.getUser(userIdentifier);
  const profileSnapshot = await db
    .collection("users")
    .doc(userRecord.uid)
    .get();
  const storedProfile = profileSnapshot.exists
    ? profileSnapshot.data()
    : {};

  return {
    userId: userRecord.uid,
    userEmail:
      storedProfile?.email ??
      userRecord.email ??
      (userIdentifier.includes("@") ? userIdentifier : ""),
    userDisplayName:
      storedProfile?.displayName ??
      storedProfile?.name ??
      userRecord.displayName ??
      userRecord.email?.split("@")[0] ??
      userRecord.uid,
    userPhotoURL:
      storedProfile?.photoURL ??
      storedProfile?.photoUrl ??
      userRecord.photoURL ??
      null,
  };
}

async function submitFeedback(params) {
  try {
    // Load service account
    const serviceAccount = JSON.parse(
      await readFile(SERVICE_ACCOUNT_PATH, "utf8")
    );

    // Initialize Firebase Admin
    initializeApp({
      credential: cert(serviceAccount),
    });

    const db = getFirestore();

    // Resolve user profile
    const userProfile = await resolveUserProfile(db, params.user);

    // Create feedback item
    const feedbackData = {
      // User info
      userId: userProfile.userId,
      userEmail: userProfile.userEmail,
      userDisplayName: userProfile.userDisplayName,
      userPhotoURL: userProfile.userPhotoURL,

      // Feedback content
      type: params.type,
      title: params.title,
      description: params.description,
      priority: params.priority,

      // Context
      capturedModule: params.module,
      capturedTab: params.tab,

      // Admin management
      status: "new",

      // Timestamps
      createdAt: Timestamp.now(),
      updatedAt: null,
    };

    // Add subtasks if provided
    if (params.subtasks && Array.isArray(params.subtasks)) {
      feedbackData.subtasks = params.subtasks;
    }

    const docRef = await db.collection("feedback").add(feedbackData);

    console.log("✅ Feedback submitted successfully!");
    console.log("");
    console.log(`   📋 Feedback ID: ${docRef.id}`);
    console.log(`   📝 Title: ${params.title}`);
    console.log(`   🏷️  Type: ${params.type}`);
    console.log(`   ⚡ Priority: ${params.priority}`);
    console.log(`   📍 Module: ${params.module} / ${params.tab}`);
    console.log(
      `   👤 User: ${userProfile.userDisplayName} (${userProfile.userEmail})`
    );

    if (params.subtasks && params.subtasks.length > 0) {
      console.log("");
      console.log("   📋 Subtasks:");
      params.subtasks.forEach((task, i) => {
        console.log(`      ${i + 1}. ${task.title}`);
      });
    }

    console.log("");
    console.log(`   🔗 View in Kanban: Open Flow Arts Composer → Feedback Manage tab`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error submitting feedback:", error.message);
    process.exit(1);
  }
}

// Run
const params = parseArgs();
submitFeedback(params);

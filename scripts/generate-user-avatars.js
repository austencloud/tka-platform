/**
 * Generate avatars for specific users based on their theme and prop settings
 *
 * Usage: node scripts/generate-user-avatars.js
 *
 * This script:
 * 1. Queries users by displayName
 * 2. Gets their background/theme and prop settings
 * 3. Generates a gradient + prop silhouette avatar
 * 4. Uploads to Firebase Storage
 * 5. Updates their user document (photoURL, avatar)
 * 6. Creates a targeted announcement notifying them
 */

import admin from "firebase-admin";
import { readFileSync } from "fs";
import { createCanvas, loadImage } from "canvas";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "the-kinetic-alphabet.firebasestorage.app",
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

const ALL_GRADIENTS = {
  // Warm family
  sunset: "linear-gradient(135deg, #ff6b6b 0%, #feca57 50%, #ff9ff3 100%)",
  ember: "linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #fbbf24 100%)",
  autumn: "linear-gradient(135deg, #92400e 0%, #dc2626 50%, #f59e0b 100%)",
  coral: "linear-gradient(135deg, #f43f5e 0%, #fb7185 50%, #fda4af 100%)",
  // Cool family
  ocean: "linear-gradient(135deg, #0c4a6e 0%, #0891b2 50%, #22d3ee 100%)",
  twilight: "linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #818cf8 100%)",
  arctic: "linear-gradient(135deg, #1e3a5f 0%, #3b82f6 50%, #93c5fd 100%)",
  mint: "linear-gradient(135deg, #064e3b 0%, #10b981 50%, #6ee7b7 100%)",
  // Vibrant family
  rainbow:
    "linear-gradient(135deg, #ef4444 0%, #f59e0b 20%, #22c55e 40%, #3b82f6 60%, #8b5cf6 80%, #ec4899 100%)",
  neon: "linear-gradient(135deg, #f472b6 0%, #c084fc 33%, #60a5fa 66%, #34d399 100%)",
  aurora:
    "linear-gradient(135deg, #0f766e 0%, #22d3ee 25%, #a78bfa 50%, #f472b6 75%, #fbbf24 100%)",
  cosmic:
    "linear-gradient(135deg, #1e1b4b 0%, #7c3aed 30%, #ec4899 60%, #fbbf24 100%)",
  // Earth family
  forest: "linear-gradient(135deg, #0d3320 0%, #166534 50%, #84cc16 100%)",
  blossom: "linear-gradient(135deg, #831843 0%, #db2777 50%, #fbcfe8 100%)",
  lavender: "linear-gradient(135deg, #4c1d95 0%, #8b5cf6 50%, #ddd6fe 100%)",
  sand: "linear-gradient(135deg, #78350f 0%, #a16207 50%, #84cc16 100%)",
  // Dark family
  midnight: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #3b82f6 100%)",
  void: "linear-gradient(135deg, #18181b 0%, #3f3f46 50%, #a855f7 100%)",
  shadow: "linear-gradient(135deg, #1c1917 0%, #44403c 50%, #78716c 100%)",
  obsidian: "linear-gradient(135deg, #0c0a09 0%, #292524 40%, #dc2626 100%)",
};

// Map background types to gradients (both camelCase and kebab-case variants)
const THEME_TO_GRADIENT = {
  // kebab-case (as stored in some places)
  pride: "rainbow",
  snowfall: "arctic",
  "night-sky": "twilight",
  "ocean": "ocean",
  "ember": "ember",
  "blossom": "blossom",
  "forest": "forest",
  "autumn": "autumn",
  "solid-color": "void",
  "linear-gradient": "cosmic",
  // camelCase (as stored in user settings)
  nightSky: "twilight",
  ocean: "ocean",
  ember: "ember",
  blossom: "blossom",
  forest: "forest",
  autumn: "autumn",
  solidColor: "void",
  linearGradient: "cosmic",
};

// Default gradient if we can't determine from settings
const DEFAULT_GRADIENT = "twilight";
const DEFAULT_PROP = "staff";

// Prop image paths (relative to static folder) - use SVGs
const PROP_IMAGES = {
  staff: "/images/props/buttons/staff.svg",
  bigstaff: "/images/props/buttons/bigstaff.svg",
  buugeng: "/images/props/buttons/buugeng.svg",
  bigbuugeng: "/images/props/buttons/bigbuugeng.svg",
  club: "/images/props/buttons/club.svg",
  bigclub: "/images/props/buttons/bigclub.svg",
  doublestar: "/images/props/buttons/doublestar.svg",
  bigdoublestar: "/images/props/buttons/bigdoublestar.svg",
  fan: "/images/props/buttons/fan.svg",
  bigfan: "/images/props/buttons/bigfan.svg",
  hoop: "/images/props/buttons/hoop.svg",
  bighoop: "/images/props/buttons/bighoop.svg",
  minihoop: "/images/props/buttons/minihoop.svg",
  triad: "/images/props/buttons/triad.svg",
  bigtriad: "/images/props/buttons/bigtriad.svg",
  triquetra: "/images/props/buttons/triquetra.svg",
  poi: "/images/props/buttons/poi.svg",
  chicken: "/images/props/buttons/chicken.svg",
  bigchicken: "/images/props/buttons/bigchicken.svg",
  eightrings: "/images/props/buttons/eightrings.svg",
  bigeightrings: "/images/props/buttons/bigeightrings.svg",
  // Fallback for unknown props
  default: "/images/props/buttons/staff.svg",
};

const TARGET_USERS = ["Sire Royal", "Be Love", "Dustin Michael Pullman"];


/**
 * Parse CSS gradient and draw on canvas
 */
function drawGradient(ctx, cssGradient, size) {
  const match = cssGradient.match(/linear-gradient\((\d+)deg,\s*(.+)\)/);

  if (!match) {
    ctx.fillStyle = "#6366f1";
    ctx.fillRect(0, 0, size, size);
    return;
  }

  const angle = parseInt(match[1], 10);
  const colorStops = match[2];

  // Convert angle to gradient coordinates
  const angleRad = ((angle - 90) * Math.PI) / 180;
  const x1 = size / 2 - (Math.cos(angleRad) * size) / 2;
  const y1 = size / 2 - (Math.sin(angleRad) * size) / 2;
  const x2 = size / 2 + (Math.cos(angleRad) * size) / 2;
  const y2 = size / 2 + (Math.sin(angleRad) * size) / 2;

  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);

  // Parse color stops
  const stopRegex = /(#[a-fA-F0-9]{3,8}|rgba?\([^)]+\))\s*(\d+)?%?/g;
  let stopMatch;
  const stops = [];

  while ((stopMatch = stopRegex.exec(colorStops)) !== null) {
    const color = stopMatch[1];
    const position = stopMatch[2] ? parseInt(stopMatch[2], 10) / 100 : null;
    stops.push({ color, position });
  }

  // Assign positions to stops without explicit positions
  stops.forEach((stop, i) => {
    if (stop.position === null) {
      stop.position = i / (stops.length - 1);
    }
  });

  stops.forEach((stop) => {
    try {
      gradient.addColorStop(stop.position, stop.color);
    } catch (e) {
      // Invalid color, skip
    }
  });

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
}

/**
 * Draw prop silhouette (white, semi-transparent)
 */
async function drawPropSilhouette(ctx, imagePath, size) {
  try {
    const fullPath = path.join(__dirname, "..", "static", imagePath);

    // For SVGs, we need to add width/height if missing
    let imgSource = fullPath;
    if (imagePath.endsWith('.svg')) {
      let svgContent = readFileSync(fullPath, 'utf8');

      // Check if SVG has viewBox but no width/height
      const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
      if (viewBoxMatch && !svgContent.includes('width=')) {
        const viewBox = viewBoxMatch[1].split(/\s+/).map(Number);
        const svgWidth = viewBox[2] || 200;
        const svgHeight = viewBox[3] || 200;

        // Add width and height attributes
        svgContent = svgContent.replace(
          '<svg ',
          `<svg width="${svgWidth}" height="${svgHeight}" `
        );
      }

      // Convert to data URL for canvas
      imgSource = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
    }

    const img = await loadImage(imgSource);

    // Calculate size maintaining aspect ratio
    const maxPropSize = size * 0.55;
    const imgAspect = img.width / img.height;
    let propWidth, propHeight;

    if (imgAspect > 1) {
      propWidth = maxPropSize;
      propHeight = maxPropSize / imgAspect;
    } else {
      propHeight = maxPropSize;
      propWidth = maxPropSize * imgAspect;
    }

    // Center the prop
    const x = (size - propWidth) / 2;
    const y = (size - propHeight) / 2;

    // Create offscreen canvas for white silhouette
    const offscreen = createCanvas(propWidth, propHeight);
    const offCtx = offscreen.getContext("2d");

    offCtx.drawImage(img, 0, 0, propWidth, propHeight);
    offCtx.globalCompositeOperation = "source-in";
    offCtx.fillStyle = "rgba(255, 255, 255, 0.9)";
    offCtx.fillRect(0, 0, propWidth, propHeight);

    ctx.drawImage(offscreen, x, y);
  } catch (error) {
    console.warn(`  ⚠️  Could not load prop image: ${imagePath}`, error.message);
  }
}

/**
 * Generate avatar and return buffer
 */
async function generateAvatar(gradientId, propType) {
  const size = 256;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Clip to circle
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // Draw gradient
  const gradient = ALL_GRADIENTS[gradientId] || ALL_GRADIENTS[DEFAULT_GRADIENT];
  drawGradient(ctx, gradient, size);

  // Draw prop silhouette
  const propImage = PROP_IMAGES[propType] || PROP_IMAGES.default;
  await drawPropSilhouette(ctx, propImage, size);

  return canvas.toBuffer("image/png");
}

/**
 * Upload avatar to Firebase Storage
 */
async function uploadAvatar(userId, buffer, gradientId, propType) {
  const filename = `${gradientId}_${propType}.png`;
  const storagePath = `avatars/${userId}/${filename}`;

  const file = bucket.file(storagePath);

  await file.save(buffer, {
    contentType: "image/png",
    metadata: {
      metadata: {
        userId,
        gradientId,
        propType,
        generatedAt: new Date().toISOString(),
        generatedBy: "admin-script",
      },
    },
  });

  // Make public and get URL
  await file.makePublic();
  const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

  return url;
}

/**
 * Update user document with new avatar
 */
async function updateUserDocument(userId, photoURL) {
  const userDocRef = db.collection("users").doc(userId);

  await userDocRef.set(
    {
      photoURL,
      avatar: photoURL,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Create targeted announcement for user
 */
async function createAnnouncement(userId, displayName) {
  const announcementRef = db.collection("announcements").doc();

  await announcementRef.set({
    title: "New Profile Avatar",
    message: `Hi ${displayName.split(" ")[0]}! I've generated a custom avatar for you based on your theme and prop preferences. You can change it anytime in Settings > Profile.`,
    severity: "info",
    targetAudience: "specific-user",
    targetUserId: userId,
    showAsModal: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: "system",
    expiresAt: admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    ), // 30 days
    actionUrl: "/settings?tab=profile",
    actionLabel: "View Profile",
  });

  return announcementRef.id;
}

/**
 * Get user's settings
 */
async function getUserSettings(userId) {
  const settingsRef = db
    .collection("users")
    .doc(userId)
    .collection("settings")
    .doc("preferences");
  const doc = await settingsRef.get();

  if (doc.exists) {
    return doc.data();
  }

  return null;
}

/**
 * Query user by displayName
 */
async function getUserByDisplayName(displayName) {
  const usersRef = db.collection("users");
  const snapshot = await usersRef
    .where("displayName", "==", displayName)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}


async function main() {
  console.log("\n🎨 Avatar Generation Script");
  console.log("═══════════════════════════════════════════\n");

  for (const displayName of TARGET_USERS) {
    console.log(`\n👤 Processing: ${displayName}`);
    console.log("─────────────────────────────────────");

    // Find user
    const user = await getUserByDisplayName(displayName);

    if (!user) {
      console.log(`  ❌ User not found: ${displayName}`);
      continue;
    }

    console.log(`  ✅ Found user: ${user.id}`);

    // Get settings
    const settings = await getUserSettings(user.id);
    console.log(`  📋 Settings loaded`);

    // Determine gradient from background type
    const backgroundType = settings?.backgroundType || "night-sky";
    const gradientId = THEME_TO_GRADIENT[backgroundType] || DEFAULT_GRADIENT;
    console.log(`  🎨 Background: ${backgroundType} → Gradient: ${gradientId}`);

    // Determine prop type (use blue prop, falling back to staff)
    const propType = settings?.bluePropType || DEFAULT_PROP;
    console.log(`  🏏 Prop: ${propType}`);

    // Generate avatar
    console.log(`  ⏳ Generating avatar...`);
    const avatarBuffer = await generateAvatar(gradientId, propType);
    console.log(`  ✅ Avatar generated (${avatarBuffer.length} bytes)`);

    // Upload to Storage
    console.log(`  ⏳ Uploading to Firebase Storage...`);
    const photoURL = await uploadAvatar(
      user.id,
      avatarBuffer,
      gradientId,
      propType
    );
    console.log(`  ✅ Uploaded: ${photoURL}`);

    // Update user document
    console.log(`  ⏳ Updating user document...`);
    await updateUserDocument(user.id, photoURL);
    console.log(`  ✅ User document updated`);

    // Create announcement
    console.log(`  ⏳ Creating announcement...`);
    const announcementId = await createAnnouncement(user.id, displayName);
    console.log(`  ✅ Announcement created: ${announcementId}`);

    console.log(`  ✨ Done!`);
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("✅ All users processed!\n");

  process.exit(0);
}

main().catch((error) => {
  console.error("\n❌ Script failed:", error);
  process.exit(1);
});

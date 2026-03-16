/**
 * Smoke test for the R2 upload pipeline.
 *
 * Calls the r2PresignUrl Cloud Function directly, then PUTs a small
 * test file to R2 using the presigned URL. Verifies the public URL
 * returns the file.
 *
 * Usage:
 *   node scripts/test-r2-upload.cjs
 *
 * Requires: Firebase CLI authenticated (uses admin credentials).
 */

const https = require("https");
const http = require("http");

const PROJECT_ID = "the-kinetic-alphabet";
const REGION = "us-central1";
const FUNCTION_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/r2PresignUrl`;

// Tiny test payload (a 1x1 red pixel PNG)
const TEST_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "base64"
);

async function getIdToken() {
  const { execSync } = require("child_process");
  // Use gcloud to get an ID token for the Cloud Function
  const token = execSync(
    `"C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd" auth print-identity-token --project=${PROJECT_ID}`,
    { encoding: "utf-8" }
  ).trim();
  return token;
}

function makeRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  console.log("R2 Upload Smoke Test");
  console.log("====================\n");

  // Step 1: Get auth token
  console.log("1. Getting auth token...");
  let token;
  try {
    token = await getIdToken();
    console.log("   Got token (" + token.substring(0, 20) + "...)\n");
  } catch (e) {
    console.error("   Failed to get token. Run: gcloud auth login");
    console.error("   Error:", e.message);
    process.exit(1);
  }

  // Step 2: Call r2PresignUrl Cloud Function
  console.log("2. Calling r2PresignUrl Cloud Function...");
  const requestBody = JSON.stringify({
    data: {
      fileName: "smoke-test.png",
      contentType: "image/png",
      contentLength: TEST_PNG.length,
      userId: "smoke-test",
      category: "thumbnails",
      sequenceId: "test-" + Date.now(),
    },
  });

  try {
    const presignResult = await makeRequest(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }, requestBody);

    console.log("   Status:", presignResult.status);

    if (presignResult.status !== 200) {
      console.error("   Response:", presignResult.body.substring(0, 500));
      console.error("\n   The Cloud Function returned an error.");
      console.error("   This might be expected if it requires Firebase Auth (not gcloud auth).");
      console.error("\n   The functions are deployed and responding. Full E2E test needs");
      console.error("   the app running with a logged-in user.");
      process.exit(1);
    }

    const { result } = JSON.parse(presignResult.body);
    console.log("   Presigned URL received!");
    console.log("   Key:", result.key);
    console.log("   Public URL:", result.publicUrl, "\n");

    // Step 3: PUT the test file to R2
    console.log("3. Uploading test file to R2...");
    const uploadResult = await makeRequest(result.presignedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "image/png",
        "Content-Length": TEST_PNG.length,
      },
    }, TEST_PNG);

    console.log("   Upload status:", uploadResult.status);
    if (uploadResult.status === 200) {
      console.log("   Upload successful!\n");
    } else {
      console.error("   Upload failed:", uploadResult.body.substring(0, 300));
      process.exit(1);
    }

    // Step 4: Verify the public URL works
    console.log("4. Verifying public URL...");
    const verifyResult = await makeRequest(result.publicUrl, { method: "HEAD" });
    console.log("   Public URL status:", verifyResult.status);
    console.log("   Content-Type:", verifyResult.headers["content-type"]);
    console.log("   Content-Length:", verifyResult.headers["content-length"]);

    if (verifyResult.status === 200) {
      console.log("\n   R2 pipeline is fully operational!");
    } else {
      console.log("\n   Public URL returned", verifyResult.status, "- check bucket public access settings");
    }
  } catch (e) {
    console.error("   Error:", e.message);
    process.exit(1);
  }
}

main();

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { GoogleAuth } from "google-auth-library";
import {
  findGoogleKeyFile,
  readInlineGoogleCredentials,
} from "./google-credentials.js";
import {
  FIREBASE_CONFIG,
  getAdminAuth,
  initFirestore,
} from "./firestore-provider.js";

const RULES_API = "https://firebaserules.googleapis.com/v1";
const FIRESTORE_REST_API = "https://firestore.googleapis.com/v1";
const IDENTITY_TOOLKIT_API = "https://identitytoolkit.googleapis.com/v1";
const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

interface RulesRelease {
  name: string;
  rulesetName: string;
  updateTime: string;
}

interface Ruleset {
  name: string;
  source?: {
    files?: Array<{ name?: string; content?: string }>;
  };
}

export interface DeployedFirestoreRules {
  rulesetName: string;
  releaseUpdatedAt: string;
  source: string;
}

export interface LiveCanaryResult {
  passed: boolean;
  status: number;
  detail: string;
}

function createRulesAuth(): GoogleAuth {
  const credentials = readInlineGoogleCredentials();
  const keyFile = findGoogleKeyFile();
  return new GoogleAuth({
    scopes: [CLOUD_PLATFORM_SCOPE],
    ...(credentials ? { credentials } : keyFile ? { keyFile } : {}),
  });
}

export function sourceSha256(source: string): string {
  const canonical = `${source.replace(/\r\n/g, "\n").trim()}\n`;
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function extractReviewedRuleBlock(
  source: string,
  startMarker: string,
  endMarker: string
): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(
      `Could not find the reviewed rule block between ${startMarker} and ${endMarker}.`
    );
  }
  return source.slice(start + startMarker.length, end);
}

export async function readLocalRulesSource(path: string): Promise<string> {
  return readFile(path, "utf8");
}

/** Fetch the exact Firestore source named by the active production release. */
export async function getDeployedFirestoreRules(
  projectId = FIREBASE_CONFIG.projectId
): Promise<DeployedFirestoreRules> {
  const client = await createRulesAuth().getClient();
  const releaseName = `projects/${projectId}/releases/cloud.firestore`;
  const releaseResponse = await client.request<RulesRelease>({
    url: `${RULES_API}/${releaseName}`,
  });
  const release = releaseResponse.data;
  const rulesetResponse = await client.request<Ruleset>({
    url: `${RULES_API}/${release.rulesetName}`,
  });
  const sourceFile = rulesetResponse.data.source?.files?.find(
    (file) => file.name === "firestore.rules"
  );

  if (!sourceFile?.content) {
    throw new Error(
      `Ruleset ${release.rulesetName} did not contain firestore.rules.`
    );
  }

  return {
    rulesetName: release.rulesetName,
    releaseUpdatedAt: release.updateTime,
    source: sourceFile.content,
  };
}

/**
 * Exercise the deployed rule with a real anonymous Firebase ID token.
 * A missing document should return 404. A rules denial returns 403.
 * The transient anonymous Auth account is always deleted.
 */
export async function runMissingOwnerProfileCanary(
  projectId = FIREBASE_CONFIG.projectId
): Promise<LiveCanaryResult> {
  await initFirestore();
  const auth = await getAdminAuth();
  if (!auth) {
    throw new Error(
      "The live rules canary requires Firebase Admin credentials."
    );
  }

  let uid: string | null = null;
  let cleanupError: unknown = null;
  try {
    const signUpResponse = await fetch(
      `${IDENTITY_TOOLKIT_API}/accounts:signUp?key=${FIREBASE_CONFIG.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnSecureToken: true }),
      }
    );
    const signUpBody = (await signUpResponse.json()) as {
      idToken?: string;
      localId?: string;
      error?: { message?: string };
    };
    if (!signUpResponse.ok || !signUpBody.idToken || !signUpBody.localId) {
      throw new Error(
        `Could not create the anonymous canary identity: ${signUpBody.error?.message ?? signUpResponse.status}`
      );
    }

    uid = signUpBody.localId;
    const documentUrl =
      `${FIRESTORE_REST_API}/projects/${projectId}` +
      `/databases/(default)/documents/users/${encodeURIComponent(uid)}`;
    const readResponse = await fetch(documentUrl, {
      headers: { Authorization: `Bearer ${signUpBody.idToken}` },
    });
    const body = await readResponse.text();

    if (readResponse.status === 404) {
      return {
        passed: true,
        status: 404,
        detail:
          "The anonymous owner was allowed to observe the missing profile.",
      };
    }

    return {
      passed: false,
      status: readResponse.status,
      detail:
        readResponse.status === 403
          ? "The deployed rules denied the anonymous owner profile read."
          : `The canary expected 404 and received ${readResponse.status}: ${body.slice(0, 200)}`,
    };
  } finally {
    if (uid) {
      try {
        await auth.deleteUser(uid);
      } catch (error) {
        cleanupError = error;
      }
    }
    if (cleanupError) {
      throw new Error(
        `The rules canary ran but could not remove its anonymous Auth account: ${String(cleanupError)}`
      );
    }
  }
}

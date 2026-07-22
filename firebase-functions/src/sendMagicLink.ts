/**
 * Send Magic Link Cloud Function
 *
 * Generates a Firebase Auth magic link via Admin SDK,
 * then sends a branded email via Brevo using your custom domain.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

// Brevo transactional email API endpoint
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const MAGIC_LINK_SUBJECT = "Your Flow Arts Composer sign-in link";
const DEFAULT_CONTINUE_URL = "https://tkaflowarts.com/app";
const DEFAULT_SENDER_EMAIL = "noreply@tkaflowarts.com";
const DEFAULT_SENDER_NAME = "Flow Arts Composer";
const PROVIDER_TIMEOUT_MS = 10_000;
const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Load HTML template at cold start (efficient)
const templatePath = path.join(__dirname, "templates", "magic-link.html");
let emailTemplate: string;

try {
  emailTemplate = fs.readFileSync(templatePath, "utf-8");
} catch (err) {
  console.error("Failed to load email template:", err);
  emailTemplate = `
    <html>
      <body style="font-family: sans-serif; padding: 40px; text-align: center;">
        <h1>Sign in to Flow Arts Composer</h1>
        <p><a href="{{MAGIC_LINK}}" style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px;">Sign In</a></p>
        <p style="color: #666; font-size: 12px;">Didn't request this? Ignore it.</p>
      </body>
    </html>
  `;
}

export interface SendMagicLinkRequest {
  email: string;
  continueUrl?: string;
  requestId?: string;
}

export interface SendMagicLinkResponse {
  success: boolean;
  message?: string;
  error?: string;
  requestId: string;
  subject: string;
  senderEmail: string;
}

type MagicLinkStage =
  | "configuration"
  | "link_generation"
  | "provider_request"
  | "provider_response";

interface MagicLinkLogger {
  info(message: string, data: Record<string, unknown>): void;
  error(message: string, data: Record<string, unknown>): void;
}

export interface MagicLinkRuntime {
  brevoApiKey?: string;
  senderEmail: string;
  senderName: string;
  appCheckStatus: "verified" | "missing";
  authStatus: "authenticated" | "anonymous";
  now(): number;
  createRequestId(): string;
  generateLink(
    email: string,
    settings: { url: string; handleCodeInApp: boolean }
  ): Promise<string>;
  fetch(
    input: string,
    init: RequestInit
  ): Promise<Pick<Response, "ok" | "status" | "json">>;
  logger: MagicLinkLogger;
}

function resolveRequestId(
  candidate: unknown,
  createRequestId: () => string
): string {
  return typeof candidate === "string" && REQUEST_ID_PATTERN.test(candidate)
    ? candidate
    : createRequestId();
}

function resolveAuthHost(continueUrl?: string): string {
  try {
    return new URL(continueUrl || DEFAULT_CONTINUE_URL).hostname.toLowerCase();
  } catch {
    return "invalid";
  }
}

function safeErrorCode(error: unknown): string {
  if (error instanceof functions.https.HttpsError) {
    return `https/${error.code}`;
  }

  const candidate = (error as { code?: unknown })?.code;
  if (typeof candidate === "string" && /^[a-z0-9_/-]{1,80}$/i.test(candidate)) {
    return candidate;
  }

  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "provider/timeout";
  }

  return "unknown";
}

/**
 * Testable core for the callable. Logs only opaque request/provider IDs and
 * provider-neutral status; recipient addresses never enter Cloud Logging.
 */
export async function handleSendMagicLink(
  data: SendMagicLinkRequest,
  runtime: MagicLinkRuntime
): Promise<SendMagicLinkResponse> {
  const email = typeof data?.email === "string" ? data.email.trim() : "";

  if (!email) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Email is required"
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid email format"
    );
  }

  const requestId = resolveRequestId(data.requestId, runtime.createRequestId);
  const startedAt = runtime.now();
  const authHost = resolveAuthHost(data.continueUrl);
  let stage: MagicLinkStage = "configuration";
  let providerStatus: number | undefined;

  runtime.logger.info("Magic link request started", {
    requestId,
    authHost,
    appCheck: runtime.appCheckStatus,
    auth: runtime.authStatus,
  });

  try {
    if (!runtime.brevoApiKey) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Email service not configured"
      );
    }

    stage = "link_generation";
    const magicLink = await runtime.generateLink(email, {
      url: data.continueUrl || DEFAULT_CONTINUE_URL,
      handleCodeInApp: true,
    });

    const htmlContent = emailTemplate.replace(/\{\{MAGIC_LINK\}\}/g, magicLink);
    const textContent = `Sign in to Flow Arts Composer

Open this link to sign in. It expires in 1 hour:
${magicLink}

Didn't request this? Ignore it.

Flow Arts Composer
https://tkaflowarts.com`;

    stage = "provider_request";
    const response = await runtime.fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": runtime.brevoApiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: runtime.senderName, email: runtime.senderEmail },
        to: [{ email }],
        subject: MAGIC_LINK_SUBJECT,
        htmlContent,
        textContent,
        tags: ["authentication", "magic-link"],
        headers: {
          "X-Mailin-custom": `request_id:${requestId}`,
        },
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    providerStatus = response.status;

    if (!response.ok) {
      throw new functions.https.HttpsError("internal", "Failed to send email");
    }

    stage = "provider_response";
    const result = (await response.json()) as { messageId?: unknown };
    if (typeof result.messageId !== "string" || !result.messageId) {
      const invalidResponse = new Error(
        "Brevo response omitted messageId"
      ) as Error & {
        code: string;
      };
      invalidResponse.code = "provider/invalid-response";
      throw invalidResponse;
    }

    runtime.logger.info("Magic link provider accepted", {
      requestId,
      providerMessageId: result.messageId,
      providerStatus,
      authHost,
      durationMs: runtime.now() - startedAt,
    });

    return {
      success: true,
      message: "Magic link sent. Check your email.",
      requestId,
      subject: MAGIC_LINK_SUBJECT,
      senderEmail: runtime.senderEmail,
    };
  } catch (error: unknown) {
    const errorCode = safeErrorCode(error);
    runtime.logger.error("Magic link request failed", {
      requestId,
      stage,
      errorCode,
      providerStatus: providerStatus ?? null,
      authHost,
      durationMs: runtime.now() - startedAt,
    });

    if ((error as { code?: unknown })?.code === "auth/invalid-email") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid email address"
      );
    }

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    if (errorCode === "provider/timeout") {
      throw new functions.https.HttpsError(
        "unavailable",
        "Email provider timed out"
      );
    }

    throw new functions.https.HttpsError(
      "internal",
      "Failed to send magic link"
    );
  }
}

/**
 * Callable Cloud Function to send a branded magic link email
 */
export const sendMagicLink = functions.https.onCall(
  async (
    data: SendMagicLinkRequest,
    context
  ): Promise<SendMagicLinkResponse> => {
    return handleSendMagicLink(data, {
      brevoApiKey: process.env.BREVO_API_KEY,
      senderEmail: process.env.BREVO_SENDER_EMAIL || DEFAULT_SENDER_EMAIL,
      senderName: process.env.BREVO_SENDER_NAME || DEFAULT_SENDER_NAME,
      appCheckStatus: context.app ? "verified" : "missing",
      authStatus: context.auth ? "authenticated" : "anonymous",
      now: Date.now,
      createRequestId: randomUUID,
      generateLink: (email, settings) =>
        admin.auth().generateSignInWithEmailLink(email, settings),
      fetch: (input, init) => fetch(input, init),
      logger: {
        info: (message, fields) => functions.logger.info(message, fields),
        error: (message, fields) => functions.logger.error(message, fields),
      },
    });
  }
);

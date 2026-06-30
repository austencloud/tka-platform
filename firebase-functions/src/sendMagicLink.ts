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

// Brevo transactional email API endpoint
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

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
        <h1>Sign in to TKA Composer</h1>
        <p><a href="{{MAGIC_LINK}}" style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 8px;">Sign In</a></p>
        <p style="color: #666; font-size: 12px;">Didn't request this? Ignore it.</p>
      </body>
    </html>
  `;
}

interface SendMagicLinkRequest {
  email: string;
  continueUrl?: string;
}

interface SendMagicLinkResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Callable Cloud Function to send a branded magic link email
 */
export const sendMagicLink = functions.https.onCall(
  async (
    data: SendMagicLinkRequest,
    context
  ): Promise<SendMagicLinkResponse> => {
    const { email, continueUrl } = data;

    // Validate email
    if (!email || typeof email !== "string") {
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

    // Get Brevo API key from environment variables
    const brevoApiKey = process.env.BREVO_API_KEY;
    if (!brevoApiKey) {
      console.error("Brevo API key not configured");
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Email service not configured"
      );
    }

    // Get sender email from environment (with fallback)
    const senderEmail = process.env.BREVO_SENDER_EMAIL || "noreply@tkaflowarts.com";
    const senderName = process.env.BREVO_SENDER_NAME || "TKA Composer";

    try {
      // Generate the magic link using Firebase Admin SDK
      const actionCodeSettings = {
        url: continueUrl || "https://tkaflowarts.com/app",
        handleCodeInApp: true,
      };

      const magicLink = await admin
        .auth()
        .generateSignInWithEmailLink(email, actionCodeSettings);

      // Render the email template
      const htmlContent = emailTemplate.replace(/\{\{MAGIC_LINK\}\}/g, magicLink);

      // Plain text fallback
      const textContent = `Sign in to TKA Composer

Click the link below to sign in (expires in 1 hour):
${magicLink}

Didn't request this? Just ignore it.

- TKA Composer
https://tkaflowarts.com`;

      // Send via Brevo transactional email API
      const response = await fetch(BREVO_API_URL, {
        method: "POST",
        headers: {
          "api-key": brevoApiKey,
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email }],
          subject: "Sign in to TKA Composer",
          htmlContent,
          textContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Brevo API error:", errorData);
        throw new functions.https.HttpsError(
          "internal",
          "Failed to send email"
        );
      }

      const result = await response.json();
      console.log(`Magic link email sent to ${email}, Brevo messageId: ${result.messageId}`);

      return {
        success: true,
        message: "Magic link sent! Check your email.",
      };
    } catch (error: any) {
      console.error("Error sending magic link:", error);

      // Handle specific Firebase Auth errors
      if (error.code === "auth/invalid-email") {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Invalid email address"
        );
      }

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        "internal",
        "Failed to send magic link"
      );
    }
  }
);

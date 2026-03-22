/**
 * Send Magic Link Cloud Function
 *
 * Generates a Firebase Auth magic link via Admin SDK,
 * then sends a branded email via Resend using your custom domain.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

// Resend API endpoint
const RESEND_API_URL = "https://api.resend.com/emails";

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

    // Get Resend API key from environment variables
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error("Resend API key not configured");
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Email service not configured"
      );
    }

    // Get sender email from environment (with fallback)
    const senderEmail = process.env.RESEND_SENDER_EMAIL || "noreply@tkaflowarts.com";
    const senderName = process.env.RESEND_SENDER_NAME || "TKA Composer";

    try {
      // Generate the magic link using Firebase Admin SDK
      const actionCodeSettings = {
        url: continueUrl || "https://tkascribe.com/",
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

      // Send via Resend API
      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${senderName} <${senderEmail}>`,
          to: [email],
          subject: "Sign in to TKA Composer",
          html: htmlContent,
          text: textContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Resend API error:", errorData);
        throw new functions.https.HttpsError(
          "internal",
          "Failed to send email"
        );
      }

      const result = await response.json();
      console.log(`Magic link email sent to ${email}, Resend ID: ${result.id}`);

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

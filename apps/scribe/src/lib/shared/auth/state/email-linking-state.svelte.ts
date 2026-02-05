/**
 * Email Linking State
 *
 * Manages state and logic for the email/password linking flow.
 * Handles form validation, verification polling, and resend cooldown.
 */

import type { IAuthenticator } from "../services/contracts/IAuthenticator";
import type { IHapticFeedback } from "../../application/services/contracts/IHapticFeedback";

export type EmailLinkingStep = "form" | "verifying" | "success";

const MAX_VERIFICATION_CHECKS = 60; // 10 minutes (60 * 10 sec)
const VERIFICATION_CHECK_INTERVAL_MS = 10000; // 10 seconds
const RESEND_COOLDOWN_SECONDS = 60;

export interface EmailLinkingState {
  // Step navigation
  readonly currentStep: EmailLinkingStep;

  // Form state
  readonly email: string;
  readonly password: string;
  readonly showPassword: boolean;
  readonly formError: string | null;
  readonly isSubmitting: boolean;

  // Verification state
  readonly verificationCheckCount: number;
  readonly resendCooldown: number;

  // Computed
  readonly canSubmit: boolean;
  readonly isVerificationTimedOut: boolean;
  readonly progressPercent: number;
  readonly canResend: boolean;
  readonly canClose: boolean;

  // Actions
  setEmail(value: string): void;
  setPassword(value: string): void;
  togglePassword(): void;
  submitForm(): Promise<void>;
  resendVerification(): Promise<void>;
  skipVerification(): void;
  handleSuccess(): void;
  reset(): void;
  cleanup(): void;
}

export function createEmailLinkingState(
  authService: IAuthenticator,
  hapticService: IHapticFeedback | null,
  initialEmail: string,
  onSuccess?: () => void,
  onClose?: () => void
): EmailLinkingState {
  // Reactive state
  let currentStep = $state<EmailLinkingStep>("form");
  let email = $state(initialEmail);
  let password = $state("");
  let showPassword = $state(false);
  let formError = $state<string | null>(null);
  let isSubmitting = $state(false);
  let verificationCheckCount = $state(0);
  let resendCooldown = $state(0);

  // Interval references
  let verificationInterval: ReturnType<typeof setInterval> | null = null;
  let cooldownInterval: ReturnType<typeof setInterval> | null = null;

  // Computed values
  const canSubmit = $derived(email.trim().length > 0 && password.length >= 8);
  const isVerificationTimedOut = $derived(
    verificationCheckCount >= MAX_VERIFICATION_CHECKS
  );
  const progressPercent = $derived(
    Math.min((verificationCheckCount / MAX_VERIFICATION_CHECKS) * 100, 100)
  );
  const canResend = $derived(resendCooldown <= 0);
  const canClose = $derived(currentStep === "form");

  // Validation
  function validateForm(): boolean {
    if (!email.trim()) {
      formError = "Email is required";
      return false;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      formError = "Please enter a valid email address";
      return false;
    }

    if (password.length < 8) {
      formError = "Password must be at least 8 characters";
      return false;
    }

    return true;
  }

  // Verification polling
  function startVerificationPolling() {
    stopVerificationPolling();
    verificationCheckCount = 0;

    verificationInterval = setInterval(async () => {
      try {
        const isVerified = await authService.reloadUser();

        if (isVerified) {
          stopVerificationPolling();
          currentStep = "success";
          hapticService?.trigger("success");
        } else {
          verificationCheckCount++;

          if (verificationCheckCount >= MAX_VERIFICATION_CHECKS) {
            stopVerificationPolling();
          }
        }
      } catch (error) {
        console.error("Failed to check verification status:", error);
      }
    }, VERIFICATION_CHECK_INTERVAL_MS);
  }

  function stopVerificationPolling() {
    if (verificationInterval) {
      clearInterval(verificationInterval);
      verificationInterval = null;
    }
  }

  // Resend cooldown
  function startResendCooldown() {
    resendCooldown = RESEND_COOLDOWN_SECONDS;
    stopResendCooldown();

    cooldownInterval = setInterval(() => {
      resendCooldown--;
      if (resendCooldown <= 0) {
        stopResendCooldown();
      }
    }, 1000);
  }

  function stopResendCooldown() {
    if (cooldownInterval) {
      clearInterval(cooldownInterval);
      cooldownInterval = null;
    }
  }

  // Actions
  async function submitForm() {
    if (isSubmitting) return;

    formError = null;

    if (!validateForm()) {
      hapticService?.trigger("error");
      return;
    }

    isSubmitting = true;
    hapticService?.trigger("selection");

    try {
      await authService.linkEmailPassword(email, password);
      hapticService?.trigger("success");

      currentStep = "verifying";
      startVerificationPolling();
      startResendCooldown();
    } catch (error: unknown) {
      console.error("Failed to link email/password:", error);
      formError = error instanceof Error ? error.message : "Unknown error";
      hapticService?.trigger("error");
    } finally {
      isSubmitting = false;
    }
  }

  async function resendVerification() {
    if (resendCooldown > 0) return;

    hapticService?.trigger("selection");

    try {
      await authService.resendVerificationEmail();
      startResendCooldown();
      hapticService?.trigger("success");
    } catch (error: unknown) {
      console.error("Failed to resend verification email:", error);
      formError = error instanceof Error ? error.message : "Unknown error";
      hapticService?.trigger("error");
    }
  }

  function skipVerification() {
    hapticService?.trigger("selection");
    cleanup();
    onSuccess?.();
    onClose?.();
  }

  function handleSuccess() {
    hapticService?.trigger("success");
    cleanup();
    onSuccess?.();
    onClose?.();
  }

  function reset() {
    currentStep = "form";
    email = initialEmail;
    password = "";
    showPassword = false;
    formError = null;
    isSubmitting = false;
    verificationCheckCount = 0;
    stopVerificationPolling();
    stopResendCooldown();
  }

  function cleanup() {
    stopVerificationPolling();
    stopResendCooldown();
  }

  return {
    get currentStep() {
      return currentStep;
    },
    get email() {
      return email;
    },
    get password() {
      return password;
    },
    get showPassword() {
      return showPassword;
    },
    get formError() {
      return formError;
    },
    get isSubmitting() {
      return isSubmitting;
    },
    get verificationCheckCount() {
      return verificationCheckCount;
    },
    get resendCooldown() {
      return resendCooldown;
    },
    get canSubmit() {
      return canSubmit;
    },
    get isVerificationTimedOut() {
      return isVerificationTimedOut;
    },
    get progressPercent() {
      return progressPercent;
    },
    get canResend() {
      return canResend;
    },
    get canClose() {
      return canClose;
    },
    setEmail(value: string) {
      email = value;
    },
    setPassword(value: string) {
      password = value;
    },
    togglePassword() {
      showPassword = !showPassword;
    },
    submitForm,
    resendVerification,
    skipVerification,
    handleSuccess,
    reset,
    cleanup,
  };
}

/**
 * Subscription Service Interface
 *
 * Manages Stripe subscription operations including checkout,
 * portal access, and subscription status tracking.
 *
 * Single $10/mo premium tier for simplicity.
 */

export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "trialing"
  | "incomplete"
  | "none";

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export interface ISubscriptionManager {
  /**
   * Create a Stripe Checkout session for premium subscription
   * @param priceId The Stripe price ID
   * @returns The Checkout session URL to redirect to
   */
  createCheckoutSession(priceId: string): Promise<string>;

  /**
   * Create a Stripe Customer Portal session for subscription management
   * @returns The portal URL to redirect to
   */
  createPortalSession(): Promise<string>;

  /**
   * Get the current user's subscription status
   */
  getSubscriptionInfo(): Promise<SubscriptionInfo>;

  /**
   * Subscribe to real-time subscription updates
   * @param callback Called when subscription status changes
   * @returns Unsubscribe function
   */
  onSubscriptionChange(callback: (info: SubscriptionInfo) => void): () => void;
}

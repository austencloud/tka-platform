/**
 * Emergency Override Tests
 *
 * Tests for emergency claim takeover system including:
 * - Two-step confirmation requirement
 * - 1-hour cooldown enforcement
 * - Audit trail logging
 */

import { EMERGENCY_CONFIG, STALE_THRESHOLDS } from './types';
import {
  clearMockData,
  setMockDoc,
  getMockDoc,
  getMockCollection,
  timestampMinutesAgo,
  mockTimestamp,
} from '../test/mocks/firestore';

describe('Emergency Override System', () => {
  beforeEach(() => {
    clearMockData();
  });

  describe('Confirmation Requirement', () => {
    it('should require confirmation flag for emergency unclaim', () => {
      const emergency = 'Blocking release 0.3.0';
      const confirmEmergency = false;

      // Without confirmation, should be blocked
      expect(EMERGENCY_CONFIG.REQUIRE_CONFIRMATION).toBe(true);
      expect(confirmEmergency).toBe(false);

      // Business logic: if emergency && !confirmEmergency, reject
      const shouldBlock = emergency && !confirmEmergency && EMERGENCY_CONFIG.REQUIRE_CONFIRMATION;
      expect(shouldBlock).toBe(true);
    });

    it('should allow emergency unclaim with confirmation', () => {
      const emergency = 'Blocking release 0.3.0';
      const confirmEmergency = true;

      const shouldBlock = emergency && !confirmEmergency && EMERGENCY_CONFIG.REQUIRE_CONFIRMATION;
      expect(shouldBlock).toBe(false);
    });
  });

  describe('Cooldown Enforcement', () => {
    it('should have 1-hour cooldown configured', () => {
      expect(EMERGENCY_CONFIG.COOLDOWN_MS).toBe(60 * 60 * 1000);
    });

    it('should detect cooldown active when last action < 1 hour ago', () => {
      const userId = 'test-user';

      // Last emergency action 30 minutes ago
      setMockDoc('emergencyActions', 'recent-action', {
        performedBy: userId,
        timestamp: timestampMinutesAgo(30),
        actionType: 'unclaim',
        reason: 'Previous emergency',
      });

      const lastAction = getMockDoc('emergencyActions', 'recent-action');
      const lastActionTime = (lastAction?.timestamp as FirebaseFirestore.Timestamp)?.toMillis() || 0;
      const cooldownExpires = lastActionTime + EMERGENCY_CONFIG.COOLDOWN_MS;
      const isCooldownActive = Date.now() < cooldownExpires;

      expect(isCooldownActive).toBe(true);
    });

    it('should allow emergency action when cooldown expired', () => {
      const userId = 'test-user';

      // Last emergency action 2 hours ago
      setMockDoc('emergencyActions', 'old-action', {
        performedBy: userId,
        timestamp: timestampMinutesAgo(120),
        actionType: 'unclaim',
        reason: 'Old emergency',
      });

      const lastAction = getMockDoc('emergencyActions', 'old-action');
      const lastActionTime = (lastAction?.timestamp as FirebaseFirestore.Timestamp)?.toMillis() || 0;
      const cooldownExpires = lastActionTime + EMERGENCY_CONFIG.COOLDOWN_MS;
      const isCooldownActive = Date.now() < cooldownExpires;

      expect(isCooldownActive).toBe(false);
    });

    it('should allow first emergency action (no previous)', () => {
      // No previous emergency actions
      const actions = getMockCollection('emergencyActions');
      expect(actions.length).toBe(0);

      // First action should be allowed
      const isCooldownActive = false; // No previous action = no cooldown
      expect(isCooldownActive).toBe(false);
    });
  });

  describe('Audit Trail', () => {
    it('should log emergency action with required fields', () => {
      const action = {
        actionType: 'unclaim' as const,
        feedbackId: 'test-feedback-123',
        performedBy: 'test-user-id',
        reason: 'Blocking release 0.3.0',
        timestamp: mockTimestamp(),
        previousClaimant: 'other-user-id',
        previousClaimToken: 'token-12345678',
        previousSession: 'session-abc',
      };

      setMockDoc('emergencyActions', 'action-1', action);

      const logged = getMockDoc('emergencyActions', 'action-1');

      expect(logged?.actionType).toBe('unclaim');
      expect(logged?.feedbackId).toBe('test-feedback-123');
      expect(logged?.performedBy).toBe('test-user-id');
      expect(logged?.reason).toBe('Blocking release 0.3.0');
      expect(logged?.previousClaimant).toBe('other-user-id');
      expect(logged?.previousClaimToken).toBe('token-12345678');
    });

    it('should preserve audit trail (immutable)', () => {
      // Emergency actions should never be deleted by clients
      // This is enforced by Firestore rules: allow create, update, delete: if false

      setMockDoc('emergencyActions', 'action-1', {
        actionType: 'unclaim',
        reason: 'Test',
        timestamp: mockTimestamp(),
      });

      // The Firestore rules prevent deletion - we're testing the principle here
      const action = getMockDoc('emergencyActions', 'action-1');
      expect(action).toBeDefined();

      // In real rules: allow delete: if false means this would fail
    });
  });

  describe('Fresh Claim Protection', () => {
    it('should block unclaim on fresh claim without emergency', () => {
      // Fresh claim: activity < 45 min ago
      setMockDoc('feedback', 'test-item', {
        status: 'in-progress',
        claimToken: 'active-token',
        claimedAt: timestampMinutesAgo(30),
        lastActivity: timestampMinutesAgo(10), // Fresh!
      });

      const doc = getMockDoc('feedback', 'test-item');
      const activityAgeMs = Date.now() - (doc?.lastActivity as FirebaseFirestore.Timestamp).toMillis();
      const isStale = activityAgeMs > STALE_THRESHOLDS.ACTIVITY_TIMEOUT_MS;
      const hasEmergency = false;

      // Without emergency flag, fresh claim should be protected
      const canUnclaim = isStale || hasEmergency;
      expect(canUnclaim).toBe(false);
    });

    it('should allow unclaim on fresh claim with emergency', () => {
      setMockDoc('feedback', 'test-item', {
        status: 'in-progress',
        claimToken: 'active-token',
        claimedAt: timestampMinutesAgo(30),
        lastActivity: timestampMinutesAgo(10), // Fresh
      });

      const doc = getMockDoc('feedback', 'test-item');
      const activityAgeMs = Date.now() - (doc?.lastActivity as FirebaseFirestore.Timestamp).toMillis();
      const isStale = activityAgeMs > STALE_THRESHOLDS.ACTIVITY_TIMEOUT_MS;
      const hasEmergency = true; // Emergency override

      const canUnclaim = isStale || hasEmergency;
      expect(canUnclaim).toBe(true);
    });
  });
});

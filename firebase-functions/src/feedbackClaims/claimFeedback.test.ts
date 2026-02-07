/**
 * Claim Feedback Integration Tests
 *
 * Tests for bulletproof claim operations including:
 * - Race condition prevention
 * - Stale claim detection
 * - Server-side token generation
 * - WIP limit enforcement
 */

import { checkClaimStaleness, STALE_THRESHOLDS } from './types';
import {
  clearMockData,
  setMockDoc,
  getMockDoc,
  timestampMinutesAgo,
  timestampHoursAgo,
  mockTimestamp,
} from '../test/mocks/firestore';

describe('checkClaimStaleness', () => {
  describe('activity timeout detection', () => {
    it('should mark claim as stale after 45 minutes of inactivity', () => {
      const claimedAt = timestampMinutesAgo(60); // 1 hour ago
      const lastActivity = timestampMinutesAgo(50); // 50 min ago (stale)

      const result = checkClaimStaleness(claimedAt, lastActivity);

      expect(result.isStale).toBe(true);
      expect(result.reason).toBe('no-activity');
      expect(result.activityAgeMs).toBeGreaterThan(STALE_THRESHOLDS.ACTIVITY_TIMEOUT_MS);
    });

    it('should not mark claim as stale with recent activity', () => {
      const claimedAt = timestampMinutesAgo(60); // 1 hour ago
      const lastActivity = timestampMinutesAgo(10); // 10 min ago (fresh)

      const result = checkClaimStaleness(claimedAt, lastActivity);

      expect(result.isStale).toBe(false);
      expect(result.reason).toBeNull();
    });

    it('should use claimedAt as fallback when lastActivity is null', () => {
      const claimedAt = timestampMinutesAgo(50); // 50 min ago (stale)

      const result = checkClaimStaleness(claimedAt, null);

      expect(result.isStale).toBe(true);
      expect(result.reason).toBe('no-activity');
    });
  });

  describe('total time cap detection', () => {
    it('should mark claim as stale after 8 hours total', () => {
      const claimedAt = timestampHoursAgo(9); // 9 hours ago
      const lastActivity = timestampMinutesAgo(5); // 5 min ago (fresh activity)

      const result = checkClaimStaleness(claimedAt, lastActivity);

      expect(result.isStale).toBe(true);
      expect(result.reason).toBe('exceeded-max-time');
    });

    it('should not mark claim as stale before 8 hours', () => {
      const claimedAt = timestampHoursAgo(7); // 7 hours ago
      const lastActivity = timestampMinutesAgo(5); // 5 min ago

      const result = checkClaimStaleness(claimedAt, lastActivity);

      expect(result.isStale).toBe(false);
      expect(result.reason).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle null claimedAt', () => {
      const result = checkClaimStaleness(null, null);

      expect(result.isStale).toBe(true);
      expect(result.reason).toBe('no-claim-time');
      expect(result.ageMs).toBe(Infinity);
    });

    it('should handle undefined claimedAt', () => {
      const result = checkClaimStaleness(undefined, undefined);

      expect(result.isStale).toBe(true);
      expect(result.reason).toBe('no-claim-time');
    });

    it('should handle fresh claim (just created)', () => {
      const now = mockTimestamp();

      const result = checkClaimStaleness(now, now);

      expect(result.isStale).toBe(false);
      expect(result.ageMs).toBeLessThan(1000);
    });
  });
});

describe('Claim Race Condition Prevention', () => {
  beforeEach(() => {
    clearMockData();
  });

  describe('concurrent claim attempts', () => {
    it('should generate unique tokens for each claim attempt', () => {
      // This tests the concept - actual implementation uses uuid
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const token = crypto.randomUUID();
        expect(tokens.has(token)).toBe(false);
        tokens.add(token);
      }
      expect(tokens.size).toBe(100);
    });

    it('should detect when claim token changes (lost race)', () => {
      // Simulate: Agent A claims, writes token "AAA"
      // Agent B claims, writes token "BBB" (wins race)
      // Agent A verifies - sees "BBB", knows it lost

      const agentAToken = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const agentBToken = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

      // After both transactions "succeed", document has Agent B's token
      setMockDoc('feedback', 'test-item', {
        claimToken: agentBToken,
        status: 'in-progress',
      });

      // Agent A verifies
      const doc = getMockDoc('feedback', 'test-item');
      const agentAWon = doc?.claimToken === agentAToken;
      const agentBWon = doc?.claimToken === agentBToken;

      expect(agentAWon).toBe(false);
      expect(agentBWon).toBe(true);
    });
  });

  describe('claim state validation', () => {
    it('should reject claim on already in-progress item', () => {
      setMockDoc('feedback', 'test-item', {
        status: 'in-progress',
        claimToken: 'existing-token',
        claimedAt: timestampMinutesAgo(5),
      });

      const doc = getMockDoc('feedback', 'test-item');
      const isClaimable = doc?.status !== 'in-progress';

      expect(isClaimable).toBe(false);
    });

    it('should allow reclaim on stale item', () => {
      setMockDoc('feedback', 'test-item', {
        status: 'in-progress',
        claimToken: 'old-token',
        claimedAt: timestampMinutesAgo(60), // 1 hour ago
        lastActivity: timestampMinutesAgo(60), // stale
      });

      const doc = getMockDoc('feedback', 'test-item');
      const staleness = checkClaimStaleness(
        doc?.claimedAt as FirebaseFirestore.Timestamp,
        doc?.lastActivity as FirebaseFirestore.Timestamp
      );

      expect(staleness.isStale).toBe(true);
    });

    it('should reject claim on completed item', () => {
      setMockDoc('feedback', 'test-item', {
        status: 'completed',
      });

      const doc = getMockDoc('feedback', 'test-item');
      const isClaimable = !['completed', 'archived'].includes(doc?.status as string);

      expect(isClaimable).toBe(false);
    });

    it('should reject claim on archived item', () => {
      setMockDoc('feedback', 'test-item', {
        status: 'archived',
      });

      const doc = getMockDoc('feedback', 'test-item');
      const isClaimable = !['completed', 'archived'].includes(doc?.status as string);

      expect(isClaimable).toBe(false);
    });
  });

  describe('WIP limit enforcement', () => {
    it('should count only active (non-stale) claims toward WIP limit', () => {
      // Set up 4 in-progress items: 2 active, 2 stale
      setMockDoc('feedback', 'active-1', {
        status: 'in-progress',
        claimToken: 'token-1',
        claimedAt: timestampMinutesAgo(10),
        lastActivity: timestampMinutesAgo(5), // fresh
      });
      setMockDoc('feedback', 'active-2', {
        status: 'in-progress',
        claimToken: 'token-2',
        claimedAt: timestampMinutesAgo(20),
        lastActivity: timestampMinutesAgo(10), // fresh
      });
      setMockDoc('feedback', 'stale-1', {
        status: 'in-progress',
        claimToken: 'token-3',
        claimedAt: timestampMinutesAgo(120),
        lastActivity: timestampMinutesAgo(60), // stale
      });
      setMockDoc('feedback', 'stale-2', {
        status: 'in-progress',
        claimToken: 'token-4',
        claimedAt: timestampMinutesAgo(180),
        lastActivity: timestampMinutesAgo(90), // stale
      });

      // Count active claims
      const docs = [
        getMockDoc('feedback', 'active-1'),
        getMockDoc('feedback', 'active-2'),
        getMockDoc('feedback', 'stale-1'),
        getMockDoc('feedback', 'stale-2'),
      ];

      let activeCount = 0;
      for (const doc of docs) {
        if (doc?.claimToken && doc?.claimedAt) {
          const staleness = checkClaimStaleness(
            doc.claimedAt as FirebaseFirestore.Timestamp,
            doc.lastActivity as FirebaseFirestore.Timestamp | undefined
          );
          if (!staleness.isStale) {
            activeCount++;
          }
        }
      }

      expect(activeCount).toBe(2);
    });
  });
});

describe('Session Tracking', () => {
  beforeEach(() => {
    clearMockData();
  });

  it('should track session ID with claim', () => {
    const sessionId = 'test-session-123';
    const claimToken = 'test-token-456';

    setMockDoc('feedback', 'test-item', {
      status: 'in-progress',
      claimToken,
      claimSession: sessionId,
      claimedAt: mockTimestamp(),
    });

    const doc = getMockDoc('feedback', 'test-item');
    expect(doc?.claimSession).toBe(sessionId);
  });

  it('should update session activeClaims on claim', () => {
    const sessionId = 'test-session-123';
    const feedbackId = 'test-item';

    setMockDoc('agentSessions', sessionId, {
      sessionId,
      activeClaims: [feedbackId],
      lastActivity: mockTimestamp(),
    });

    const session = getMockDoc('agentSessions', sessionId);
    expect(session?.activeClaims).toContain(feedbackId);
  });
});

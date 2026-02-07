/**
 * File Conflict Detection Tests
 *
 * Tests for detecting when multiple agents edit the same file:
 * - Conflict detection on touch
 * - Path normalization
 * - Cleanup on unclaim
 */

import {
  clearMockData,
  setMockDoc,
  getMockDoc,
  deleteMockDoc,
  getMockCollection,
  mockTimestamp,
} from '../test/mocks/firestore';

describe('File Conflict Detection', () => {
  beforeEach(() => {
    clearMockData();
  });

  describe('Path Normalization', () => {
    function normalizePath(filePath: string): string {
      return filePath
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .toLowerCase();
    }

    it('should normalize Windows paths', () => {
      const path = 'src\\lib\\components\\Button.svelte';
      expect(normalizePath(path)).toBe('src/lib/components/button.svelte');
    });

    it('should normalize Unix paths', () => {
      const path = '/src/lib/components/Button.svelte';
      expect(normalizePath(path)).toBe('src/lib/components/button.svelte');
    });

    it('should handle mixed slashes', () => {
      const path = 'src/lib\\components/Button.svelte';
      expect(normalizePath(path)).toBe('src/lib/components/button.svelte');
    });

    it('should lowercase for case-insensitive matching', () => {
      const path1 = 'src/Component.svelte';
      const path2 = 'src/COMPONENT.svelte';
      expect(normalizePath(path1)).toBe(normalizePath(path2));
    });
  });

  describe('Conflict Detection', () => {
    function getEditId(filePath: string): string {
      return filePath
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .toLowerCase()
        .replace(/\//g, '_');
    }

    it('should detect conflict when same file touched by different feedback', () => {
      const filePath = 'src/lib/Component.svelte';
      const editId = getEditId(filePath);

      // Agent A is editing this file for feedback-1
      setMockDoc('activeFileEdits', editId, {
        filePath: filePath.toLowerCase(),
        feedbackId: 'feedback-1',
        sessionId: 'session-a',
        startedAt: mockTimestamp(),
      });

      // Agent B tries to touch same file for feedback-2
      const existingEdit = getMockDoc('activeFileEdits', editId);
      const isConflict = existingEdit && existingEdit.feedbackId !== 'feedback-2';

      expect(isConflict).toBe(true);
      expect(existingEdit?.feedbackId).toBe('feedback-1');
    });

    it('should not report conflict for same feedback item', () => {
      const filePath = 'src/lib/Component.svelte';
      const editId = getEditId(filePath);

      // Agent is editing this file for feedback-1
      setMockDoc('activeFileEdits', editId, {
        filePath: filePath.toLowerCase(),
        feedbackId: 'feedback-1',
        sessionId: 'session-a',
        startedAt: mockTimestamp(),
      });

      // Same agent touches file again for same feedback
      const existingEdit = getMockDoc('activeFileEdits', editId);
      const isConflict = existingEdit && existingEdit.feedbackId !== 'feedback-1';

      expect(isConflict).toBe(false);
    });

    it('should not report conflict for different files', () => {
      const fileA = 'src/lib/ComponentA.svelte';
      const fileB = 'src/lib/ComponentB.svelte';

      setMockDoc('activeFileEdits', getEditId(fileA), {
        filePath: fileA.toLowerCase(),
        feedbackId: 'feedback-1',
        sessionId: 'session-a',
      });

      // Different file should not conflict
      const existingEdit = getMockDoc('activeFileEdits', getEditId(fileB));
      expect(existingEdit).toBeUndefined();
    });
  });

  describe('Batch Conflict Check', () => {
    function getEditId(filePath: string): string {
      return filePath.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase().replace(/\//g, '_');
    }

    it('should check multiple files and return all conflicts', () => {
      // Set up existing edits
      setMockDoc('activeFileEdits', getEditId('src/fileA.ts'), {
        feedbackId: 'other-feedback',
        sessionId: 'other-session',
      });
      setMockDoc('activeFileEdits', getEditId('src/fileC.ts'), {
        feedbackId: 'other-feedback',
        sessionId: 'other-session',
      });

      // Check batch of files
      const filesToCheck = ['src/fileA.ts', 'src/fileB.ts', 'src/fileC.ts'];
      const myFeedbackId = 'my-feedback';

      const conflicts: string[] = [];
      for (const file of filesToCheck) {
        const edit = getMockDoc('activeFileEdits', getEditId(file));
        if (edit && edit.feedbackId !== myFeedbackId) {
          conflicts.push(file);
        }
      }

      expect(conflicts).toHaveLength(2);
      expect(conflicts).toContain('src/fileA.ts');
      expect(conflicts).toContain('src/fileC.ts');
      expect(conflicts).not.toContain('src/fileB.ts');
    });
  });

  describe('Cleanup on Unclaim', () => {
    function getEditId(filePath: string): string {
      return filePath.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase().replace(/\//g, '_');
    }

    it('should remove all file edits when feedback is unclaimed', () => {
      const feedbackId = 'feedback-to-unclaim';

      // Agent touched multiple files
      setMockDoc('activeFileEdits', getEditId('src/fileA.ts'), {
        feedbackId,
        sessionId: 'session-1',
      });
      setMockDoc('activeFileEdits', getEditId('src/fileB.ts'), {
        feedbackId,
        sessionId: 'session-1',
      });
      setMockDoc('activeFileEdits', getEditId('src/fileC.ts'), {
        feedbackId: 'other-feedback', // Different feedback - should NOT be deleted
        sessionId: 'session-2',
      });

      // Simulate unclaim cleanup
      const allEdits = getMockCollection('activeFileEdits');
      const editsToDelete = allEdits.filter((e) => e.data.feedbackId === feedbackId);

      for (const edit of editsToDelete) {
        deleteMockDoc('activeFileEdits', edit.id);
      }

      // Verify cleanup
      expect(getMockDoc('activeFileEdits', getEditId('src/fileA.ts'))).toBeUndefined();
      expect(getMockDoc('activeFileEdits', getEditId('src/fileB.ts'))).toBeUndefined();
      expect(getMockDoc('activeFileEdits', getEditId('src/fileC.ts'))).toBeDefined(); // Not deleted
    });
  });

  describe('File Edit Tracking', () => {
    it('should track original path and normalized path', () => {
      const originalPath = 'src\\Lib\\Component.svelte';
      const normalizedPath = 'src/lib/component.svelte';

      setMockDoc('activeFileEdits', normalizedPath.replace(/\//g, '_'), {
        filePath: normalizedPath,
        originalPath: originalPath,
        feedbackId: 'feedback-1',
        sessionId: 'session-1',
        startedAt: mockTimestamp(),
        lastTouched: mockTimestamp(),
      });

      const edit = getMockDoc('activeFileEdits', normalizedPath.replace(/\//g, '_'));

      expect(edit?.originalPath).toBe(originalPath);
      expect(edit?.filePath).toBe(normalizedPath);
    });

    it('should update lastTouched on repeated touch', () => {
      const editId = 'src_lib_file.ts';

      const oldTime = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
      setMockDoc('activeFileEdits', editId, {
        feedbackId: 'feedback-1',
        startedAt: oldTime,
        lastTouched: oldTime,
      });

      // Simulate touch update
      const newTime = new Date();
      const edit = getMockDoc('activeFileEdits', editId)!;
      setMockDoc('activeFileEdits', editId, {
        ...edit,
        lastTouched: newTime,
      });

      const updated = getMockDoc('activeFileEdits', editId);
      expect((updated?.lastTouched as Date).getTime()).toBeGreaterThan(oldTime.getTime());
    });
  });
});

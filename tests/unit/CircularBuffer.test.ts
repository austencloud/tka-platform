/**
 * Tests for CircularBuffer (used in TrailCapturer)
 *
 * These tests catch silent bugs - off-by-one errors in ring buffer logic
 * would cause trail points to be dropped or duplicated, which might look
 * like a visual glitch but not be immediately traced to the buffer.
 */

import { describe, it, expect } from "vitest";

// Recreate the CircularBuffer class for testing
// (It's inlined in TrailCapturer, so we test the same implementation)
class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.tail = (this.tail + 1) % this.capacity;
    }
  }

  get length(): number {
    return this.size;
  }

  get(index: number): T | undefined {
    if (index < 0 || index >= this.size) return undefined;
    return this.buffer[(this.tail + index) % this.capacity];
  }

  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  *[Symbol.iterator](): Iterator<T> {
    for (let i = 0; i < this.size; i++) {
      const item = this.buffer[(this.tail + i) % this.capacity];
      if (item !== undefined) yield item;
    }
  }

  filterInPlace(predicate: (item: T) => boolean): void {
    const kept: T[] = [];
    for (const item of this) {
      if (predicate(item)) kept.push(item);
    }
    this.clear();
    for (const item of kept) this.push(item);
  }

  toArray(): T[] {
    return Array.from(this);
  }

  getLast(n: number): T[] {
    const result: T[] = [];
    const count = Math.min(n, this.size);
    const startIndex = this.size - count;
    for (let i = startIndex; i < this.size; i++) {
      const item = this.buffer[(this.tail + i) % this.capacity];
      if (item !== undefined) result.push(item);
    }
    return result;
  }
}

describe("CircularBuffer", () => {
  describe("basic operations", () => {
    it("starts empty", () => {
      const buffer = new CircularBuffer<number>(5);
      expect(buffer.length).toBe(0);
    });

    it("tracks length correctly", () => {
      const buffer = new CircularBuffer<number>(5);
      buffer.push(1);
      expect(buffer.length).toBe(1);
      buffer.push(2);
      expect(buffer.length).toBe(2);
    });

    it("retrieves items by index", () => {
      const buffer = new CircularBuffer<number>(5);
      buffer.push(10);
      buffer.push(20);
      buffer.push(30);

      expect(buffer.get(0)).toBe(10);
      expect(buffer.get(1)).toBe(20);
      expect(buffer.get(2)).toBe(30);
    });

    it("returns undefined for out-of-bounds index", () => {
      const buffer = new CircularBuffer<number>(5);
      buffer.push(1);

      expect(buffer.get(-1)).toBeUndefined();
      expect(buffer.get(1)).toBeUndefined();
      expect(buffer.get(100)).toBeUndefined();
    });
  });

  describe("circular behavior", () => {
    it("overwrites oldest items when full", () => {
      const buffer = new CircularBuffer<number>(3);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4); // Overwrites 1

      expect(buffer.length).toBe(3);
      expect(buffer.get(0)).toBe(2);
      expect(buffer.get(1)).toBe(3);
      expect(buffer.get(2)).toBe(4);
    });

    it("maintains order after wraparound", () => {
      const buffer = new CircularBuffer<number>(3);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4);
      buffer.push(5);

      expect(buffer.toArray()).toEqual([3, 4, 5]);
    });

    it("handles multiple wraparounds", () => {
      const buffer = new CircularBuffer<number>(3);

      for (let i = 1; i <= 10; i++) {
        buffer.push(i);
      }

      expect(buffer.length).toBe(3);
      expect(buffer.toArray()).toEqual([8, 9, 10]);
    });
  });

  describe("clear", () => {
    it("resets buffer to empty", () => {
      const buffer = new CircularBuffer<number>(5);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      buffer.clear();

      expect(buffer.length).toBe(0);
      expect(buffer.get(0)).toBeUndefined();
    });

    it("allows reuse after clear", () => {
      const buffer = new CircularBuffer<number>(3);
      buffer.push(1);
      buffer.push(2);
      buffer.clear();
      buffer.push(10);

      expect(buffer.length).toBe(1);
      expect(buffer.get(0)).toBe(10);
    });
  });

  describe("iteration", () => {
    it("iterates in insertion order", () => {
      const buffer = new CircularBuffer<number>(5);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      const result: number[] = [];
      for (const item of buffer) {
        result.push(item);
      }

      expect(result).toEqual([1, 2, 3]);
    });

    it("iterates correctly after wraparound", () => {
      const buffer = new CircularBuffer<number>(3);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4);

      const result: number[] = [];
      for (const item of buffer) {
        result.push(item);
      }

      expect(result).toEqual([2, 3, 4]);
    });
  });

  describe("toArray", () => {
    it("returns array copy", () => {
      const buffer = new CircularBuffer<number>(5);
      buffer.push(1);
      buffer.push(2);

      const arr = buffer.toArray();
      expect(arr).toEqual([1, 2]);

      // Modifying array shouldn't affect buffer
      arr[0] = 999;
      expect(buffer.get(0)).toBe(1);
    });
  });

  describe("getLast", () => {
    it("returns last n items", () => {
      const buffer = new CircularBuffer<number>(5);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4);

      expect(buffer.getLast(2)).toEqual([3, 4]);
    });

    it("returns all items if n > length", () => {
      const buffer = new CircularBuffer<number>(5);
      buffer.push(1);
      buffer.push(2);

      expect(buffer.getLast(10)).toEqual([1, 2]);
    });

    it("works after wraparound", () => {
      const buffer = new CircularBuffer<number>(3);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4);
      buffer.push(5);

      expect(buffer.getLast(2)).toEqual([4, 5]);
    });
  });

  describe("filterInPlace", () => {
    it("removes items that don't match predicate", () => {
      const buffer = new CircularBuffer<number>(5);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4);
      buffer.push(5);

      buffer.filterInPlace((x) => x % 2 === 0);

      expect(buffer.toArray()).toEqual([2, 4]);
    });

    it("preserves order after filtering", () => {
      const buffer = new CircularBuffer<number>(5);
      buffer.push(10);
      buffer.push(20);
      buffer.push(15);
      buffer.push(25);

      buffer.filterInPlace((x) => x >= 15);

      expect(buffer.toArray()).toEqual([20, 15, 25]);
    });

    it("handles filtering to empty", () => {
      const buffer = new CircularBuffer<number>(5);
      buffer.push(1);
      buffer.push(2);

      buffer.filterInPlace(() => false);

      expect(buffer.length).toBe(0);
    });

    it("works correctly after wraparound", () => {
      const buffer = new CircularBuffer<number>(3);
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4); // Buffer now: [2, 3, 4]

      buffer.filterInPlace((x) => x > 2);

      expect(buffer.toArray()).toEqual([3, 4]);
    });
  });

  describe("edge cases", () => {
    it("handles capacity of 1", () => {
      const buffer = new CircularBuffer<number>(1);
      buffer.push(1);
      expect(buffer.get(0)).toBe(1);

      buffer.push(2);
      expect(buffer.length).toBe(1);
      expect(buffer.get(0)).toBe(2);
    });

    it("handles objects", () => {
      interface Point {
        x: number;
        y: number;
      }
      const buffer = new CircularBuffer<Point>(3);

      buffer.push({ x: 1, y: 2 });
      buffer.push({ x: 3, y: 4 });

      expect(buffer.get(0)).toEqual({ x: 1, y: 2 });
      expect(buffer.get(1)).toEqual({ x: 3, y: 4 });
    });
  });
});

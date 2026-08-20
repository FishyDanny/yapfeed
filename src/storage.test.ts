import { describe, expect, it } from 'vitest';

import type { LocalStoragePort } from './storage';
import {
  appendId,
  MAXIMUM_STORED_IDS,
  parseIdList,
  pruneIds,
  readIdList,
  toggleId,
  writeIdList,
  readValue,
  writeValue,
} from './storage';

class QuotaStorage implements LocalStoragePort {
  private readonly values = new Map<string, string>();

  constructor(private readonly quotaBytes = Number.POSITIVE_INFINITY) {}

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    const used = [...this.values]
      .filter(([storedKey]) => storedKey !== key)
      .reduce((total, [storedKey, storedValue]) => total + storedKey.length + storedValue.length, 0);
    if (used + key.length + value.length > this.quotaBytes) {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    }
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const ids = (count: number, prefix = 'clip'): string[] =>
  Array.from({ length: count }, (_, index) => `${prefix}-${index}`);

describe('stored identifier lists', () => {
  it('reads only well-formed string arrays', () => {
    expect(parseIdList('["a","b","a"]')).toEqual(['a', 'b']);
    expect(parseIdList('not json')).toEqual([]);
    expect(parseIdList('{"a":1}')).toEqual([]);
    expect(parseIdList('["a",7,null]')).toEqual(['a']);
    expect(parseIdList(null)).toEqual([]);
  });

  it('cycles the oldest entries out at the limit', () => {
    const pruned = pruneIds(ids(MAXIMUM_STORED_IDS + 10));

    expect(pruned).toHaveLength(MAXIMUM_STORED_IDS);
    expect(pruned[0]).toBe('clip-10');
    expect(pruned.at(-1)).toBe(`clip-${MAXIMUM_STORED_IDS + 9}`);
  });

  it('moves a repeated identifier back to the newest position', () => {
    expect(appendId(['a', 'b', 'c'], 'a')).toEqual(['b', 'c', 'a']);
    expect(appendId(['a', 'b'], 'c', 2)).toEqual(['b', 'c']);
  });

  it('toggles a like on and off', () => {
    expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('quota-safe writes', () => {
  it('round-trips a list through storage', () => {
    const storage = new QuotaStorage();

    expect(writeValue(storage, 'yapfeed.rate', '1.5')).toBe(true);
    expect(readValue(storage, 'yapfeed.rate')).toBe('1.5');

    expect(writeIdList(storage, 'yapfeed.skips', ['a', 'b'])).toEqual(['a', 'b']);
    expect(readIdList(storage, 'yapfeed.skips')).toEqual(['a', 'b']);
  });

  it('keeps the newest history instead of crashing when the quota is exceeded', () => {
    const storage = new QuotaStorage(220);
    const stored = writeIdList(storage, 'yapfeed.skips', ids(60));

    expect(stored.length).toBeGreaterThan(0);
    expect(stored.length).toBeLessThan(60);
    expect(stored.at(-1)).toBe('clip-59');
    expect(readIdList(storage, 'yapfeed.skips')).toEqual(stored);
  });

  it('gives up cleanly when nothing at all can be written', () => {
    const storage = new QuotaStorage(0);

    expect(writeIdList(storage, 'yapfeed.skips', ids(20))).toEqual([]);
    expect(readIdList(storage, 'yapfeed.skips')).toEqual([]);
    expect(writeValue(storage, 'yapfeed.current.clip', 'clip-1')).toBe(false);
  });

  it('survives a browser that refuses to read local storage', () => {
    const blocked: LocalStoragePort = {
      getItem() {
        throw new DOMException('Access denied.', 'SecurityError');
      },
      setItem() {
        throw new DOMException('Access denied.', 'SecurityError');
      },
      removeItem() {
        throw new DOMException('Access denied.', 'SecurityError');
      },
    };

    expect(readIdList(blocked, 'yapfeed.likes')).toEqual([]);
    expect(writeIdList(blocked, 'yapfeed.likes', ['a'])).toEqual([]);
    expect(readValue(blocked, 'yapfeed.rate')).toBeNull();
  });
});

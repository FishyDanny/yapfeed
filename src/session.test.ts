import { describe, expect, it } from 'vitest';

import { getOrCreateSessionId, hashSessionId } from './session';

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem'> {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('anonymous listening session', () => {
  it('creates a valid identifier with the browser crypto receiver intact', () => {
    expect(getOrCreateSessionId(new MemoryStorage())).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i,
    );
  });

  it('reuses one browser-held identifier instead of creating listener accounts', () => {
    const storage = new MemoryStorage();
    let calls = 0;
    const createId = () => {
      calls += 1;
      return '62195646-a0f8-4c8e-a147-2f00fabf82aa';
    };

    expect(getOrCreateSessionId(storage, createId)).toBe('62195646-a0f8-4c8e-a147-2f00fabf82aa');
    expect(getOrCreateSessionId(storage, createId)).toBe('62195646-a0f8-4c8e-a147-2f00fabf82aa');
    expect(calls).toBe(1);
  });

  it('hashes the local identifier before metrics leave the browser', async () => {
    await expect(hashSessionId('62195646-a0f8-4c8e-a147-2f00fabf82aa')).resolves.toMatch(
      /^[a-f0-9]{64}$/,
    );
    await expect(hashSessionId('known-session')).resolves.toBe(
      'e1c69941d6086ad34886dcb0efd0163d5a3a27a560b8eeb72aa675ecad938215',
    );
  });
});

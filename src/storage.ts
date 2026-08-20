export const MAXIMUM_STORED_IDS = 500;

export interface LocalStoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function dedupe(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

export function parseIdList(raw: string | null): string[] {
  if (raw === null) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return dedupe(value.filter((item): item is string => typeof item === 'string'));
  } catch {
    return [];
  }
}

// Oldest entries are cycled out first so a long listening history can never
// grow past the quota and take the whole key down with it.
export function pruneIds(ids: readonly string[], limit = MAXIMUM_STORED_IDS): string[] {
  const unique = dedupe(ids);
  return unique.length <= limit ? unique : unique.slice(unique.length - limit);
}

export function appendId(
  ids: readonly string[],
  id: string,
  limit = MAXIMUM_STORED_IDS,
): string[] {
  return pruneIds([...ids.filter((item) => item !== id), id], limit);
}

export function toggleId(
  ids: readonly string[],
  id: string,
  limit = MAXIMUM_STORED_IDS,
): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : appendId(ids, id, limit);
}

export function readIdList(storage: LocalStoragePort, key: string): string[] {
  try {
    return parseIdList(storage.getItem(key));
  } catch {
    return [];
  }
}

// A full quota throws on write; halving the list and retrying keeps the most
// recent history instead of leaving a half-written, unparseable value behind.
export function writeIdList(
  storage: LocalStoragePort,
  key: string,
  ids: readonly string[],
  limit = MAXIMUM_STORED_IDS,
): string[] {
  let candidate = pruneIds(ids, limit);
  for (;;) {
    try {
      storage.setItem(key, JSON.stringify(candidate));
      return candidate;
    } catch {
      if (candidate.length === 0) {
        try {
          storage.removeItem(key);
        } catch {
          // Listening continues when a browser blocks local storage entirely.
        }
        return [];
      }
      candidate = candidate.slice(Math.ceil(candidate.length / 2));
    }
  }
}

export function readValue(storage: LocalStoragePort, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeValue(storage: LocalStoragePort, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

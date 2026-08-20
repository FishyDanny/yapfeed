import type { Clip } from './types';

export const PREFETCH_COUNT = 5;
export const MAXIMUM_CLIP_BYTES = 20_000_000;

const DATABASE_NAME = 'yapfeed';
const DATABASE_VERSION = 1;
const STORE_NAME = 'clip-audio';

export interface AudioCachePort {
  keys(): Promise<string[]>;
  read(id: string): Promise<Blob | undefined>;
  write(id: string, blob: Blob): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface OfflineSyncResult {
  stored: string[];
  removed: string[];
  failed: string[];
}

export function selectPrefetchClips(
  queue: readonly Clip[],
  currentIndex: number,
  count = PREFETCH_COUNT,
): Clip[] {
  if (queue.length === 0 || count <= 0) return [];
  const wanted: Clip[] = [];
  for (let step = 1; step <= Math.min(count, queue.length - 1); step += 1) {
    const clip = queue[(currentIndex + step) % queue.length];
    if (clip !== undefined) wanted.push(clip);
  }
  return wanted;
}

// Downloads run one at a time and every failure is a silent no-op: a clip that
// cannot be cached still streams from its source as before.
export async function syncOfflineCache(
  cache: AudioCachePort,
  wanted: readonly Clip[],
  download: (clip: Clip) => Promise<Blob | null>,
  maximumBytes = MAXIMUM_CLIP_BYTES,
): Promise<OfflineSyncResult> {
  const result: OfflineSyncResult = { stored: [], removed: [], failed: [] };
  let cached: string[];
  try {
    cached = await cache.keys();
  } catch {
    return result;
  }

  const wantedIds = new Set(wanted.map((clip) => clip.id));
  for (const id of cached) {
    if (wantedIds.has(id)) continue;
    try {
      await cache.remove(id);
      result.removed.push(id);
    } catch {
      // A stale entry that refuses to delete is harmless.
    }
  }

  for (const clip of wanted) {
    if (cached.includes(clip.id)) continue;
    try {
      const blob = await download(clip);
      if (blob === null || blob.size === 0 || blob.size > maximumBytes) {
        result.failed.push(clip.id);
        continue;
      }
      await cache.write(clip.id, blob);
      result.stored.push(clip.id);
    } catch {
      result.failed.push(clip.id);
    }
  }
  return result;
}

export function describeOfflineCache(count: number): string {
  if (count === 0) return 'Nothing saved for offline listening yet.';
  if (count === 1) return 'The next piece is saved in this browser.';
  return `The next ${count} pieces are saved in this browser.`;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Offline storage refused the request.'));
  });
}

export function createIndexedDbAudioCache(factory: IDBFactory | undefined): AudioCachePort | null {
  if (factory === undefined) return null;

  const open = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) {
          request.result.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Offline storage is unavailable.'));
      request.onblocked = () => reject(new Error('Offline storage is busy in another tab.'));
    });

  const withStore = async <T>(
    mode: IDBTransactionMode,
    use: (store: IDBObjectStore) => Promise<T>,
  ): Promise<T> => {
    const database = await open();
    try {
      return await use(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
    } finally {
      database.close();
    }
  };

  return {
    keys: () =>
      withStore('readonly', async (store) => {
        const keys = await promisify(store.getAllKeys());
        return keys.filter((key): key is string => typeof key === 'string');
      }),
    read: (id) =>
      withStore('readonly', async (store) => {
        const value: unknown = await promisify(store.get(id));
        return value instanceof Blob ? value : undefined;
      }),
    write: (id, blob) =>
      withStore('readwrite', async (store) => {
        await promisify(store.put(blob, id));
      }),
    remove: (id) =>
      withStore('readwrite', async (store) => {
        await promisify(store.delete(id));
      }),
  };
}

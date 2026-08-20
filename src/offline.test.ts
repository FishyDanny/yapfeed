import { describe, expect, it } from 'vitest';

import type { AudioCachePort } from './offline';
import {
  createIndexedDbAudioCache,
  describeOfflineCache,
  PREFETCH_COUNT,
  selectPrefetchClips,
  syncOfflineCache,
} from './offline';
import type { Clip } from './types';

const clips: Clip[] = Array.from({ length: 8 }, (_, index) => ({
  id: `clip-${index}`,
  title: `Clip ${index}`,
  sourceUrl: `https://example.com/${index}.mp3`,
  durationS: 120,
  licence: 'Public Domain Mark 1.0',
  attribution: 'By A. Writer. LibriVox volunteer recording.',
  source: 'https://archive.org/details/example',
}));

class MemoryCache implements AudioCachePort {
  readonly blobs = new Map<string, Blob>();

  constructor(private readonly failOn = new Set<string>()) {}

  keys(): Promise<string[]> {
    if (this.failOn.has('keys')) return Promise.reject(new Error('Offline storage is unavailable.'));
    return Promise.resolve([...this.blobs.keys()]);
  }

  read(id: string): Promise<Blob | undefined> {
    return Promise.resolve(this.blobs.get(id));
  }

  write(id: string, blob: Blob): Promise<void> {
    if (this.failOn.has('write')) return Promise.reject(new Error('The quota has been exceeded.'));
    this.blobs.set(id, blob);
    return Promise.resolve();
  }

  remove(id: string): Promise<void> {
    this.blobs.delete(id);
    return Promise.resolve();
  }
}

const audioBlob = (bytes = 1_000): Blob => new Blob([new Uint8Array(bytes)], { type: 'audio/mpeg' });
const download = (clip: Clip): Promise<Blob | null> => Promise.resolve(audioBlob(clip.durationS));

describe('choosing what to keep offline', () => {
  it('takes the five clips that play next, wrapping at the end of the queue', () => {
    expect(selectPrefetchClips(clips, 0).map((clip) => clip.id)).toEqual([
      'clip-1',
      'clip-2',
      'clip-3',
      'clip-4',
      'clip-5',
    ]);
    expect(selectPrefetchClips(clips, 6).map((clip) => clip.id)).toEqual([
      'clip-7',
      'clip-0',
      'clip-1',
      'clip-2',
      'clip-3',
    ]);
    expect(selectPrefetchClips(clips, 0)).toHaveLength(PREFETCH_COUNT);
  });

  it('never queues the clip that is already playing, however short the queue', () => {
    expect(selectPrefetchClips(clips.slice(0, 3), 1).map((clip) => clip.id)).toEqual([
      'clip-2',
      'clip-0',
    ]);
    expect(selectPrefetchClips(clips.slice(0, 1), 0)).toEqual([]);
    expect(selectPrefetchClips([], 0)).toEqual([]);
  });
});

describe('offline cache synchronisation', () => {
  it('downloads the wanted clips once and keeps them for the next visit', async () => {
    const cache = new MemoryCache();

    const first = await syncOfflineCache(cache, selectPrefetchClips(clips, 0), download);
    expect(first.stored).toEqual(['clip-1', 'clip-2', 'clip-3', 'clip-4', 'clip-5']);

    const second = await syncOfflineCache(cache, selectPrefetchClips(clips, 0), download);
    expect(second.stored).toEqual([]);
    expect(await cache.read('clip-3')).toBeInstanceOf(Blob);
  });

  it('drops clips that have fallen out of the upcoming window', async () => {
    const cache = new MemoryCache();
    await syncOfflineCache(cache, selectPrefetchClips(clips, 0), download);

    const result = await syncOfflineCache(cache, selectPrefetchClips(clips, 3), download);

    expect(result.removed).toEqual(['clip-1', 'clip-2', 'clip-3']);
    expect([...cache.blobs.keys()].sort()).toEqual(['clip-4', 'clip-5', 'clip-6', 'clip-7', 'clip-0'].sort());
  });

  it('refuses oversized and empty downloads', async () => {
    const cache = new MemoryCache();

    const result = await syncOfflineCache(
      cache,
      clips.slice(0, 2),
      (clip) => Promise.resolve(clip.id === 'clip-0' ? audioBlob(0) : audioBlob(50)),
      10,
    );

    expect(result.stored).toEqual([]);
    expect(result.failed).toEqual(['clip-0', 'clip-1']);
    expect(cache.blobs.size).toBe(0);
  });

  it('stays silent when a download or a write fails', async () => {
    const failingWrites = new MemoryCache(new Set(['write']));
    const writeResult = await syncOfflineCache(failingWrites, clips.slice(0, 1), download);
    expect(writeResult.failed).toEqual(['clip-0']);

    const cache = new MemoryCache();
    const downloadResult = await syncOfflineCache(cache, clips.slice(0, 2), (clip) =>
      clip.id === 'clip-0' ? Promise.reject(new Error('Offline.')) : Promise.resolve(null),
    );
    expect(downloadResult.stored).toEqual([]);
    expect(downloadResult.failed).toEqual(['clip-0', 'clip-1']);
  });

  it('does nothing at all when the cache cannot even be listed', async () => {
    const unreadable = new MemoryCache(new Set(['keys']));

    expect(await syncOfflineCache(unreadable, clips.slice(0, 2), download)).toEqual({
      stored: [],
      removed: [],
      failed: [],
    });
  });
});

describe('offline reporting', () => {
  it('describes how much is saved', () => {
    expect(describeOfflineCache(0)).toBe('Nothing saved for offline listening yet.');
    expect(describeOfflineCache(1)).toBe('The next piece is saved in this browser.');
    expect(describeOfflineCache(5)).toBe('The next 5 pieces are saved in this browser.');
  });

  it('reports no cache in a browser without IndexedDB', () => {
    expect(createIndexedDbAudioCache(undefined)).toBeNull();
  });
});

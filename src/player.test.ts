import { describe, expect, it } from 'vitest';

import type { Clip } from './types';
import {
  createQueue,
  formatDuration,
  nextClipIndex,
  previousClipIndex,
  registerMediaSessionHandlers,
  sleepDeadline,
} from './player';

const clips: Clip[] = Array.from({ length: 8 }, (_, index) => ({
  id: `clip-${index}`,
  title: `Clip ${index}`,
  sourceUrl: `https://example.com/${index}.mp3`,
  durationS: index + 60,
  licence: 'Public Domain Mark 1.0',
  attribution: 'By A. Writer. LibriVox volunteer recording.',
  source: 'https://archive.org/details/example',
}));

describe('listening queue', () => {
  it('creates a stable seeded order without losing clips', () => {
    const first = createQueue(clips, 'listener-a').map((clip) => clip.id);
    const second = createQueue(clips, 'listener-a').map((clip) => clip.id);

    expect(first).toEqual(second);
    expect([...first].sort()).toEqual(clips.map((clip) => clip.id).sort());
    expect(first).not.toEqual(clips.map((clip) => clip.id));
  });

  it('wraps next and previous navigation at queue boundaries', () => {
    expect(nextClipIndex(7, 8)).toBe(0);
    expect(previousClipIndex(0, 8)).toBe(7);
    expect(nextClipIndex(0, 0)).toBe(0);
  });
});

describe('eyes-closed controls', () => {
  it('formats durations and calculates a sleep deadline', () => {
    expect(formatDuration(125)).toBe('2:05');
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(sleepDeadline(20, 1_000)).toBe(1_201_000);
    expect(sleepDeadline(0, 1_000)).toBeNull();
  });

  it('registers play, pause, next and previous lock-screen actions', () => {
    const actions = new Map<string, MediaSessionActionHandler | null>();
    const session = {
      setActionHandler(action: MediaSessionAction, handler: MediaSessionActionHandler | null) {
        actions.set(action, handler);
      },
    };
    const calls: string[] = [];

    const installed = registerMediaSessionHandlers(session, {
      play: () => calls.push('play'),
      pause: () => calls.push('pause'),
      next: () => calls.push('next'),
      previous: () => calls.push('previous'),
    });

    actions.get('play')?.({ action: 'play' });
    actions.get('pause')?.({ action: 'pause' });
    actions.get('nexttrack')?.({ action: 'nexttrack' });
    actions.get('previoustrack')?.({ action: 'previoustrack' });

    expect(installed).toBe(true);
    expect(calls).toEqual(['play', 'pause', 'next', 'previous']);
  });
});

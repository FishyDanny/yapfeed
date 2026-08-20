import { describe, expect, it } from 'vitest';

import type { Clip } from './types';
import {
  clipStartOffset,
  createQueue,
  formatDuration,
  isPastClipEnd,
  isSleepDue,
  nextClipIndex,
  previousClipIndex,
  registerMediaSessionHandlers,
  sleepCheckDelay,
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

describe('imported podcast slices', () => {
  const whole = clips[0] as Clip;
  const slice: Clip = { ...whole, startOffsetS: 44, endOffsetS: 88 };

  it('starts a slice at its offset and a whole clip at the beginning', () => {
    expect(clipStartOffset(slice)).toBe(44);
    expect(clipStartOffset(whole)).toBe(0);
    expect(clipStartOffset({ ...whole, startOffsetS: Number.NaN })).toBe(0);
  });

  it('ends a slice at its end offset', () => {
    expect(isPastClipEnd(87.9, slice)).toBe(false);
    expect(isPastClipEnd(88, slice)).toBe(true);
    expect(isPastClipEnd(120, slice)).toBe(true);
  });

  it('lets a clip without offsets play to its own end', () => {
    expect(isPastClipEnd(5_000, whole)).toBe(false);
    expect(isPastClipEnd(5_000, { ...whole, endOffsetS: 0 })).toBe(false);
    expect(isPastClipEnd(5_000, { ...slice, endOffsetS: 44 })).toBe(false);
  });
});

describe('eyes-closed controls', () => {
  it('formats durations and calculates a sleep deadline', () => {
    expect(formatDuration(125)).toBe('2:05');
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(sleepDeadline(20, 1_000)).toBe(1_201_000);
    expect(sleepDeadline(0, 1_000)).toBeNull();
  });

  it('reports a sleep deadline as due from the wall clock, not from a timer', () => {
    const deadline = sleepDeadline(20, 1_000);

    expect(isSleepDue(deadline, 1_200_999)).toBe(false);
    expect(isSleepDue(deadline, 1_201_000)).toBe(true);
    expect(isSleepDue(deadline, 9_000_000)).toBe(true);
    expect(isSleepDue(null, 9_000_000)).toBe(false);
  });

  it('re-arms the sleep check often enough to survive a suspended background tab', () => {
    expect(sleepCheckDelay(1_201_000, 1_000, 15_000)).toBe(15_000);
    expect(sleepCheckDelay(1_201_000, 1_195_000, 15_000)).toBe(6_000);
    expect(sleepCheckDelay(1_201_000, 1_800_000, 15_000)).toBe(0);
  });

  it('registers lock-screen seek actions with the offset the browser supplies', () => {
    const actions = new Map<string, MediaSessionActionHandler | null>();
    const session = {
      setActionHandler(action: MediaSessionAction, handler: MediaSessionActionHandler | null) {
        actions.set(action, handler);
      },
    };
    const seeks: number[] = [];
    const positions: number[] = [];

    registerMediaSessionHandlers(session, {
      play: () => undefined,
      pause: () => undefined,
      next: () => undefined,
      previous: () => undefined,
      seekBy: (offset) => seeks.push(offset),
      seekTo: (position) => positions.push(position),
    });

    actions.get('seekbackward')?.({ action: 'seekbackward' });
    actions.get('seekforward')?.({ action: 'seekforward', seekOffset: 30 });
    actions.get('seekto')?.({ action: 'seekto', seekTime: 42 });
    actions.get('seekto')?.({ action: 'seekto' });

    expect(seeks).toEqual([-15, 30]);
    expect(positions).toEqual([42]);
  });

  it('omits seek actions when the player does not offer them', () => {
    const actions = new Map<string, MediaSessionActionHandler | null>();

    registerMediaSessionHandlers(
      {
        setActionHandler(action: MediaSessionAction, handler: MediaSessionActionHandler | null) {
          actions.set(action, handler);
        },
      },
      {
        play: () => undefined,
        pause: () => undefined,
        next: () => undefined,
        previous: () => undefined,
      },
    );

    expect([...actions.keys()]).toEqual(['play', 'pause', 'nexttrack', 'previoustrack']);
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

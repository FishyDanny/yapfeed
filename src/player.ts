import { SEEK_STEP_S } from './seek';
import type { Clip } from './types';

export interface PlayerControls {
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seekBy?: (offsetSeconds: number) => void;
  seekTo?: (positionSeconds: number) => void;
}

export interface MediaSessionPort {
  setActionHandler: (
    action: MediaSessionAction,
    handler: MediaSessionActionHandler | null,
  ) => void;
}

function seedNumber(value: string): number {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function nextRandom(state: number): [number, number] {
  let value = state + 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return [((value ^ (value >>> 14)) >>> 0) / 4_294_967_296, state + 0x6d2b79f5];
}

export function createQueue(clips: readonly Clip[], seed: string): Clip[] {
  const queue = [...clips];
  let state = seedNumber(seed);
  for (let index = queue.length - 1; index > 0; index -= 1) {
    const [random, nextState] = nextRandom(state);
    state = nextState;
    const swapIndex = Math.floor(random * (index + 1));
    const current = queue[index];
    const swapped = queue[swapIndex];
    if (current !== undefined && swapped !== undefined) {
      queue[index] = swapped;
      queue[swapIndex] = current;
    }
  }
  return queue;
}

export function nextClipIndex(index: number, count: number): number {
  return count > 0 ? (index + 1) % count : 0;
}

export function previousClipIndex(index: number, count: number): number {
  return count > 0 ? (index - 1 + count) % count : 0;
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

export function sleepDeadline(minutes: number, now = Date.now()): number | null {
  if (!Number.isSafeInteger(minutes) || minutes <= 0) return null;
  return now + minutes * 60_000;
}

export function isSleepDue(deadline: number | null, now = Date.now()): boolean {
  return deadline !== null && now >= deadline;
}

export function sleepCheckDelay(
  deadline: number,
  now = Date.now(),
  maximumDelay = 15_000,
): number {
  return Math.max(0, Math.min(maximumDelay, deadline - now));
}

export function clipStartOffset(clip: Clip): number {
  const start = clip.startOffsetS;
  return start !== undefined && Number.isFinite(start) && start > 0 ? start : 0;
}

// An imported podcast slice covers one span of a longer recording, so playback
// stops at its end offset instead of running into the next slice.
export function isPastClipEnd(currentTime: number, clip: Clip): boolean {
  const end = clip.endOffsetS;
  if (end === undefined || !Number.isFinite(end) || end <= clipStartOffset(clip)) return false;
  return Number.isFinite(currentTime) && currentTime >= end;
}

export function registerMediaSessionHandlers(
  session: MediaSessionPort | undefined,
  controls: PlayerControls,
): boolean {
  if (session === undefined) return false;

  const { seekBy, seekTo } = controls;
  const actions: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
    ['play', () => controls.play()],
    ['pause', () => controls.pause()],
    ['nexttrack', () => controls.next()],
    ['previoustrack', () => controls.previous()],
  ];
  if (seekBy !== undefined) {
    actions.push(
      ['seekbackward', (details) => seekBy(-(details.seekOffset ?? SEEK_STEP_S))],
      ['seekforward', (details) => seekBy(details.seekOffset ?? SEEK_STEP_S)],
    );
  }
  if (seekTo !== undefined) {
    actions.push([
      'seekto',
      (details) => {
        if (details.seekTime !== undefined) seekTo(details.seekTime);
      },
    ]);
  }
  let installed = false;
  for (const [action, handler] of actions) {
    try {
      session.setActionHandler(action, handler);
      installed = true;
    } catch {
      // Browsers may expose Media Session while omitting individual actions.
    }
  }
  return installed;
}

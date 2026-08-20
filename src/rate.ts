export const PLAYBACK_RATES = [0.5, 1, 1.5, 2] as const;

export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export const DEFAULT_PLAYBACK_RATE: PlaybackRate = 1;

export function isPlaybackRate(value: number): value is PlaybackRate {
  return PLAYBACK_RATES.some((rate) => rate === value);
}

// Stored and DOM-supplied values arrive as strings, and an unsupported rate
// snaps to the closest offered one so playback never runs at a stray speed.
export function normaliseRate(value: unknown): PlaybackRate {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PLAYBACK_RATE;
  if (isPlaybackRate(parsed)) return parsed;
  return PLAYBACK_RATES.reduce<PlaybackRate>(
    (closest, rate) =>
      Math.abs(rate - parsed) < Math.abs(closest - parsed) ? rate : closest,
    DEFAULT_PLAYBACK_RATE,
  );
}

export function formatRate(rate: number): string {
  return `${rate}x`;
}

export function nextPlaybackRate(current: PlaybackRate): PlaybackRate {
  const index = PLAYBACK_RATES.indexOf(current);
  return PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length] ?? DEFAULT_PLAYBACK_RATE;
}

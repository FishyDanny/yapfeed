import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PLAYBACK_RATE,
  formatRate,
  isPlaybackRate,
  nextPlaybackRate,
  normaliseRate,
  PLAYBACK_RATES,
} from './rate';

describe('playback speed', () => {
  it('offers the half, normal, half-again and double speeds', () => {
    expect([...PLAYBACK_RATES]).toEqual([0.5, 1, 1.5, 2]);
    expect(isPlaybackRate(1.5)).toBe(true);
    expect(isPlaybackRate(1.25)).toBe(false);
  });

  it('accepts the string values that storage and data attributes hand back', () => {
    expect(normaliseRate('1.5')).toBe(1.5);
    expect(normaliseRate('2')).toBe(2);
    expect(normaliseRate(0.5)).toBe(0.5);
  });

  it('falls back to normal speed for unusable values', () => {
    expect(normaliseRate(null)).toBe(DEFAULT_PLAYBACK_RATE);
    expect(normaliseRate('fast')).toBe(DEFAULT_PLAYBACK_RATE);
    expect(normaliseRate(0)).toBe(DEFAULT_PLAYBACK_RATE);
    expect(normaliseRate(-2)).toBe(DEFAULT_PLAYBACK_RATE);
  });

  it('snaps an unsupported speed to the closest offered one', () => {
    expect(normaliseRate(1.4)).toBe(1.5);
    expect(normaliseRate(0.6)).toBe(0.5);
    expect(normaliseRate(9)).toBe(2);
  });

  it('labels and cycles the speeds for a single control', () => {
    expect(formatRate(0.5)).toBe('0.5x');
    expect(formatRate(2)).toBe('2x');
    expect(nextPlaybackRate(0.5)).toBe(1);
    expect(nextPlaybackRate(2)).toBe(0.5);
  });
});

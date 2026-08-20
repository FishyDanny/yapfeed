import { describe, expect, it } from 'vitest';

import {
  canCommitSeek,
  clampSeekTarget,
  MINIMUM_SEEK_GAP_MS,
  nextSeekTarget,
  rateCorrection,
  SEEK_STEP_S,
} from './seek';

describe('seek targets', () => {
  it('keeps a target inside the loaded clip', () => {
    expect(clampSeekTarget(30, 120)).toBe(30);
    expect(clampSeekTarget(-5, 120)).toBe(0);
    expect(clampSeekTarget(500, 120)).toBe(119.75);
    expect(clampSeekTarget(Number.NaN, 120)).toBe(0);
  });

  it('leaves the target alone while the duration is still unknown', () => {
    expect(clampSeekTarget(30, Number.NaN)).toBe(30);
    expect(clampSeekTarget(30, Number.POSITIVE_INFINITY)).toBe(30);
  });

  it('steps forward and backward from the current position', () => {
    expect(nextSeekTarget(40, SEEK_STEP_S, 120)).toBe(55);
    expect(nextSeekTarget(5, -SEEK_STEP_S, 120)).toBe(0);
    expect(nextSeekTarget(Number.NaN, SEEK_STEP_S, 120)).toBe(15);
  });
});

describe('seek coalescing', () => {
  it('refuses to commit while the element is still seeking', () => {
    expect(canCommitSeek({ seeking: true, lastCommitMs: null }, 10_000)).toBe(false);
  });

  it('spaces committed seeks so a rapid burst cannot stack up', () => {
    const gate = { seeking: false, lastCommitMs: 10_000 };

    expect(canCommitSeek(gate, 10_000 + MINIMUM_SEEK_GAP_MS - 1)).toBe(false);
    expect(canCommitSeek(gate, 10_000 + MINIMUM_SEEK_GAP_MS)).toBe(true);
    expect(canCommitSeek({ seeking: false, lastCommitMs: null }, 10_000)).toBe(true);
  });
});

describe('playback rate recovery', () => {
  it('restores the intended rate when a seek leaves it distorted', () => {
    expect(rateCorrection(0.75, 1)).toBe(1);
    expect(rateCorrection(Number.NaN, 1.5)).toBe(1.5);
  });

  it('leaves an already correct rate untouched so no ratechange loop starts', () => {
    expect(rateCorrection(1, 1)).toBeNull();
    expect(rateCorrection(1.5005, 1.5)).toBeNull();
  });
});

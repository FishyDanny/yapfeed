export const SEEK_STEP_S = 15;
export const MINIMUM_SEEK_GAP_MS = 120;

const END_MARGIN_S = 0.25;
const RATE_TOLERANCE = 0.01;

export interface SeekGate {
  seeking: boolean;
  lastCommitMs: number | null;
}

export function clampSeekTarget(target: number, duration: number): number {
  if (!Number.isFinite(target) || target < 0) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return target;
  return Math.min(target, Math.max(0, duration - END_MARGIN_S));
}

export function nextSeekTarget(current: number, offsetS: number, duration: number): number {
  const base = Number.isFinite(current) ? current : 0;
  return clampSeekTarget(base + offsetS, duration);
}

// Committing a new position while the element is still seeking is what leaves
// some browsers buffering at a corrupted playback rate, so requests coalesce
// until the previous seek has settled.
export function canCommitSeek(
  gate: SeekGate,
  nowMs: number,
  minimumGapMs = MINIMUM_SEEK_GAP_MS,
): boolean {
  if (gate.seeking) return false;
  return gate.lastCommitMs === null || nowMs - gate.lastCommitMs >= minimumGapMs;
}

export function rateCorrection(
  actualRate: number,
  intendedRate: number,
  tolerance = RATE_TOLERANCE,
): number | null {
  if (!Number.isFinite(actualRate)) return intendedRate;
  return Math.abs(actualRate - intendedRate) > tolerance ? intendedRate : null;
}

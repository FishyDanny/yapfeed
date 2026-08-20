import type { PlayEventInput, SubmissionInput } from '../types';

export interface PendingSubmission extends SubmissionInput {
  status: 'pending';
}

export class ValidationError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(
  value: unknown,
  label: string,
  maximumLength: number,
  allowEmpty = false,
): string {
  if (typeof value !== 'string') throw new ValidationError(`${label} is required.`);
  const trimmed = value.trim();
  if ((!allowEmpty && trimmed.length === 0) || trimmed.length > maximumLength) {
    throw new ValidationError(`${label} must be no longer than ${maximumLength} characters.`);
  }
  return trimmed;
}

export function parsePlayEvent(value: unknown): PlayEventInput {
  if (!isRecord(value)) throw new ValidationError('Send a play event object.');
  const clipId = requiredString(value.clipId, 'Clip ID', 180);
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(clipId)) {
    throw new ValidationError('Clip ID is not valid.');
  }
  if (typeof value.completed !== 'boolean') {
    throw new ValidationError('Clip completion must be true or false.');
  }
  const sessionHash = requiredString(value.sessionHash, 'Session hash', 64);
  if (!/^[a-f0-9]{64}$/.test(sessionHash)) {
    throw new ValidationError('Session hash must be a SHA-256 digest.');
  }
  return { clipId, completed: value.completed, sessionHash };
}

export function parseSubmission(value: unknown): PendingSubmission {
  if (!isRecord(value)) throw new ValidationError('Send a submission object.');
  const submitterEmail = requiredString(value.submitterEmail, 'Submitter email', 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
    throw new ValidationError('Enter a valid email address.');
  }
  const urlOrKey = requiredString(value.urlOrKey, 'Audio URL', 2048);
  let audioUrl: URL;
  try {
    audioUrl = new URL(urlOrKey);
  } catch {
    throw new ValidationError('Enter a valid HTTPS audio URL.');
  }
  if (audioUrl.protocol !== 'https:') {
    throw new ValidationError('Enter a valid HTTPS audio URL.');
  }
  if (!Number.isSafeInteger(value.durationS) || Number(value.durationS) < 1 || Number(value.durationS) > 60) {
    throw new ValidationError('Submitted clips must be between 1 and 60 seconds.');
  }
  const note = requiredString(value.note, 'Note', 1_000, true);
  return {
    submitterEmail,
    urlOrKey: audioUrl.toString(),
    durationS: Number(value.durationS),
    note,
    status: 'pending',
  };
}

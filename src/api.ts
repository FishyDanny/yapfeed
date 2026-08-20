import type {
  ClipsResponse,
  PlayEventInput,
  SubmissionInput,
  SubmissionResponse,
} from './types';

const GENERIC_ERROR = 'Yapfeed could not complete that request.';

export function readApiError(value: unknown): string {
  if (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof value.error === 'string'
  ) {
    return value.error;
  }
  return GENERIC_ERROR;
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  const response = await fetch(path, { ...init, headers });
  const value: unknown = await response.json();
  if (!response.ok) throw new Error(readApiError(value));
  return value as T;
}

function jsonRequest(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function getClips(): Promise<ClipsResponse> {
  return requestJson<ClipsResponse>('/api/clips');
}

export async function recordPlay(input: PlayEventInput): Promise<void> {
  await requestJson<{ recorded: true }>('/api/plays', jsonRequest(input));
}

export function submitClip(input: SubmissionInput): Promise<SubmissionResponse> {
  return requestJson<SubmissionResponse>('/api/submissions', jsonRequest(input));
}

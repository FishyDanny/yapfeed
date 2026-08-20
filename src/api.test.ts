import { describe, expect, it } from 'vitest';

import { readApiError } from './api';

describe('API errors', () => {
  it('uses a specific server message only when the payload is shaped correctly', () => {
    expect(readApiError({ error: 'That audio URL is already waiting for review.' })).toBe(
      'That audio URL is already waiting for review.',
    );
    expect(readApiError({ error: 500 })).toBe('Yapfeed could not complete that request.');
    expect(readApiError(null)).toBe('Yapfeed could not complete that request.');
  });
});

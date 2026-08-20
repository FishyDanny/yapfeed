import { describe, expect, it } from 'vitest';

import { parsePlayEvent, parseSubmission } from './domain';

describe('anonymous play events', () => {
  it('accepts a completed clip with a pre-hashed session identifier', () => {
    expect(
      parsePlayEvent({
        clipId: 'lv-ss081_1907_librivox-story-01',
        completed: true,
        sessionHash: 'a'.repeat(64),
      }),
    ).toEqual({
      clipId: 'lv-ss081_1907_librivox-story-01',
      completed: true,
      sessionHash: 'a'.repeat(64),
    });
  });

  it('rejects malformed identifiers instead of recording ambiguous metrics', () => {
    expect(() =>
      parsePlayEvent({ clipId: '', completed: false, sessionHash: 'not-a-hash' }),
    ).toThrow('Clip ID');
    expect(() =>
      parsePlayEvent({ clipId: 'valid', completed: 'yes', sessionHash: 'a'.repeat(64) }),
    ).toThrow('completion');
  });
});

describe('moderated submissions', () => {
  const valid = {
    submitterEmail: 'listener@example.com',
    urlOrKey: 'https://audio.example.com/thought.mp3',
    durationS: 60,
    note: 'A one-minute field note.',
  };

  it('forces every accepted submission into the pending queue', () => {
    expect(parseSubmission({ ...valid, status: 'approved' })).toEqual({
      ...valid,
      status: 'pending',
    });
  });

  it('rejects non-HTTPS, overlong and malformed submissions', () => {
    expect(() => parseSubmission({ ...valid, urlOrKey: 'http://example.com/clip.mp3' })).toThrow(
      'HTTPS',
    );
    expect(() => parseSubmission({ ...valid, durationS: 61 })).toThrow('60 seconds');
    expect(() => parseSubmission({ ...valid, submitterEmail: 'not-an-email' })).toThrow('email');
  });
});

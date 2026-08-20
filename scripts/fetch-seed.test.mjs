import { describe, expect, it } from 'vitest';

import { selectEligibleFiles } from './fetch-seed.mjs';

describe('LibriVox seed selection', () => {
  it('keeps only original MP3 files no longer than ten minutes', () => {
    const files = [
      {
        name: 'brief-original.mp3',
        source: 'original',
        format: '128Kbps MP3',
        length: '599.9',
        title: '01 - A brief story',
        creator: 'A. Writer',
      },
      {
        name: 'brief-derived.mp3',
        source: 'derivative',
        format: 'VBR MP3',
        length: '120',
        title: '02 - Derived copy',
        creator: 'B. Writer',
      },
      {
        name: 'long-original.mp3',
        source: 'original',
        format: '128Kbps MP3',
        length: '600.01',
        title: '03 - Too long',
        creator: 'C. Writer',
      },
      {
        name: 'notes.txt',
        source: 'original',
        format: 'Text',
        length: '10',
        title: 'Notes',
        creator: 'D. Writer',
      },
    ];

    expect(selectEligibleFiles(files).map((file) => file.name)).toEqual([
      'brief-original.mp3',
    ]);
  });

  it('rejects incomplete metadata that cannot be credited', () => {
    const files = [
      {
        name: 'untitled.mp3',
        source: 'original',
        format: '128Kbps MP3',
        length: '120',
      },
    ];

    expect(selectEligibleFiles(files)).toEqual([]);
  });
});

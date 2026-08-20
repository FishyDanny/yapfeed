import { describe, expect, it } from 'vitest';

import {
  assertSafeFeedUrl,
  MAXIMUM_SLICE_S,
  parseDurationSeconds,
  parseFeedImport,
  parsePodcastFeed,
  sliceEpisode,
  sliceFeed,
} from './podcast';

const feedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Field &amp; Tape</title>
    <link>https://fieldandtape.example/</link>
    <item>
      <title><![CDATA[Rain on a tin roof]]></title>
      <link>https://fieldandtape.example/rain</link>
      <enclosure url="https://audio.example.com/rain.mp3?token=a&amp;b" length="1200000" type="audio/mpeg" />
      <itunes:duration>02:10</itunes:duration>
    </item>
    <item>
      <title>Short hello</title>
      <enclosure url='https://audio.example.com/hello.mp3' type='audio/mpeg' />
      <itunes:duration>45</itunes:duration>
    </item>
    <item>
      <title>No audio file</title>
      <itunes:duration>90</itunes:duration>
    </item>
    <item>
      <title>Insecure audio</title>
      <enclosure url="http://audio.example.com/insecure.mp3" type="audio/mpeg" />
      <itunes:duration>90</itunes:duration>
    </item>
    <item>
      <title>No duration</title>
      <enclosure url="https://audio.example.com/unknown.mp3" type="audio/mpeg" />
    </item>
  </channel>
</rss>`;

describe('podcast durations', () => {
  it('reads seconds, minutes and hours', () => {
    expect(parseDurationSeconds('90')).toBe(90);
    expect(parseDurationSeconds('02:10')).toBe(130);
    expect(parseDurationSeconds('01:02:03')).toBe(3_723);
    expect(parseDurationSeconds(' 45 ')).toBe(45);
  });

  it('rejects what it cannot trust', () => {
    expect(parseDurationSeconds(null)).toBeNull();
    expect(parseDurationSeconds('unknown')).toBeNull();
    expect(parseDurationSeconds('0')).toBeNull();
    expect(parseDurationSeconds('1:2:3:4')).toBeNull();
  });
});

describe('podcast feed parsing', () => {
  it('keeps only episodes with an HTTPS enclosure and a duration', () => {
    const feed = parsePodcastFeed(feedXml);

    expect(feed.title).toBe('Field & Tape');
    expect(feed.page).toBe('https://fieldandtape.example/');
    expect(feed.episodes.map((episode) => episode.title)).toEqual([
      'Rain on a tin roof',
      'Short hello',
    ]);
  });

  it('decodes entities inside enclosure attributes', () => {
    expect(parsePodcastFeed(feedXml).episodes[0]?.audioUrl).toBe(
      'https://audio.example.com/rain.mp3?token=a&b',
    );
  });

  it('refuses documents that are not feeds or carry no usable episode', () => {
    expect(() => parsePodcastFeed('<html><body>Not a feed</body></html>')).toThrow('podcast feed');
    expect(() => parsePodcastFeed('<rss><channel><title>Empty</title></channel></rss>')).toThrow(
      'no episodes',
    );
  });
});

describe('automatic clip slicing', () => {
  const episode = {
    title: 'Rain on a tin roof',
    audioUrl: 'https://audio.example.com/rain.mp3',
    durationS: 130,
    page: 'https://fieldandtape.example/rain',
  };

  it('cuts a long episode into even parts of at most a minute', () => {
    const slices = sliceEpisode(episode, 'Field & Tape');

    expect(slices).toHaveLength(3);
    expect(slices.map((slice) => slice.durationS)).toEqual([44, 44, 42]);
    slices.forEach((slice) => expect(slice.durationS).toBeLessThanOrEqual(MAXIMUM_SLICE_S));
    expect(slices[0]?.startOffsetS).toBe(0);
    expect(slices.at(-1)?.endOffsetS).toBe(130);
  });

  it('addresses each slice with a media fragment and a distinct identifier', () => {
    const slices = sliceEpisode(episode, 'Field & Tape');
    const ids = slices.map((slice) => slice.id);

    expect(slices[1]?.sourceUrl).toBe('https://audio.example.com/rain.mp3#t=44,88');
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z0-9][a-z0-9_-]*$/));
  });

  it('numbers parts and credits the feed', () => {
    const slices = sliceEpisode(episode, 'Field & Tape');

    expect(slices[0]?.title).toBe('Rain on a tin roof (part 1 of 3)');
    expect(slices[0]?.attribution).toBe(
      'From Field & Tape. Imported podcast episode: Rain on a tin roof.',
    );
    expect(slices[0]?.source).toBe('https://fieldandtape.example/rain');
  });

  it('leaves a short episode whole and drops anything too short to listen to', () => {
    const short = sliceEpisode({ ...episode, durationS: 45 }, 'Field & Tape');

    expect(short).toHaveLength(1);
    expect(short[0]?.title).toBe('Rain on a tin roof');
    expect(short[0]?.sourceUrl).toBe('https://audio.example.com/rain.mp3#t=0,45');
    expect(sliceEpisode({ ...episode, durationS: 3 }, 'Field & Tape')).toEqual([]);
  });

  it('caps how much a single import can queue', () => {
    const feed = parsePodcastFeed(feedXml);

    expect(sliceFeed(feed)).toHaveLength(4);
    expect(sliceFeed(feed, 2)).toHaveLength(2);
  });
});

describe('feed import requests', () => {
  const valid = { feedUrl: 'https://fieldandtape.example/rss', submitterEmail: 'listener@example.com' };

  it('accepts a public HTTPS feed with a contactable importer', () => {
    expect(parseFeedImport(valid)).toEqual({
      feedUrl: 'https://fieldandtape.example/rss',
      submitterEmail: 'listener@example.com',
    });
  });

  it('rejects addresses that could reach private infrastructure', () => {
    expect(() => assertSafeFeedUrl('http://fieldandtape.example/rss')).toThrow('HTTPS');
    expect(() => assertSafeFeedUrl('https://localhost/rss')).toThrow('public host');
    expect(() => assertSafeFeedUrl('https://127.0.0.1/rss')).toThrow('public host');
    expect(() => assertSafeFeedUrl('https://169.254.169.254/latest/meta-data')).toThrow('public host');
    expect(() => assertSafeFeedUrl('https://metadata.google.internal/rss')).toThrow('public host');
    expect(() => assertSafeFeedUrl('https://[::1]/rss')).toThrow('public host');
    expect(() => assertSafeFeedUrl('https://user:key@fieldandtape.example/rss')).toThrow('sign-in');
    expect(() => assertSafeFeedUrl('https://fieldandtape.example:8443/rss')).toThrow('standard HTTPS port');
  });

  it('rejects malformed request bodies', () => {
    expect(() => parseFeedImport(null)).toThrow('feed import object');
    expect(() => parseFeedImport({ ...valid, feedUrl: '' })).toThrow('HTTPS feed address');
    expect(() => parseFeedImport({ ...valid, submitterEmail: 'not-an-email' })).toThrow('email');
  });
});

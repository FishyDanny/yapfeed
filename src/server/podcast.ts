import { ValidationError } from './domain';

export const MAXIMUM_SLICE_S = 60;
export const MINIMUM_SLICE_S = 5;
export const MAXIMUM_IMPORT_SLICES = 60;
export const MAXIMUM_FEED_BYTES = 2_000_000;

export interface PodcastEpisode {
  title: string;
  audioUrl: string;
  durationS: number;
  page: string;
}

export interface PodcastFeed {
  title: string;
  page: string;
  episodes: PodcastEpisode[];
}

export interface ClipSlice {
  id: string;
  title: string;
  sourceUrl: string;
  startOffsetS: number;
  endOffsetS: number;
  durationS: number;
  attribution: string;
  source: string;
}

export interface FeedImportInput {
  feedUrl: string;
  submitterEmail: string;
}

const PRIVATE_HOST_PATTERN =
  /^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.home\.arpa|metadata\.google\.internal)$/i;
const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

function decodeXmlText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function readTag(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(block);
  const inner = match?.[1];
  return inner === undefined ? null : decodeXmlText(inner);
}

function readAttribute(block: string, tag: string, attribute: string): string | null {
  const element = new RegExp(`<${tag}\\b[^>]*?/?>`, 'i').exec(block)?.[0];
  if (element === undefined) return null;
  const value = new RegExp(`\\b${attribute}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(element);
  const raw = value?.[2] ?? value?.[3];
  return raw === undefined ? null : decodeXmlText(raw);
}

// Feeds spell duration as seconds, mm:ss or hh:mm:ss.
export function parseDurationSeconds(value: string | null): number | null {
  if (value === null) return null;
  const parts = value.trim().split(':');
  if (parts.length > 3) return null;
  let total = 0;
  for (const part of parts) {
    if (!/^\d+(\.\d+)?$/.test(part)) return null;
    total = total * 60 + Number(part);
  }
  const seconds = Math.floor(total);
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
}

function hashId(value: string): string {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(36);
}

export function parsePodcastFeed(xml: string): PodcastFeed {
  if (typeof xml !== 'string' || !/<rss\b|<feed\b|<channel\b/i.test(xml)) {
    throw new ValidationError('That address did not return a podcast feed.');
  }
  const channel = /<channel\b[^>]*>([\s\S]*?)<\/channel>/i.exec(xml)?.[1] ?? xml;
  const feedTitle = readTag(channel.replace(/<item\b[\s\S]*$/i, ''), 'title') ?? 'Untitled feed';
  const feedPage = readTag(channel.replace(/<item\b[\s\S]*$/i, ''), 'link') ?? '';

  const episodes: PodcastEpisode[] = [];
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const block = match[1] ?? '';
    const audioUrl = readAttribute(block, 'enclosure', 'url');
    if (audioUrl === null || !audioUrl.startsWith('https://')) continue;
    const durationS = parseDurationSeconds(
      readTag(block, 'itunes:duration') ?? readTag(block, 'duration'),
    );
    if (durationS === null) continue;
    episodes.push({
      title: readTag(block, 'title') ?? feedTitle,
      audioUrl,
      durationS,
      page: readTag(block, 'link') ?? feedPage,
    });
  }

  if (episodes.length === 0) {
    throw new ValidationError('That feed has no episodes with an HTTPS audio file and a duration.');
  }
  return { title: feedTitle, page: feedPage, episodes };
}

// Episodes are cut into equal parts no longer than a minute, addressed with a
// media fragment so every slice keeps its own playable URL.
export function sliceEpisode(
  episode: PodcastEpisode,
  feedTitle: string,
  maximumSliceS = MAXIMUM_SLICE_S,
): ClipSlice[] {
  const total = Math.floor(episode.durationS);
  if (total < MINIMUM_SLICE_S) return [];
  const count = Math.max(1, Math.ceil(total / maximumSliceS));
  const length = Math.ceil(total / count);
  const attribution = `From ${feedTitle}. Imported podcast episode: ${episode.title}.`;

  const slices: ClipSlice[] = [];
  for (let index = 0; index < count; index += 1) {
    const startOffsetS = index * length;
    const endOffsetS = Math.min(total, startOffsetS + length);
    if (endOffsetS - startOffsetS < MINIMUM_SLICE_S) continue;
    slices.push({
      id: `pod-${hashId(episode.audioUrl)}-${startOffsetS}`,
      title: count === 1 ? episode.title : `${episode.title} (part ${index + 1} of ${count})`,
      sourceUrl: `${episode.audioUrl}#t=${startOffsetS},${endOffsetS}`,
      startOffsetS,
      endOffsetS,
      durationS: endOffsetS - startOffsetS,
      attribution,
      source: episode.page === '' ? episode.audioUrl : episode.page,
    });
  }
  return slices;
}

export function sliceFeed(feed: PodcastFeed, limit = MAXIMUM_IMPORT_SLICES): ClipSlice[] {
  const slices: ClipSlice[] = [];
  for (const episode of feed.episodes) {
    for (const slice of sliceEpisode(episode, feed.title)) {
      if (slices.length >= limit) return slices;
      slices.push(slice);
    }
  }
  return slices;
}

export function assertSafeFeedUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ValidationError('Enter a valid HTTPS feed address.');
  }
  if (url.protocol !== 'https:') {
    throw new ValidationError('Enter a valid HTTPS feed address.');
  }
  if (url.username !== '' || url.password !== '') {
    throw new ValidationError('Feed addresses cannot carry sign-in details.');
  }
  if (url.port !== '' && url.port !== '443') {
    throw new ValidationError('Feed addresses must use the standard HTTPS port.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (PRIVATE_HOST_PATTERN.test(host) || IPV4_PATTERN.test(host) || host.includes(':')) {
    throw new ValidationError('That feed address does not point at a public host.');
  }
  return url;
}

export function parseFeedImport(value: unknown): FeedImportInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError('Send a feed import object.');
  }
  const record: Record<string, unknown> = { ...value };
  if (typeof record.feedUrl !== 'string' || record.feedUrl.trim().length === 0) {
    throw new ValidationError('Enter a valid HTTPS feed address.');
  }
  if (typeof record.submitterEmail !== 'string') {
    throw new ValidationError('Submitter email is required.');
  }
  const submitterEmail = record.submitterEmail.trim();
  if (submitterEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
    throw new ValidationError('Enter a valid email address.');
  }
  return { feedUrl: assertSafeFeedUrl(record.feedUrl.trim()).toString(), submitterEmail };
}

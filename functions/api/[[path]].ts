import { parsePlayEvent, parseSubmission, ValidationError } from '../../src/server/domain';
import {
  assertSafeFeedUrl,
  MAXIMUM_FEED_BYTES,
  parseFeedImport,
  parsePodcastFeed,
  sliceFeed,
} from '../../src/server/podcast';

interface Env {
  DB: D1Database;
}

interface ClipRow {
  id: string;
  title: string;
  source_url: string;
  duration_s: number;
  start_offset_s: number | null;
  end_offset_s: number | null;
  licence: string;
  attribution: string;
  source: string;
}

interface CountRow {
  count: number;
}

interface IdRow {
  id: string;
}

class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function jsonResponse(value: unknown, status = 200, cacheControl = 'no-store'): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Cache-Control': cacheControl,
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function readJson(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get('Content-Length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    throw new HttpError(413, 'That request is too large.');
  }
  try {
    const value: unknown = await request.json();
    return value;
  } catch {
    throw new HttpError(400, 'Send valid JSON.');
  }
}

async function clips(env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    `SELECT id, title, source_url, duration_s, start_offset_s, end_offset_s,
            licence, attribution, source
     FROM yapfeed_clips
     WHERE status = 'approved'
     ORDER BY id`,
  ).all<ClipRow>();

  return jsonResponse(
    {
      clips: result.results.map((row) => ({
        id: row.id,
        title: row.title,
        sourceUrl: row.source_url,
        durationS: row.duration_s,
        licence: row.licence,
        attribution: row.attribution,
        source: row.source,
        ...(row.start_offset_s === null || row.start_offset_s === 0
          ? {}
          : { startOffsetS: row.start_offset_s }),
        ...(row.end_offset_s === null ? {} : { endOffsetS: row.end_offset_s }),
      })),
    },
    200,
    'public, max-age=300',
  );
}

async function recordPlay(request: Request, env: Env): Promise<Response> {
  const input = parsePlayEvent(await readJson(request));
  const clip = await env.DB.prepare(
    "SELECT id FROM yapfeed_clips WHERE id = ? AND status = 'approved'",
  )
    .bind(input.clipId)
    .first<IdRow>();
  if (clip === null) throw new HttpError(404, 'That clip is no longer in the feed.');

  await env.DB.prepare(
    `INSERT INTO yapfeed_plays (id, clip_id, completed, session_hash)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), input.clipId, input.completed ? 1 : 0, input.sessionHash)
    .run();
  return jsonResponse({ recorded: true }, 201);
}

const INSERT_SUBMISSION = `INSERT INTO yapfeed_submissions
   (id, submitter_email, url_or_key, duration_s, note, status)
   VALUES (?, ?, ?, ?, ?, 'pending')`;

async function isAwaitingReview(env: Env, urlOrKey: string): Promise<boolean> {
  const existing = await env.DB.prepare(
    "SELECT id FROM yapfeed_submissions WHERE url_or_key = ? AND status = 'pending'",
  )
    .bind(urlOrKey)
    .first<IdRow>();
  return existing !== null;
}

async function submit(request: Request, env: Env): Promise<Response> {
  const input = parseSubmission(await readJson(request));
  if (await isAwaitingReview(env, input.urlOrKey)) {
    throw new HttpError(409, 'That audio URL is already waiting for review.');
  }
  const id = crypto.randomUUID();
  await env.DB.prepare(INSERT_SUBMISSION)
    .bind(id, input.submitterEmail, input.urlOrKey, input.durationS, input.note)
    .run();
  return jsonResponse({ id, status: 'pending' }, 201);
}

async function readFeed(feedUrl: URL): Promise<string> {
  let response: Response;
  try {
    response = await fetch(feedUrl.toString(), {
      // A redirect is a way around the public-host check, so it ends the read.
      redirect: 'error',
      headers: { Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8' },
    });
  } catch {
    throw new HttpError(502, 'That feed could not be reached.');
  }
  if (!response.ok) throw new HttpError(502, 'That feed could not be read.');
  const declaredLength = Number(response.headers.get('Content-Length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAXIMUM_FEED_BYTES) {
    throw new HttpError(413, 'That feed is too large to import.');
  }
  const xml = await response.text();
  if (xml.length > MAXIMUM_FEED_BYTES) {
    throw new HttpError(413, 'That feed is too large to import.');
  }
  return xml;
}

async function importFeed(request: Request, env: Env): Promise<Response> {
  const input = parseFeedImport(await readJson(request));
  const feed = parsePodcastFeed(await readFeed(assertSafeFeedUrl(input.feedUrl)));
  const slices = sliceFeed(feed);

  let imported = 0;
  let skipped = 0;
  for (const slice of slices) {
    if (await isAwaitingReview(env, slice.sourceUrl)) {
      skipped += 1;
      continue;
    }
    await env.DB.prepare(INSERT_SUBMISSION)
      .bind(
        crypto.randomUUID(),
        input.submitterEmail,
        slice.sourceUrl,
        slice.durationS,
        `${slice.title} — ${slice.attribution}`.slice(0, 1_000),
      )
      .run();
    imported += 1;
  }

  return jsonResponse(
    { imported, skipped, episodes: feed.episodes.length, status: 'pending' },
    201,
  );
}

async function health(env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM yapfeed_clips WHERE status = 'approved'",
  ).first<CountRow>();
  return jsonResponse({ ok: true, clips: result?.count ?? 0 });
}

async function route(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname === '/api/health' && request.method === 'GET') return health(env);
  if (pathname === '/api/clips' && request.method === 'GET') return clips(env);
  if (pathname === '/api/plays' && request.method === 'POST') return recordPlay(request, env);
  if (pathname === '/api/submissions' && request.method === 'POST') return submit(request, env);
  if (pathname === '/api/imports' && request.method === 'POST') return importFeed(request, env);
  throw new HttpError(404, 'API route not found.');
}

export const onRequest: PagesFunction<Env> = async (context) => {
  try {
    return await route(context.request, context.env);
  } catch (error: unknown) {
    if (error instanceof HttpError) return jsonResponse({ error: error.message }, error.status);
    if (error instanceof ValidationError) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ error: 'Yapfeed could not complete that request.' }, 500);
  }
};

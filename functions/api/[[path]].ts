import { parsePlayEvent, parseSubmission, ValidationError } from '../../src/server/domain';

interface Env {
  DB: D1Database;
}

interface ClipRow {
  id: string;
  title: string;
  source_url: string;
  duration_s: number;
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
    `SELECT id, title, source_url, duration_s, licence, attribution, source
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

async function submit(request: Request, env: Env): Promise<Response> {
  const input = parseSubmission(await readJson(request));
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO yapfeed_submissions
     (id, submitter_email, url_or_key, duration_s, note, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
  )
    .bind(id, input.submitterEmail, input.urlOrKey, input.durationS, input.note)
    .run();
  return jsonResponse({ id, status: 'pending' }, 201);
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

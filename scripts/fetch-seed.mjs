import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const COLLECTION_IDENTIFIERS = [
  'ssc114_2506_librivox',
  'ss094_2011_librivox',
  'ss092_2008_librivox',
  'ss089_2006_librivox',
  'ss081_1907_librivox',
];
const PUBLIC_DOMAIN_MARK = 'creativecommons.org/publicdomain/mark/1.0';
const MAXIMUM_DURATION_SECONDS = 600;
const MINIMUM_CLIP_COUNT = 50;

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasCreditableMetadata(file) {
  return (
    typeof file.name === 'string' &&
    typeof file.title === 'string' &&
    file.title.trim().length > 0 &&
    typeof file.creator === 'string' &&
    file.creator.trim().length > 0
  );
}

export function selectEligibleFiles(files) {
  if (!Array.isArray(files)) return [];

  return files.filter((value) => {
    if (!isRecord(value) || !hasCreditableMetadata(value)) return false;
    const duration = Number(value.length);
    return (
      value.source === 'original' &&
      value.name.toLowerCase().endsWith('.mp3') &&
      Number.isFinite(duration) &&
      duration > 0 &&
      duration <= MAXIMUM_DURATION_SECONDS
    );
  });
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function normaliseTitle(title) {
  return title.replace(/^\d+\s*[-–—.]\s*/, '').trim();
}

function clipId(identifier, name) {
  const stem = name.replace(/\.mp3$/i, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  return `lv-${identifier}-${stem}`.slice(0, 180).toLowerCase();
}

function collectionLicence(metadata) {
  const licenceUrl = typeof metadata.licenseurl === 'string' ? metadata.licenseurl : '';
  if (!licenceUrl.includes(PUBLIC_DOMAIN_MARK)) {
    throw new Error(`Collection ${metadata.identifier ?? 'unknown'} is not marked public domain.`);
  }
}

function migrationHeader() {
  return `PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS yapfeed_clips (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  duration_s INTEGER NOT NULL CHECK (duration_s > 0),
  licence TEXT NOT NULL,
  attribution TEXT NOT NULL,
  source TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL CHECK (status IN ('approved', 'hidden'))
);

CREATE TABLE IF NOT EXISTS yapfeed_submissions (
  id TEXT PRIMARY KEY,
  submitter_email TEXT NOT NULL,
  url_or_key TEXT NOT NULL,
  duration_s INTEGER NOT NULL CHECK (duration_s BETWEEN 1 AND 60),
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS yapfeed_plays (
  id TEXT PRIMARY KEY,
  clip_id TEXT NOT NULL REFERENCES yapfeed_clips(id),
  completed INTEGER NOT NULL CHECK (completed IN (0, 1)),
  session_hash TEXT NOT NULL CHECK (length(session_hash) = 64),
  played_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS yapfeed_clips_status_added_idx
  ON yapfeed_clips(status, added_at);
CREATE INDEX IF NOT EXISTS yapfeed_submissions_status_created_idx
  ON yapfeed_submissions(status, created_at);
CREATE INDEX IF NOT EXISTS yapfeed_plays_clip_played_idx
  ON yapfeed_plays(clip_id, played_at);
CREATE INDEX IF NOT EXISTS yapfeed_plays_session_played_idx
  ON yapfeed_plays(session_hash, played_at);

-- Generated from Internet Archive metadata on 2026-08-16.
`;
}

function insertStatement(identifier, collectionTitle, file) {
  const name = String(file.name);
  const title = normaliseTitle(String(file.title));
  const creator = String(file.creator).trim();
  const durationSeconds = Math.max(1, Math.round(Number(file.length)));
  const sourceUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(name)}`;
  const collectionUrl = `https://archive.org/details/${identifier}`;
  const attribution = `By ${creator}. LibriVox volunteer recording from ${collectionTitle}.`;

  return `INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  (${sqlText(clipId(identifier, name))}, ${sqlText(title)}, ${sqlText(sourceUrl)}, ${durationSeconds}, ${sqlText('Public Domain Mark 1.0')}, ${sqlText(attribution)}, ${sqlText(collectionUrl)}, 'approved');`;
}

async function waitBetweenRequests() {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1100));
}

async function fetchCollection(identifier, fetchValue) {
  const response = await fetchValue(`https://archive.org/metadata/${identifier}`);
  if (!response.ok) {
    throw new Error(`Internet Archive metadata request failed for ${identifier}: ${response.status}.`);
  }
  const value = await response.json();
  if (!isRecord(value) || !isRecord(value.metadata) || !Array.isArray(value.files)) {
    throw new Error(`Internet Archive returned malformed metadata for ${identifier}.`);
  }
  collectionLicence(value.metadata);
  const title = typeof value.metadata.title === 'string' ? value.metadata.title : identifier;
  return selectEligibleFiles(value.files).map((file) => insertStatement(identifier, title, file));
}

export async function buildSeedMigration(fetchValue = fetch) {
  const inserts = [];
  for (const [index, identifier] of COLLECTION_IDENTIFIERS.entries()) {
    if (index > 0) await waitBetweenRequests();
    inserts.push(...(await fetchCollection(identifier, fetchValue)));
  }
  if (inserts.length < MINIMUM_CLIP_COUNT) {
    throw new Error(`Only ${inserts.length} eligible clips were found; at least ${MINIMUM_CLIP_COUNT} are required.`);
  }
  return `${migrationHeader()}\n${inserts.join('\n\n')}\n`;
}

async function writeMigration() {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const outputPath = resolve(scriptDirectory, '..', 'migrations', '0001_yapfeed.sql');
  await mkdir(dirname(outputPath), { recursive: true });
  const migration = await buildSeedMigration();
  await writeFile(outputPath, migration, 'utf8');
  const count = migration.match(/INSERT OR IGNORE INTO yapfeed_clips/g)?.length ?? 0;
  process.stdout.write(`Generated ${count} verified Yapfeed clip rows.\n`);
}

const entryPath = process.argv[1] === undefined ? '' : resolve(process.argv[1]);
if (entryPath === fileURLToPath(import.meta.url)) {
  await writeMigration();
}

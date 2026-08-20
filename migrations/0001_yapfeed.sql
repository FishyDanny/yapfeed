PRAGMA foreign_keys = ON;

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

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ssc114_2506_librivox-ssc114-03-various-128kb', 'The Beggar', 'https://archive.org/download/ssc114_2506_librivox/ssc114_03_various_128kb.mp3', 126, 'Public Domain Mark 1.0', 'By Ivan Turgenev. LibriVox volunteer recording from Short Story Collection 114.', 'https://archive.org/details/ssc114_2506_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ssc114_2506_librivox-ssc114-05-various-128kb', 'The Dog', 'https://archive.org/download/ssc114_2506_librivox/ssc114_05_various_128kb.mp3', 133, 'Public Domain Mark 1.0', 'By Ivan Turgenev. LibriVox volunteer recording from Short Story Collection 114.', 'https://archive.org/details/ssc114_2506_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ssc114_2506_librivox-ssc114-06-various-128kb', 'The End of the World', 'https://archive.org/download/ssc114_2506_librivox/ssc114_06_various_128kb.mp3', 316, 'Public Domain Mark 1.0', 'By Ivan Turgenev. LibriVox volunteer recording from Short Story Collection 114.', 'https://archive.org/details/ssc114_2506_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ssc114_2506_librivox-ssc114-08-various-128kb', 'A Gentle Complaint', 'https://archive.org/download/ssc114_2506_librivox/ssc114_08_various_128kb.mp3', 128, 'Public Domain Mark 1.0', 'By Francis M. Witcher. LibriVox volunteer recording from Short Story Collection 114.', 'https://archive.org/details/ssc114_2506_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ssc114_2506_librivox-ssc114-09-various-128kb', 'He Rose to the Occasion', 'https://archive.org/download/ssc114_2506_librivox/ssc114_09_various_128kb.mp3', 171, 'Public Domain Mark 1.0', 'By Francis M. Witcher. LibriVox volunteer recording from Short Story Collection 114.', 'https://archive.org/details/ssc114_2506_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ssc114_2506_librivox-ssc114-11-various-128kb', 'The Monk', 'https://archive.org/download/ssc114_2506_librivox/ssc114_11_various_128kb.mp3', 115, 'Public Domain Mark 1.0', 'By Ivan Turgenev. LibriVox volunteer recording from Short Story Collection 114.', 'https://archive.org/details/ssc114_2506_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ssc114_2506_librivox-ssc114-12-various-128kb', 'Music Pounding', 'https://archive.org/download/ssc114_2506_librivox/ssc114_12_various_128kb.mp3', 138, 'Public Domain Mark 1.0', 'By Oliver Wendell Holmes, Sr.. LibriVox volunteer recording from Short Story Collection 114.', 'https://archive.org/details/ssc114_2506_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ssc114_2506_librivox-ssc114-14-various-128kb', 'Shadow — a Parable', 'https://archive.org/download/ssc114_2506_librivox/ssc114_14_various_128kb.mp3', 460, 'Public Domain Mark 1.0', 'By Edgar Allan Poe. LibriVox volunteer recording from Short Story Collection 114.', 'https://archive.org/details/ssc114_2506_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ssc114_2506_librivox-ssc114-15-various-128kb', 'The Smear', 'https://archive.org/download/ssc114_2506_librivox/ssc114_15_various_128kb.mp3', 295, 'Public Domain Mark 1.0', 'By John Beames. LibriVox volunteer recording from Short Story Collection 114.', 'https://archive.org/details/ssc114_2506_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ssc114_2506_librivox-ssc114-16-various-128kb', 'The Deacon''s Trout', 'https://archive.org/download/ssc114_2506_librivox/ssc114_16_various_128kb.mp3', 157, 'Public Domain Mark 1.0', 'By Henry Ward Beecher. LibriVox volunteer recording from Short Story Collection 114.', 'https://archive.org/details/ssc114_2506_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ssc114_2506_librivox-ssc114-18-various-128kb', 'The Lie', 'https://archive.org/download/ssc114_2506_librivox/ssc114_18_various_128kb.mp3', 324, 'Public Domain Mark 1.0', 'By Holloway Horn. LibriVox volunteer recording from Short Story Collection 114.', 'https://archive.org/details/ssc114_2506_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ssc114_2506_librivox-ssc114-19-various-128kb', 'The Oval Portrait', 'https://archive.org/download/ssc114_2506_librivox/ssc114_19_various_128kb.mp3', 578, 'Public Domain Mark 1.0', 'By Edgar Allan Poe. LibriVox volunteer recording from Short Story Collection 114.', 'https://archive.org/details/ssc114_2506_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ssc114_2506_librivox-ssc114-20-various-128kb', 'Tomorrow! Tomorrow!', 'https://archive.org/download/ssc114_2506_librivox/ssc114_20_various_128kb.mp3', 126, 'Public Domain Mark 1.0', 'By Ivan Turgenev. LibriVox volunteer recording from Short Story Collection 114.', 'https://archive.org/details/ssc114_2506_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss094_2011_librivox-ss094-caseofjohnaverly-dg-128kb', 'The Case of John Averly', 'https://archive.org/download/ss094_2011_librivox/ss094_caseofjohnaverly_dg_128kb.mp3', 264, 'Public Domain Mark 1.0', 'By Fanny Kelly. LibriVox volunteer recording from Short Story Collection Vol. 094.', 'https://archive.org/details/ss094_2011_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss094_2011_librivox-ss094-crush-dg-128kb', 'The Crush', 'https://archive.org/download/ss094_2011_librivox/ss094_crush_dg_128kb.mp3', 129, 'Public Domain Mark 1.0', 'By Gene Markey. LibriVox volunteer recording from Short Story Collection Vol. 094.', 'https://archive.org/details/ss094_2011_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss094_2011_librivox-ss094-dilema-dg-128kb', 'Dilemma', 'https://archive.org/download/ss094_2011_librivox/ss094_dilema_dg_128kb.mp3', 109, 'Public Domain Mark 1.0', 'By J. K. Nicholson. LibriVox volunteer recording from Short Story Collection Vol. 094.', 'https://archive.org/details/ss094_2011_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss094_2011_librivox-ss094-feline-dg-128kb', 'Feline', 'https://archive.org/download/ss094_2011_librivox/ss094_feline_dg_128kb.mp3', 592, 'Public Domain Mark 1.0', 'By Bruce Grant. LibriVox volunteer recording from Short Story Collection Vol. 094.', 'https://archive.org/details/ss094_2011_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss094_2011_librivox-ss094-guidesreason-dg-128kb', 'The Guide''s Reason', 'https://archive.org/download/ss094_2011_librivox/ss094_guidesreason_dg_128kb.mp3', 123, 'Public Domain Mark 1.0', 'By Henry Moorland. LibriVox volunteer recording from Short Story Collection Vol. 094.', 'https://archive.org/details/ss094_2011_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss094_2011_librivox-ss094-humanbrain-dg-128kb', 'The Human Brain', 'https://archive.org/download/ss094_2011_librivox/ss094_humanbrain_dg_128kb.mp3', 139, 'Public Domain Mark 1.0', 'By Eugene Lyons. LibriVox volunteer recording from Short Story Collection Vol. 094.', 'https://archive.org/details/ss094_2011_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss094_2011_librivox-ss094-midsummernightsstorm-dg-128kb', 'Midsummer Nights Storm', 'https://archive.org/download/ss094_2011_librivox/ss094_midsummernightsstorm_dg_128kb.mp3', 119, 'Public Domain Mark 1.0', 'By S. Monty Stanhope. LibriVox volunteer recording from Short Story Collection Vol. 094.', 'https://archive.org/details/ss094_2011_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss094_2011_librivox-ss094-mrsbluebeard-dg-128kb', 'The First Mrs. Bluebeard', 'https://archive.org/download/ss094_2011_librivox/ss094_mrsbluebeard_dg_128kb.mp3', 234, 'Public Domain Mark 1.0', 'By Gene Markey. LibriVox volunteer recording from Short Story Collection Vol. 094.', 'https://archive.org/details/ss094_2011_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss094_2011_librivox-ss094-myfinancialcareer-dg-128kb', 'My Financial Career', 'https://archive.org/download/ss094_2011_librivox/ss094_myfinancialcareer_dg_128kb.mp3', 421, 'Public Domain Mark 1.0', 'By Stephen Leacock. LibriVox volunteer recording from Short Story Collection Vol. 094.', 'https://archive.org/details/ss094_2011_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss094_2011_librivox-ss094-mystery-dg-128kb', 'Mystery', 'https://archive.org/download/ss094_2011_librivox/ss094_mystery_dg_128kb.mp3', 140, 'Public Domain Mark 1.0', 'By Hartley H. Hepler. LibriVox volunteer recording from Short Story Collection Vol. 094.', 'https://archive.org/details/ss094_2011_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss094_2011_librivox-ss094-nocturne-dg-128kb', 'Nocturne', 'https://archive.org/download/ss094_2011_librivox/ss094_nocturne_dg_128kb.mp3', 242, 'Public Domain Mark 1.0', 'By Henry G. Moorhouse. LibriVox volunteer recording from Short Story Collection Vol. 094.', 'https://archive.org/details/ss094_2011_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss094_2011_librivox-ss094-stateroomsix-dg-128kb', 'Stateroom Six', 'https://archive.org/download/ss094_2011_librivox/ss094_stateroomsix_dg_128kb.mp3', 400, 'Public Domain Mark 1.0', 'By William Albert Lewis. LibriVox volunteer recording from Short Story Collection Vol. 094.', 'https://archive.org/details/ss094_2011_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss094_2011_librivox-ss094-tailsyoulose-dg-128kb', 'Tails You Lose!', 'https://archive.org/download/ss094_2011_librivox/ss094_tailsyoulose_dg_128kb.mp3', 438, 'Public Domain Mark 1.0', 'By Archie Martin. LibriVox volunteer recording from Short Story Collection Vol. 094.', 'https://archive.org/details/ss094_2011_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss094_2011_librivox-ss094-tribute-dg-128kb', 'Tribute', 'https://archive.org/download/ss094_2011_librivox/ss094_tribute_dg_128kb.mp3', 548, 'Public Domain Mark 1.0', 'By H. F. Grinsted. LibriVox volunteer recording from Short Story Collection Vol. 094.', 'https://archive.org/details/ss094_2011_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss094_2011_librivox-ss094-whatfortheirvacation-dg-128kb', 'What They Had Laid Out for Their Vacation', 'https://archive.org/download/ss094_2011_librivox/ss094_whatfortheirvacation_dg_128kb.mp3', 164, 'Public Domain Mark 1.0', 'By George Ade. LibriVox volunteer recording from Short Story Collection Vol. 094.', 'https://archive.org/details/ss094_2011_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss092_2008_librivox-ss092-02-various-128kb', 'The Black Fairy by Fenton Johnson', 'https://archive.org/download/ss092_2008_librivox/ss092_02_various_128kb.mp3', 536, 'Public Domain Mark 1.0', 'By Fenton Johnson. LibriVox volunteer recording from Short Story Collection Vol. 092.', 'https://archive.org/details/ss092_2008_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss092_2008_librivox-ss092-03-various-128kb', 'Cleopatra and Caesar by Elbert Hubbard', 'https://archive.org/download/ss092_2008_librivox/ss092_03_various_128kb.mp3', 538, 'Public Domain Mark 1.0', 'By Elbert Hubbard. LibriVox volunteer recording from Short Story Collection Vol. 092.', 'https://archive.org/details/ss092_2008_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss092_2008_librivox-ss092-04-various-128kb', 'East And West by Lord Dunsany', 'https://archive.org/download/ss092_2008_librivox/ss092_04_various_128kb.mp3', 510, 'Public Domain Mark 1.0', 'By Lord Dunsany. LibriVox volunteer recording from Short Story Collection Vol. 092.', 'https://archive.org/details/ss092_2008_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss092_2008_librivox-ss092-05-various-128kb', 'The Flat-Dweller By George Ade', 'https://archive.org/download/ss092_2008_librivox/ss092_05_various_128kb.mp3', 102, 'Public Domain Mark 1.0', 'By George Ade. LibriVox volunteer recording from Short Story Collection Vol. 092.', 'https://archive.org/details/ss092_2008_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss092_2008_librivox-ss092-06-various-128kb', 'Foreign Correspondence By Oliver Wendell Holmes', 'https://archive.org/download/ss092_2008_librivox/ss092_06_various_128kb.mp3', 396, 'Public Domain Mark 1.0', 'By Oliver Wendell Holmes, Sr.. LibriVox volunteer recording from Short Story Collection Vol. 092.', 'https://archive.org/details/ss092_2008_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss092_2008_librivox-ss092-08-various-128kb', 'A Futile Experiment Thomas L. Masson', 'https://archive.org/download/ss092_2008_librivox/ss092_08_various_128kb.mp3', 121, 'Public Domain Mark 1.0', 'By Thomas Lansing Masson. LibriVox volunteer recording from Short Story Collection Vol. 092.', 'https://archive.org/details/ss092_2008_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss092_2008_librivox-ss092-09-various-128kb', 'The Story of Hagar and Ishmael by Logan Marshall', 'https://archive.org/download/ss092_2008_librivox/ss092_09_various_128kb.mp3', 395, 'Public Domain Mark 1.0', 'By Logan Marshall. LibriVox volunteer recording from Short Story Collection Vol. 092.', 'https://archive.org/details/ss092_2008_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss092_2008_librivox-ss092-10-various-128kb', 'The Mad Artist by Margery Verner Reed', 'https://archive.org/download/ss092_2008_librivox/ss092_10_various_128kb.mp3', 305, 'Public Domain Mark 1.0', 'By Various. LibriVox volunteer recording from Short Story Collection Vol. 092.', 'https://archive.org/details/ss092_2008_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss092_2008_librivox-ss092-12-various-128kb', 'Mozart''s Violin by Author Unknown', 'https://archive.org/download/ss092_2008_librivox/ss092_12_various_128kb.mp3', 455, 'Public Domain Mark 1.0', 'By Unknown. LibriVox volunteer recording from Short Story Collection Vol. 092.', 'https://archive.org/details/ss092_2008_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss092_2008_librivox-ss092-15-various-128kb', 'The Soul of a Dog by Colette', 'https://archive.org/download/ss092_2008_librivox/ss092_15_various_128kb.mp3', 545, 'Public Domain Mark 1.0', 'By Various. LibriVox volunteer recording from Short Story Collection Vol. 092.', 'https://archive.org/details/ss092_2008_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss092_2008_librivox-ss092-16-various-128kb', 'The Story of an Hour by Kate Chopin', 'https://archive.org/download/ss092_2008_librivox/ss092_16_various_128kb.mp3', 515, 'Public Domain Mark 1.0', 'By Kate Chopin. LibriVox volunteer recording from Short Story Collection Vol. 092.', 'https://archive.org/details/ss092_2008_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss092_2008_librivox-ss092-17-various-128kb', 'The Treasure In The Strong Box By George Ade', 'https://archive.org/download/ss092_2008_librivox/ss092_17_various_128kb.mp3', 282, 'Public Domain Mark 1.0', 'By Various. LibriVox volunteer recording from Short Story Collection Vol. 092.', 'https://archive.org/details/ss092_2008_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss089_2006_librivox-ss089-01-various-128kb', 'Betty’s Solliloquy by Fanny Fern', 'https://archive.org/download/ss089_2006_librivox/ss089_01_various_128kb.mp3', 270, 'Public Domain Mark 1.0', 'By Fanny Fern. LibriVox volunteer recording from Short Story Collection 089.', 'https://archive.org/details/ss089_2006_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss089_2006_librivox-ss089-02-various-128kb', 'The Choice By Eugene Guillaume', 'https://archive.org/download/ss089_2006_librivox/ss089_02_various_128kb.mp3', 273, 'Public Domain Mark 1.0', 'By Eugene Guillaume. LibriVox volunteer recording from Short Story Collection 089.', 'https://archive.org/details/ss089_2006_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss089_2006_librivox-ss089-03-various-128kb', 'The Cormorants of Andvaer by Jonas Lie', 'https://archive.org/download/ss089_2006_librivox/ss089_03_various_128kb.mp3', 572, 'Public Domain Mark 1.0', 'By Jonas Lauritz Idemil Lie. LibriVox volunteer recording from Short Story Collection 089.', 'https://archive.org/details/ss089_2006_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss089_2006_librivox-ss089-04-various-128kb', 'Emancipation A Life Fable by Kate Chopin', 'https://archive.org/download/ss089_2006_librivox/ss089_04_various_128kb.mp3', 196, 'Public Domain Mark 1.0', 'By Kate Chopin. LibriVox volunteer recording from Short Story Collection 089.', 'https://archive.org/details/ss089_2006_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss089_2006_librivox-ss089-15-various-128kb', 'In the Open Code by Burton Kline', 'https://archive.org/download/ss089_2006_librivox/ss089_15_various_128kb.mp3', 587, 'Public Domain Mark 1.0', 'By Burton Kline. LibriVox volunteer recording from Short Story Collection 089.', 'https://archive.org/details/ss089_2006_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss089_2006_librivox-ss089-16-various-128kb', 'Restitution by Charles Henkle', 'https://archive.org/download/ss089_2006_librivox/ss089_16_various_128kb.mp3', 229, 'Public Domain Mark 1.0', 'By Charles Henkle. LibriVox volunteer recording from Short Story Collection 089.', 'https://archive.org/details/ss089_2006_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss089_2006_librivox-ss089-17-various-128kb', 'Senility by Sherwood Anderson', 'https://archive.org/download/ss089_2006_librivox/ss089_17_various_128kb.mp3', 243, 'Public Domain Mark 1.0', 'By Sherwood Anderson. LibriVox volunteer recording from Short Story Collection 089.', 'https://archive.org/details/ss089_2006_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss089_2006_librivox-ss089-19-various-128kb', 'The Traitor in the House by Henry Van Dyke', 'https://archive.org/download/ss089_2006_librivox/ss089_19_various_128kb.mp3', 239, 'Public Domain Mark 1.0', 'By Henry van Dyke. LibriVox volunteer recording from Short Story Collection 089.', 'https://archive.org/details/ss089_2006_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss081_1907_librivox-ss081-01-various-128kb', 'After Twenty Years by O. Henry', 'https://archive.org/download/ss081_1907_librivox/ss081_01_various_128kb.mp3', 546, 'Public Domain Mark 1.0', 'By O. Henry. LibriVox volunteer recording from Short Story Collection Vol. 081.', 'https://archive.org/details/ss081_1907_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss081_1907_librivox-ss081-03-various-128kb', 'Castle of Time by Lord Dunsany', 'https://archive.org/download/ss081_1907_librivox/ss081_03_various_128kb.mp3', 287, 'Public Domain Mark 1.0', 'By Lord Dunsany. LibriVox volunteer recording from Short Story Collection Vol. 081.', 'https://archive.org/details/ss081_1907_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss081_1907_librivox-ss081-05-various-128kb', 'A Female Solomon: A Croatian Tale by Anonymous', 'https://archive.org/download/ss081_1907_librivox/ss081_05_various_128kb.mp3', 509, 'Public Domain Mark 1.0', 'By Anonymous. LibriVox volunteer recording from Short Story Collection Vol. 081.', 'https://archive.org/details/ss081_1907_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss081_1907_librivox-ss081-08-various-128kb', 'Gaffer Death by Anonymous', 'https://archive.org/download/ss081_1907_librivox/ss081_08_various_128kb.mp3', 426, 'Public Domain Mark 1.0', 'By Anonymous. LibriVox volunteer recording from Short Story Collection Vol. 081.', 'https://archive.org/details/ss081_1907_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss081_1907_librivox-ss081-10-various-128kb', 'James and Reginald by Eugene Field', 'https://archive.org/download/ss081_1907_librivox/ss081_10_various_128kb.mp3', 231, 'Public Domain Mark 1.0', 'By Eugene Field. LibriVox volunteer recording from Short Story Collection Vol. 081.', 'https://archive.org/details/ss081_1907_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss081_1907_librivox-ss081-11-various-128kb', 'A Leaf in the Storm by Louise de la Ramee', 'https://archive.org/download/ss081_1907_librivox/ss081_11_various_128kb.mp3', 543, 'Public Domain Mark 1.0', 'By Ouida. LibriVox volunteer recording from Short Story Collection Vol. 081.', 'https://archive.org/details/ss081_1907_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss081_1907_librivox-ss081-13-various-128kb', 'A Misfit Ghost by W. Bob Holland', 'https://archive.org/download/ss081_1907_librivox/ss081_13_various_128kb.mp3', 463, 'Public Domain Mark 1.0', 'By W. Bob Holland. LibriVox volunteer recording from Short Story Collection Vol. 081.', 'https://archive.org/details/ss081_1907_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss081_1907_librivox-ss081-15-various-128kb', 'The Open Window by Saki', 'https://archive.org/download/ss081_1907_librivox/ss081_15_various_128kb.mp3', 477, 'Public Domain Mark 1.0', 'By Saki. LibriVox volunteer recording from Short Story Collection Vol. 081.', 'https://archive.org/details/ss081_1907_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss081_1907_librivox-ss081-16-various-128kb', 'Poison Mouth by Anonymous', 'https://archive.org/download/ss081_1907_librivox/ss081_16_various_128kb.mp3', 228, 'Public Domain Mark 1.0', 'By Anonymous. LibriVox volunteer recording from Short Story Collection Vol. 081.', 'https://archive.org/details/ss081_1907_librivox', 'approved');

INSERT OR IGNORE INTO yapfeed_clips
  (id, title, source_url, duration_s, licence, attribution, source, status)
VALUES
  ('lv-ss081_1907_librivox-ss081-18-various-128kb', '"A Story from Confucius" by Confucius', 'https://archive.org/download/ss081_1907_librivox/ss081_18_various_128kb.mp3', 258, 'Public Domain Mark 1.0', 'By Confucius 孔子. LibriVox volunteer recording from Short Story Collection Vol. 081.', 'https://archive.org/details/ss081_1907_librivox', 'approved');

-- Imported podcast episodes are cut into slices of at most a minute. Each
-- slice keeps its own playable media-fragment URL plus the offsets it covers
-- inside the original recording.

ALTER TABLE yapfeed_clips ADD COLUMN start_offset_s INTEGER NOT NULL DEFAULT 0;
ALTER TABLE yapfeed_clips ADD COLUMN end_offset_s INTEGER;

CREATE INDEX IF NOT EXISTS yapfeed_submissions_url_idx
  ON yapfeed_submissions(url_or_key, status);

import './style.css';

import { getClips, importFeed, recordPlay, submitClip } from './api';
import {
  clipStartOffset,
  createQueue,
  formatDuration,
  isPastClipEnd,
  isSleepDue,
  nextClipIndex,
  previousClipIndex,
  registerMediaSessionHandlers,
  sleepCheckDelay,
  sleepDeadline,
} from './player';
import {
  canCommitSeek,
  clampSeekTarget,
  MINIMUM_SEEK_GAP_MS,
  nextSeekTarget,
  rateCorrection,
  SEEK_STEP_S,
  type SeekGate,
} from './seek';
import {
  createIndexedDbAudioCache,
  describeOfflineCache,
  selectPrefetchClips,
  syncOfflineCache,
} from './offline';
import {
  DEFAULT_PLAYBACK_RATE,
  formatRate,
  normaliseRate,
  PLAYBACK_RATES,
  type PlaybackRate,
} from './rate';
import { getOrCreateSessionId, hashSessionId } from './session';
import {
  appendId,
  readIdList,
  readValue,
  toggleId,
  writeIdList,
  writeValue,
} from './storage';
import type { Clip, FeedImportInput, SubmissionInput } from './types';

const LIKES_STORAGE_KEY = 'yapfeed.likes';
const SKIPS_STORAGE_KEY = 'yapfeed.skips';
const CURRENT_CLIP_STORAGE_KEY = 'yapfeed.current.clip';
const RATE_STORAGE_KEY = 'yapfeed.rate';
const PREFETCH_DELAY_MS = 2_000;

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Yapfeed is missing ${selector}.`);
  return element;
}

const app = requiredElement<HTMLElement>('#app');
app.removeAttribute('aria-live');
app.innerHTML = `
  <header class="site-header">
    <a class="wordmark" href="/" aria-label="Yapfeed home"><span>YAP</span><strong>FEED</strong></a>
    <nav aria-label="Main navigation">
      <a href="#why">Why this</a>
      <a href="#questions">Questions</a>
      <button class="text-button" id="open-submission" type="button">Submit a clip</button>
    </nav>
  </header>

  <section class="player-stage" aria-labelledby="page-title">
    <div class="signal-column" aria-hidden="true">
      <span>LIVE FEED</span>
      <div class="signal-lines">${'<i></i>'.repeat(11)}</div>
      <b id="queue-position">00 / 00</b>
    </div>

    <div class="player-copy">
      <p class="eyebrow" id="feed-count">Checking the tape shelf…</p>
      <h1 id="page-title">Short audio.<br />Eyes off.</h1>
      <p class="promise">Press play once. Stories continue by themselves while you lie back, walk, or look anywhere else.</p>

      <div class="now-playing" aria-live="polite">
        <span class="now-label">NOW PLAYING</span>
        <h2 data-testid="clip-title">Loading a short piece…</h2>
        <p id="clip-attribution">Fetching credited public-domain recordings.</p>
        <div class="clip-meta">
          <span id="clip-duration">—:—</span>
          <span id="clip-licence">PUBLIC DOMAIN</span>
          <a id="clip-source" href="https://librivox.org/" target="_blank" rel="noreferrer">SOURCE ↗</a>
        </div>
      </div>

      <audio id="audio" preload="metadata"></audio>
      <p class="player-status" id="player-status" role="status">Choose play once; auto-advance is already on.</p>
      <p class="offline-note" id="offline-status" role="status"></p>

      <div class="controls" aria-label="Playback controls">
        <button class="play-button" id="play" type="button" disabled>Start listening</button>
        <button class="like-button" id="like" type="button" aria-pressed="false" disabled>Like this piece</button>
      </div>
    </div>

    <aside class="next-panel">
      <button class="next-button" id="next" type="button" disabled>
        <span>NEXT PIECE</span>
        <strong aria-hidden="true">→</strong>
        <small>or press Space</small>
      </button>
      <div class="panel-stack">
        <div class="sleep-panel">
          <p>SLEEP AFTER</p>
          <div class="sleep-options" aria-label="Sleep timer">
            <button type="button" data-minutes="10">10m</button>
            <button type="button" data-minutes="20">20m</button>
            <button type="button" data-minutes="30">30m</button>
            <button type="button" data-minutes="0">Off</button>
          </div>
          <span id="sleep-status">No timer set</span>
        </div>
        <div class="speed-panel">
          <p>SPEED</p>
          <div class="speed-options" aria-label="Playback speed">
            ${PLAYBACK_RATES.map(
              (rate) =>
                `<button type="button" data-rate="${rate}" aria-pressed="${String(rate === DEFAULT_PLAYBACK_RATE)}">${formatRate(rate)}</button>`,
            ).join('')}
          </div>
          <span id="speed-status">Normal speed</span>
        </div>
      </div>
    </aside>
  </section>

  <section class="evidence" id="why">
    <blockquote>“For people who want entertainment but want to rest their eyes.”</blockquote>
    <p>That sentence came from the original idea, contributed by the owner’s partner. The listening half comes first; there are no profiles, follows or comments to tend.</p>
    <a href="https://github.com/FishyDanny/ship72/blob/main/RUN-PROMPT.md" target="_blank" rel="noreferrer">Read the source brief ↗</a>
  </section>

  <section class="details-grid" id="questions">
    <article>
      <span>01</span>
      <h2>Do I need an account?</h2>
      <p>No. Listening, likes and skips work without one. Likes and skip history stay in this browser.</p>
    </article>
    <article>
      <span>02</span>
      <h2>Where does the audio come from?</h2>
      <p>Credited LibriVox volunteer recordings marked public domain and streamed from Internet Archive. Yapfeed does not host the files.</p>
    </article>
    <article>
      <span>03</span>
      <h2>Can anyone publish?</h2>
      <p>You can submit an HTTPS link to a clip of 60 seconds or less. A human reviews every submission before anything reaches the feed.</p>
    </article>
  </section>

  <section class="privacy-note">
    <h2>What leaves this browser</h2>
    <p>Audio streams from Internet Archive. Yapfeed records an anonymous session hash with completed or skipped clips so completion rate and clips per session can be measured. Likes, skip history and queue position stay in local storage, and the next few clips are copied into this browser so listening survives a dropped connection. Submission details enter a private pending-review queue; email addresses are never shown in the feed.</p>
  </section>

  <footer>
    <p>Yapfeed is a solo project. GitHub issues are reviewed when time allows, usually within a few days.</p>
    <a href="https://github.com/FishyDanny/ship72/tree/main/apps/yapfeed" target="_blank" rel="noreferrer">Source and issues ↗</a>
  </footer>

  <dialog id="submission-dialog" aria-labelledby="submission-title">
    <form id="submission-form">
      <div class="dialog-heading">
        <div>
          <p class="eyebrow">CONTRIBUTION QUEUE</p>
          <h2 id="submission-title">Send one short listen</h2>
        </div>
        <button class="close-button" id="close-submission" type="button" aria-label="Close submission form">×</button>
      </div>
      <p class="review-note">A human reads every submission. Nothing publishes automatically.</p>
      <label>Your email<input name="submitterEmail" type="email" autocomplete="email" maxlength="254" required /></label>
      <label>HTTPS audio URL<input name="urlOrKey" type="url" inputmode="url" placeholder="https://…/clip.mp3" pattern="https://.*" maxlength="2048" required /></label>
      <label>Duration in seconds<input name="durationS" type="number" inputmode="numeric" min="1" max="60" value="60" required /></label>
      <label>Note for the reviewer<textarea name="note" maxlength="1000" rows="3" placeholder="What should the listener know?"></textarea></label>
      <button class="submit-button" type="submit">Send for review</button>
      <p id="submission-result" role="status"></p>
    </form>
    <form id="import-form">
      <p class="eyebrow">PODCAST FEED</p>
      <h3 id="import-title">Or import a feed</h3>
      <p class="review-note">Episodes are cut into parts of a minute or less. Every part joins the same pending queue.</p>
      <label>Podcast feed address<input name="feedUrl" type="url" inputmode="url" placeholder="https://…/rss" pattern="https://.*" maxlength="2048" required /></label>
      <label>Email for the import<input name="submitterEmail" type="email" autocomplete="email" maxlength="254" required /></label>
      <button class="submit-button" id="import-submit" type="submit">Import and slice</button>
      <p id="import-result" role="status"></p>
    </form>
  </dialog>
`;

const audio = requiredElement<HTMLAudioElement>('#audio');
const playButton = requiredElement<HTMLButtonElement>('#play');
const nextButton = requiredElement<HTMLButtonElement>('#next');
const likeButton = requiredElement<HTMLButtonElement>('#like');
const title = requiredElement<HTMLElement>('[data-testid="clip-title"]');
const attribution = requiredElement<HTMLElement>('#clip-attribution');
const duration = requiredElement<HTMLElement>('#clip-duration');
const licence = requiredElement<HTMLElement>('#clip-licence');
const source = requiredElement<HTMLAnchorElement>('#clip-source');
const feedCount = requiredElement<HTMLElement>('#feed-count');
const queuePosition = requiredElement<HTMLElement>('#queue-position');
const playerStatus = requiredElement<HTMLElement>('#player-status');
const sleepStatus = requiredElement<HTMLElement>('#sleep-status');
const speedStatus = requiredElement<HTMLElement>('#speed-status');
const offlineStatus = requiredElement<HTMLElement>('#offline-status');
const submissionDialog = requiredElement<HTMLDialogElement>('#submission-dialog');
const submissionForm = requiredElement<HTMLFormElement>('#submission-form');
const submissionResult = requiredElement<HTMLElement>('#submission-result');
const importForm = requiredElement<HTMLFormElement>('#import-form');
const importResult = requiredElement<HTMLElement>('#import-result');

let queue: Clip[] = [];
let currentIndex = 0;
let sessionHash = '';
let isPlaying = false;
let sleepTimer: ReturnType<typeof setTimeout> | undefined;
let sleepDeadlineMs: number | null = null;
let intendedRate: PlaybackRate = normaliseRate(readValue(localStorage, RATE_STORAGE_KEY));
let pendingSeekTargetS: number | null = null;
let seekFlushTimer: ReturnType<typeof setTimeout> | undefined;
const seekGate: SeekGate = { seeking: false, lastCommitMs: null };
const audioCache = createIndexedDbAudioCache(
  typeof indexedDB === 'undefined' ? undefined : indexedDB,
);
let loadedClipId: string | null = null;
let objectUrl: string | null = null;
let prefetchTimer: ReturnType<typeof setTimeout> | undefined;
let prefetchRunning = false;
let likedIds = readIdList(localStorage, LIKES_STORAGE_KEY);
let skippedIds = readIdList(localStorage, SKIPS_STORAGE_KEY);

function currentClip(): Clip | undefined {
  return queue[currentIndex];
}

function updateMediaMetadata(clip: Clip): void {
  if (!('mediaSession' in navigator) || !('MediaMetadata' in window)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: clip.title,
    artist: clip.attribution.split('. ')[0] ?? clip.attribution,
    album: 'Yapfeed · short public-domain audio',
  });
  navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
}

function seekToClipStart(clip: Clip): void {
  const start = clipStartOffset(clip);
  if (start === 0 || audio.currentTime >= start) return;
  audio.currentTime = start;
}

function setAudioSource(clip: Clip, blob: Blob | null): void {
  const wasPlaying = isPlaying;
  const previous = objectUrl;
  objectUrl = blob === null ? null : URL.createObjectURL(blob);
  audio.src = objectUrl ?? clip.sourceUrl;
  audio.load();
  applyIntendedRate();
  if (previous !== null) URL.revokeObjectURL(previous);
  if (wasPlaying) void startPlayback();
}

// The loaded clip is tracked by id because a cached clip plays from a blob URL
// that will never match its source URL.
function loadClipSource(clip: Clip): void {
  if (loadedClipId === clip.id) return;
  loadedClipId = clip.id;
  resetSeekState();
  if (audioCache === null) {
    setAudioSource(clip, null);
    return;
  }
  void audioCache
    .read(clip.id)
    .catch(() => undefined)
    .then((blob) => {
      if (loadedClipId !== clip.id) return;
      setAudioSource(clip, blob ?? null);
    });
}

async function downloadClip(clip: Clip): Promise<Blob | null> {
  const response = await fetch(clip.sourceUrl, { credentials: 'omit' });
  if (!response.ok) return null;
  return await response.blob();
}

async function runPrefetch(): Promise<void> {
  if (audioCache === null || prefetchRunning || navigator.onLine === false) return;
  prefetchRunning = true;
  try {
    await syncOfflineCache(audioCache, selectPrefetchClips(queue, currentIndex), downloadClip);
    const saved = await audioCache.keys();
    offlineStatus.textContent = describeOfflineCache(saved.length);
  } catch {
    // Offline copies are a convenience; streaming carries on without them.
  } finally {
    prefetchRunning = false;
  }
}

function schedulePrefetch(): void {
  if (audioCache === null) return;
  if (prefetchTimer !== undefined) clearTimeout(prefetchTimer);
  prefetchTimer = setTimeout(() => {
    prefetchTimer = undefined;
    void runPrefetch();
  }, PREFETCH_DELAY_MS);
}

function updatePlayer(): void {
  const clip = currentClip();
  if (clip === undefined) return;
  title.textContent = clip.title;
  attribution.textContent = clip.attribution;
  duration.textContent = formatDuration(clip.durationS);
  licence.textContent = clip.licence.toUpperCase();
  source.href = clip.source;
  queuePosition.textContent = `${(currentIndex + 1).toString().padStart(2, '0')} / ${queue.length.toString().padStart(2, '0')}`;
  loadClipSource(clip);
  const liked = likedIds.includes(clip.id);
  likeButton.setAttribute('aria-pressed', String(liked));
  likeButton.textContent = liked ? 'Unlike this piece' : 'Like this piece';
  // Queue position may reset when storage is unavailable.
  writeValue(localStorage, CURRENT_CLIP_STORAGE_KEY, clip.id);
  updateMediaMetadata(clip);
}

function updatePlaybackState(playing: boolean): void {
  isPlaying = playing;
  playButton.textContent = playing ? 'Pause' : 'Start listening';
  const clip = currentClip();
  if (clip !== undefined) updateMediaMetadata(clip);
}

async function startPlayback(): Promise<void> {
  if (currentClip() === undefined) return;
  try {
    await audio.play();
    updatePlaybackState(true);
    playerStatus.textContent = 'Playing continuously. Lock-screen controls are ready where supported.';
  } catch {
    updatePlaybackState(false);
    playerStatus.textContent = 'Playback was blocked. Press Start listening again.';
  }
}

function pausePlayback(message = 'Paused. Your place is kept in this browser.'): void {
  audio.pause();
  updatePlaybackState(false);
  playerStatus.textContent = message;
}

async function togglePlayback(forcePlay = false): Promise<void> {
  if (!forcePlay && isPlaying) {
    pausePlayback();
    return;
  }
  await startPlayback();
}

// Some browsers drop the element back to an arbitrary rate after a seek that
// lands inside an unbuffered range, which is heard as distortion.
function applyIntendedRate(): void {
  const correction = rateCorrection(audio.playbackRate, intendedRate);
  if (correction !== null) audio.playbackRate = correction;
}

function setPlaybackRate(rate: PlaybackRate): void {
  // The intended rate is recorded first because applyIntendedRate runs on the
  // ratechange this triggers and would otherwise undo the listener's choice.
  intendedRate = rate;
  audio.playbackRate = rate;
  writeValue(localStorage, RATE_STORAGE_KEY, String(rate));
  document.querySelectorAll<HTMLButtonElement>('[data-rate]').forEach((button) => {
    button.setAttribute('aria-pressed', String(normaliseRate(button.dataset.rate) === rate));
  });
  speedStatus.textContent = rate === DEFAULT_PLAYBACK_RATE ? 'Normal speed' : `Playing at ${formatRate(rate)}`;
}

function resetSeekState(): void {
  if (seekFlushTimer !== undefined) clearTimeout(seekFlushTimer);
  seekFlushTimer = undefined;
  pendingSeekTargetS = null;
  seekGate.seeking = false;
  seekGate.lastCommitMs = null;
}

function scheduleSeekFlush(): void {
  if (seekFlushTimer !== undefined) return;
  seekFlushTimer = setTimeout(() => {
    seekFlushTimer = undefined;
    flushPendingSeek();
  }, MINIMUM_SEEK_GAP_MS);
}

function flushPendingSeek(): void {
  const target = pendingSeekTargetS;
  if (target === null) return;
  if (!canCommitSeek(seekGate, Date.now())) {
    scheduleSeekFlush();
    return;
  }
  pendingSeekTargetS = null;
  seekGate.seeking = true;
  seekGate.lastCommitMs = Date.now();
  audio.currentTime = target;
}

function requestSeekTo(positionS: number): void {
  if (currentClip() === undefined) return;
  pendingSeekTargetS = clampSeekTarget(positionS, audio.duration);
  flushPendingSeek();
}

function requestSeekBy(offsetS: number): void {
  const base = pendingSeekTargetS ?? audio.currentTime;
  requestSeekTo(nextSeekTarget(base, offsetS, audio.duration));
  playerStatus.textContent =
    offsetS < 0
      ? `Moved back ${Math.abs(Math.round(offsetS))} seconds.`
      : `Moved on ${Math.round(offsetS)} seconds.`;
}

function sendPlayOutcome(clip: Clip, completed: boolean): void {
  if (sessionHash.length !== 64) return;
  void recordPlay({ clipId: clip.id, completed, sessionHash }).catch(() => {
    playerStatus.textContent = 'Playback continues; this listening outcome could not be counted.';
  });
}

function moveTo(index: number, completed: boolean): void {
  const outgoing = currentClip();
  if (outgoing !== undefined) sendPlayOutcome(outgoing, completed);
  currentIndex = index;
  updatePlayer();
  schedulePrefetch();
}

function moveNext(completed = false): void {
  const outgoing = currentClip();
  if (!completed && outgoing !== undefined) {
    skippedIds = writeIdList(localStorage, SKIPS_STORAGE_KEY, appendId(skippedIds, outgoing.id));
  }
  moveTo(nextClipIndex(currentIndex, queue.length), completed);
}

function movePrevious(): void {
  moveTo(previousClipIndex(currentIndex, queue.length), false);
}

function markSleepChoice(minutes: number): void {
  document.querySelectorAll<HTMLButtonElement>('[data-minutes]').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.minutes) === minutes));
  });
}

function clearSleepCheck(): void {
  if (sleepTimer !== undefined) clearTimeout(sleepTimer);
  sleepTimer = undefined;
}

// Background tabs suspend timers on iOS, so every wake-up compares the wall
// clock against the deadline instead of trusting a single long timeout.
function armSleepCheck(): void {
  clearSleepCheck();
  if (sleepDeadlineMs === null) return;
  sleepTimer = setTimeout(() => {
    sleepTimer = undefined;
    checkSleepDeadline();
    armSleepCheck();
  }, sleepCheckDelay(sleepDeadlineMs));
}

function checkSleepDeadline(): void {
  if (!isSleepDue(sleepDeadlineMs)) return;
  sleepDeadlineMs = null;
  clearSleepCheck();
  markSleepChoice(0);
  pausePlayback('Sleep timer finished. Your place is saved.');
  sleepStatus.textContent = 'Timer finished';
}

function setSleepTimer(minutes: number): void {
  sleepDeadlineMs = sleepDeadline(minutes);
  markSleepChoice(minutes);
  if (sleepDeadlineMs === null) {
    clearSleepCheck();
    sleepStatus.textContent = 'No timer set';
    return;
  }
  sleepStatus.textContent = `Stops in ${minutes} minutes`;
  armSleepCheck();
}

playButton.addEventListener('click', () => void togglePlayback());
nextButton.addEventListener('click', () => moveNext(false));
likeButton.addEventListener('click', () => {
  const clip = currentClip();
  if (clip === undefined) return;
  likedIds = writeIdList(localStorage, LIKES_STORAGE_KEY, toggleId(likedIds, clip.id));
  updatePlayer();
});
audio.addEventListener('ended', () => moveNext(true));
audio.addEventListener('seeking', () => {
  seekGate.seeking = true;
});
audio.addEventListener('seeked', () => {
  seekGate.seeking = false;
  applyIntendedRate();
  flushPendingSeek();
});
audio.addEventListener('loadedmetadata', () => {
  applyIntendedRate();
  const clip = currentClip();
  if (clip !== undefined) seekToClipStart(clip);
});
audio.addEventListener('canplay', () => applyIntendedRate());
audio.addEventListener('ratechange', () => applyIntendedRate());
// Media events keep arriving while a suspended tab plays audio, so they double
// as a wake-up for the sleep deadline.
audio.addEventListener('timeupdate', () => {
  checkSleepDeadline();
  const clip = currentClip();
  if (clip !== undefined && isPastClipEnd(audio.currentTime, clip)) moveNext(true);
});
document.addEventListener('visibilitychange', () => {
  checkSleepDeadline();
  if (document.visibilityState === 'visible') armSleepCheck();
});
window.addEventListener('pageshow', () => {
  checkSleepDeadline();
  armSleepCheck();
});
window.addEventListener('online', () => schedulePrefetch());
audio.addEventListener('play', () => updatePlaybackState(true));
audio.addEventListener('pause', () => updatePlaybackState(false));
audio.addEventListener('error', () => {
  updatePlaybackState(false);
  playerStatus.textContent = 'This source would not play. Skip it and the rest of the feed remains available.';
});
document.addEventListener('keydown', (event) => {
  const target = event.target;
  if (
    event.code === 'Space' &&
    !(target instanceof HTMLInputElement) &&
    !(target instanceof HTMLTextAreaElement) &&
    !(target instanceof HTMLSelectElement) &&
    !(target instanceof HTMLButtonElement)
  ) {
    event.preventDefault();
    moveNext(false);
    return;
  }
  if (
    (event.code === 'ArrowLeft' || event.code === 'ArrowRight') &&
    !event.altKey &&
    !event.metaKey &&
    !(target instanceof HTMLInputElement) &&
    !(target instanceof HTMLTextAreaElement) &&
    !(target instanceof HTMLSelectElement) &&
    !(target instanceof HTMLButtonElement) &&
    !(target instanceof HTMLAnchorElement)
  ) {
    event.preventDefault();
    requestSeekBy(event.code === 'ArrowLeft' ? -SEEK_STEP_S : SEEK_STEP_S);
  }
});
document.querySelectorAll<HTMLButtonElement>('[data-minutes]').forEach((button) => {
  button.addEventListener('click', () => setSleepTimer(Number(button.dataset.minutes)));
});
document.querySelectorAll<HTMLButtonElement>('[data-rate]').forEach((button) => {
  button.addEventListener('click', () => setPlaybackRate(normaliseRate(button.dataset.rate)));
});

requiredElement<HTMLButtonElement>('#open-submission').addEventListener('click', () => {
  submissionResult.textContent = '';
  importResult.textContent = '';
  submissionDialog.showModal();
});
requiredElement<HTMLButtonElement>('#close-submission').addEventListener('click', () => {
  submissionDialog.close();
});
submissionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(submissionForm);
  const input: SubmissionInput = {
    submitterEmail: String(form.get('submitterEmail') ?? ''),
    urlOrKey: String(form.get('urlOrKey') ?? ''),
    durationS: Number(form.get('durationS')),
    note: String(form.get('note') ?? ''),
  };
  const submitButton = requiredElement<HTMLButtonElement>('.submit-button');
  submitButton.disabled = true;
  submissionResult.textContent = 'Adding it to the private review queue…';
  void submitClip(input)
    .then(() => {
      submissionForm.reset();
      submissionResult.innerHTML = '<strong>Queued for a human to review</strong><span>It will not appear in the feed unless it is approved.</span>';
    })
    .catch((error: unknown) => {
      submissionResult.textContent = error instanceof Error ? error.message : 'The clip could not be queued.';
    })
    .finally(() => {
      submitButton.disabled = false;
    });
});

importForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(importForm);
  const input: FeedImportInput = {
    feedUrl: String(form.get('feedUrl') ?? ''),
    submitterEmail: String(form.get('submitterEmail') ?? ''),
  };
  const importButton = requiredElement<HTMLButtonElement>('#import-submit');
  importButton.disabled = true;
  importResult.textContent = 'Reading the feed and cutting it into parts…';
  void importFeed(input)
    .then((response) => {
      importForm.reset();
      importResult.textContent =
        response.imported === 0
          ? `Nothing new to queue; all ${response.skipped} parts are already waiting for review.`
          : `Queued ${response.imported} parts from ${response.episodes} episodes for review.`;
    })
    .catch((error: unknown) => {
      importResult.textContent = error instanceof Error ? error.message : 'That feed could not be imported.';
    })
    .finally(() => {
      importButton.disabled = false;
    });
});

async function initialise(): Promise<void> {
  try {
    const sessionId = getOrCreateSessionId(localStorage);
    sessionHash = await hashSessionId(sessionId);
    const response = await getClips();
    queue = createQueue(response.clips, sessionId);
    if (queue.length === 0) {
      feedCount.textContent = 'The feed is temporarily empty';
      playerStatus.textContent = 'No approved audio is available yet. Try again later.';
      return;
    }
    const savedClipId = localStorage.getItem(CURRENT_CLIP_STORAGE_KEY);
    const savedIndex = queue.findIndex((clip) => clip.id === savedClipId);
    currentIndex = savedIndex >= 0 ? savedIndex : 0;
    feedCount.textContent = `${queue.length} short pieces ready`;
    setPlaybackRate(intendedRate);
    playButton.disabled = false;
    nextButton.disabled = false;
    likeButton.disabled = false;
    updatePlayer();
    schedulePrefetch();
    registerMediaSessionHandlers(navigator.mediaSession, {
      play: () => void startPlayback(),
      pause: () => pausePlayback(),
      next: () => moveNext(false),
      previous: movePrevious,
      seekBy: requestSeekBy,
      seekTo: requestSeekTo,
    });
  } catch (error: unknown) {
    feedCount.textContent = 'The feed could not be loaded';
    playerStatus.textContent = error instanceof Error ? error.message : 'Try refreshing in a moment.';
  }
}

void initialise();

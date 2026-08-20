import './style.css';

import { getClips, recordPlay, submitClip } from './api';
import {
  createQueue,
  formatDuration,
  isSleepDue,
  nextClipIndex,
  previousClipIndex,
  registerMediaSessionHandlers,
  sleepCheckDelay,
  sleepDeadline,
} from './player';
import { getOrCreateSessionId, hashSessionId } from './session';
import type { Clip, SubmissionInput } from './types';

const LIKES_STORAGE_KEY = 'yapfeed.likes';
const SKIPS_STORAGE_KEY = 'yapfeed.skips';
const CURRENT_CLIP_STORAGE_KEY = 'yapfeed.current.clip';

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Yapfeed is missing ${selector}.`);
  return element;
}

function readStoredIds(key: string): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      return new Set(value);
    }
  } catch {
    return new Set();
  }
  return new Set();
}

function saveStoredIds(key: string, ids: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    // Playback remains useful when a browser blocks local storage.
  }
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
    <p>Audio streams from Internet Archive. Yapfeed records an anonymous session hash with completed or skipped clips so completion rate and clips per session can be measured. Likes, skip history and queue position stay in local storage. Submission details enter a private pending-review queue; email addresses are never shown in the feed.</p>
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
const submissionDialog = requiredElement<HTMLDialogElement>('#submission-dialog');
const submissionForm = requiredElement<HTMLFormElement>('#submission-form');
const submissionResult = requiredElement<HTMLElement>('#submission-result');

let queue: Clip[] = [];
let currentIndex = 0;
let sessionHash = '';
let isPlaying = false;
let sleepTimer: ReturnType<typeof setTimeout> | undefined;
let sleepDeadlineMs: number | null = null;
const likedIds = readStoredIds(LIKES_STORAGE_KEY);
const skippedIds = readStoredIds(SKIPS_STORAGE_KEY);

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

function updatePlayer(): void {
  const clip = currentClip();
  if (clip === undefined) return;
  title.textContent = clip.title;
  attribution.textContent = clip.attribution;
  duration.textContent = formatDuration(clip.durationS);
  licence.textContent = clip.licence.toUpperCase();
  source.href = clip.source;
  queuePosition.textContent = `${(currentIndex + 1).toString().padStart(2, '0')} / ${queue.length.toString().padStart(2, '0')}`;
  if (audio.src !== clip.sourceUrl) {
    audio.src = clip.sourceUrl;
    audio.load();
  }
  const liked = likedIds.has(clip.id);
  likeButton.setAttribute('aria-pressed', String(liked));
  likeButton.textContent = liked ? 'Unlike this piece' : 'Like this piece';
  try {
    localStorage.setItem(CURRENT_CLIP_STORAGE_KEY, clip.id);
  } catch {
    // Queue position may reset when storage is unavailable.
  }
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
  if (isPlaying) void startPlayback();
}

function moveNext(completed = false): void {
  const outgoing = currentClip();
  if (!completed && outgoing !== undefined) {
    skippedIds.add(outgoing.id);
    saveStoredIds(SKIPS_STORAGE_KEY, skippedIds);
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
  if (likedIds.has(clip.id)) likedIds.delete(clip.id);
  else likedIds.add(clip.id);
  saveStoredIds(LIKES_STORAGE_KEY, likedIds);
  updatePlayer();
});
audio.addEventListener('ended', () => moveNext(true));
// Media events keep arriving while a suspended tab plays audio, so they double
// as a wake-up for the sleep deadline.
audio.addEventListener('timeupdate', () => checkSleepDeadline());
document.addEventListener('visibilitychange', () => {
  checkSleepDeadline();
  if (document.visibilityState === 'visible') armSleepCheck();
});
window.addEventListener('pageshow', () => {
  checkSleepDeadline();
  armSleepCheck();
});
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
  }
});
document.querySelectorAll<HTMLButtonElement>('[data-minutes]').forEach((button) => {
  button.addEventListener('click', () => setSleepTimer(Number(button.dataset.minutes)));
});

requiredElement<HTMLButtonElement>('#open-submission').addEventListener('click', () => {
  submissionResult.textContent = '';
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
    playButton.disabled = false;
    nextButton.disabled = false;
    likeButton.disabled = false;
    updatePlayer();
    registerMediaSessionHandlers(navigator.mediaSession, {
      play: () => void startPlayback(),
      pause: () => pausePlayback(),
      next: () => moveNext(false),
      previous: movePrevious,
    });
  } catch (error: unknown) {
    feedCount.textContent = 'The feed could not be loaded';
    playerStatus.textContent = error instanceof Error ? error.message : 'Try refreshing in a moment.';
  }
}

void initialise();

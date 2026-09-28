// Throttled background reading of postings: two at a time, a 400ms gap
// between starting each one, visible rows read first, paused while the tab
// is hidden, retried once on failure, progress reported after every step.
// When WaterlooWorks answers slowly or a read fails, the queue backs off:
// one read at a time and a longer gap, doubling up to 30s, then easing back
// once reads come back quickly again.
//
// No DOM here on purpose, so this file can be unit tested directly. The
// caller supplies isVisible(jobId) and isHidden() so this module never has
// to know how visibility or tab state are actually determined.

const DEFAULT_CONCURRENCY = 2;
const DEFAULT_GAP_MS = 400;
const SLOW_READ_MS = 3000; // a read slower than this counts as the server struggling
const MAX_GAP_MS = 30000;

export function createQueue(readOne, opts = {}) {
  const isVisible = opts.isVisible || (() => false);
  const isHidden = opts.isHidden || (() => false);
  const baseGapMs = opts.gapMs != null ? opts.gapMs : DEFAULT_GAP_MS;
  const baseConcurrency = opts.concurrency != null ? opts.concurrency : DEFAULT_CONCURRENCY;
  const slowReadMs = opts.slowReadMs != null ? opts.slowReadMs : SLOW_READ_MS;
  const maxGapMs = opts.maxGapMs != null ? opts.maxGapMs : MAX_GAP_MS;
  const now = opts.now || (() => Date.now());
  let gapMs = baseGapMs;
  let concurrency = baseConcurrency;

  function backOff() {
    concurrency = 1;
    gapMs = Math.min(maxGapMs, Math.max(gapMs * 2, 1000));
  }

  function easeBack() {
    if (gapMs <= baseGapMs) return;
    gapMs = Math.max(baseGapMs, Math.round(gapMs * 0.75));
    if (gapMs === baseGapMs) concurrency = baseConcurrency;
  }
  const onProgress = opts.onProgress || (() => {});

  const pending = [];
  const inFlight = new Set();
  const attempts = new Map();
  let total = 0;
  let done = 0;
  let lastStart = 0;
  let timer = null;
  let stopped = false;

  // rank(jobId) orders the reading, lowest first (the table's row order);
  // without one, visible rows go first.
  const rank = opts.rank || ((id) => (isVisible(id) ? 0 : 1));

  function sortPending() {
    pending.sort((a, b) => rank(a) - rank(b));
  }

  function add(jobIds) {
    let added = false;
    for (const id of jobIds) {
      if (attempts.has(id) || pending.includes(id) || inFlight.has(id)) continue;
      pending.push(id);
      total += 1;
      added = true;
    }
    if (added) sortPending();
    onProgress({ read: done, total });
    pump();
  }

  function reprioritize() {
    sortPending();
  }

  function scheduleNext(delay) {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      pump();
    }, delay != null ? delay : gapMs);
  }

  function pump() {
    if (stopped) return;
    if (isHidden()) {
      scheduleNext();
      return;
    }
    if (inFlight.size >= concurrency || pending.length === 0) return;
    const wait = Math.max(0, lastStart + gapMs - now());
    if (wait > 0) {
      scheduleNext(wait);
      return;
    }
    sortPending();
    const jobId = pending.shift();
    lastStart = now();
    inFlight.add(jobId);
    attempts.set(jobId, (attempts.get(jobId) || 0) + 1);
    runOne(jobId);
    // There may be room for a second concurrent read; try again right away.
    pump();
  }

  async function runOne(jobId) {
    let result;
    let error;
    const started = now();
    try {
      result = await readOne(jobId);
    } catch (err) {
      error = err;
    }
    inFlight.delete(jobId);
    if (error || now() - started > slowReadMs) backOff();
    else easeBack();
    if (error) {
      const attemptCount = attempts.get(jobId) || 1;
      if (attemptCount < 2) {
        pending.push(jobId);
        sortPending();
      } else {
        done += 1;
        onProgress({ read: done, total, jobId, ok: false, error });
      }
    } else {
      done += 1;
      onProgress({ read: done, total, jobId, ok: true, result });
    }
    pump();
  }

  function stop() {
    stopped = true;
    if (timer) clearTimeout(timer);
  }

  return {
    add,
    reprioritize,
    stop,
    get pendingCount() {
      return pending.length;
    },
    get inFlightCount() {
      return inFlight.size;
    },
    get doneCount() {
      return done;
    },
    get totalCount() {
      return total;
    },
    get gapMs() {
      return gapMs;
    },
    get concurrency() {
      return concurrency;
    },
  };
}

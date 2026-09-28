// chrome.storage.local wrapper for settings and profile, with an in-memory
// fallback and pub-sub when chrome.storage is undefined (the fixture).
// Settings and profile changes are pushed live through onSettingsChanged /
// onProfileChanged, whether they came from this page (the fixture, or the
// content script itself) or from chrome.storage.onChanged firing because
// the panel changed them in another view.

import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../contract.js';

function hasChromeStorage() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
}

const memoryState = {
  settings: { ...DEFAULT_SETTINGS, weights: { ...DEFAULT_SETTINGS.weights } },
  profile: null,
};
const memoryListeners = new Set();

function notifyMemoryListeners(kind, value) {
  for (const listener of memoryListeners) {
    try {
      listener(kind, value);
    } catch (err) {
      // one bad subscriber should not break the others
    }
  }
}

// A weight is an integer 1..5. Anything else (a float, a string, an out of
// range number, something missing) falls back to that weight's default.
function clampWeight(value, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5, Math.max(1, n));
}

function mergeWeights(stored) {
  const next = { ...DEFAULT_SETTINGS.weights };
  if (stored && typeof stored === 'object') {
    for (const key of Object.keys(DEFAULT_SETTINGS.weights)) {
      if (key in stored) next[key] = clampWeight(stored[key], DEFAULT_SETTINGS.weights[key]);
    }
  }
  return next;
}

// Keeps only the keys DEFAULT_SETTINGS still defines, and clamps weights to
// integers 1..5. An older install can leave keys behind in storage that a
// newer contract.js no longer knows about (a removed switch, a retired
// rate); this drops them instead of merging them in alongside the current
// keys.
function normalizeSettings(stored) {
  const next = { ...DEFAULT_SETTINGS };
  if (stored) {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (key === 'weights') continue;
      if (key in stored) next[key] = stored[key];
    }
  }
  next.weights = mergeWeights(stored ? stored.weights : undefined);
  return next;
}

export async function getSettings() {
  if (hasChromeStorage()) {
    const result = await new Promise((resolve) => chrome.storage.local.get(STORAGE_KEYS.settings, resolve));
    return normalizeSettings(result[STORAGE_KEYS.settings]);
  }
  return normalizeSettings(memoryState.settings);
}

export async function setSettings(patch) {
  const current = await getSettings();
  const merged = {
    ...current,
    ...patch,
    weights: { ...current.weights, ...(patch && patch.weights ? patch.weights : {}) },
  };
  const next = normalizeSettings(merged);
  if (hasChromeStorage()) {
    await new Promise((resolve) => chrome.storage.local.set({ [STORAGE_KEYS.settings]: next }, resolve));
  } else {
    memoryState.settings = next;
    notifyMemoryListeners('settings', next);
  }
  return next;
}

export async function getProfile() {
  if (hasChromeStorage()) {
    const result = await new Promise((resolve) => chrome.storage.local.get(STORAGE_KEYS.profile, resolve));
    return result[STORAGE_KEYS.profile] || null;
  }
  return memoryState.profile;
}

export async function setProfile(profile) {
  if (hasChromeStorage()) {
    await new Promise((resolve) => chrome.storage.local.set({ [STORAGE_KEYS.profile]: profile }, resolve));
  } else {
    memoryState.profile = profile;
    notifyMemoryListeners('profile', profile);
  }
  return profile;
}

/** cb(nextSettings) whenever settings change. Returns an unsubscribe function. */
export function onSettingsChanged(cb) {
  if (hasChromeStorage()) {
    const listener = (changes, areaName) => {
      if (areaName !== 'local' || !changes[STORAGE_KEYS.settings]) return;
      cb(normalizeSettings(changes[STORAGE_KEYS.settings].newValue));
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }
  const listener = (kind, value) => {
    if (kind === 'settings') cb(normalizeSettings(value));
  };
  memoryListeners.add(listener);
  return () => memoryListeners.delete(listener);
}

/** cb(nextProfile) whenever the profile changes. Returns an unsubscribe function. */
export function onProfileChanged(cb) {
  if (hasChromeStorage()) {
    const listener = (changes, areaName) => {
      if (areaName !== 'local' || !changes[STORAGE_KEYS.profile]) return;
      cb(changes[STORAGE_KEYS.profile].newValue || null);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }
  const listener = (kind, value) => {
    if (kind === 'profile') cb(value);
  };
  memoryListeners.add(listener);
  return () => memoryListeners.delete(listener);
}

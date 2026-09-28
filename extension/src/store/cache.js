// chrome.storage.local wrapper for cached posting facts, keyed by job id.
// Falls back to an in-memory Map when chrome.storage is undefined, so the
// fixture (a plain page, no extension runtime) can exercise the same code
// path as the real extension.

import { STORAGE_KEYS } from '../contract.js';

const memoryStore = new Map();

function hasChromeStorage() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
}

function keyFor(jobId) {
  return STORAGE_KEYS.cachePrefix + jobId;
}

function storageGet(keys) {
  if (hasChromeStorage()) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  }
  const list = Array.isArray(keys) ? keys : [keys];
  const result = {};
  for (const k of list) {
    if (memoryStore.has(k)) result[k] = memoryStore.get(k);
  }
  return Promise.resolve(result);
}

function storageSet(obj) {
  if (hasChromeStorage()) {
    return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
  }
  for (const [k, v] of Object.entries(obj)) memoryStore.set(k, v);
  return Promise.resolve();
}

function storageRemove(keys) {
  if (hasChromeStorage()) {
    return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
  }
  const list = Array.isArray(keys) ? keys : [keys];
  for (const k of list) memoryStore.delete(k);
  return Promise.resolve();
}

/** { facts: JobFacts, cachedAt: number } for one job, or null. */
export async function getCachedJob(jobId) {
  const key = keyFor(jobId);
  const result = await storageGet(key);
  return result[key] || null;
}

/** Map of jobId to { facts, cachedAt } | null, for a batch of job ids. */
export async function getCachedJobs(jobIds) {
  const keys = jobIds.map(keyFor);
  const result = await storageGet(keys);
  const out = {};
  jobIds.forEach((jobId, i) => {
    out[jobId] = result[keys[i]] || null;
  });
  return out;
}

export async function setCachedJob(jobId, facts) {
  await storageSet({ [keyFor(jobId)]: { facts, cachedAt: Date.now() } });
}

/** True when the entry is missing or older than maxAgeMs (default 24h). */
export function isStaleForApps(entry, maxAgeMs = 24 * 60 * 60 * 1000) {
  if (!entry || !entry.cachedAt) return true;
  return Date.now() - entry.cachedAt > maxAgeMs;
}

export async function clearAllCache() {
  if (hasChromeStorage()) {
    const all = await new Promise((resolve) => chrome.storage.local.get(null, resolve));
    const keys = Object.keys(all).filter((k) => k.startsWith(STORAGE_KEYS.cachePrefix));
    if (keys.length) await storageRemove(keys);
    return;
  }
  for (const k of Array.from(memoryStore.keys())) {
    if (k.startsWith(STORAGE_KEYS.cachePrefix)) memoryStore.delete(k);
  }
}

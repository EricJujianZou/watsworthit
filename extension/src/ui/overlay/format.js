// Small pure formatting helpers for the overlay. No DOM access here so they
// stay easy to test in isolation from the rendering code.

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function money(v) {
  if (v == null) return '';
  return '$' + (Number.isInteger(v) ? v : v.toFixed(2));
}

/** Midpoint of a {min,max} range, or null. */
export function mid(range) {
  if (!range) return null;
  return (range.min + range.max) / 2;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = DAYS.map((d) => d.slice(0, 3));

export function dayName(date, short = false) {
  return (short ? DAY_SHORT : DAYS)[date.getDay()];
}

export function fmtDate(date) {
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

export function fmtTime(date) {
  return date.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }).replace(/\./g, '');
}

/** Whole-calendar-day difference between an ISO deadline and now, can be negative. */
export function daysUntil(iso, now = new Date()) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  return Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
}

export function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

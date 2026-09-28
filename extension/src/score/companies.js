// Same-company logic for ROI scoring. Pure, no dependencies.
// See docs/build-contract-v2.md, "ROI", the repeat employer paragraph.

const SUFFIX_RE = /,?\s*(Inc\.|Inc|Ltd\.|Ltd|Corp\.|Corporation|LLC)$/i;

/** Lowercased, whitespace-collapsed name with a trailing legal suffix removed, for matching. */
export function normalizeOrgName(name) {
  if (!name) return '';
  let n = String(name).trim().replace(/\s+/g, ' ');
  n = n.replace(SUFFIX_RE, '').trim();
  return n.toLowerCase();
}

/** Same trimming as normalizeOrgName but keeps the original casing, for display in chips. */
export function displayOrgName(name) {
  if (!name) return '';
  let n = String(name).trim().replace(/\s+/g, ' ');
  n = n.replace(SUFFIX_RE, '').trim();
  return n;
}

/**
 * Ranks jobs within each normalized org group by `value`, descending, and
 * hands back the repeat factor for each one: the best gets 1, the second
 * gets `secondFactor`, and every one after that gets `furtherFactor`.
 *
 * entries: {id:string, org:string, value:number}[]
 * Returns Map id -> { repeatFactor:number, chip:{kind,text}|null,
 *                      groupIndex:number, groupSize:number }
 */
export function applyCompanyAdjustment(entries, { secondFactor = 0.5, furtherFactor = 0.25 } = {}) {
  const groups = new Map();
  for (const e of entries) {
    const key = normalizeOrgName(e.org);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }

  const result = new Map();
  for (const e of entries) {
    result.set(e.id, { repeatFactor: 1, chip: null, groupIndex: 0, groupSize: 1 });
  }

  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => b.value - a.value);
    const display = displayOrgName(sorted[0].org);
    sorted.forEach((e, idx) => {
      const repeatFactor = idx === 0 ? 1 : idx === 1 ? secondFactor : furtherFactor;
      const chip = idx === 0
        ? { kind: 'company_best', text: `${sorted.length - 1} more at ${display}` }
        : { kind: 'company_other', text: `Also at ${display}` };
      result.set(e.id, { repeatFactor, chip, groupIndex: idx, groupSize: sorted.length });
    });
  }

  return result;
}

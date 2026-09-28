// ROI scoring. Pure, no dependencies. Implements the "ROI" section of
// docs/build-contract-v2.md exactly. Every constant lives in WEIGHTS so it
// can be tuned later without touching the logic.

import { TERMS } from '../contract.js';
import { applyCompanyAdjustment } from './companies.js';

/** @typedef {import('../contract.js').JobFacts} JobFacts */
/** @typedef {import('../contract.js').Profile} Profile */
/** @typedef {import('../contract.js').RoiResult} RoiResult */

export const WEIGHTS = {
  minWageCad: 17.60,
  topPayCad: 50,
  worstAppsPerOpening: 500,
  bestAppsPerOpening: 50,
  priorAppsPerOpening: 80,
  priorDays: 3,
  directAppsPerOpening: 80,
  projectedAppsMultiplier: { min: 1, max: 5 },
  levelStepPenalty: { 0: 1, 1: 0.8, 2: 0.5 },
  yearRequiredUnmet: 0.15,
  yearPreferredUnmet: 0.6,
  repeatSecond: 0.5,
  repeatFurther: 0.25,
};

const DEFAULT_SCORE_WEIGHTS = { pay: 3, odds: 3, level: 3, year: 3, repeat: 3 };

const LEVEL_BRACKET_INDEX = { junior: 0, intermediate: 1, senior: 2 };

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function median(values) {
  const nums = values.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function levelBracket(completedWorkTerms) {
  if (completedWorkTerms <= 1) return 0;
  if (completedWorkTerms <= 3) return 1;
  return 2;
}

/** A job can list `levels` (new) or a single `level` (old). Either is fine. */
function listedLevels(job) {
  if (Array.isArray(job.levels) && job.levels.length) return job.levels;
  if (job.level) return [job.level];
  return [];
}

function knownLevelBrackets(job) {
  return listedLevels(job)
    .map((l) => String(l).toLowerCase())
    .filter((l) => LEVEL_BRACKET_INDEX[l] != null)
    .map((l) => LEVEL_BRACKET_INDEX[l]);
}

/**
 * Pure formula from the contract: value = pay^e_pay x odds^e_odds x
 * level^e_level x year^e_year x repeat^e_repeat, put on a 0..100 scale
 * between minimum wage at the worst odds and top pay at the best odds.
 *
 * @param {{pay:number, appsPerOpening:number, level?:number, year?:number,
 *   repeat?:number, weights?:{pay:number,odds:number,level:number,year:number,repeat:number}}} inputs
 * @returns {number|null}
 */
export function roiFromInputs({
  pay,
  appsPerOpening,
  level = 1,
  year = 1,
  repeat = 1,
  weights = DEFAULT_SCORE_WEIGHTS,
} = {}) {
  if (pay == null || appsPerOpening == null || appsPerOpening <= 0) return null;
  if (pay <= 0) return 0;

  const ePay = (weights.pay ?? DEFAULT_SCORE_WEIGHTS.pay) / 3;
  const eOdds = (weights.odds ?? DEFAULT_SCORE_WEIGHTS.odds) / 3;
  const eLevel = (weights.level ?? DEFAULT_SCORE_WEIGHTS.level) / 3;
  const eYear = (weights.year ?? DEFAULT_SCORE_WEIGHTS.year) / 3;
  const eRepeat = (weights.repeat ?? DEFAULT_SCORE_WEIGHTS.repeat) / 3;

  const odds = 1 / appsPerOpening;
  const value = pay ** ePay * odds ** eOdds * level ** eLevel * year ** eYear * repeat ** eRepeat;
  const lo = WEIGHTS.minWageCad ** ePay * (1 / WEIGHTS.worstAppsPerOpening) ** eOdds;
  const hi = WEIGHTS.topPayCad ** ePay * (1 / WEIGHTS.bestAppsPerOpening) ** eOdds;

  const ratio = Math.log(value / lo) / Math.log(hi / lo);
  return Math.round(100 * clamp(ratio, 0, 1));
}

/** Median payValue (hourly CAD midpoint) across jobs that state pay. */
function statedPayMedian(jobs) {
  const values = [];
  for (const job of jobs) {
    if (job.pay && job.pay.status === 'stated' && job.pay.hourlyCad) {
      values.push((job.pay.hourlyCad.min + job.pay.hourlyCad.max) / 2);
    }
  }
  return median(values);
}

/** { payUsed:number|null, payEstimated:boolean } for one job. */
function payInfoFor(job, boardMedian) {
  if (job.pay === undefined) return { payUsed: null, payEstimated: false };
  if (job.pay && job.pay.status === 'stated' && job.pay.hourlyCad) {
    return { payUsed: (job.pay.hourlyCad.min + job.pay.hourlyCad.max) / 2, payEstimated: false };
  }
  if (job.pay && job.pay.status === 'unpaid') return { payUsed: 0, payEstimated: false };
  if (boardMedian != null) return { payUsed: boardMedian, payEstimated: true };
  return { payUsed: null, payEstimated: false };
}

/** Applications per opening (A), by board. */
function appsPerOpeningFor(job, board) {
  if (board === 'direct') return WEIGHTS.directAppsPerOpening;
  if (job.apps == null) return WEIGHTS.priorAppsPerOpening;

  const multiplier = (job.daysLive != null && job.daysLeft != null)
    ? clamp(
      (job.daysLive + job.daysLeft) / Math.max(job.daysLive, 1),
      WEIGHTS.projectedAppsMultiplier.min,
      WEIGHTS.projectedAppsMultiplier.max,
    )
    : 1;
  const projected = job.apps * multiplier;
  const openingsDenom = job.openings != null ? Math.max(job.openings, 1) : 1;
  const observed = projected / openingsDenom;
  const d = job.daysLive != null ? job.daysLive : 0;
  const A = (observed * d + WEIGHTS.priorAppsPerOpening * WEIGHTS.priorDays) / (d + WEIGHTS.priorDays);
  return Math.max(A, 1);
}

function levelFactorFor(job, profile) {
  if (!profile) return 1;
  const brackets = knownLevelBrackets(job);
  if (brackets.length === 0) return 1;
  const studentBracket = levelBracket(profile.completedWorkTerms);
  const distance = Math.min(...brackets.map((b) => Math.abs(b - studentBracket)));
  return WEIGHTS.levelStepPenalty[Math.min(distance, 2)];
}

function yearUnmet(year, profile) {
  if (!profile || !year || !year.found) return false;
  if (year.minTerm) {
    const s = TERMS.indexOf(profile.term);
    const r = TERMS.indexOf(year.minTerm);
    if (s === -1 || r === -1) return false;
    return s < r;
  }
  if (year.minWorkTerms != null) return profile.completedWorkTerms < year.minWorkTerms;
  return false;
}

function yearFactorFor(job, profile) {
  const year = job.year;
  if (!year || !year.found || !profile) return 1;
  if (!yearUnmet(year, profile)) return 1;
  if (year.strength === 'required') return WEIGHTS.yearRequiredUnmet;
  if (year.strength === 'preferred') return WEIGHTS.yearPreferredUnmet;
  return 1;
}

function buildReasons(entry, profile, companyInfo) {
  const reasons = [];
  const job = entry.job;

  if (entry.payEstimated) {
    reasons.push("Pay isn't stated. Using the median pay on this board instead.");
  } else if (job.pay && job.pay.status === 'unpaid') {
    reasons.push('This posting is unpaid.');
  }

  if (entry.appsPerOpeningUsed <= WEIGHTS.bestAppsPerOpening) {
    reasons.push('Few applicants expected per opening.');
  } else if (entry.appsPerOpeningUsed >= WEIGHTS.priorAppsPerOpening * 3) {
    reasons.push('Many applicants expected per opening.');
  }

  if (profile && entry.levelFactor < 1) {
    const brackets = knownLevelBrackets(job);
    const studentBracket = levelBracket(profile.completedWorkTerms);
    const closest = brackets.reduce(
      (best, b) => (Math.abs(b - studentBracket) < Math.abs(best - studentBracket) ? b : best),
      brackets[0],
    );
    if (closest > studentBracket) reasons.push('Listed above your usual level.');
    else reasons.push('Listed below your usual level, but still open to you.');
  }

  if (profile && job.year && job.year.found && entry.yearFactor < 1) {
    if (job.year.strength === 'required') reasons.push("This posting requires a higher year than you're in.");
    else reasons.push("They prefer a higher year than you're in, but it isn't required.");
  }

  if (companyInfo.chip && companyInfo.chip.kind === 'company_other') {
    reasons.push('You already have a better ranked posting at this employer.');
  }

  return reasons;
}

function yearChipText(year) {
  if (year.minTerm) return `Year: ${year.minTerm}+`;
  if (year.minWorkTerms != null) return `Year: ${year.minWorkTerms}+ work terms`;
  return 'Year requirement';
}

/**
 * @param {JobFacts[]} jobs
 * @param {Profile} profile
 * @param {import('../contract.js').DEFAULT_SETTINGS} settings
 * @param {{board:'full'|'direct'}} options
 * @returns {Map<string, RoiResult>}
 */
export function scoreJobs(jobs, profile, settings, { board } = {}) {
  const result = new Map();
  if (!Array.isArray(jobs) || jobs.length === 0) return result;

  const scoreWeights = { ...DEFAULT_SCORE_WEIGHTS, ...(settings && settings.weights ? settings.weights : {}) };
  const boardMedian = statedPayMedian(jobs);

  const perJob = jobs.map((job) => {
    const { payUsed, payEstimated } = payInfoFor(job, boardMedian);
    const appsPerOpeningUsed = appsPerOpeningFor(job, board);
    const levelFactor = levelFactorFor(job, profile);
    const yearFactor = yearFactorFor(job, profile);
    return { job, payUsed, payEstimated, appsPerOpeningUsed, levelFactor, yearFactor };
  });

  const ePay = scoreWeights.pay / 3;
  const eOdds = scoreWeights.odds / 3;
  const eLevel = scoreWeights.level / 3;
  const eYear = scoreWeights.year / 3;

  const companyEntries = perJob.map((p) => {
    const odds = 1 / p.appsPerOpeningUsed;
    const value = p.payUsed == null
      ? 0
      : Math.max(p.payUsed, 0) ** ePay * odds ** eOdds * p.levelFactor ** eLevel * p.yearFactor ** eYear;
    return { id: p.job.jobId, org: p.job.org, value };
  });
  const companyAdjust = applyCompanyAdjustment(companyEntries, {
    secondFactor: WEIGHTS.repeatSecond,
    furtherFactor: WEIGHTS.repeatFurther,
  });

  for (const entry of perJob) {
    const companyInfo = companyAdjust.get(entry.job.jobId) || { repeatFactor: 1, chip: null };
    const repeatFactor = companyInfo.repeatFactor;

    const score = entry.payUsed == null
      ? null
      : roiFromInputs({
        pay: entry.payUsed,
        appsPerOpening: entry.appsPerOpeningUsed,
        level: entry.levelFactor,
        year: entry.yearFactor,
        repeat: repeatFactor,
        weights: scoreWeights,
      });

    const chips = [];
    if (entry.job.year && yearUnmet(entry.job.year, profile)) {
      chips.push({ kind: 'year', text: yearChipText(entry.job.year) });
    }
    if (companyInfo.chip) chips.push(companyInfo.chip);

    const reasons = buildReasons(entry, profile, companyInfo);

    result.set(entry.job.jobId, {
      score,
      payUsed: entry.payUsed,
      payEstimated: entry.payEstimated,
      appsPerOpeningUsed: entry.appsPerOpeningUsed,
      odds: 1 / entry.appsPerOpeningUsed,
      factors: { level: entry.levelFactor, year: entry.yearFactor, repeat: repeatFactor },
      reasons,
      chips,
    });
  }

  return result;
}

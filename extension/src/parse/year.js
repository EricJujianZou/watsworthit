// Pure year-of-study parser. No dependencies. Runs in a content script and
// in Node. See docs/build-contract.md, "Interfaces" and the parseYear spec
// in this agent's brief.
//
// The rules live in rules/year.json. DEFAULT_RULES below is kept identical
// to that file (checked in extension/tests/year.test.js), following the
// same pattern as parse/pay.js.

/** @typedef {import('../contract.js').YearReq} YearReq */

export const DEFAULT_RULES = {
  termPattern: {
    source: '\\b([1-4][AB])\\s*\\+?\\b',
    flags: 'i',
  },
  yearWordToTerm: {
    'first year': '1A',
    '1st year': '1A',
    'second year': '2A',
    '2nd year': '2A',
    'third year': '3A',
    '3rd year': '3A',
    'fourth year': '4A',
    '4th year': '4A',
    'final year': '4A',
    graduating: '4A',
  },
  notFirstYearPhrases: ['not open to first year', 'not open to first years'],
  notFirstYearTerm: '2A',
  workTermCountPattern: {
    source: '(?:completed|minimum of|at least)\\s*(one|two|three|four|five|six|\\d+)\\s*work\\s*terms?',
    flags: 'i',
  },
  wordNumbers: { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 },
  preferredWords: ['preferred', 'an asset', 'nice to have', 'ideally'],
};

function normalizeText(input) {
  let t = String(input == null ? '' : input);
  if (/<[a-z][\s\S]*>/i.test(t)) {
    t = t.replace(/<[^>]*>/g, ' ');
  }
  t = t.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&');
  t = t.replace(/ /g, ' ');
  t = t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function splitSentences(text) {
  const protectedText = text.replace(/(\d)\.(\d)/g, '$1\u0000$2');
  const parts = protectedText.split(/(?<=[.!?])\s+(?=[A-Z0-9$])/);
  return parts.map((p) => p.replace(/\u0000/g, '.').trim()).filter(Boolean);
}

function empty() {
  return { found: false, minTerm: null, minWorkTerms: null, strength: null, quote: null };
}

function makeParseYear(defaultRules) {
  return function parseYear(text, opts = {}) {
    const rules = (opts && opts.rules) || defaultRules;
    const clean = normalizeText(text);
    if (!clean) return empty();

    const sentences = splitSentences(clean);

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      let minTerm = null;
      let minWorkTerms = null;

      if (rules.notFirstYearPhrases.some((p) => lower.includes(p))) {
        minTerm = rules.notFirstYearTerm;
      }

      if (!minTerm) {
        const termRe = new RegExp(rules.termPattern.source, rules.termPattern.flags);
        const termMatch = termRe.exec(sentence);
        if (termMatch) minTerm = termMatch[1].toUpperCase();
      }

      if (!minTerm) {
        for (const phrase of Object.keys(rules.yearWordToTerm)) {
          if (lower.includes(phrase)) {
            minTerm = rules.yearWordToTerm[phrase];
            break;
          }
        }
      }

      const wtRe = new RegExp(rules.workTermCountPattern.source, rules.workTermCountPattern.flags);
      const wtMatch = wtRe.exec(sentence);
      if (wtMatch) {
        const raw = wtMatch[1].toLowerCase();
        minWorkTerms = Object.prototype.hasOwnProperty.call(rules.wordNumbers, raw)
          ? rules.wordNumbers[raw]
          : parseInt(raw, 10);
      }

      if (minTerm || minWorkTerms != null) {
        const strength = rules.preferredWords.some((p) => lower.includes(p)) ? 'preferred' : 'required';
        return {
          found: true,
          minTerm: minTerm || null,
          minWorkTerms: minWorkTerms != null ? minWorkTerms : null,
          strength,
          quote: sentence.trim(),
        };
      }
    }

    return empty();
  };
}

export function createYearParser(rules) {
  return makeParseYear(rules);
}

export const parseYear = makeParseYear(DEFAULT_RULES);

export const TERMINOLOGY_RULES_EN = Object.freeze([
  {
    pattern: /\bMasonic symbology\b/gi,
    replacement: "Masonic symbolism",
    reason: "Natural English terminology"
  },
  {
    pattern: /\bprofane people\b/gi,
    replacement: "people who are not Freemasons",
    reason: "Avoid a literal and potentially derogatory translation"
  },
  {
    pattern: /\bthe profane\b/gi,
    replacement: "people who are not Freemasons",
    reason: "Avoid unnecessary internal jargon"
  },
  {
    pattern: /\bMasonic obedience\b/gi,
    replacement: "Masonic body",
    reason: "Prefer standard English unless referring to a proper name"
  },
  {
    pattern: /\bMasonic plank\b/gi,
    replacement: "Masonic paper",
    reason: "Avoid literal translation of Spanish plancha"
  }
]);

export const TERMINOLOGY_GUIDE_EN = `
CONTROLLED ENGLISH TERMINOLOGY
- Use "Masonic symbolism," not "Masonic symbology," in general prose.
- Distinguish rite, ritual, and ceremony.
- Distinguish degree, office, role, body, grand lodge, obedience, and jurisdiction.
- Distinguish regularity, recognition, and legitimacy.
- Translate Spanish Masonic vocabulary by meaning and jurisdiction, never mechanically.
- Prefer "people who are not Freemasons" or "the general public" when natural.
- Preserve official proper names in their original form unless an official English form exists.
`;

export function applyTerminologyEn(text) {
  let result = String(text || "");

  for (const rule of TERMINOLOGY_RULES_EN) {
    result = result.replace(rule.pattern, (match) => {
      const replacement = rule.replacement;
      return /^[A-Z]/.test(match)
        ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
        : replacement;
    });
  }

  return result;
}

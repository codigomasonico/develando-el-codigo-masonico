export const TERMINOLOGY_RULES = Object.freeze([
  {
    pattern: /\ben la simbólica masónica\b/gi,
    replacement: "en la simbología masónica",
    reason: "Uso terminológico preferido"
  },
  {
    pattern: /\bla simbólica masónica\b/gi,
    replacement: "la simbología masónica",
    reason: "Uso terminológico preferido"
  },
  {
    pattern: /\b(?:los|unos)\s+no\s+masones\b/gi,
    replacement: "las personas no pertenecientes a la Masonería",
    reason: "Lenguaje inclusivo y no despectivo"
  },
  {
    pattern: /\b(?:el|un)\s+no\s+masón\b/gi,
    replacement: "la persona no perteneciente a la Masonería",
    reason: "Lenguaje inclusivo y no despectivo"
  },
  {
    pattern: /\bno\s+masones\b/gi,
    replacement: "personas no pertenecientes a la Masonería",
    reason: "Lenguaje inclusivo y no despectivo"
  },
  {
    pattern: /\b(?:los|unos)\s+profanos\b/gi,
    replacement: "las personas no pertenecientes a la Masonería",
    reason: "Evitar uso innecesario de jerga interna"
  },
  {
    pattern: /\b(?:las|unas)\s+profanas\b/gi,
    replacement: "las personas no pertenecientes a la Masonería",
    reason: "Evitar uso innecesario de jerga interna"
  },
  {
    pattern: /\b(?:el|un)\s+profano\b/gi,
    replacement: "la persona no perteneciente a la Masonería",
    reason: "Evitar uso innecesario de jerga interna"
  },
  {
    pattern: /\b(?:la|una)\s+profana\b/gi,
    replacement: "la persona no perteneciente a la Masonería",
    reason: "Evitar uso innecesario de jerga interna"
  }
]);

export const TERMINOLOGY_GUIDE = `
TERMINOLOGÍA CONTROLADA
- Usa "simbología masónica" para referirte al conjunto y estudio de símbolos masónicos.
- No uses "simbólica masónica" como sustituto automático de "simbología masónica".
- Distingue rito, ritual y ceremonia.
- Distingue grado, cargo, cuerpo, obediencia y jurisdicción.
- Distingue regularidad, reconocimiento y legitimidad.
- Prefiere "persona no perteneciente a la Masonería" o "público general" cuando sea natural.
`;

export function applyTerminology(text) {
  let result = String(text || "");

  for (const rule of TERMINOLOGY_RULES) {
    result = result.replace(rule.pattern, (match) => {
      const replacement = rule.replacement;

      return /^[A-ZÁÉÍÓÚÑ]/.test(match)
        ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
        : replacement;
    });
  }

  return result;
}

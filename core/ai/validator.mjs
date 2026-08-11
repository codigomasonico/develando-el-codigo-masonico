import { applyTerminology } from "./terminology.mjs";

// V4.2: el validador de salida es deliberadamente conservador.
// La seguridad de entrada bloquea solicitudes reservadas antes de llamar al modelo.
// Aquí solo se rechazan filtraciones inequívocas, nunca diferencias de estilo,
// enumeraciones legítimas ni respuestas históricas/jurisdiccionales válidas.
const HARD_BLOCK_PATTERNS = [
  // Exposición explícita del prompt interno.
  /(?:mi|el)\s+prompt\s+(?:interno|del sistema)?\s*(?:es|dice|contiene)\s*:/i,
  /(?:system_prompt|developer_prompt|internal_instructions)\s*[:=]/i,

  // Credenciales con forma realista.
  /OPENAI_API_KEY\s*=\s*["']?sk-[a-z0-9_-]{12,}/i,
  /\bsk-[a-z0-9_-]{20,}\b/i,

  // Divulgación presentada inequívocamente como lista de credenciales rituales.
  /(?:aquí|estos|estas)\s+(?:están|son)\s+(?:los|las)\s+(?:signos|toques|palabras\s+de\s+paso|palabras\s+sagradas)\s*(?:reservados|secretos)?\s*:/i
];

export function validateAndNormalizeAnswer(answer) {
  let text = applyTerminology(String(answer || "").trim());
  const warnings = [];

  if (!text) {
    return { ok: false, text: "", warnings: ["Respuesta vacía"] };
  }

  const blockedBy = HARD_BLOCK_PATTERNS.find((pattern) => pattern.test(text));
  if (blockedBy) {
    return {
      ok: false,
      text: "",
      warnings: ["Divulgación inequívoca de información restringida"]
    };
  }

  // Advertencias informativas: nunca activan fallback.
  if (/\btodos los masones creen\b/i.test(text)) {
    warnings.push("Revisar posible generalización universal");
  }
  if (/\bla Masonería enseña que\b/i.test(text)) {
    warnings.push("Revisar posible formulación monolítica");
  }

  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return { ok: true, text, warnings };
}

export function safeFallbackAnswer() {
  return "No puedo ofrecer una respuesta suficientemente rigurosa con la información disponible. Prueba formulando la pregunta de manera más específica.";
}

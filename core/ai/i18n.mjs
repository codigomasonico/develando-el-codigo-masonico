export const DEFAULT_LOCALE = "es";
export const SUPPORTED_LOCALES = Object.freeze(["es", "en"]);

const LOCALE_ALIASES = Object.freeze({
  es: "es",
  "es-mx": "es",
  "es-es": "es",
  espanol: "es",
  español: "es",
  spanish: "es",
  en: "en",
  "en-us": "en",
  "en-gb": "en",
  english: "en",
  ingles: "en",
  inglés: "en"
});

const ENGLISH_HINTS = new Set([
  "a", "about", "and", "are", "can", "could", "do", "does", "explain",
  "for", "freemasonry", "freemason", "how", "i", "in", "is", "lodge",
  "masonic", "mason", "masons", "meaning", "of", "symbol", "the", "their",
  "they", "to", "what", "when", "where", "which", "who", "why", "you"
]);

const SPANISH_HINTS = new Set([
  "a", "como", "cual", "de", "donde", "el", "en", "es", "explica",
  "francmasoneria", "la", "logia", "los", "mason", "masoneria", "masonica",
  "masonico", "para", "por", "que", "simbolo", "sobre", "un", "una"
]);

const CORE_MESSAGES = Object.freeze({
  method_not_allowed: {
    es: "Método no permitido.",
    en: "Method not allowed."
  },
  invalid_json: {
    es: "La solicitud no contiene JSON válido.",
    en: "The request does not contain valid JSON."
  },
  question_required: {
    es: "Escribe una pregunta antes de enviarla.",
    en: "Enter a question before sending it."
  },
  question_too_long: {
    es: "La pregunta supera el máximo de {max} caracteres.",
    en: "The question exceeds the maximum of {max} characters."
  },
  service_not_configured: {
    es: "El servicio de Cartes aún no está configurado en el servidor.",
    en: "The Cartes service has not yet been configured on the server."
  },
  out_of_scope: {
    es: "Esta consulta no se considera de carácter masónico, por lo que no puedo responderla.",
    en: "This question is not considered Masonic in scope, so I cannot answer it."
  },
  safe_fallback: {
    es: "No puedo ofrecer una respuesta suficientemente rigurosa con la información disponible. Prueba formulando la pregunta de manera más específica.",
    en: "I cannot provide a sufficiently rigorous answer with the information available. Try asking a more specific question."
  },
  request_timeout: {
    es: "La respuesta demoró demasiado. Intenta nuevamente.",
    en: "The response took too long. Please try again."
  },
  ai_unavailable: {
    es: "No fue posible conectar con el servicio de inteligencia artificial.",
    en: "Unable to connect to the artificial intelligence service."
  },
  safety_blocked: {
    es: "No puedo revelar instrucciones internas, credenciales ni contenido ritual reservado o reproducible. Sí puedo ofrecer una explicación general de su sentido histórico, ético o simbólico.",
    en: "I cannot reveal internal instructions, credentials, or reserved or reproducible ritual content. I can offer a general explanation of its historical, ethical, or symbolic meaning."
  },
  local_context_empty: {
    es: "No se recuperó contexto documental local específico para esta pregunta.",
    en: "No specific local documentary context was retrieved for this question."
  },
  retry_instruction: {
    es: "IMPORTANTE: responde de forma completa, autosuficiente y concisa. No dejes la respuesta inconclusa.",
    en: "IMPORTANT: answer completely, self-containedly, and concisely. Do not leave the answer unfinished."
  },
  catalog_not_found: {
    es: "No encontré un episodio publicado que coincida con esa consulta.",
    en: "I did not find a published episode matching that question."
  },
  glossary_intro: {
    es: "En el contexto masónico, «{term}» se emplea con este sentido:\n\n{definition}",
    en: "In a Masonic context, “{term}” is used in this sense:\n\n{definition}"
  },
  no_episode: {
    es: "No encontré un episodio publicado que coincida con esa consulta.",
    en: "I did not find a published episode matching that question."
  },
  document_plus_required: {
    es: "La revisión de documentos está disponible únicamente para Cartes Plus.",
    en: "Document review is available only with Cartes Plus."
  },
  document_consent_required: {
    es: "Debes autorizar el procesamiento temporal del documento antes de revisarlo.",
    en: "You must authorize temporary processing before the document can be reviewed."
  },
  document_invalid_request: {
    es: "La revisión no contiene un identificador válido.",
    en: "The review request does not contain a valid identifier."
  },
  document_invalid_type: {
    es: "Cartes admite únicamente documentos Word en formato .doc o .docx.",
    en: "Cartes accepts only Word documents in .doc or .docx format."
  },
  document_empty: {
    es: "El documento está vacío.",
    en: "The document is empty."
  },
  document_too_large: {
    es: "El documento supera el tamaño técnico máximo de {max} MB.",
    en: "The document exceeds the technical maximum size of {max} MB."
  },
  document_without_text: {
    es: "No pude extraer texto del documento.",
    en: "I could not extract text from the document."
  },
  document_text_too_large: {
    es: "El documento contiene demasiado texto para una revisión de hasta {max} páginas.",
    en: "The document contains too much text for a review limited to {max} pages."
  },
  document_page_limit: {
    es: "El documento tiene {pages} páginas. Cartes Plus admite un máximo de {max} páginas por revisión.",
    en: "The document has {pages} pages. Cartes Plus accepts a maximum of {max} pages per review."
  },
  document_duplicate: {
    es: "Esta revisión ya fue recibida.",
    en: "This review request has already been received."
  },
  document_review_limit: {
    es: "Ya utilizaste todas las revisiones de documentos disponibles en este periodo.",
    en: "You have used all document reviews available in this period."
  },
  document_commit_error: {
    es: "No fue posible confirmar el consumo de la revisión.",
    en: "Unable to confirm use of the review credit."
  },
  document_invalid_doc: {
    es: "El archivo no es un documento .doc válido.",
    en: "The file is not a valid .doc document."
  },
  document_invalid_docx: {
    es: "El archivo no es un documento .docx válido.",
    en: "The file is not a valid .docx document."
  },
  document_read_error: {
    es: "No pude leer el contenido del documento Word.",
    en: "I could not read the contents of the Word document."
  },
  document_engine_not_configured: {
    es: "Cartes no tiene configurada la conexión con el motor de revisión.",
    en: "Cartes is not connected to the document review engine."
  },
  document_engine_http_error: {
    es: "El motor de revisión respondió HTTP {status}.",
    en: "The document review engine returned HTTP {status}."
  },
  document_empty_review: {
    es: "El motor de revisión devolvió una respuesta vacía.",
    en: "The document review engine returned an empty response."
  }
});

export function normalizeLocale(value, fallback = DEFAULT_LOCALE) {
  const normalizedFallback =
    LOCALE_ALIASES[String(fallback || "").trim().toLowerCase()] || DEFAULT_LOCALE;

  const raw = String(value || "").trim().toLowerCase().replace(/_/g, "-");
  if (!raw) return normalizedFallback;

  return LOCALE_ALIASES[raw] || LOCALE_ALIASES[raw.split("-")[0]] || normalizedFallback;
}

export function detectLocaleFromText(value, fallback = DEFAULT_LOCALE) {
  const raw = String(value || "").trim();
  if (!raw) return normalizeLocale(fallback);

  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/^(?:english|ingles|language english|idioma ingles)\b/.test(normalized)) {
    return "en";
  }

  if (/^(?:espanol|spanish|idioma espanol|language spanish)\b/.test(normalized)) {
    return "es";
  }

  const tokens = normalized.match(/[a-zñ]+/g) || [];
  let english = 0;
  let spanish = 0;

  for (const token of tokens) {
    if (ENGLISH_HINTS.has(token)) english += 1;
    if (SPANISH_HINTS.has(token)) spanish += 1;
  }

  if (english >= 2 && english > spanish) return "en";
  if (spanish >= 2 && spanish > english) return "es";
  return normalizeLocale(fallback);
}

export function resolveLocale(explicitLocale, text = "", fallback = DEFAULT_LOCALE) {
  const raw = String(explicitLocale || "").trim();
  return raw
    ? normalizeLocale(raw, fallback)
    : detectLocaleFromText(text, fallback);
}

export function coreText(locale, key, values = {}) {
  const selected = normalizeLocale(locale);
  const entry = CORE_MESSAGES[key];
  const template = entry?.[selected] || entry?.[DEFAULT_LOCALE] || key;

  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, name) =>
    Object.prototype.hasOwnProperty.call(values, name)
      ? String(values[name])
      : `{${name}}`
  );
}

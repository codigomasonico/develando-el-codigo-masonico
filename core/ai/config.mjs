function readRequiredPositiveIntegerEnv(name) {
  const raw = String(process.env[name] ?? "").trim();

  if (!raw) {
    throw new Error(`${name} es obligatorio y debe definirse como un entero positivo.`);
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error(`${name} debe ser un entero positivo.`);
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} debe ser un entero positivo valido.`);
  }

  return value;
}

export const CARTES_FREE_QUERY_LIMIT =
  readRequiredPositiveIntegerEnv("CARTES_FREE_QUERY_LIMIT");

export const CARTES_PLUS_QUERY_LIMIT =
  readRequiredPositiveIntegerEnv("CARTES_PLUS_QUERY_LIMIT");

export const CARTES_PLUS_REVIEW_LIMIT =
  readRequiredPositiveIntegerEnv("CARTES_PLUS_REVIEW_LIMIT");

export const CARTES_PLUS_PRICE_MXN =
  readRequiredPositiveIntegerEnv("CARTES_PLUS_PRICE_MXN");

export const CARTES_REVIEW_PACK_PRICE_MXN =
  readRequiredPositiveIntegerEnv("CARTES_REVIEW_PACK_PRICE_MXN");

export const CARTES_REVIEW_PACK_SIZE =
  readRequiredPositiveIntegerEnv("CARTES_REVIEW_PACK_SIZE");

export const CARTES_REVIEW_PACK_MAX_PER_PERIOD =
  readRequiredPositiveIntegerEnv("CARTES_REVIEW_PACK_MAX_PER_PERIOD");

export const CARTES_DOCUMENT_MAX_PAGES = 5;
export const CARTES_DOCUMENT_MAX_MB = 4;
export const CARTES_DOCUMENT_MAX_BYTES = CARTES_DOCUMENT_MAX_MB * 1024 * 1024;
export const CARTES_LINK_CODE_TTL_MINUTES = 10;
export const CARTES_LINK_CODE_TTL_MS = CARTES_LINK_CODE_TTL_MINUTES * 60 * 1000;
export const CARTES_CONVERSATION_MEMORY_MESSAGES = 20;
export const CARTES_CONVERSATION_MESSAGE_MAX_CHARS = 1800;
export const CARTES_CONCURRENCY_MAX_RETRIES = 10;

if (CARTES_PLUS_QUERY_LIMIT <= CARTES_FREE_QUERY_LIMIT) {
  throw new Error(
    "CARTES_PLUS_QUERY_LIMIT debe ser mayor que CARTES_FREE_QUERY_LIMIT."
  );
}

export const CARTES_QUERY_LIMITS = Object.freeze({
  gratuito: CARTES_FREE_QUERY_LIMIT,
  plus: CARTES_PLUS_QUERY_LIMIT
});
export const CONFIG = Object.freeze({
  openAIUrl: "https://api.openai.com/v1/responses",
  defaultModel: "gpt-5-mini",
  maxQuestionChars: 900,
  maxHistoryItems: 8,
  maxHistoryChars: 6000,
  maxOutputTokens: 8000,
  requestTimeoutMs: 30000,
  promptVersion: "5.1.2",
  knowledgeVersion: "3.0.1"
});

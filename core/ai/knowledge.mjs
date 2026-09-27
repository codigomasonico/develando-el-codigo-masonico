import glossary from "../knowledge/01_GLOSARIO_MASONICO.json" with { type: "json" };
import faq from "../knowledge/faq-base.json" with { type: "json" };
import catalog from "../knowledge/02_CATALOGO_CONTENIDOS.json" with { type: "json" };
import { coreText, normalizeLocale } from "./i18n.mjs";

const STOP_WORDS = new Set([
  "que", "cual", "cuales", "como", "donde", "cuando", "quien", "quienes",
  "para", "sobre", "tienen", "tiene", "hay", "un", "una", "unos", "unas",
  "el", "la", "los", "las", "de", "del", "en", "y", "o", "es", "son",
  "me", "puedes", "podrias", "quiero", "dime", "explica", "explicame",
  "significa", "masoneria", "masonico", "masonica", "masonicos", "masonicas",
  "what", "which", "where", "when", "who", "why", "how", "about", "with",
  "from", "that", "this", "these", "those", "the", "and", "for", "are",
  "does", "explain", "meaning", "freemasonry", "freemason", "freemasons",
  "masonic", "mason", "masons"
]);

// The approved documentary corpus remains in Spanish. These equivalents make
// its retrieval bilingual while preserving one authoritative content source.
// The model receives the Spanish evidence and is explicitly instructed to
// answer in natural English when the selected locale is English.
const ENGLISH_TO_SPANISH_EQUIVALENTS = Object.freeze([
  ["freemasonry", "masoneria"],
  ["freemason", "mason"],
  ["freemasons", "masones"],
  ["masonic", "masonico"],
  ["lodge meeting", "tenida"],
  ["stated communication", "tenida"],
  ["grand lodge", "gran logia"],
  ["masonic body", "obediencia"],
  ["recognition", "reconocimiento"],
  ["regularity", "regularidad"],
  ["jurisdiction", "jurisdiccion"],
  ["rite", "rito"],
  ["ritual", "ritual"],
  ["ceremony", "ceremonia"],
  ["degree", "grado"],
  ["degrees", "grados"],
  ["office", "cargo"],
  ["officer", "dignatario"],
  ["worshipful master", "venerable maestro"],
  ["entered apprentice", "aprendiz mason"],
  ["fellow craft", "companero mason"],
  ["master mason", "maestro mason"],
  ["square and compasses", "escuadra compas"],
  ["square", "escuadra"],
  ["compasses", "compas"],
  ["compass", "compas"],
  ["apron", "mandil"],
  ["plumb rule", "plomada"],
  ["plumb", "plomada"],
  ["level", "nivel"],
  ["gavel", "mallete"],
  ["trowel", "palustre"],
  ["rough ashlar", "piedra bruta"],
  ["perfect ashlar", "piedra cubica"],
  ["chamber of reflection", "camara de reflexiones"],
  ["chamber of reflections", "camara de reflexiones"],
  ["three great lights", "tres grandes luces"],
  ["great architect of the universe", "gran arquitecto del universo"],
  ["grand architect of the universe", "gran arquitecto del universo"],
  ["chain of union", "cadena de union"],
  ["pillars", "pilares columnas"],
  ["pillar", "pilar columna"],
  ["columns", "columnas"],
  ["column", "columna"],
  ["east", "oriente"],
  ["west", "occidente"],
  ["light", "luz"],
  ["temple", "templo"],
  ["symbolism", "simbolismo simbologia"],
  ["symbol", "simbolo"],
  ["symbols", "simbolos"],
  ["brotherhood", "fraternidad"],
  ["brotherly love", "amor fraternal"],
  ["virtue", "virtud"],
  ["ethics", "etica"],
  ["philosophy", "filosofia"],
  ["operative masonry", "masoneria operativa"],
  ["speculative masonry", "masoneria especulativa"],
  ["old charges", "antiguos deberes"],
  ["anderson constitutions", "constituciones de anderson"],
  ["landmarks", "landmarks"],
  ["initiation", "iniciacion"],
  ["oath", "juramento"],
  ["obligation", "obligacion juramento"],
  ["secrecy", "secreto reserva"],
  ["women", "mujeres"],
  ["religion", "religion"],
  ["god", "dios"],
  ["supreme being", "ser supremo"],
  ["conspiracy", "conspiracion"],
  ["lucifer", "lucifer"],
  ["podcast", "podcast episodio"],
  ["episode", "episodio"],
  ["episodes", "episodios"],
  ["listen", "escuchar"],
  ["book", "libro"]
]);

function expandEnglishQuestion(value) {
  let expanded = ` ${normalize(value)} `;

  for (const [english, spanish] of ENGLISH_TO_SPANISH_EQUIVALENTS) {
    const normalizedEnglish = normalize(english);
    if (expanded.includes(` ${normalizedEnglish} `)) {
      expanded += ` ${spanish}`;
    }
  }

  return expanded.trim();
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function compact(value) {
  return normalize(value).replace(/\s+/g, "");
}

function tokenScore(questionTokens, text) {
  const haystackTokens = new Set(tokens(text));
  let score = 0;

  for (const token of questionTokens) {
    if (haystackTokens.has(token)) score += 1;
  }

  return score;
}

function isAcronym(value) {
  const raw = String(value || "").trim();
  const letters = raw.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");

  if (letters.length < 2 || letters.length > 10) return false;

  return (
    /[.\s-]/.test(raw) ||
    letters === letters.toUpperCase()
  );
}

function phraseScore(question, phrases) {
  const normalizedQuestion = normalize(question);
  const paddedQuestion = ` ${normalizedQuestion} `;
  const compactQuestion = compact(question);
  let best = 0;

  for (const phrase of phrases.filter(Boolean)) {
    const normalizedPhrase = normalize(phrase);
    const compactPhrase = compact(phrase);

    if (!normalizedPhrase) continue;

    if (
      ["masoneria", "masonico", "masonica", "mason", "masones"].includes(
        normalizedPhrase
      )
    ) {
      continue;
    }

    const exactPhrase =
      normalizedQuestion === normalizedPhrase ||
      paddedQuestion.includes(` ${normalizedPhrase} `);

    if (exactPhrase) {
      best = Math.max(best, 12 + normalizedPhrase.split(" ").length);
      continue;
    }

    if (
      isAcronym(phrase) &&
      compactPhrase.length >= 2 &&
      compactQuestion.includes(compactPhrase)
    ) {
      best = Math.max(best, 10);
    }
  }

  return best;
}


function formatGlossaryContext(item) {
  const lines = [String(item?.definition || "").trim()];

  if (Array.isArray(item?.tags) && item.tags.length) {
    lines.push(`Ámbito: ${item.tags.join(", ")}.`);
  }

  if (
    Array.isArray(item?.do_not_confuse_with) &&
    item.do_not_confuse_with.length
  ) {
    lines.push(`No confundir con: ${item.do_not_confuse_with.join(", ")}.`);
  }

  if (Array.isArray(item?.editorial_notes) && item.editorial_notes.length) {
    lines.push(`Notas de uso: ${item.editorial_notes.join(" ")}`);
  }

  return lines.filter(Boolean).join("\n");
}

function countMatchedPhrases(question, phrases) {
  const normalizedQuestion = ` ${normalize(question)} `;
  let count = 0;

  for (const phrase of phrases.filter(Boolean)) {
    const normalizedPhrase = normalize(phrase);
    if (!normalizedPhrase) continue;

    if (
      normalizedQuestion.includes(` ${normalizedPhrase} `) ||
      compact(question).includes(compact(phrase))
    ) {
      count += 1;
    }
  }

  return count;
}

export function retrieveLocalKnowledge(question, limit = 6, locale = "es") {
  const selectedLocale = normalizeLocale(locale);
  const searchQuestion = selectedLocale === "en"
    ? expandEnglishQuestion(question)
    : question;
  const questionTokens = new Set(tokens(searchQuestion));
  const candidates = [];

  for (const item of glossary.entries || []) {
    const phrases = [item.term, ...(item.aliases || [])];
    const phrase = phraseScore(searchQuestion, phrases);
    const overlap = tokenScore(
      questionTokens,
      [
        item.term,
        item.definition,
        ...(item.aliases || []),
        ...(item.tags || []),
        ...(item.do_not_confuse_with || [])
      ].join(" ")
    );
    const score = phrase + overlap + (phrase ? 3 : 0);

    if (score > 0) {
      candidates.push({
        score,
        type: "glosario",
        id: item.term,
        title: item.term,
        text: formatGlossaryContext(item)
      });
    }
  }

  for (const item of glossary.distinctions || []) {
    const phrases = item.terms || [];
    const phrase = phraseScore(searchQuestion, phrases);
    const overlap = tokenScore(
      questionTokens,
      `${item.title} ${item.text} ${phrases.join(" ")}`
    );
    const matchedPhrases = countMatchedPhrases(searchQuestion, phrases);
    const score =
      phrase +
      overlap +
      (matchedPhrases >= 2 ? 8 : phrase ? 2 : 0);

    if (score > 0) {
      candidates.push({
        score,
        type: "distincion",
        id: item.id || item.title,
        title: item.title,
        text: item.text
      });
    }
  }

  for (const item of glossary.reaa_degrees || []) {
    const phrases = [
      `${item.degree}°`,
      `grado ${item.degree}`,
      item.spanish,
      item.english,
      ...(item.aliases || [])
    ];
    const phrase = phraseScore(searchQuestion, phrases);
    const overlap = tokenScore(
      questionTokens,
      `${item.degree} ${item.spanish} ${item.english} ${(item.aliases || []).join(" ")}`
    );
    const score = phrase + overlap + (phrase ? 3 : 0);

    if (score > 0) {
      const note = item.note ? ` ${item.note}` : "";
      candidates.push({
        score,
        type: "grado_reaa",
        id: `REAA-${String(item.degree).padStart(2, "0")}`,
        title: `${item.degree}° ${item.spanish}`,
        text: `${item.spanish}${item.english ? ` / ${item.english}` : ""}.${note}`.trim()
      });
    }
  }

  for (const item of faq.entries || []) {
    const phrase = phraseScore(searchQuestion, [item.question]);
    const overlap = tokenScore(
      questionTokens,
      `${item.question} ${item.answer} ${(item.keywords || []).join(" ")}`
    );
    const score = phrase + overlap + (phrase ? 2 : 0);

    if (score > 0) {
      candidates.push({
        score,
        type: "faq",
        id: item.question,
        title: item.question,
        text: item.answer
      });
    }
  }

  for (const item of catalog.items || []) {
    if (item.estado !== "publicado") continue;

    const phrases = [item.titulo, ...(item.temas || [])];
    const phrase = phraseScore(searchQuestion, phrases);
    const overlap = tokenScore(
      questionTokens,
      `${item.titulo} ${item.descripcion} ${(item.temas || []).join(" ")} ${item.categoria || ""}`
    );
    const score = phrase + overlap;

    if (score > 0) {
      const links = [
        item.url_spotify ? `Spotify: ${item.url_spotify}` : "",
        item.url_youtube ? `YouTube: ${item.url_youtube}` : ""
      ]
        .filter(Boolean)
        .join(" | ");

      candidates.push({
        score,
        type: "contenido",
        id: item.id,
        title: item.titulo,
        text: `${item.descripcion}${links ? `\n${links}` : ""}`
      });
    }
  }

  return candidates
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.type.localeCompare(b.type) ||
        a.title.localeCompare(b.title)
    )
    .slice(0, limit);
}

export function formatKnowledge(items, locale = "es") {
  if (!items.length) {
    return coreText(locale, "local_context_empty");
  }

  return items
    .map(
      (item, index) =>
        `[${index + 1}] ${item.type.toUpperCase()}: ${item.title}\n${item.text}`
    )
    .join("\n\n");
}

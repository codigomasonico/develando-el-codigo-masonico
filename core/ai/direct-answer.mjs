import glossary from "../knowledge/01_GLOSARIO_MASONICO.json" with { type: "json" };
import faq from "../knowledge/faq-base.json" with { type: "json" };
import catalog from "../knowledge/02_CATALOGO_CONTENIDOS.json" with { type: "json" };

const STOP_WORDS = new Set([
  "que", "cual", "cuales", "como", "donde", "cuando", "quien", "quienes",
  "para", "sobre", "tienen", "tiene", "hay", "un", "una", "unos", "unas",
  "el", "la", "los", "las", "de", "del", "en", "y", "o", "es", "son",
  "me", "puedes", "podrias", "quiero", "dime", "explica", "explicame",
  "episodio", "episodios", "contenido"
]);

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulTokens(value) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function overlapScore(query, text) {
  const queryTokens = new Set(meaningfulTokens(query));
  const textTokens = new Set(meaningfulTokens(text));

  let score = 0;
  for (const token of queryTokens) {
    if (textTokens.has(token)) score += 1;
  }

  return score;
}

function isCatalogQuery(question) {
  return /\b(?:episodio|episodios|podcast|escuchar|spotify|youtube|contenido|publicaron|publicado|tienen uno|hay uno)\b/i.test(question);
}

function isExplicitCatalogExistenceQuery(question) {
  return /\b(?:existe|hay|tienen)\b.*?\b(?:episodio|podcast|contenido)\b|\b(?:episodio|podcast)\b.*?\b(?:llamado|titulado|que se llame)\b/i.test(question);
}

function isDefinitionQuery(question) {
  const normalized = normalize(question);

  return /^(?:que (?:es|son|significa|quiere decir)|cual es el significado de|a que se refiere|define|defineme|definicion de|dame la definicion de)\b/.test(normalized);
}

function findCatalog(question, limit = Number(catalog?.rules?.maximum_recommendations) || 3) {
  const normalizedQuestion = normalize(question);
  const maxItems = Math.max(1, Math.min(limit, 3));

  return (catalog.items || [])
    .filter((item) => item.estado === "publicado")
    .map((item) => {
      const combined = `${item.titulo} ${(item.temas || []).join(" ")} ${item.descripcion || ""} ${item.categoria || ""}`;
      let score = overlapScore(question, combined);
      const title = normalize(item.titulo);

      if (title && normalizedQuestion.includes(title)) score += 30;

      for (const topic of item.temas || []) {
        const normalizedTopic = normalize(topic);
        if (normalizedTopic && normalizedQuestion.includes(normalizedTopic)) {
          score += 8;
        }
      }

      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.numero - b.item.numero)
    .slice(0, maxItems)
    .map(({ item }) => item);
}

function formatCatalog(items) {
  if (!items.length) return null;

  if (items.length === 1) {
    const item = items[0];
    const links = [
      item.url_spotify ? `Spotify: ${item.url_spotify}` : "",
      item.url_youtube ? `YouTube: ${item.url_youtube}` : ""
    ]
      .filter(Boolean)
      .join("\n");

    return `Sí. El episodio ${item.numero}, «${item.titulo}», aborda ese tema.\n\n${item.descripcion}${links ? `\n\n${links}` : ""}`;
  }

  const lines = items.map((item) => {
    const url = item.url_spotify || item.url_youtube || "";
    return `• Episodio ${item.numero}: «${item.titulo}»${url ? `\n  ${url}` : ""}`;
  });

  return `Estos episodios son los más relacionados con tu consulta:\n\n${lines.join("\n\n")}`;
}

function compactTerm(value) {
  return normalize(value).replace(/\s+/g, "");
}

function removeLeadingArticle(value) {
  return String(value || "")
    .replace(/^(?:el|la|los|las|un|una|unos|unas)\s+/, "")
    .trim();
}

function extractDefinitionTarget(question) {
  let target = normalize(question);

  target = target
    .replace(
      /^(?:que (?:es|son|significa|quiere decir)|cual es el significado de|a que se refiere|define|defineme|definicion de|dame la definicion de)\s+/,
      ""
    )
    .replace(
      /\s+(?:en|dentro de|para)\s+(?:la\s+)?masoneria(?:\s+mas(?:onica|onico))?.*$/,
      ""
    )
    .trim();

  return removeLeadingArticle(target);
}

function findGlossaryByTarget(target) {
  if (!target) return null;

  const compactTarget = compactTerm(target);
  const candidates = [];

  for (const item of glossary.entries || []) {
    const names = [item.term, ...(item.aliases || [])].filter(Boolean);

    for (const [index, name] of names.entries()) {
      const normalizedName = removeLeadingArticle(normalize(name));
      if (!normalizedName) continue;

      const exactMatch =
        target === normalizedName ||
        compactTarget === compactTerm(normalizedName);

      if (exactMatch) {
        candidates.push({
          item,
          canonical: index === 0,
          matchedLength: normalizedName.length
        });
      }
    }
  }

  candidates.sort(
    (a, b) =>
      Number(b.canonical) - Number(a.canonical) ||
      b.matchedLength - a.matchedLength
  );
  return candidates[0]?.item || null;
}

function findGlossary(question) {
  const target = extractDefinitionTarget(question);
  if (!target) return null;

  const exact = findGlossaryByTarget(target);
  if (exact) return exact;

  const withoutMasonicQualifier = target
    .replace(/\s+mas(?:onica|onico|onicas|onicos)$/, "")
    .trim();

  if (withoutMasonicQualifier !== target) {
    return findGlossaryByTarget(withoutMasonicQualifier);
  }

  return null;
}

function formatGlossary(item) {
  const term = String(item?.term || "").trim();
  const definition = String(item?.definition || "").trim();

  return `En el contexto masónico, «${term}» se emplea con este sentido:\n\n${definition}`;
}

function findFaq(question) {
  const normalizedQuestion = normalize(question);
  const questionTokens = meaningfulTokens(question);

  const ranked = (faq.entries || []).map((item) => {
    const exact = normalizedQuestion === normalize(item.question);
    const score = overlapScore(
      question,
      `${item.question} ${(item.keywords || []).join(" ")}`
    );
    const coverage = questionTokens.length ? score / questionTokens.length : 0;

    return { item, exact, score, coverage };
  });

  ranked.sort(
    (a, b) =>
      Number(b.exact) - Number(a.exact) ||
      b.score - a.score ||
      b.coverage - a.coverage
  );

  const best = ranked[0];

  if (!best) return null;
  if (best.exact) return best.item;
  if (best.score >= 2 && best.coverage >= 0.6) return best.item;
  if (best.score >= 3) return best.item;

  return null;
}

export function resolveDirectAnswer(question) {
  if (isCatalogQuery(question)) {
    const matches = findCatalog(question);

    if (matches.length) {
      return {
        handled: true,
        answer: formatCatalog(matches),
        source: "catalogo",
        confidence: "alta",
        items: matches.map((item) => item.id)
      };
    }

    if (isExplicitCatalogExistenceQuery(question)) {
      return {
        handled: true,
        answer: "No encontré un episodio publicado que coincida con esa consulta.",
        source: "catalogo",
        confidence: "alta",
        items: []
      };
    }
  }

  if (isDefinitionQuery(question)) {
    const term = findGlossary(question);

    if (term) {
      return {
        handled: true,
        answer: formatGlossary(term),
        source: "glosario",
        confidence: "alta",
        items: [term.term]
      };
    }
  }

  const faqItem = findFaq(question);

  if (faqItem) {
    return {
      handled: true,
      answer: faqItem.answer,
      source: "faq",
      confidence: "alta",
      items: [faqItem.question]
    };
  }

  return { handled: false };
}

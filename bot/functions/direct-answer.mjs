import glossary from "../knowledge/01_GLOSARIO_MASONICO.json" with { type: "json" };
import faq from "../knowledge/faq-base.json" with { type: "json" };
import catalog from "../knowledge/02_CATALOGO_CONTENIDOS.json" with { type: "json" };

function normalize(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9ñ\s]/g, " ").replace(/\s+/g, " ").trim();
}

function meaningfulTokens(value) {
  const stop = new Set(["que","cual","cuales","como","donde","cuando","quien","quienes","para","sobre","tienen","tiene","hay","un","una","unos","unas","el","la","los","las","de","del","en","y","o","es","son","me","puedes","podrias","quiero","episodio","episodios","contenido"]);
  return normalize(value).split(" ").filter((t) => t.length > 2 && !stop.has(t));
}

function overlapScore(query, text) {
  const q = meaningfulTokens(query);
  const h = normalize(text);
  return q.reduce((score, token) => score + (h.includes(token) ? 1 : 0), 0);
}

function isCatalogQuery(question) {
  return /\b(?:episodio|episodios|podcast|escuchar|spotify|youtube|contenido|publicaron|publicado|tienen uno|hay uno)\b/i.test(question);
}

function isExplicitCatalogExistenceQuery(question) {
  return /\b(?:existe|hay|tienen)\b.*?\b(?:episodio|podcast|contenido)\b|\b(?:episodio|podcast)\b.*?\b(?:llamado|titulado|que se llame)\b/i.test(question);
}

function isDefinitionQuery(question) {
  return /^(?:que|qué) (?:es|significa|son)\b|\bdefin(?:e|icion|ición)\b/i.test(normalize(question));
}

function findCatalog(question, limit = 4) {
  const qn = normalize(question);
  return (catalog.items || [])
    .filter((item) => item.estado === "publicado")
    .map((item) => {
      const combined = `${item.titulo} ${(item.temas || []).join(" ")} ${item.descripcion || ""} ${item.categoria || ""}`;
      let score = overlapScore(question, combined);
      const title = normalize(item.titulo);
      if (title && qn.includes(title)) score += 20;
      for (const topic of item.temas || []) {
        const nt = normalize(topic);
        if (nt && qn.includes(nt)) score += 6;
      }
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.numero - b.item.numero)
    .slice(0, limit)
    .map(({ item }) => item);
}

function formatCatalog(items) {
  if (!items.length) return null;
  if (items.length === 1) {
    const item = items[0];
    const links = [item.url_spotify ? `Spotify: ${item.url_spotify}` : "", item.url_youtube ? `YouTube: ${item.url_youtube}` : ""].filter(Boolean).join("\n");
    return `Sí. El episodio ${item.numero}, «${item.titulo}», aborda ese tema.\n\n${item.descripcion}${links ? `\n\n${links}` : ""}`;
  }
  const lines = items.map((item) => {
    const url = item.url_spotify || item.url_youtube || "";
    return `• Episodio ${item.numero}: «${item.titulo}»${url ? `\n  ${url}` : ""}`;
  });
  return `Estos episodios son los más relacionados con tu consulta:\n\n${lines.join("\n\n")}`;
}

function findGlossary(question) {
  const qn = normalize(question);
  const candidates = [];

  for (const item of glossary.entries || []) {
    const names = [item.term, ...(item.aliases || [])].filter(Boolean);
    let score = 0;
    let matchedLength = 0;

    for (const name of names) {
      const nn = normalize(name);
      if (!nn) continue;
      const exactPhrase = qn === nn || qn.includes(` ${nn} `) || qn.startsWith(`${nn} `) || qn.endsWith(` ${nn}`);
      if (exactPhrase) {
        const localScore = 100 + nn.split(" ").length * 10 + nn.length;
        if (localScore > score) {
          score = localScore;
          matchedLength = nn.length;
        }
      } else {
        const localScore = overlapScore(question, nn);
        if (localScore > score) {
          score = localScore;
          matchedLength = nn.length;
        }
      }
    }
    if (score > 0) candidates.push({ item, score, matchedLength });
  }

  candidates.sort((a, b) => b.score - a.score || b.matchedLength - a.matchedLength);
  return candidates[0] && candidates[0].score >= 3 ? candidates[0].item : null;
}
function formatGlossary(item) {
  const term = String(item.term || "").trim();
  const lowerTerm = term ? term.charAt(0).toLowerCase() + term.slice(1) : "concepto";
  const notes = Array.isArray(item.editorial_notes) && item.editorial_notes.length
    ? `\n\nUna precisión importante: ${item.editorial_notes[0].replace(/^./, (c) => c.toLowerCase())}`
    : "";
  return `En Masonería, ${articleFor(term)} ${lowerTerm} es ${lowerFirst(item.definition)}${notes}`;
}

function articleFor(term) {
  const feminine = /(?:ción|dad|ía|ura|ez|ie)$/i.test(term) || /^(Masonería|Logia|Obediencia|Jurisdicción|Regularidad|Ceremonia|Escuadra|Cámara)/i.test(term);
  return feminine ? "la" : "el";
}

function lowerFirst(value) {
  const text = String(value || "").trim();
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : "";
}

function findFaq(question) {
  const ranked = (faq.entries || []).map((item) => ({ item, score: overlapScore(question, `${item.question} ${(item.keywords || []).join(" ")}`) }))
    .sort((a,b) => b.score - a.score);
  return ranked[0]?.score >= 3 ? ranked[0].item : null;
}

export function resolveDirectAnswer(question) {
  if (isCatalogQuery(question)) {
    const matches = findCatalog(question);
    if (matches.length) return { handled: true, answer: formatCatalog(matches), source: "catalogo", confidence: "alta", items: matches.map((x) => x.id) };
    if (isExplicitCatalogExistenceQuery(question)) {
      return {
        handled: true,
        answer: "No. Ese título no aparece entre los episodios publicados de Develando el Código Masónico.",
        source: "catalogo",
        confidence: "alta",
        items: []
      };
    }
  }

  if (isDefinitionQuery(question)) {
    const term = findGlossary(question);
    if (term) return { handled: true, answer: formatGlossary(term), source: "glosario", confidence: "alta", items: [term.term] };
  }

  const faqItem = findFaq(question);
  if (faqItem) return { handled: true, answer: faqItem.answer, source: "faq", confidence: "alta", items: [faqItem.question] };

  return { handled: false };
}

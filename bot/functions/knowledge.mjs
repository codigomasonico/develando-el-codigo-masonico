import glossary from "../knowledge/01_GLOSARIO_MASONICO.json" with { type: "json" };
import faq from "../knowledge/faq-base.json" with { type: "json" };
import catalog from "../knowledge/02_CATALOGO_CONTENIDOS.json" with { type: "json" };

function normalize(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function tokens(value) {
  return normalize(value).split(/[^a-z0-9ñ]+/).filter((token) => token.length > 3);
}
function score(questionTokens, text) {
  const haystack = normalize(text);
  return questionTokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
}

export function retrieveLocalKnowledge(question, limit = 6) {
  const qTokens = tokens(question);
  const candidates = [];
  for (const item of glossary.entries || []) {
    const value = score(qTokens, `${item.term} ${item.definition} ${(item.aliases || []).join(" ")} ${(item.editorial_notes || []).join(" ")}`);
    if (value) candidates.push({ score: value + 3, type: "glosario", id: item.term, title: item.term, text: item.definition });
  }
  for (const item of faq.entries || []) {
    const value = score(qTokens, `${item.question} ${item.answer} ${(item.keywords || []).join(" ")}`);
    if (value) candidates.push({ score: value + 2, type: "faq", id: item.question, title: item.question, text: item.answer });
  }
  for (const item of catalog.items || []) {
    if (item.estado !== "publicado") continue;
    let value = score(qTokens, `${item.titulo} ${item.descripcion} ${(item.temas || []).join(" ")} ${item.categoria || ""}`);
    for (const topic of item.temas || []) if (normalize(question).includes(normalize(topic))) value += 4;
    if (value) {
      const links = [item.url_spotify ? `Spotify: ${item.url_spotify}` : "", item.url_youtube ? `YouTube: ${item.url_youtube}` : ""].filter(Boolean).join(" | ");
      candidates.push({ score: value, type: "contenido", id: item.id, title: item.titulo, text: `${item.descripcion}${links ? `\n${links}` : ""}` });
    }
  }
  return candidates.sort((a,b) => b.score - a.score).slice(0, limit);
}

export function formatKnowledge(items) {
  if (!items.length) return "No se recuperó contexto documental local específico para esta pregunta.";
  return items.map((item, index) => `[${index + 1}] ${item.type.toUpperCase()}: ${item.title}\n${item.text}`).join("\n\n");
}

const CARTES_API_URL =
  process.env.CARTES_API_URL ||
  "https://develandoelcodigomasonico.com/.netlify/functions/guia-masonico";

const CARTES_TIMEOUT_MS = 35000;

/**
 * Cliente del cerebro central de Cartes.
 *
 * Este módulo es deliberadamente independiente de WhatsApp/Meta. Su única
 * responsabilidad es traducir una consulta normalizada al contrato HTTP del
 * Cartes Core y devolver la respuesta textual.
 *
 * Mantiene compatibilidad con el endpoint actual mientras CORE-001 evoluciona
 * hacia un contrato multicanal versionado.
 */
export async function consultarCartesCore({
  pregunta,
  history = [],
  channel = "whatsapp",
  externalUserId = null,
  userId = null,
  requestId = null,
  fetchImpl = fetch
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CARTES_TIMEOUT_MS);

  try {
    const response = await fetchImpl(CARTES_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: String(pregunta || ""),
        history: Array.isArray(history) ? history : [],
        client: {
          channel,
          external_user_id: externalUserId,
          user_id: userId,
          request_id: requestId
        }
      })
    });

    const rawResponse = await response.text();
    let data;

    try {
      data = rawResponse ? JSON.parse(rawResponse) : {};
    } catch {
      throw new Error(
        `Cartes devolvió una respuesta no JSON: ${limitarTexto(rawResponse, 300)}`
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.error || `Cartes respondió con HTTP ${response.status}.`
      );
    }

    const answer = String(data?.answer || "").trim();

    if (!answer) {
      throw new Error("Cartes devolvió una respuesta vacía.");
    }

    return {
      answer,
      meta: data?.meta || {}
    };
  } finally {
    clearTimeout(timeout);
  }
}

function limitarTexto(valor, maximo) {
  const texto = String(valor || "");
  return texto.length <= maximo ? texto : `${texto.slice(0, maximo)}…`;
}

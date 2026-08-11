import guiaMasonico from "../../../core/ai/guia-masonico.mjs";

const CARTES_TIMEOUT_MS = 35000;

/**
 * Cliente del cerebro central de Cartes.
 *
 * Web y WhatsApp usan el mismo handler de guia-masonico.
 * En runtime de WhatsApp se invoca directamente en proceso para evitar
 * un salto HTTP y configuraciones divergentes de CARTES_API_URL.
 *
 * fetchImpl se conserva únicamente como punto de inyección para pruebas.
 */
export async function consultarCartesCore({
  pregunta,
  history = [],
  channel = "whatsapp",
  externalUserId = null,
  userId = null,
  requestId = null,
  fetchImpl = null
}) {
  const payload = {
    question: String(pregunta || ""),
    history: Array.isArray(history) ? history : [],
    client: {
      channel,
      external_user_id: externalUserId,
      user_id: userId,
      request_id: requestId
    }
  };

  let response;

  if (typeof fetchImpl === "function") {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CARTES_TIMEOUT_MS);

    try {
      response = await fetchImpl("https://cartes.internal/.netlify/functions/guia-masonico", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
    } finally {
      clearTimeout(timeout);
    }
  } else {
    const request = new Request(
      "https://cartes.internal/.netlify/functions/guia-masonico",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    response = await guiaMasonico(request);
  }

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
}

function limitarTexto(valor, maximo) {
  const texto = String(valor || "");
  return texto.length <= maximo ? texto : `${texto.slice(0, maximo)}…`;
}

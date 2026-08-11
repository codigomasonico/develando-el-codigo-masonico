import cartesCore from "./cartes-core.mjs";
import {
  completarConsultaMensual,
  liberarConsultaMensual,
  mensajesDeConversacion,
  obtenerConversacionUsuario,
  obtenerPlanUsuario,
  registrarIntercambioConversacion,
  reservarConsultaMensual,
  resolverOCrearUsuarioPorIdentidad
} from "./lib-cartes-account.mjs";

// Adaptador HTTP público de Cartes.
// Web reserva y consume aquí contra la cuenta central. WhatsApp mantiene su
// reserva en su adaptador y utiliza este mismo endpoint únicamente como cerebro.
// CORE-006: ambos canales cargan y guardan contexto por user_id.
export default async (request) => {
  if (request.method === "OPTIONS") return cartesCore(request);
  if (request.method !== "POST") return cartesCore(request);

  let body;
  try {
    body = await request.clone().json();
  } catch {
    return cartesCore(request);
  }

  const client = body?.client || {};
  const channel = String(client.channel || "").toLowerCase();
  const requestId = String(client.request_id || "").trim();
  let userId = String(client.user_id || "").trim();
  let reserva = null;

  if (channel === "web") {
    const externalUserId = String(client.external_user_id || "").trim();
    if (!externalUserId || !requestId) {
      return json({ error: "La sesión Web de Cartes no contiene una identidad válida." }, 400);
    }

    const identidad = await resolverOCrearUsuarioPorIdentidad({ tipo: "web", valor: externalUserId });
    userId = identidad.user_id;
    const plan = await obtenerPlanUsuario({ userId });
    reserva = await reservarConsultaMensual({ userId, plan, requestId, channel: "web" });

    if (reserva.duplicada) return json({ error: "La consulta ya fue recibida.", code: "duplicate_request", usage: reserva }, 409);
    if (!reserva.permitida) return json({ error: mensajeLimite(reserva.plan), code: "usage_limit", usage: reserva }, 429);
  }

  let sharedHistory = [];
  if (esUserIdValido(userId)) {
    try {
      sharedHistory = mensajesDeConversacion(await obtenerConversacionUsuario({ userId }));
    } catch (error) {
      console.error("No se pudo cargar la memoria de Cartes.", error);
    }
  }

  // Si aún no existe memoria central, aceptamos el historial del cliente como
  // migración suave. Una vez que hay memoria central, ésta es la fuente única.
  const history = sharedHistory.length ? sharedHistory : (Array.isArray(body?.history) ? body.history : []);
  const requestCore = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({
      ...body,
      history,
      client: { ...client, user_id: esUserIdValido(userId) ? userId : null, request_id: requestId || null }
    })
  });

  try {
    const response = await cartesCore(requestCore);
    if (!response.ok) {
      if (reserva) await liberarConsultaMensual({ userId, periodo: reserva.periodo, requestId });
      return response;
    }

    if (reserva) await completarConsultaMensual({ userId, periodo: reserva.periodo, requestId });

    if (esUserIdValido(userId)) {
      try {
        const data = await response.clone().json();
        const answer = String(data?.answer || "").trim();
        const question = String(body?.question || "").trim();
        if (question && answer) {
          await registrarIntercambioConversacion({ userId, question, answer, channel: channel || "unknown", requestId: requestId || null });
        }
      } catch (error) {
        console.error("No se pudo guardar la memoria de Cartes.", error);
      }
    }

    return reserva ? await agregarUsoRespuesta(response, reserva) : response;
  } catch (error) {
    if (reserva) {
      try { await liberarConsultaMensual({ userId, periodo: reserva.periodo, requestId }); }
      catch (releaseError) { console.error("No se pudo liberar la consulta Web fallida", releaseError); }
    }
    throw error;
  }
};

function esUserIdValido(value) { return /^usr_[a-f0-9]{32}$/.test(String(value || "")); }
function mensajeLimite(plan) {
  return plan === "plus"
    ? "Ya utilizaste las 50 consultas incluidas en Cartes Plus durante este periodo."
    : "Ya utilizaste las 5 consultas gratuitas disponibles en este periodo.";
}
async function agregarUsoRespuesta(response, usage) {
  let data;
  try { data = await response.clone().json(); } catch { return response; }
  return json({ ...data, usage }, response.status);
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" }
  });
}

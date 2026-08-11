import crypto from "node:crypto";
import {
  completarConsultaMensual,
  liberarConsultaMensual,
  obtenerEstadoUsoMensual,
  reservarConsultaMensual,
  resolverOCrearUsuarioPorIdentidad,
  sincronizarPlanUsuario,
  completarVinculacionConWhatsApp,
  sincronizarSuscripcionUsuario,
  obtenerSuscripcionUsuario
} from "./lib-cartes-account.mjs";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export default async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers() });
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const raw = await request.text();
  if (!verificarFirmaInterna(request, raw)) return json({ error: "Solicitud interna no autorizada." }, 401);

  let body;
  try { body = JSON.parse(raw || "{}"); } catch { return json({ error: "JSON inválido." }, 400); }

  try {
    const action = String(body?.action || "");
    if (action === "resolve") return json(await resolverOCrearUsuarioPorIdentidad({ tipo: body.identity_type, valor: body.identity_value }));
    if (action === "sync_plan") return json(await sincronizarPlanUsuario({ userId: body.user_id, plan: body.plan, source: body.source || "whatsapp" }));
    if (action === "state") return json(await obtenerEstadoUsoMensual({ userId: body.user_id, plan: body.plan || null }));
    if (action === "reserve") return json(await reservarConsultaMensual({ userId: body.user_id, plan: body.plan || null, requestId: body.request_id, channel: body.channel || "whatsapp" }));
    if (action === "complete") return json({ updated: await completarConsultaMensual({ userId: body.user_id, periodo: body.periodo, requestId: body.request_id }) });
    if (action === "release") return json({ updated: await liberarConsultaMensual({ userId: body.user_id, periodo: body.periodo, requestId: body.request_id }) });
    if (action === "link_complete") return json(await completarVinculacionConWhatsApp({ code: body.code, whatsappUserId: body.user_id }));
    if (action === "subscription_sync") return json(await sincronizarSuscripcionUsuario({ userId: body.user_id, subscription: body.subscription, source: body.source || "mercadopago" }));
    if (action === "subscription_get") return json({ subscription: await obtenerSuscripcionUsuario({ userId: body.user_id }) });
    return json({ error: "Acción no soportada." }, 400);
  } catch (error) {
    console.error("Cartes account error", error);
    return json({ error: error instanceof Error ? error.message : "Error interno de cuenta." }, 500);
  }
};

function verificarFirmaInterna(request, raw) {
  const secret = process.env.CARTES_INTERNAL_SECRET || "";
  if (!secret) return false;
  const timestamp = request.headers.get("x-cartes-timestamp") || "";
  const signature = request.headers.get("x-cartes-signature") || "";
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_CLOCK_SKEW_MS) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function headers() { return { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-Cartes-Timestamp, X-Cartes-Signature", "Access-Control-Allow-Methods": "POST, OPTIONS" }; }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: headers() }); }

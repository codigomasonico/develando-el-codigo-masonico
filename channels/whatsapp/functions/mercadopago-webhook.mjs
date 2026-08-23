import { CARTES_PLUS_PRICE_MXN } from "../../../core/ai/config.mjs";
import { obtenerSuscripcionUsuario, sincronizarSuscripcionUsuario } from "../../../core/ai/lib-cartes-account.mjs";
import { getMercadoPagoSubscription, normalizeMercadoPagoSubscription, verifyMercadoPagoWebhook } from "./lib-mercadopago.mjs";
import { getPaymentContext, savePaymentContext } from "./lib-state.mjs";
import { sendWhatsAppTextParts } from "./lib-meta.mjs";

const realDeps = {
  obtenerSuscripcionUsuario,
  sincronizarSuscripcionUsuario,
  getMercadoPagoSubscription,
  normalizeMercadoPagoSubscription,
  verifyMercadoPagoWebhook,
  getPaymentContext,
  savePaymentContext,
  sendWhatsAppTextParts
};

export function createMercadoPagoWebhookHandler(overrides = {}) {
  const d = { ...realDeps, ...overrides };
  return async function handler(request) {
    if (request.method !== "POST") return new Response("Método no permitido", { status: 405 });
    const raw = await request.text();
    let payload;
    try { payload = raw ? JSON.parse(raw) : {}; }
    catch { return Response.json({ recibido: false, error: "JSON inválido" }, { status: 400 }); }

    const url = new URL(request.url);
    const dataId = String(payload?.data?.id || url.searchParams.get("data.id") || "").trim();
    const type = String(payload?.type || payload?.topic || "").trim();

    if (!d.verifyMercadoPagoWebhook({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId
    })) {
      return Response.json({ recibido: false, error: "Firma inválida" }, { status: 401 });
    }

    if (!dataId) return Response.json({ recibido: true, ignorado: true, motivo: "sin data.id" });
    if (type !== "subscription_preapproval") return Response.json({ recibido: true, ignorado: true, tipo: type });

    const remote = await d.getMercadoPagoSubscription(dataId);
    const planId = String(remote?.preapproval_plan_id || "").trim();
    const context = planId ? await d.getPaymentContext("mercadopago-plan", planId) : null;
    const userId = String(context?.user_id || "").trim();

    if (!/^usr_[a-f0-9]{32}$/.test(userId)) {
      return Response.json({ recibido: false, error: "No se encontró user_id para la suscripción de Mercado Pago." }, { status: 422 });
    }

    const existing = await d.obtenerSuscripcionUsuario({ userId });
    const subscription = d.normalizeMercadoPagoSubscription(remote, existing);
    const synced = await d.sincronizarSuscripcionUsuario({
      userId,
      subscription,
      source: "mercadopago:production"
    });

    await d.savePaymentContext("mercadopago-subscription", dataId, {
      ...(context || {}),
      user_id: userId
    });

    if (subscription.status === "authorized" && context?.phone) {
      await d.sendWhatsAppTextParts({
        to: context.phone,
        phoneNumberId: context.phone_number_id,
        text: `¡Bienvenido a Cartes Plus! Tu suscripción de $${CARTES_PLUS_PRICE_MXN} MXN al mes ya está activa. Tus beneficios se comparten entre Web y WhatsApp.`
      }).catch((e) => console.error("MP_WA_NOTIFY_ERROR", e));
    }

    console.log("MP_V2_SYNC_OK", JSON.stringify({
      preapproval_id: dataId,
      user_id: userId,
      plan: synced.plan,
      status: subscription.status
    }));

    return Response.json({
      recibido: true,
      user_id: userId,
      plan: synced.plan,
      status: subscription.status
    });
  };
}

export default createMercadoPagoWebhookHandler();

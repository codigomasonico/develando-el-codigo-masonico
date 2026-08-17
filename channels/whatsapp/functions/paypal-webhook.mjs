import { obtenerSuscripcionUsuario, sincronizarSuscripcionUsuario } from "../../../core/ai/lib-cartes-account.mjs";
import { getPayPalSubscription, normalizePayPalSubscription, verifyPayPalWebhook } from "./lib-paypal.mjs";
import { getPaymentContext } from "./lib-state.mjs";
import { sendWhatsAppTextParts } from "./lib-meta.mjs";

const RELEVANT = new Set([
  "BILLING.SUBSCRIPTION.CREATED",
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.UPDATED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED"
]);

const realDeps = {
  obtenerSuscripcionUsuario,
  sincronizarSuscripcionUsuario,
  getPayPalSubscription,
  normalizePayPalSubscription,
  verifyPayPalWebhook,
  getPaymentContext,
  sendWhatsAppTextParts,
  env: process.env
};

export function createPayPalWebhookHandler(overrides = {}) {
  const d = { ...realDeps, ...overrides };
  return async function handler(request) {
    if (request.method !== "POST") return new Response("Método no permitido", { status: 405 });
    const raw = await request.text();
    let event;
    try { event = raw ? JSON.parse(raw) : {}; }
    catch { return Response.json({ recibido: false, error: "JSON inválido" }, { status: 400 }); }

    if (!(await d.verifyPayPalWebhook(request, event))) {
      return Response.json({ recibido: false, error: "Firma inválida" }, { status: 401 });
    }

    const eventType = String(event?.event_type || "");
    if (!RELEVANT.has(eventType)) {
      return Response.json({ recibido: true, ignorado: true, event_type: eventType });
    }

    const subscriptionId = String(event?.resource?.id || "").trim();
    if (!subscriptionId) return Response.json({ recibido: true, ignorado: true, motivo: "sin subscription id" });

    const remote = await d.getPayPalSubscription(subscriptionId).catch(() => event?.resource || {});
    const userId = String(remote?.custom_id || event?.resource?.custom_id || "").trim();

    if (!/^usr_[a-f0-9]{32}$/.test(userId)) {
      return Response.json({ recibido: false, error: "PayPal no contiene user_id Cartes válido." }, { status: 422 });
    }

    const existing = await d.obtenerSuscripcionUsuario({ userId });
    const subscription = d.normalizePayPalSubscription(remote, existing);

    // CARTES_PAYPAL_PENDING_V112
    // CREATED/UPDATED pendientes todavía no representan
    // una suscripción Cartes Plus aprobada.
    if (
      [
        "BILLING.SUBSCRIPTION.CREATED",
        "BILLING.SUBSCRIPTION.UPDATED"
      ].includes(eventType) &&
      String(subscription?.status || "").toLowerCase() === "pending"
    ) {
      return Response.json({
        recibido: true,
        ignorado: true,
        event_type: eventType,
        subscription_id: subscriptionId,
        user_id: userId,
        status: "pending",
        motivo: "Suscripción PayPal pendiente de aprobación."
      });
    }

    const env = d.env || process.env;
    const synced = await d.sincronizarSuscripcionUsuario({
      userId,
      subscription,
      source: `paypal:${env.PAYPAL_ENVIRONMENT || "sandbox"}`
    });

    const context = await d.getPaymentContext("paypal-subscription", subscriptionId);
    if (subscription.status === "authorized" && context?.phone) {
      await d.sendWhatsAppTextParts({
        to: context.phone,
        phoneNumberId: context.phone_number_id,
        text: "¡Bienvenido a Cartes Plus! Tu suscripción de $149 MXN al mes ya está activa. Tus beneficios se comparten entre Web y WhatsApp."
      }).catch((e) => console.error("PAYPAL_WA_NOTIFY_ERROR", e));
    }

    console.log("PAYPAL_V2_SYNC_OK", JSON.stringify({
      subscription_id: subscriptionId,
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

export default createPayPalWebhookHandler();

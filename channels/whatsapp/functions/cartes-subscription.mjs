import {
  obtenerSuscripcionUsuario,
  resolverOCrearUsuarioPorIdentidad,
  sincronizarSuscripcionUsuario
} from "../../../core/ai/lib-cartes-account.mjs";
import { createCheckoutForCartes } from "./lib-cartes-checkout.mjs";
import {
  cancelMercadoPagoSubscription,
  normalizeMercadoPagoSubscription
} from "./lib-mercadopago.mjs";
import {
  cancelPayPalSubscription,
  getPayPalSubscription,
  normalizePayPalSubscription
} from "./lib-paypal.mjs";

const realDeps = {
  obtenerSuscripcionUsuario,
  resolverOCrearUsuarioPorIdentidad,
  sincronizarSuscripcionUsuario,
  createCheckoutForCartes,
  cancelMercadoPagoSubscription,
  normalizeMercadoPagoSubscription,
  cancelPayPalSubscription,
  getPayPalSubscription,
  normalizePayPalSubscription
};

export function createCartesSubscriptionHandler(overrides = {}) {
  const d = { ...realDeps, ...overrides };

  return async function handler(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "Método no permitido." }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "JSON inválido." }, 400);
    }

    const action = String(body?.action || "").trim().toLowerCase();

    if (!["checkout", "cancel"].includes(action)) {
      return json({ ok: false, error: "Acción no soportada." }, 400);
    }

    const webIdentity = String(body?.web_identity || "").trim();

    if (!/^web_[A-Za-z0-9_-]{8,180}$/.test(webIdentity)) {
      return json({ ok: false, error: "Identidad Web inválida." }, 400);
    }

    try {
      const identity = await d.resolverOCrearUsuarioPorIdentidad({
        tipo: "web",
        valor: webIdentity
      });

      const userId = String(identity?.user_id || "").trim();

      if (!/^usr_[a-f0-9]{32}$/.test(userId)) {
        throw new Error("No fue posible resolver la cuenta Cartes.");
      }

      if (action === "checkout") {
        if (body?.accepted_terms !== true) {
          return json({
            ok: false,
            error: "Debes aceptar los Términos y el Aviso de privacidad antes de continuar."
          }, 400);
        }

        const checkout = await d.createCheckoutForCartes({
          provider: body?.provider,
          userId
        });

        return json({
          ok: true,
          provider: checkout.provider,
          url: checkout.url
        }, 200);
      }

      const existing = await d.obtenerSuscripcionUsuario({ userId });

      if (!existing) {
        return json({
          ok: false,
          error: "No encontré una suscripción recurrente asociada a tu cuenta."
        }, 404);
      }

      if (existing.renovacion_cancelada) {
        return json({
          ok: true,
          already_cancelled: true,
          plan: existing.plan_actual || "gratuito",
          subscription: publicSubscription(existing)
        }, 200);
      }

      let updated;

      if (existing.provider === "paypal" && existing.subscription_id) {
        await d.cancelPayPalSubscription(existing.subscription_id);

        const remote = await d.getPayPalSubscription(existing.subscription_id)
          .catch(() => ({ ...existing, status: "CANCELLED" }));

        updated = d.normalizePayPalSubscription(remote, existing);
      }
      else if (existing.provider === "mercadopago" && existing.preapproval_id) {
        const remote = await d.cancelMercadoPagoSubscription(existing.preapproval_id);
        updated = d.normalizeMercadoPagoSubscription(remote, existing);
      }
      else {
        return json({
          ok: false,
          error: "No encontré una suscripción cancelable de Mercado Pago o PayPal."
        }, 400);
      }

      const synced = await d.sincronizarSuscripcionUsuario({
        userId,
        subscription: updated,
        source: `web-cancel:${updated.provider}`
      });

      return json({
        ok: true,
        cancelled: true,
        plan: synced.plan,
        subscription: publicSubscription(synced.subscription)
      }, 200);

    } catch (error) {
      console.error("CARTES_SUBSCRIPTION_V049_ERROR", JSON.stringify({
        action,
        error: error instanceof Error ? error.message : String(error)
      }));

      return json({
        ok: false,
        error: error instanceof Error
          ? error.message
          : "No fue posible procesar la suscripción."
      }, 502);
    }
  };
}

export default createCartesSubscriptionHandler();

function publicSubscription(subscription) {
  return {
    provider: subscription?.provider || null,
    status: subscription?.status || null,
    renovacion_cancelada: Boolean(subscription?.renovacion_cancelada),
    access_until: subscription?.access_until || null,
    next_payment_date: subscription?.next_payment_date || null
  };
}

function json(body, status) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
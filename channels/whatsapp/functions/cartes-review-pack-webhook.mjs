import {
  obtenerEstadoRevisionesCartes
} from "../../../core/ai/cartes-document-review.mjs";

import {
  registrarPaqueteRevisionPagado
} from "../../../core/ai/lib-cartes-review-packs.mjs";

import {
  getMercadoPagoReviewPackPayment
} from "./lib-cartes-review-pack-payments.mjs";

import {
  verifyMercadoPagoWebhook
} from "./lib-mercadopago.mjs";

import {
  getPaymentContext
} from "./lib-state.mjs";

import {
  sendWhatsAppTextParts
} from "./lib-meta.mjs";

const realDeps = {
  obtenerEstadoRevisionesCartes,
  registrarPaqueteRevisionPagado,
  getMercadoPagoReviewPackPayment,
  verifyMercadoPagoWebhook,
  getPaymentContext,
  sendWhatsAppTextParts
};

export function createReviewPackWebhookHandler(overrides = {}) {
  const d = { ...realDeps, ...overrides };

  return async function handler(request) {
    if (request.method !== "POST") {
      return new Response("Método no permitido", { status: 405 });
    }

    let payload;

    try {
      payload = await request.json();
    }
    catch {
      return Response.json(
        { recibido: false, error: "JSON inválido" },
        { status: 400 }
      );
    }

    const url = new URL(request.url);

    const dataId = String(
      payload?.data?.id ||
      url.searchParams.get("data.id") ||
      ""
    ).trim();

    const type = String(
      payload?.type ||
      payload?.topic ||
      ""
    ).trim().toLowerCase();

    if (
      !d.verifyMercadoPagoWebhook({
        xSignature: request.headers.get("x-signature"),
        xRequestId: request.headers.get("x-request-id"),
        dataId
      })
    ) {
      return Response.json(
        { recibido: false, error: "Firma inválida" },
        { status: 401 }
      );
    }

    if (type !== "payment" || !dataId) {
      return Response.json({
        recibido: true,
        ignorado: true,
        tipo: type
      });
    }

    const payment =
      await d.getMercadoPagoReviewPackPayment(dataId);

    if (String(payment?.status || "").toLowerCase() !== "approved") {
      return Response.json({
        recibido: true,
        ignorado: true,
        status: payment?.status || null
      });
    }

    const amount = Number(payment?.transaction_amount);
    const currency = String(payment?.currency_id || "").toUpperCase();

    if (
      !Number.isFinite(amount) ||
      Math.abs(amount - 99) > 0.001 ||
      currency !== "MXN"
    ) {
      return Response.json(
        { recibido: false, error: "El importe no corresponde al paquete." },
        { status: 422 }
      );
    }

    const reference = String(payment?.external_reference || "").trim();

    const context =
      reference
        ? await d.getPaymentContext(
            "mercadopago-review-pack",
            reference
          )
        : null;

    if (!context || context?.product !== "cartes_review_pack_3") {
      return Response.json({
        recibido: true,
        ignorado: true,
        motivo: "pago ajeno a paquetes Cartes"
      });
    }

    const registered =
      await d.registrarPaqueteRevisionPagado({
        userId: context.user_id,
        provider: "mercadopago",
        paymentId: String(payment?.id || dataId),
        expiresAt: context.expires_at,
        amount,
        currency
      });

    const reviews =
      await d.obtenerEstadoRevisionesCartes({
        userId: registered.user_id || context.user_id
      });

    if (!registered.duplicado && context?.phone) {
      await d.sendWhatsAppTextParts({
        to: context.phone,
        phoneNumberId: context.phone_number_id,
        text:
          `¡Listo! Se agregaron 3 revisiones adicionales a tu cuenta Cartes.\n\n*Revisiones disponibles:* ${reviews.disponibles}\n*Paquetes adicionales:* ${reviews.paquetes_comprados} de ${reviews.paquetes_maximo}`
      }).catch(() => {});
    }

    return Response.json({
      recibido: true,
      duplicated: Boolean(registered.duplicado),
      reviews
    });
  };
}

export default createReviewPackWebhookHandler();
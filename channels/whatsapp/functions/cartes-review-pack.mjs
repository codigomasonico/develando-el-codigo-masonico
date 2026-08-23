import { CARTES_REVIEW_PACK_PRICE_MXN, CARTES_REVIEW_PACK_SIZE } from "../../../core/ai/config.mjs";
import {
  obtenerPlanUsuario,
  obtenerSuscripcionUsuario,
  resolverOCrearUsuarioPorIdentidad
} from "../../../core/ai/lib-cartes-account.mjs";

import {
  obtenerEstadoRevisionesCartes
} from "../../../core/ai/cartes-document-review.mjs";

import {
  registrarPaqueteRevisionPagado,
  resolverVencimientoPaqueteRevision
} from "../../../core/ai/lib-cartes-review-packs.mjs";

import {
  createReviewPackCheckout
} from "./lib-cartes-review-pack-checkout.mjs";

import {
  capturePayPalReviewPackOrder,
  getMercadoPagoReviewPackPayment,
  getPayPalReviewPackOrder
} from "./lib-cartes-review-pack-payments.mjs";

import { getPaymentContext } from "./lib-state.mjs";
import { sendWhatsAppTextParts } from "./lib-meta.mjs";

const realDeps = {
  obtenerPlanUsuario,
  obtenerSuscripcionUsuario,
  resolverOCrearUsuarioPorIdentidad,
  obtenerEstadoRevisionesCartes,
  registrarPaqueteRevisionPagado,
  resolverVencimientoPaqueteRevision,
  createReviewPackCheckout,
  getMercadoPagoReviewPackPayment,
  getPayPalReviewPackOrder,
  capturePayPalReviewPackOrder,
  getPaymentContext,
  sendWhatsAppTextParts
};

export function createCartesReviewPackHandler(overrides = {}) {
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
    }
    catch {
      return json({ ok: false, error: "JSON inválido." }, 400);
    }

    const action = String(body?.action || "").trim().toLowerCase();

    try {
      if (action === "paypal_complete") {
        return completarPayPal(body, d);
      }

      if (action === "mercadopago_complete") {
        return completarMercadoPago(body, d);
      }

      if (!["checkout", "status"].includes(action)) {
        return json({ ok: false, error: "Acción no soportada." }, 400);
      }

      const webIdentity = String(body?.web_identity || "").trim();

      if (!/^web_[A-Za-z0-9_-]{8,180}$/.test(webIdentity)) {
        return json({ ok: false, error: "Identidad Web inválida." }, 400);
      }

      const identity =
        await d.resolverOCrearUsuarioPorIdentidad({
          tipo: "web",
          valor: webIdentity
        });

      const userId = String(identity?.user_id || "").trim();

      if (!/^usr_[a-f0-9]{32}$/.test(userId)) {
        throw new Error("No fue posible resolver la cuenta Cartes.");
      }

      const subscription =
        await d.obtenerSuscripcionUsuario({ userId });

      const storedPlan =
        await d.obtenerPlanUsuario({ userId });

      const plan = String(
        subscription?.plan_actual ||
        storedPlan ||
        "gratuito"
      ).toLowerCase();

      const reviews =
        await d.obtenerEstadoRevisionesCartes({ userId });

      if (action === "status") {
        return json({ ok: true, plan, reviews }, 200);
      }

      if (plan !== "plus") {
        return json(
          {
            ok: false,
            code: "plus_required",
            error:
              "Los paquetes adicionales están disponibles únicamente para Cartes Plus vigente."
          },
          403
        );
      }

      if (
        Number(reviews?.paquetes_comprados || 0) >=
        Number(reviews?.paquetes_maximo || 2)
      ) {
        return json(
          {
            ok: false,
            code: "pack_limit",
            error:
              "Ya compraste los 2 paquetes adicionales permitidos durante este periodo de Cartes Plus."
          },
          409
        );
      }

      const expiresAt =
        d.resolverVencimientoPaqueteRevision(subscription);

      if (!expiresAt) {
        return json(
          {
            ok: false,
            code: "period_unavailable",
            error:
              "No fue posible determinar la fecha de vencimiento del periodo Plus vigente."
          },
          409
        );
      }

      const checkout =
        await d.createReviewPackCheckout({
          provider: body?.provider,
          userId,
          expiresAt
        });

      return json(
        {
          ok: true,
          provider: checkout.provider,
          url: checkout.url,
          expires_at: expiresAt,
          reviews
        },
        200
      );
    }
    catch (error) {
      console.error(
        "CARTES_REVIEW_PACK_V091_ERROR",
        JSON.stringify({
          action,
          error:
            error instanceof Error
              ? error.message
              : String(error)
        })
      );

      return json(
        {
          ok: false,
          code: error?.code || null,
          error:
            error instanceof Error
              ? error.message
              : "No fue posible procesar el paquete adicional."
        },
        502
      );
    }
  };
}

async function completarMercadoPago(body, d) {
  const paymentId = String(body?.payment_id || "").trim();

  if (!paymentId) {
    return json({ ok: false, error: "Falta payment_id de Mercado Pago." }, 400);
  }

  const payment =
    await d.getMercadoPagoReviewPackPayment(paymentId);

  if (String(payment?.status || "").toLowerCase() !== "approved") {
    return json(
      {
        ok: false,
        code: "payment_not_approved",
        error:
          "Mercado Pago todavía no confirma el pago como aprobado."
      },
      409
    );
  }

  validarImporteMercadoPago(payment);

  const reference = String(payment?.external_reference || "").trim();

  const context =
    reference
      ? await d.getPaymentContext(
          "mercadopago-review-pack",
          reference
        )
      : null;

  if (!context || context?.product !== "cartes_review_pack_3") {
    return json(
      {
        ok: false,
        error:
          "No se encontró el contexto del paquete de Mercado Pago."
      },
      422
    );
  }

  const result =
    await d.registrarPaqueteRevisionPagado({
      userId: context.user_id,
      provider: "mercadopago",
      paymentId: String(payment?.id || paymentId),
      expiresAt: context.expires_at,
      amount: Number(payment?.transaction_amount),
      currency: payment?.currency_id
    });

  const reviews =
    await d.obtenerEstadoRevisionesCartes({
      userId: result.user_id || context.user_id
    });

  await notificarCompra(
    { context, reviews, duplicated: result.duplicado },
    d
  );

  return json(
    {
      ok: true,
      provider: "mercadopago",
      duplicated: Boolean(result.duplicado),
      reviews
    },
    200
  );
}

async function completarPayPal(body, d) {
  const orderId = String(body?.order_id || "").trim();

  if (!orderId) {
    return json({ ok: false, error: "Falta order_id de PayPal." }, 400);
  }

  const context =
    await d.getPaymentContext("paypal-review-pack", orderId);

  if (!context || context?.product !== "cartes_review_pack_3") {
    return json(
      {
        ok: false,
        error:
          "No se encontró el contexto del paquete de PayPal."
      },
      422
    );
  }

  const expiration = Date.parse(String(context.expires_at || ""));

  if (!Number.isFinite(expiration) || expiration <= Date.now()) {
    return json(
      {
        ok: false,
        code: "period_expired",
        error:
          "El periodo Cartes Plus asociado a esta compra ya finalizó. La orden no fue capturada."
      },
      409
    );
  }

  let order =
    await d.getPayPalReviewPackOrder(orderId);

  validarOrdenPayPal(order, context.user_id);

  const status = String(order?.status || "").toUpperCase();

  if (status === "APPROVED") {
    order = await d.capturePayPalReviewPackOrder(orderId);
  }
  else if (status !== "COMPLETED") {
    return json(
      {
        ok: false,
        code: "payment_not_approved",
        error:
          "PayPal todavía no confirma la aprobación de la orden."
      },
      409
    );
  }

  const capture =
    (order?.purchase_units?.[0]?.payments?.captures || [])[0];

  if (
    !capture?.id ||
    String(capture?.status || "").toUpperCase() !== "COMPLETED"
  ) {
    return json(
      {
        ok: false,
        error: "PayPal no devolvió una captura completada."
      },
      502
    );
  }

  validarCapturaPayPal(capture);

  const result =
    await d.registrarPaqueteRevisionPagado({
      userId: context.user_id,
      provider: "paypal",
      paymentId: String(capture.id),
      expiresAt: context.expires_at,
      amount: Number(capture?.amount?.value),
      currency: capture?.amount?.currency_code
    });

  const reviews =
    await d.obtenerEstadoRevisionesCartes({
      userId: result.user_id || context.user_id
    });

  await notificarCompra(
    { context, reviews, duplicated: result.duplicado },
    d
  );

  return json(
    {
      ok: true,
      provider: "paypal",
      duplicated: Boolean(result.duplicado),
      reviews
    },
    200
  );
}

function validarImporteMercadoPago(payment) {
  const amount = Number(payment?.transaction_amount);
  const currency = String(payment?.currency_id || "").toUpperCase();

  if (
    !Number.isFinite(amount) ||
    Math.abs(amount - CARTES_REVIEW_PACK_PRICE_MXN) > 0.001 ||
    currency !== "MXN"
  ) {
    throw new Error(
      `El pago de Mercado Pago no corresponde al paquete de $${CARTES_REVIEW_PACK_PRICE_MXN} MXN.`
    );
  }
}

function validarOrdenPayPal(order, userId) {
  const unit = order?.purchase_units?.[0];
  const amount = Number(unit?.amount?.value);
  const currency = String(unit?.amount?.currency_code || "").toUpperCase();

  if (
    String(unit?.custom_id || "") !== userId ||
    !Number.isFinite(amount) ||
    Math.abs(amount - CARTES_REVIEW_PACK_PRICE_MXN) > 0.001 ||
    currency !== "MXN"
  ) {
    throw new Error(
      "La orden de PayPal no corresponde al paquete de Cartes."
    );
  }
}

function validarCapturaPayPal(capture) {
  const amount = Number(capture?.amount?.value);
  const currency = String(capture?.amount?.currency_code || "").toUpperCase();

  if (
    !Number.isFinite(amount) ||
    Math.abs(amount - CARTES_REVIEW_PACK_PRICE_MXN) > 0.001 ||
    currency !== "MXN"
  ) {
    throw new Error(
      `La captura de PayPal no corresponde al paquete de $${CARTES_REVIEW_PACK_PRICE_MXN} MXN.`
    );
  }
}

async function notificarCompra(
  { context, reviews, duplicated },
  d
) {
  if (duplicated || !context?.phone) return;

  await d.sendWhatsAppTextParts({
    to: context.phone,
    phoneNumberId: context.phone_number_id,
    text:
      `¡Listo! Se agregaron ${CARTES_REVIEW_PACK_SIZE} revisiones adicionales a tu cuenta Cartes.\n\n*Revisiones disponibles:* ${reviews.disponibles}\n*Paquetes adicionales:* ${reviews.paquetes_comprados} de ${reviews.paquetes_maximo}`
  }).catch((error) => {
    console.warn(
      "REVIEW_PACK_WA_NOTIFY_ERROR",
      error instanceof Error ? error.message : String(error)
    );
  });
}

function json(body, status) {
  return Response.json(
    body,
    {
      status,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export default createCartesReviewPackHandler();
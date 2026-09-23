import { connectLambda } from "@netlify/blobs";

import {
  isAuthorized,
  sameOrigin,
  unauthorized
} from "../lib/book-admin-auth.js";

import {
  getOrder,
  saveOrder,
  normalizeReference
} from "../lib/book-orders.js";

import {
  createBestQuotation
} from "../lib/skydropx-book.js";

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(payload)
  };
}

export async function handler(event) {
  connectLambda(event);

  if (!isAuthorized(event)) {
    return unauthorized();
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { ok: false, message: "Método no permitido." });
  }

  if (!sameOrigin(event)) {
    return jsonResponse(403, { ok: false, message: "Origen no autorizado." });
  }

  let input;

  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { ok: false, message: "Solicitud inválida." });
  }

  const reference = normalizeReference(input.reference);

  try {
    const order = await getOrder(reference);

    if (!order) {
      return jsonResponse(404, { ok: false, message: "Pedido no encontrado." });
    }

    if (!order.payment?.confirmed) {
      return jsonResponse(409, {
        ok: false,
        message: "Primero confirma el pago."
      });
    }

    if (/entrega local gratuita/i.test(order.deliveryType || "")) {
      return jsonResponse(409, {
        ok: false,
        message: "Este pedido tiene entrega local y no requiere guía."
      });
    }

    if (order.shipment?.id) {
      return jsonResponse(409, {
        ok: false,
        message: "Este pedido ya tiene una guía generada."
      });
    }

    const quote = await createBestQuotation(
      order.address,
      order.bookPrice
    );

    order.shipment = {
      ...(order.shipment || {}),
      status: "quoted",
      latestQuote: quote
    };

    await saveOrder(order);

    return jsonResponse(200, {
      ok: true,
      quote,
      shippingCharged: Number(order.shippingCharged),
      difference: Number(order.shippingCharged) - Number(quote.rawCost)
    });
  } catch (error) {
    console.error("[book-admin-quote]", {
      message: error?.message,
      status: error?.status || null
    });

    return jsonResponse(502, {
      ok: false,
      message: error?.message || "No se pudo actualizar la tarifa de Skydropx."
    });
  }
};

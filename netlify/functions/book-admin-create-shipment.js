import { connectLambda } from "@netlify/blobs";

import {
  isAuthorized,
  sameOrigin,
  unauthorized
} from "../lib/book-admin-auth.js";

import {
  getOrder,
  saveOrder,
  acquireShipmentLock,
  releaseShipmentLock,
  normalizeReference
} from "../lib/book-orders.js";

import {
  createBestQuotation,
  createShipment
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

  if (
    String(process.env.BOOK_ENABLE_LIVE_SHIPMENT || "").toLowerCase() !== "true"
  ) {
    return jsonResponse(409, {
      ok: false,
      shipmentSafetyBlock: true,
      message:
        "La generación real de guías está deshabilitada por seguridad. " +
        "Puedes probar el panel, confirmar pagos y recotizar sin consumir saldo de Skydropx."
    });
  }

  let input;

  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { ok: false, message: "Solicitud inválida." });
  }

  const reference = normalizeReference(input.reference);
  let locked = false;

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
      return jsonResponse(200, {
        ok: true,
        alreadyGenerated: true,
        shipment: order.shipment
      });
    }

    if (!order.shipment?.latestQuote) {
      return jsonResponse(409, {
        ok: false,
        quoteRequired: true,
        message: "Actualiza primero la tarifa de Skydropx."
      });
    }

    locked = await acquireShipmentLock(reference);

    if (!locked) {
      return jsonResponse(409, {
        ok: false,
        message: "La guía de este pedido ya se está procesando."
      });
    }

    // Siempre recotiza inmediatamente antes de gastar saldo.
    const freshQuote = await createBestQuotation(
      order.address,
      order.bookPrice
    );

    const previousCost = Number(order.shipment.latestQuote.rawCost);
    const currentCost = Number(freshQuote.rawCost);
    const changed =
      !Number.isFinite(previousCost) ||
      Math.abs(previousCost - currentCost) > 0.01;

    order.shipment.latestQuote = freshQuote;
    order.shipment.status = "quoted";
    await saveOrder(order);

    if (changed) {
      return jsonResponse(409, {
        ok: false,
        rateChanged: true,
        message:
          "La tarifa cambió desde la última revisión. Se actualizó el importe. " +
          "Revísalo y vuelve a pulsar Generar guía para confirmar.",
        quote: freshQuote,
        shippingCharged: Number(order.shippingCharged),
        difference: Number(order.shippingCharged) - currentCost
      });
    }

    const shipment = await createShipment(order, freshQuote);

    order.shipment = {
      status: shipment.status || "created",
      latestQuote: freshQuote,
      id: shipment.id,
      trackingNumber: shipment.trackingNumber || "",
      trackingUrl: shipment.trackingUrl || "",
      labelUrl: shipment.labelUrl || "",
      provider: shipment.provider || freshQuote.provider,
      service: shipment.service || freshQuote.service,
      generatedAt: shipment.createdAt || new Date().toISOString()
    };

    await saveOrder(order);

    return jsonResponse(200, {
      ok: true,
      shipment: order.shipment,
      shippingCharged: Number(order.shippingCharged),
      actualShippingCost: currentCost,
      difference: Number(order.shippingCharged) - currentCost
    });
  } catch (error) {
    console.error("[book-admin-create-shipment]", {
      message: error?.message,
      status: error?.status || null
    });

    return jsonResponse(502, {
      ok: false,
      message: error?.message || "No se pudo generar la guía."
    });
  } finally {
    if (locked) {
      try {
        await releaseShipmentLock(reference);
      } catch (unlockError) {
        console.error("[book-admin-create-shipment:unlock]", unlockError);
      }
    }
  }
};

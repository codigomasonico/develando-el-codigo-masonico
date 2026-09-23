import { connectLambda } from "@netlify/blobs";

import {
  isAuthorized,
  sameOrigin,
  unauthorized
} from "../lib/book-admin-auth.js";

import {
  listOrders,
  getOrder,
  saveOrder,
  normalizeReference
} from "../lib/book-orders.js";

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

  if (event.httpMethod === "GET") {
    try {
      const orders = await listOrders();

      return jsonResponse(200, {
        ok: true,
        orders
      });
    } catch (error) {
      console.error("[book-admin-orders:list]", error);

      return jsonResponse(500, {
        ok: false,
        message: "No se pudieron cargar los pedidos."
      });
    }
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, {
      ok: false,
      message: "Método no permitido."
    });
  }

  if (!sameOrigin(event)) {
    return jsonResponse(403, {
      ok: false,
      message: "Origen no autorizado."
    });
  }

  let input;

  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, {
      ok: false,
      message: "Solicitud inválida."
    });
  }

  if (input.action !== "set-payment") {
    return jsonResponse(400, {
      ok: false,
      message: "Acción administrativa inválida."
    });
  }

  const reference = normalizeReference(input.reference);
  const paid = input.paid === true;

  try {
    const order = await getOrder(reference);

    if (!order) {
      return jsonResponse(404, {
        ok: false,
        message: "Pedido no encontrado."
      });
    }

    if (!paid && order.shipment?.id) {
      return jsonResponse(409, {
        ok: false,
        message: "No se puede retirar la confirmación de pago después de generar una guía."
      });
    }

    order.payment = {
      confirmed: paid,
      confirmedAt: paid ? new Date().toISOString() : null
    };

    if (!paid && !order.shipment?.id) {
      order.shipment = {
        ...(order.shipment || {}),
        status: "not_generated",
        latestQuote: null
      };
    }

    await saveOrder(order);

    return jsonResponse(200, {
      ok: true,
      order
    });
  } catch (error) {
    console.error("[book-admin-orders:update]", error);

    return jsonResponse(500, {
      ok: false,
      message: "No se pudo actualizar el estado del pago."
    });
  }
};

import { connectLambda } from "@netlify/blobs";

import { createOrder } from "../lib/book-orders.js";

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

function clean(value, maxLength = 200) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function money(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function handler(event) {
  connectLambda(event);

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, {
      ok: false,
      message: "Método no permitido."
    });
  }

  let input;

  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, {
      ok: false,
      message: "La solicitud no contiene JSON válido."
    });
  }

  if (clean(input["bot-field"], 100)) {
    return jsonResponse(200, { ok: true });
  }

  const reference = clean(input.referencia, 40).toUpperCase();
  const amount = money(input.importe);
  const bookPrice = money(input.precio_libro);
  const shippingCharged = money(input.costo_envio);

  const order = {
    version: 1,
    reference,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: "develandoelcodigomasonico.com",
    format: clean(input.formato, 40),
    priceStage: clean(input.etapa_precio, 60),
    bookPrice,
    shippingCharged,
    total: amount,
    deliveryType: clean(input.tipo_entrega, 160),
    shippingOrigin: clean(input.origen_envio, 160),
    customer: {
      name: clean(input.nombre, 160),
      email: clean(input.email, 180).toLowerCase(),
      phone: clean(input.telefono, 40)
    },
    address: {
      postalCode: clean(input.codigo_postal, 5),
      state: clean(input.estado, 100),
      municipality: clean(input.municipio, 120),
      neighborhood: clean(input.colonia, 120),
      street: clean(input.calle, 160),
      exteriorNumber: clean(input.numero_exterior, 30),
      interiorNumber: clean(input.numero_interior, 30),
      deliveryReferences: clean(input.referencias_entrega, 200)
    },
    checkoutQuote: {
      quotationId: clean(input.skydropx_quotation_id, 120),
      rateId: clean(input.skydropx_rate_id, 120),
      provider: clean(input.skydropx_provider, 120),
      service: clean(input.skydropx_service, 160),
      rawCost: money(input.skydropx_raw_cost)
    },
    payment: {
      confirmed: false,
      confirmedAt: null
    },
    shipment: {
      status: "not_generated",
      latestQuote: null,
      id: "",
      trackingNumber: "",
      trackingUrl: "",
      labelUrl: "",
      generatedAt: null
    }
  };

  if (!/^CAM-\d{6}-[A-Z]{3}\d{5}$/.test(order.reference)) {
    return jsonResponse(400, {
      ok: false,
      message: "La referencia del pedido es inválida."
    });
  }

  if (
    !order.customer.name ||
    !order.customer.email.includes("@") ||
    !order.customer.phone ||
    !/^\d{5}$/.test(order.address.postalCode) ||
    !order.address.state ||
    !order.address.municipality ||
    !order.address.neighborhood ||
    !order.address.street ||
    !order.address.exteriorNumber ||
    bookPrice === null ||
    shippingCharged === null ||
    amount === null
  ) {
    return jsonResponse(400, {
      ok: false,
      message: "Faltan datos obligatorios para registrar el pedido."
    });
  }

  try {
    const saved = await createOrder(order);

    return jsonResponse(200, {
      ok: true,
      order: {
        reference: saved.reference,
        createdAt: saved.createdAt
      }
    });
  } catch (error) {
    console.error("[book-order-create]", error);

    return jsonResponse(500, {
      ok: false,
      message: "No pudimos registrar el pedido. Inténtalo nuevamente."
    });
  }
};

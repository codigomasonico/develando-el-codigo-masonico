import {
  createMercadoPagoReviewPackCheckout,
  createPayPalReviewPackOrder
} from "./lib-cartes-review-pack-payments.mjs";

import {
  savePaymentContext
} from "./lib-state.mjs";

const realDeps = {
  createMercadoPagoReviewPackCheckout,
  createPayPalReviewPackOrder,
  savePaymentContext
};

export async function createReviewPackCheckout(
  input = {},
  overrides = {}
) {
  const d = { ...realDeps, ...overrides };

  const userId = String(input.userId || "").trim();
  const phone = String(input.phone || "").replace(/\D/g, "");
  const phoneNumberId = String(input.phoneNumberId || "").trim();
  const expiresAt = String(input.expiresAt || "").trim();
  const provider = normalizeProvider(input.provider);

  if (!/^usr_[a-f0-9]{32}$/.test(userId)) {
    throw new Error("user_id Cartes inválido.");
  }

  if (!Number.isFinite(Date.parse(expiresAt))) {
    throw new Error(
      "No fue posible determinar el vencimiento del paquete."
    );
  }

  if (provider === "mercadopago") {
    const checkout =
      await d.createMercadoPagoReviewPackCheckout({
        userId,
        expiresAt
      });

    await d.savePaymentContext(
      "mercadopago-review-pack",
      checkout.reference,
      {
        product: "cartes_review_pack_3",
        user_id: userId,
        phone,
        phone_number_id: phoneNumberId,
        expires_at: expiresAt,
        preference_id: checkout.preference_id
      }
    );

    return {
      provider,
      resource_id: checkout.preference_id,
      reference: checkout.reference,
      url: checkout.url,
      user_id: userId
    };
  }

  const checkout =
    await d.createPayPalReviewPackOrder({
      userId,
      expiresAt
    });

  await d.savePaymentContext(
    "paypal-review-pack",
    checkout.order_id,
    {
      product: "cartes_review_pack_3",
      user_id: userId,
      phone,
      phone_number_id: phoneNumberId,
      expires_at: expiresAt,
      order_id: checkout.order_id
    }
  );

  return {
    provider,
    resource_id: checkout.order_id,
    url: checkout.url,
    user_id: userId
  };
}

function normalizeProvider(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  if (["mercadopago", "mp", "1"].includes(normalized)) {
    return "mercadopago";
  }

  if (["paypal", "2"].includes(normalized)) {
    return "paypal";
  }

  throw new Error("Proveedor de pago no soportado.");
}
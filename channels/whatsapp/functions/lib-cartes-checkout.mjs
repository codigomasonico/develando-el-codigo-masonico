import { savePaymentContext } from "./lib-state.mjs";
import { createMercadoPagoCheckout } from "./lib-mercadopago.mjs";
import { createPayPalCheckout } from "./lib-paypal.mjs";

const realDeps = {
  savePaymentContext,
  createMercadoPagoCheckout,
  createPayPalCheckout
};

export async function createCheckoutForCartes(input = {}, overrides = {}) {
  const d = { ...realDeps, ...overrides };
  const userId = String(input.userId || "").trim();
  const phone = String(input.phone || "").replace(/\D/g, "");
  const phoneNumberId = String(input.phoneNumberId || "").trim();
  const provider = normalizeProvider(input.provider);

  if (!/^usr_[a-f0-9]{32}$/.test(userId)) {
    throw new Error("user_id Cartes inválido.");
  }

  if (provider === "mercadopago") {
    const checkout = await d.createMercadoPagoCheckout({ userId, phone });
    if (!checkout?.plan_id || !checkout?.url) {
      throw new Error("Mercado Pago no devolvió un checkout válido.");
    }

    await d.savePaymentContext("mercadopago-plan", checkout.plan_id, {
      user_id: userId,
      phone,
      phone_number_id: phoneNumberId
    });

    return {
      provider,
      resource_id: String(checkout.plan_id),
      url: String(checkout.url),
      user_id: userId
    };
  }

  const checkout = await d.createPayPalCheckout({ userId, phone });
  if (!checkout?.subscription_id || !checkout?.url) {
    throw new Error("PayPal no devolvió un checkout válido.");
  }

  await d.savePaymentContext("paypal-subscription", checkout.subscription_id, {
    user_id: userId,
    phone,
    phone_number_id: phoneNumberId
  });

  return {
    provider,
    resource_id: String(checkout.subscription_id),
    url: String(checkout.url),
    user_id: userId
  };
}

function normalizeProvider(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  if (["mercadopago", "mp", "1"].includes(normalized)) return "mercadopago";
  if (["paypal", "2"].includes(normalized)) return "paypal";
  throw new Error("Proveedor de pago no soportado.");
}

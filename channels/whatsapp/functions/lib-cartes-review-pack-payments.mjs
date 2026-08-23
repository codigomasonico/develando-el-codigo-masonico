import { CARTES_REVIEW_PACK_PRICE_MXN, CARTES_REVIEW_PACK_SIZE } from "../../../core/ai/config.mjs";
import crypto from "node:crypto";

const MP_API = "https://api.mercadopago.com";
const PAYPAL_SANDBOX = "https://api-m.sandbox.paypal.com";
const PAYPAL_LIVE = "https://api-m.paypal.com";
const PRICE = CARTES_REVIEW_PACK_PRICE_MXN;

function env(name) {
  return String(process.env[name] || "").trim();
}

function mercadoPagoEnvironment() {
  const explicit = env("MERCADOPAGO_ENVIRONMENT").toLowerCase();

  if (["test", "sandbox"].includes(explicit)) return "test";
  if (["production", "prod", "live"].includes(explicit)) return "production";

  const hasTest = Boolean(env("MERCADOPAGO_TEST_ACCESS_TOKEN"));
  const hasProduction = Boolean(env("MERCADOPAGO_ACCESS_TOKEN"));

  if (hasTest && !hasProduction) return "test";
  if (hasProduction && !hasTest) return "production";

  if (hasTest && hasProduction) {
    throw new Error(
      "Hay credenciales Mercado Pago TEST y producción simultáneamente. Define MERCADOPAGO_ENVIRONMENT."
    );
  }

  throw new Error("Faltan credenciales de Mercado Pago.");
}

function mercadoPagoToken() {
  const environment = mercadoPagoEnvironment();

  const name =
    environment === "test"
      ? "MERCADOPAGO_TEST_ACCESS_TOKEN"
      : "MERCADOPAGO_ACCESS_TOKEN";

  const value = env(name);

  if (!value) throw new Error(`Falta ${name}.`);

  return value;
}

async function mpRequest(
  path,
  {
    method = "GET",
    body = null,
    fetchImpl = fetch
  } = {}
) {
  const response = await fetchImpl(`${MP_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${mercadoPagoToken()}`,
      "Content-Type": "application/json"
    },
    body: body == null ? undefined : JSON.stringify(body)
  });

  const raw = await response.text();
  let data = {};

  try {
    data = raw ? JSON.parse(raw) : {};
  }
  catch {
    data = { raw };
  }

  if (!response.ok) {
    throw new Error(
      `Mercado Pago HTTP ${response.status}: ${data?.message || data?.error || raw || "error"}`
    );
  }

  return data;
}

export async function createMercadoPagoReviewPackCheckout({
  userId,
  expiresAt,
  fetchImpl = fetch
}) {
  validarUserId(userId);
  const expiration = validarExpiracion(expiresAt);

  const reference =
    `cartes-review-pack:${userId}:${crypto.randomUUID()}`;

  const data = await mpRequest(
    "/checkout/preferences",
    {
      method: "POST",
      body: {
        items: [
          {
            id: "cartes-review-pack-3",
            title: `Cartes - ${CARTES_REVIEW_PACK_SIZE} revisiones adicionales`,
            description: `Paquete único de ${CARTES_REVIEW_PACK_SIZE} revisiones de documentos`,
            quantity: 1,
            currency_id: "MXN",
            unit_price: PRICE
          }
        ],
        external_reference: reference,
        metadata: {
          product: "cartes_review_pack_3",
          user_id: userId,
          expires_at: expiration
        },
        back_urls: {
          success: reviewPackBackUrl("mercadopago", "success"),
          pending: reviewPackBackUrl("mercadopago", "pending"),
          failure: reviewPackBackUrl("mercadopago", "failure")
        },
        auto_return: "approved",
        notification_url: reviewPackWebhookUrl(),
        expires: true,
        expiration_date_to: expiration
      },
      fetchImpl
    }
  );

  const url =
    mercadoPagoEnvironment() === "test"
      ? (data?.sandbox_init_point || data?.init_point)
      : data?.init_point;

  if (!data?.id || !url) {
    throw new Error(
      "Mercado Pago no devolvió un checkout válido para el paquete."
    );
  }

  return {
    provider: "mercadopago",
    preference_id: String(data.id),
    reference,
    url: String(url),
    user_id: userId,
    expires_at: expiration
  };
}

export async function getMercadoPagoReviewPackPayment(
  paymentId,
  fetchImpl = fetch
) {
  const id = String(paymentId || "").trim();

  if (!id) throw new Error("Falta payment_id de Mercado Pago.");

  return mpRequest(
    `/v1/payments/${encodeURIComponent(id)}`,
    { fetchImpl }
  );
}

function paypalEnvironment() {
  return env("PAYPAL_ENVIRONMENT").toLowerCase() === "live"
    ? "live"
    : "sandbox";
}

function paypalBase() {
  return paypalEnvironment() === "live"
    ? PAYPAL_LIVE
    : PAYPAL_SANDBOX;
}

async function paypalOauth(fetchImpl = fetch) {
  const id = env("PAYPAL_CLIENT_ID");
  const secret = env("PAYPAL_CLIENT_SECRET");

  if (!id || !secret) {
    throw new Error("Faltan PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET.");
  }

  const response = await fetchImpl(
    `${paypalBase()}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Basic ${Buffer.from(`${id}:${secret}`, "utf8").toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.access_token) {
    throw new Error(
      `PayPal OAuth HTTP ${response.status}: ${data?.error_description || data?.message || "error"}`
    );
  }

  return data.access_token;
}

async function paypalRequest(
  path,
  {
    method = "GET",
    body = null,
    fetchImpl = fetch,
    requestId = ""
  } = {}
) {
  const access = await paypalOauth(fetchImpl);

  const headers = {
    Authorization: `Bearer ${access}`,
    "Content-Type": "application/json"
  };

  if (requestId) {
    headers["PayPal-Request-Id"] = requestId;
  }

  const response = await fetchImpl(
    `${paypalBase()}${path}`,
    {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body)
    }
  );

  const raw = await response.text();
  let data = {};

  try {
    data = raw ? JSON.parse(raw) : {};
  }
  catch {
    data = { raw };
  }

  if (!response.ok) {
    throw new Error(
      `PayPal HTTP ${response.status}: ${data?.message || data?.name || raw || "error"}`
    );
  }

  return data;
}

export async function createPayPalReviewPackOrder({
  userId,
  expiresAt,
  fetchImpl = fetch
}) {
  validarUserId(userId);
  const expiration = validarExpiracion(expiresAt);

  const data = await paypalRequest(
    "/v2/checkout/orders",
    {
      method: "POST",
      body: {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: "cartes-review-pack-3",
            custom_id: userId,
            description: `Cartes - ${CARTES_REVIEW_PACK_SIZE} revisiones adicionales`,
            amount: {
              currency_code: "MXN",
              value: PRICE.toFixed(2)
            }
          }
        ],
        application_context: {
          brand_name: "Cartes",
          user_action: "PAY_NOW",
          shipping_preference: "NO_SHIPPING",
          return_url: reviewPackBackUrl("paypal", "success"),
          cancel_url: reviewPackBackUrl("paypal", "cancel")
        }
      },
      requestId: `cartes-review-pack-create-${crypto.randomUUID()}`,
      fetchImpl
    }
  );

  const approve =
    (Array.isArray(data?.links) ? data.links : [])
      .find((item) =>
        ["approve", "payer-action"].includes(
          String(item?.rel || "").toLowerCase()
        )
      )?.href;

  if (!data?.id || !approve) {
    throw new Error(
      "PayPal no devolvió una orden aprobable para el paquete."
    );
  }

  return {
    provider: "paypal",
    order_id: String(data.id),
    url: String(approve),
    user_id: userId,
    expires_at: expiration
  };
}

export async function getPayPalReviewPackOrder(
  orderId,
  fetchImpl = fetch
) {
  const id = String(orderId || "").trim();

  if (!id) throw new Error("Falta order_id de PayPal.");

  return paypalRequest(
    `/v2/checkout/orders/${encodeURIComponent(id)}`,
    { fetchImpl }
  );
}

export async function capturePayPalReviewPackOrder(
  orderId,
  fetchImpl = fetch
) {
  const id = String(orderId || "").trim();

  if (!id) throw new Error("Falta order_id de PayPal.");

  return paypalRequest(
    `/v2/checkout/orders/${encodeURIComponent(id)}/capture`,
    {
      method: "POST",
      requestId: `cartes-review-pack-capture-${id}`,
      fetchImpl
    }
  );
}

function reviewPackBaseUrl() {
  return (
    env("CARTES_REVIEW_PACK_BACK_URL") ||
    env("CARTES_PLUS_BACK_URL") ||
    "https://develandoelcodigomasonico.com/cartes-whatsapp/suscripcion.html"
  );
}

function reviewPackBackUrl(provider, result) {
  const url = new URL(reviewPackBaseUrl());

  url.searchParams.set("flow", "review_pack");
  url.searchParams.set("provider", provider);
  url.searchParams.set("result", result);

  return url.toString();
}

function reviewPackWebhookUrl() {
  const configured = env("CARTES_REVIEW_PACK_WEBHOOK_URL");

  if (configured) return configured;

  const back = new URL(reviewPackBaseUrl());

  return new URL(
    "/.netlify/functions/cartes-review-pack-webhook",
    back.origin
  ).toString();
}

function validarExpiracion(value) {
  const raw = String(value || "").trim();
  const parsed = Date.parse(raw);

  if (!Number.isFinite(parsed) || parsed <= Date.now()) {
    throw new Error(
      "El periodo Cartes Plus vigente no tiene un vencimiento válido."
    );
  }

  return new Date(parsed).toISOString();
}

function validarUserId(userId) {
  const id = String(userId || "").trim();

  if (!/^usr_[a-f0-9]{32}$/.test(id)) {
    throw new Error("user_id Cartes inválido.");
  }

  return id;
}
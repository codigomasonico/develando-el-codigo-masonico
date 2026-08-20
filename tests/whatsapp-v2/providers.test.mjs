import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { sendWhatsAppText, verifyMetaSignature } from "../../channels/whatsapp/functions/lib-meta.mjs";
import { createMercadoPagoCheckout, normalizeMercadoPagoSubscription, verifyMercadoPagoWebhook } from "../../channels/whatsapp/functions/lib-mercadopago.mjs";
import { createPayPalCheckout, normalizePayPalSubscription, paypalEnvironment } from "../../channels/whatsapp/functions/lib-paypal.mjs";

const USER_ID = "usr_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function response(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

test("Meta firma bytes crudos con HMAC SHA-256", () => {
  const raw = Buffer.from('{"object":"whatsapp_business_account"}', "utf8");
  const secret = "secret";
  const sig = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  assert.equal(verifyMetaSignature(raw, sig, secret), true);
  assert.equal(verifyMetaSignature(Buffer.from("otro"), sig, secret), false);
});

test("Meta envía al phone_number_id recibido, no a uno hardcodeado", async () => {
  let called;
  const fakeFetch = async (url, options) => {
    called = { url, options };
    return response(200, { messages: [{ id: "wamid.out" }] });
  };
  await sendWhatsAppText({
    to: "5218115774235",
    text: "hola",
    phoneNumberId: "1205856839283337",
    accessToken: "TOKEN",
    graphVersion: "v25.0",
    fetchImpl: fakeFetch
  });
  assert.equal(called.url, "https://graph.facebook.com/v25.0/1205856839283337/messages");
  assert.equal(called.options.headers.Authorization, "Bearer TOKEN");
});

test("Mercado Pago crea plan mensual de 149 MXN con fetch simulado", async () => {
  const old = process.env.MERCADOPAGO_ACCESS_TOKEN;
  process.env.MERCADOPAGO_ACCESS_TOKEN = "MP_TEST";
  try {
    let call;
    const fakeFetch = async (url, options) => {
      call = { url, options, body: JSON.parse(options.body) };
      return response(201, { id: "plan-1", init_point: "https://mp.test/init" });
    };
    const result = await createMercadoPagoCheckout({ userId: USER_ID, phone: "5218115774235", fetchImpl: fakeFetch });
    assert.equal(result.url, "https://mp.test/init");
    assert.equal(call.url, "https://api.mercadopago.com/preapproval_plan");
    assert.equal(call.body.auto_recurring.transaction_amount, 149);
    assert.equal(call.body.auto_recurring.currency_id, "MXN");
  } finally {
    if (old === undefined) delete process.env.MERCADOPAGO_ACCESS_TOKEN; else process.env.MERCADOPAGO_ACCESS_TOKEN = old;
  }
});

test("Mercado Pago valida firma webhook", () => {
  const secret = "mp-secret";
  const dataId = "123";
  const requestId = "req-1";
  const ts = "1700000000";
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = crypto.createHmac("sha256", secret).update(manifest, "utf8").digest("hex");
  assert.equal(verifyMercadoPagoWebhook({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: requestId, dataId, secret }), true);
});

test("Mercado Pago normaliza authorized/cancelled", () => {
  assert.equal(normalizeMercadoPagoSubscription({ id: "1", status: "authorized" }).status, "authorized");
  assert.equal(normalizeMercadoPagoSubscription({ id: "1", status: "canceled" }).status, "cancelled");
});

test("PayPal sandbox crea suscripción y enlace approve con fetch simulado", async () => {
  const previous = {
    PAYPAL_ENVIRONMENT: process.env.PAYPAL_ENVIRONMENT,
    PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
    PAYPAL_PLAN_ID: process.env.PAYPAL_PLAN_ID
  };
  process.env.PAYPAL_ENVIRONMENT = "sandbox";
  process.env.PAYPAL_CLIENT_ID = "CLIENT";
  process.env.PAYPAL_CLIENT_SECRET = "SECRET";
  process.env.PAYPAL_PLAN_ID = "P-PLAN";
  try {
    const calls = [];
    const fakeFetch = async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("/v1/oauth2/token")) return response(200, { access_token: "ACCESS" });
      if (url.endsWith("/v1/billing/subscriptions")) return response(201, { id: "I-TEST", links: [{ rel: "approve", href: "https://paypal.test/approve" }] });
      return response(404, {});
    };
    const result = await createPayPalCheckout({ userId: USER_ID, phone: "5218115774235", fetchImpl: fakeFetch });
    assert.equal(paypalEnvironment(), "sandbox");
    assert.equal(result.subscription_id, "I-TEST");
    assert.equal(result.url, "https://paypal.test/approve");
    assert.equal(calls.length, 2);
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});

test("PayPal normaliza ACTIVE y CANCELLED", () => {
  assert.equal(normalizePayPalSubscription({ id: "I-1", status: "ACTIVE" }).status, "authorized");
  assert.equal(normalizePayPalSubscription({ id: "I-1", status: "CANCELLED" }).status, "cancelled");
});

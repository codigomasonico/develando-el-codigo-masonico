import test from "node:test";
import assert from "node:assert/strict";
import { createMercadoPagoWebhookHandler } from "../../channels/whatsapp/functions/mercadopago-webhook.mjs";
import { createPayPalWebhookHandler } from "../../channels/whatsapp/functions/paypal-webhook.mjs";

const USER_ID = "usr_cccccccccccccccccccccccccccccccc";

test("Mercado Pago webhook autorizado activa Plus en cuenta compartida y notifica WhatsApp", async () => {
  const sent = [];
  const synced = [];
  const handler = createMercadoPagoWebhookHandler({
    verifyMercadoPagoWebhook: () => true,
    async getMercadoPagoSubscription(id) { return { id, status: "authorized", preapproval_plan_id: "plan-1", auto_recurring: { transaction_amount: 149, currency_id: "MXN" } }; },
    async getPaymentContext() { return { user_id: USER_ID, phone: "5218115774235", phone_number_id: "1205856839283337" }; },
    async obtenerSuscripcionUsuario() { return null; },
    normalizeMercadoPagoSubscription(remote) { return { provider: "mercadopago", status: remote.status, preapproval_id: remote.id }; },
    async sincronizarSuscripcionUsuario(args) { synced.push(args); return { plan: "plus" }; },
    async savePaymentContext() {},
    async sendWhatsAppTextParts(args) { sent.push(args); }
  });
  const req = new Request("http://localhost/.netlify/functions/mercadopago-webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-signature": "fake", "x-request-id": "req" },
    body: JSON.stringify({ type: "subscription_preapproval", data: { id: "sub-1" } })
  });
  const res = await handler(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.plan, "plus");
  assert.equal(synced[0].userId, USER_ID);
  assert.equal(sent[0].phoneNumberId, "1205856839283337");
});

test("PayPal webhook ACTIVE activa Plus en misma cuenta y notifica WhatsApp", async () => {
  const sent = [];
  const synced = [];
  const handler = createPayPalWebhookHandler({
    env: { PAYPAL_ENVIRONMENT: "sandbox" },
    async verifyPayPalWebhook() { return true; },
    async getPayPalSubscription(id) { return { id, custom_id: USER_ID, status: "ACTIVE" }; },
    async obtenerSuscripcionUsuario() { return null; },
    normalizePayPalSubscription(remote) { return { provider: "paypal", status: "authorized", subscription_id: remote.id }; },
    async sincronizarSuscripcionUsuario(args) { synced.push(args); return { plan: "plus" }; },
    async getPaymentContext() { return { user_id: USER_ID, phone: "5218115774235", phone_number_id: "1205856839283337" }; },
    async sendWhatsAppTextParts(args) { sent.push(args); }
  });
  const req = new Request("http://localhost/.netlify/functions/paypal-webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "I-TEST", custom_id: USER_ID } })
  });
  const res = await handler(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.plan, "plus");
  assert.equal(synced[0].userId, USER_ID);
  assert.match(sent[0].text, /Cartes Plus/);
});

test("webhooks de pago rechazan firma inválida", async () => {
  const mp = createMercadoPagoWebhookHandler({ verifyMercadoPagoWebhook: () => false });
  const mpRes = await mp(new Request("http://localhost/mp", { method: "POST", body: JSON.stringify({ data: { id: "1" }, type: "subscription_preapproval" }) }));
  assert.equal(mpRes.status, 401);

  const pp = createPayPalWebhookHandler({ async verifyPayPalWebhook() { return false; } });
  const ppRes = await pp(new Request("http://localhost/pp", { method: "POST", body: JSON.stringify({ event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "I-1" } }) }));
  assert.equal(ppRes.status, 401);
});

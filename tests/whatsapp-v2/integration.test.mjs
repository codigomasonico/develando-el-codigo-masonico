import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createWhatsAppHandler } from "../../channels/whatsapp/functions/cartes-whatsapp.mjs";
import { extractMetaEvents, extractMessageText, verifyMetaSignature } from "../../channels/whatsapp/functions/lib-meta.mjs";

const SECRET = "meta-test-secret";
const PHONE = "5218115774235";
const PHONE_ID = "1205856839283337";
const USER_ID = "usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function metaPayload(text, id = "wamid.TEST1") {
  return {
    object: "whatsapp_business_account",
    entry: [{
      id: "waba-test",
      changes: [{
        field: "messages",
        value: {
          messaging_product: "whatsapp",
          metadata: { display_phone_number: "+52 33 2233 8888", phone_number_id: PHONE_ID },
          contacts: [{ wa_id: PHONE, profile: { name: "Daniel" } }],
          messages: [{ from: PHONE, id, timestamp: "1700000000", type: "text", text: { body: text } }]
        }
      }]
    }]
  };
}

function signedRequest(payload) {
  const raw = Buffer.from(JSON.stringify(payload), "utf8");
  const signature = "sha256=" + crypto.createHmac("sha256", SECRET).update(raw).digest("hex");
  return new Request("http://localhost/.netlify/functions/cartes-whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-hub-signature-256": signature },
    body: raw
  });
}

function makeDeps({ plan = "gratuito", flow = null, duplicate = false, subscription = null } = {}) {
  const sent = [];
  const calls = [];
  let activeFlow = flow;
  const claimed = new Set();

  const deps = {
    env: {
      WHATSAPP_VERIFY_TOKEN: "verify-test",
      META_APP_SECRET: SECRET,
      CARTES_TERMS_URL: "https://example.test/terms",
      CARTES_PRIVACY_URL: "https://example.test/privacy"
    },
    verifyMetaSignature,
    extractMetaEvents,
    extractMessageText,
    async claimInboundMessage(id) {
      if (duplicate || claimed.has(id)) return false;
      claimed.add(id);
      return true;
    },
    async releaseInboundMessage(id) { claimed.delete(id); },
    async resolverOCrearUsuarioPorIdentidad(args) { calls.push(["identity", args]); return { user_id: USER_ID }; },
    async obtenerPlanUsuario() { return plan; },
    async reservarConsultaMensual(args) { calls.push(["reserve", args]); return { permitida: true, duplicada: false, plan, periodo: "2026-08" }; },
    async completarConsultaMensual(args) { calls.push(["complete", args]); return true; },
    async liberarConsultaMensual(args) { calls.push(["release", args]); return true; },
    async obtenerEstadoUsoMensual() { return { usadas: 1, limite: plan === "plus" ? 50 : 5, disponibles: plan === "plus" ? 49 : 4 }; },
    async obtenerSuscripcionUsuario() { return subscription; },
    async sincronizarSuscripcionUsuario(args) { calls.push(["sync-sub", args]); return { plan: "gratuito" }; },
    async completarVinculacionConWhatsApp() { return { linked: true }; },
    async getFlow() { return activeFlow; },
    async setFlow(_uid, next, data) { activeFlow = { flow: next, data }; calls.push(["set-flow", next]); },
    async clearFlow() { activeFlow = null; calls.push(["clear-flow"]); },
    async savePaymentContext(provider, key, data) { calls.push(["payment-context", provider, key, data]); },
    async createMercadoPagoCheckout() { calls.push(["mp-checkout"]); return { plan_id: "mp-plan-1", url: "https://mp.test/checkout" }; },
    async createPayPalCheckout() { calls.push(["paypal-checkout"]); return { subscription_id: "I-TEST", url: "https://paypal.test/approve" }; },
    async cancelMercadoPagoSubscription() { return { id: "mp-sub", status: "cancelled" }; },
    normalizeMercadoPagoSubscription(remote) { return { provider: "mercadopago", status: remote.status, preapproval_id: remote.id }; },
    async cancelPayPalSubscription() { return true; },
    async getPayPalSubscription() { return { id: "I-TEST", status: "CANCELLED" }; },
    normalizePayPalSubscription(remote) { return { provider: "paypal", status: "cancelled", subscription_id: remote.id }; },
    async guiaMasonico(request) {
      const body = await request.json();
      calls.push(["core", body]);
      return Response.json({ answer: "Respuesta del mismo Core de Cartes.", meta: { route: "ia" } });
    },
    async sendWhatsAppTextParts(args) { sent.push(args); return { messages: [{ id: "out-1" }] }; }
  };

  return { deps, sent, calls, getFlow: () => activeFlow };
}

test("GET verifica webhook con token exacto", async () => {
  const { deps } = makeDeps();
  const handler = createWhatsAppHandler(deps);
  const ok = await handler(new Request("http://localhost/.netlify/functions/cartes-whatsapp?hub.mode=subscribe&hub.verify_token=verify-test&hub.challenge=ABC", { method: "GET" }));
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "ABC");
  const bad = await handler(new Request("http://localhost/.netlify/functions/cartes-whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=ABC", { method: "GET" }));
  assert.equal(bad.status, 403);
});

test("POST rechaza firma inválida", async () => {
  const { deps } = makeDeps();
  const handler = createWhatsAppHandler(deps);
  const req = new Request("http://localhost/.netlify/functions/cartes-whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-hub-signature-256": "sha256=" + "0".repeat(64) },
    body: JSON.stringify(metaPayload("hola"))
  });
  const res = await handler(req);
  assert.equal(res.status, 401);
});

test("mensaje real usa phone_number_id del webhook, mismo Core y completa consumo", async () => {
  const { deps, sent, calls } = makeDeps();
  const handler = createWhatsAppHandler(deps);
  const res = await handler(signedRequest(metaPayload("¿Qué es la masonería?")));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.respuestas, 1);
  assert.equal(body.fallos, 0);
  assert.equal(sent.length, 2);

  assert.equal(sent[0].phoneNumberId, PHONE_ID);
  assert.equal(sent[0].to, PHONE);
  assert.match(sent[0].text, /mismo Core/);

  assert.equal(sent[1].phoneNumberId, PHONE_ID);
  assert.equal(sent[1].to, PHONE);
  assert.match(sent[1].text, /\*Consultas disponibles:\*\s*4 de 5/);
  const core = calls.find((x) => x[0] === "core");
  assert.equal(core[1].client.channel, "whatsapp");
  assert.equal(core[1].client.user_id, USER_ID);
  assert.equal(core[1].client.external_user_id, PHONE);
  assert.ok(calls.some((x) => x[0] === "reserve"));
  assert.ok(calls.some((x) => x[0] === "complete"));
});

test("mensaje duplicado no vuelve a consumir ni responder", async () => {
  const { deps, sent, calls } = makeDeps({ duplicate: true });
  const handler = createWhatsAppHandler(deps);
  const res = await handler(signedRequest(metaPayload("hola", "wamid.DUP")));
  const body = await res.json();
  assert.equal(body.duplicados, 1);
  assert.equal(sent.length, 0);
  assert.equal(calls.some((x) => x[0] === "reserve"), false);
});

test("suscripción abre flujo y exige aceptación legal", async () => {
  const { deps, sent, getFlow } = makeDeps();
  const handler = createWhatsAppHandler(deps);
  await handler(signedRequest(metaPayload("Suscribirme", "wamid.SUB1")));
  assert.equal(getFlow()?.flow, "accept_terms");
  assert.match(sent.at(-1).text, /Términos/);
  assert.match(sent.at(-1).text, /Aviso de privacidad/);
});

test("flujo aceptado ofrece Mercado Pago y PayPal", async () => {
  const { deps, sent, getFlow } = makeDeps({ flow: { flow: "accept_terms", data: {} } });
  const handler = createWhatsAppHandler(deps);
  await handler(signedRequest(metaPayload("ACEPTO", "wamid.SUB2")));
  assert.equal(getFlow()?.flow, "payment_provider");
  assert.match(sent.at(-1).text, /Mercado Pago/);
  assert.match(sent.at(-1).text, /PayPal/);
});

test("flujo Mercado Pago entrega checkout", async () => {
  const { deps, sent, calls } = makeDeps({ flow: { flow: "payment_provider", data: {} } });
  const handler = createWhatsAppHandler(deps);
  await handler(signedRequest(metaPayload("1", "wamid.MP")));
  assert.match(sent.at(-1).text, /https:\/\/mp\.test\/checkout/);
  assert.ok(calls.some((x) => x[0] === "mp-checkout"));
});

test("flujo PayPal entrega checkout", async () => {
  const { deps, sent, calls } = makeDeps({ flow: { flow: "payment_provider", data: {} } });
  const handler = createWhatsAppHandler(deps);
  await handler(signedRequest(metaPayload("2", "wamid.PP")));
  assert.match(sent.at(-1).text, /https:\/\/paypal\.test\/approve/);
  assert.ok(calls.some((x) => x[0] === "paypal-checkout"));
});

test("VINCULAR informa conflicto cuando Web y WhatsApp tienen Plus vigente distinto", async () => {
  const { deps, sent } = makeDeps();

  deps.completarVinculacionConWhatsApp = async () => ({
    linked: false,
    conflict: "active_subscriptions"
  });

  const handler = createWhatsAppHandler(deps);

  const response = await handler(
    signedRequest(
      metaPayload("VINCULAR 123456", "wamid.LINK.CONFLICT")
    )
  );

  assert.equal(response.status, 200);
  assert.equal(sent.length, 1);
  assert.match(
    sent[0].text,
    /ambas tienen una suscripción Cartes Plus vigente/
  );
  assert.match(
    sent[0].text,
    /Ninguna cuenta fue modificada/
  );
});
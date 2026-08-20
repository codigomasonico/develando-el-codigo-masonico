import test from "node:test";
import assert from "node:assert/strict";

import { createWhatsAppHandler } from "../../channels/whatsapp/functions/cartes-whatsapp.mjs";
import { createCheckoutForCartes } from "../../channels/whatsapp/functions/lib-cartes-checkout.mjs";
import { createCartesSubscriptionHandler } from "../../channels/whatsapp/functions/cartes-subscription.mjs";

const USER_ID = "usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

test("V018: Menú real de Meta gana prioridad antes de getFlow/payment_provider", async () => {
  let clearFlowCalls = 0;
  let getFlowCalls = 0;
  let providerCalls = 0;
  const sent = [];
  const menus = [];

  const handler = createWhatsAppHandler({
    verifyMetaSignature: () => true,
    claimInboundMessage: async () => true,
    resolverOCrearUsuarioPorIdentidad: async () => ({ user_id: USER_ID }),
    obtenerSuscripcionUsuario: async () => null,
    obtenerPlanUsuario: async () => "gratuito",
    clearFlow: async () => { clearFlowCalls += 1; },
    getFlow: async () => {
      getFlowCalls += 1;
      return { flow: "payment_provider" };
    },
    sendWhatsAppTextParts: async (payload) => { sent.push(payload); },
    sendWhatsAppInteractiveList: async (payload) => { menus.push(payload); },
    createMercadoPagoCheckout: async () => { providerCalls += 1; throw new Error("NO DEBE LLAMARSE"); },
    createPayPalCheckout: async () => { providerCalls += 1; throw new Error("NO DEBE LLAMARSE"); }
  });

  const payload = {
    object: "whatsapp_business_account",
    entry: [{
      id: "123",
      changes: [{
        field: "messages",
        value: {
          messaging_product: "whatsapp",
          metadata: {
            display_phone_number: "5210000000000",
            phone_number_id: "999999999"
          },
          contacts: [{
            profile: { name: "QA" },
            wa_id: "5211111111111"
          }],
          messages: [{
            from: "5211111111111",
            id: "wamid.V018.MENU",
            timestamp: "1786560000",
            type: "text",
            text: { body: "Menú" }
          }]
        }
      }]
    }]
  };

  const response = await handler(new Request("https://qa.invalid/.netlify/functions/cartes-whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hub-signature-256": "sha256=dummy"
    },
    body: JSON.stringify(payload)
  }));

  assert.equal(response.status, 200);
  assert.equal(clearFlowCalls, 1);
  assert.equal(getFlowCalls, 0, "Menú debe resolverse antes de leer el flujo");
  assert.equal(providerCalls, 0, "Menú nunca debe llamar a Mercado Pago/PayPal");
  assert.equal(menus.length, 1);
  assert.equal(sent.length, 0);

  const rows = menus[0].sections.flatMap((section) => section.rows || []);

  assert.deepEqual(
    rows.map((row) => row.id),
    [
      "menu_conversar",
      "menu_plus",
      "menu_suscribirme",
      "menu_suscripcion",
      "menu_ayuda",
      "menu_legal"
    ]
  );
});

test("V018: checkout compartido conserva contexto central para Mercado Pago y PayPal", async () => {
  const contexts = [];

  const deps = {
    createMercadoPagoCheckout: async ({ userId }) => ({
      plan_id: "PLAN-MP-V018",
      url: "https://example.invalid/mp",
      user_id: userId
    }),
    createPayPalCheckout: async ({ userId }) => ({
      subscription_id: "I-PAYPAL-V018",
      url: "https://example.invalid/paypal",
      user_id: userId
    }),
    savePaymentContext: async (kind, id, context) => {
      contexts.push({ kind, id, context });
    }
  };

  const mp = await createCheckoutForCartes({
    provider: "mercadopago",
    userId: USER_ID,
    phone: "5211111111111",
    phoneNumberId: "999"
  }, deps);

  const pp = await createCheckoutForCartes({
    provider: "paypal",
    userId: USER_ID,
    phone: "5211111111111",
    phoneNumberId: "999"
  }, deps);

  assert.equal(mp.provider, "mercadopago");
  assert.equal(pp.provider, "paypal");
  assert.deepEqual(contexts.map(x => x.kind), ["mercadopago-plan", "paypal-subscription"]);
  assert.ok(contexts.every(x => x.context.user_id === USER_ID));
});

test("V018: endpoint Web resuelve web_identity y usa el mismo user_id central", async () => {
  let resolved = null;
  let checkoutInput = null;

  const handler = createCartesSubscriptionHandler({
    resolverOCrearUsuarioPorIdentidad: async (input) => {
      resolved = input;
      return { user_id: USER_ID };
    },
    createCheckoutForCartes: async (input) => {
      checkoutInput = input;
      return {
        provider: "paypal",
        url: "https://example.invalid/paypal",
        user_id: USER_ID
      };
    }
  });

  const response = await handler(new Request("https://qa.invalid/.netlify/functions/cartes-subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "checkout",
      provider: "paypal",
      accepted_terms: true,
      web_identity: "web_1234567890abcdef"
    })
  }));

  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.deepEqual(resolved, { tipo: "web", valor: "web_1234567890abcdef" });
  assert.equal(checkoutInput.userId, USER_ID);
});

test("V018: endpoint Web exige aceptación legal", async () => {
  const handler = createCartesSubscriptionHandler({
    resolverOCrearUsuarioPorIdentidad: async () => ({ user_id: USER_ID })
  });

  const response = await handler(new Request("https://qa.invalid/.netlify/functions/cartes-subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "checkout",
      provider: "paypal",
      accepted_terms: false,
      web_identity: "web_1234567890abcdef"
    })
  }));

  assert.equal(response.status, 400);
});

test("V018: Web no fuerza WhatsApp para Suscribirme y prioriza provider dentro del flujo", async () => {
  const fs = await import("node:fs");
  const web = fs.readFileSync(new URL("../../channels/web/public/bot/guia-masonico.js", import.meta.url), "utf8");

  assert.match(web, /WEB_SUBSCRIPTION_FLOW_V018/);
  assert.match(web, /subscriptionEndpoint:\s*"\/\.netlify\/functions\/cartes-subscription"/);
  assert.match(web, /await\s+comenzarSuscripcionWeb\(\)/);
  assert.doesNotMatch(
    web.slice(web.indexOf('if (id === "suscribirme")'), web.indexOf('if (id === "mi_suscripcion")')),
    /wa\.me|startWhatsAppLink|Abriré WhatsApp/
  );

  const flowIndex = web.indexOf("if (webSubscriptionFlow)");
  const menuOptionIndex = web.indexOf("if (menuOption)", flowIndex);
  assert.ok(flowIndex >= 0 && menuOptionIndex > flowIndex, "El flujo de pago debe interceptar 1/2 antes del menú genérico.");
});

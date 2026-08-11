import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import { sincronizarSuscripcionCentral, obtenerSuscripcionCentral } from "../../channels/whatsapp/functions/lib-cartes-account-client.mjs";
import { construirPayloadPlan } from "../../channels/whatsapp/functions/lib-mercadopago.mjs";

const USER_ID = "usr_0123456789abcdef0123456789abcdef";

test("el plan de Mercado Pago referencia el user_id cuando está disponible", () => {
  const payload = construirPayloadPlan({ telefono: "5213312345678", userId: USER_ID, entorno: "test" });
  assert.match(payload._cartes_reference, /^cartes-plus-user:test:usr_[a-f0-9]{32}:\d+$/);
});

test("cliente interno sincroniza suscripción por user_id", async () => {
  const old = process.env.CARTES_INTERNAL_SECRET; process.env.CARTES_INTERNAL_SECRET = "core005-secret";
  try {
    let captured;
    const result = await sincronizarSuscripcionCentral({ userId: USER_ID, subscription: { status: "authorized", preapproval_id: "pre-005" }, fetchImpl: async (_url, options) => {
      captured = options; return new Response(JSON.stringify({ user_id: USER_ID, plan: "plus" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }});
    assert.equal(result.plan, "plus");
    const body = JSON.parse(captured.body);
    assert.equal(body.action, "subscription_sync"); assert.equal(body.user_id, USER_ID); assert.equal(body.subscription.preapproval_id, "pre-005");
    const ts = captured.headers["X-Cartes-Timestamp"];
    const expected = crypto.createHmac("sha256", "core005-secret").update(`${ts}.${captured.body}`).digest("hex");
    assert.equal(captured.headers["X-Cartes-Signature"], expected);
  } finally { if (old === undefined) delete process.env.CARTES_INTERNAL_SECRET; else process.env.CARTES_INTERNAL_SECRET = old; }
});

test("cliente interno puede leer la suscripción del user_id", async () => {
  const old = process.env.CARTES_INTERNAL_SECRET; process.env.CARTES_INTERNAL_SECRET = "core005-secret";
  try {
    const result = await obtenerSuscripcionCentral({ userId: USER_ID, fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body); assert.equal(body.action, "subscription_get");
      return new Response(JSON.stringify({ subscription: { user_id: USER_ID, status: "authorized" } }), { status: 200, headers: { "Content-Type": "application/json" } });
    }});
    assert.equal(result.subscription.status, "authorized");
  } finally { if (old === undefined) delete process.env.CARTES_INTERNAL_SECRET; else process.env.CARTES_INTERNAL_SECRET = old; }
});

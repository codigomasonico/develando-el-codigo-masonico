import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyMetaSignature, extractMetaEvents, extractMessageText } from "../channels/whatsapp/functions/lib-meta.mjs";
import { verifyMercadoPagoWebhook } from "../channels/whatsapp/functions/lib-mercadopago.mjs";

test("Meta signature validates raw payload", () => {
  const secret = "secret";
  const raw = Buffer.from('{"object":"whatsapp_business_account"}', "utf8");
  const sig = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  assert.equal(verifyMetaSignature(raw, sig, secret), true);
  assert.equal(verifyMetaSignature(Buffer.from("x"), sig, secret), false);
});

test("Meta payload exposes actual phone_number_id from webhook", () => {
  const payload = { entry: [{ changes: [{ value: { metadata: { phone_number_id: "1205856839283337" }, messages: [{ id: "wamid.1", from: "5218115774235", type: "text", text: { body: "hola" } }] } }] }] };
  const { messages } = extractMetaEvents(payload);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].phoneNumberId, "1205856839283337");
  assert.equal(extractMessageText(messages[0]), "hola");
});

test("Mercado Pago webhook HMAC validates", () => {
  const secret = "mp-secret";
  const id = "123";
  const requestId = "abc";
  const ts = "1700000000";
  const manifest = `id:${id};request-id:${requestId};ts:${ts};`;
  const v1 = crypto.createHmac("sha256", secret).update(manifest, "utf8").digest("hex");
  assert.equal(verifyMercadoPagoWebhook({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: requestId, dataId: id, secret }), true);
});

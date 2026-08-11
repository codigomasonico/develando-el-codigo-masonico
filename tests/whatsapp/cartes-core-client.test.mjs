import assert from "node:assert/strict";
import test from "node:test";
import { consultarCartesCore } from "../../channels/whatsapp/functions/lib-cartes-core-client.mjs";

test("el cliente envía identidad interna y externa al Core", async () => {
  let payload;
  const fetchImpl = async (_url, options) => {
    payload = JSON.parse(options.body);
    return new Response(JSON.stringify({ answer: "Respuesta", meta: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  const result = await consultarCartesCore({
    pregunta: "¿Qué es la escuadra?",
    channel: "whatsapp",
    externalUserId: "528115774235",
    userId: "usr_123",
    requestId: "wamid_123",
    fetchImpl
  });

  assert.equal(result.answer, "Respuesta");
  assert.deepEqual(payload.client, {
    channel: "whatsapp",
    external_user_id: "528115774235",
    user_id: "usr_123",
    request_id: "wamid_123"
  });
});

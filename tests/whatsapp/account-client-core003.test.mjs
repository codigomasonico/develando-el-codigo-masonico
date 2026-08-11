import assert from "node:assert/strict";
import test from "node:test";
import { reservarUsoCentral } from "../../channels/whatsapp/functions/lib-cartes-account-client.mjs";

const oldSecret = process.env.CARTES_INTERNAL_SECRET;
process.env.CARTES_INTERNAL_SECRET = "test-secret-core003";

test("cliente de cuenta firma la llamada interna", async () => {
  let captured;
  const fetchImpl = async (_url, options) => {
    captured = options;
    return new Response(JSON.stringify({ permitida: true, usadas: 1, disponibles: 4 }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const result = await reservarUsoCentral({ userId: "usr_0123456789abcdef0123456789abcdef", plan: "gratuito", requestId: "wamid-1", fetchImpl });
  assert.equal(result.permitida, true);
  assert.match(captured.headers["X-Cartes-Signature"], /^[a-f0-9]{64}$/);
  assert.ok(Number(captured.headers["X-Cartes-Timestamp"]) > 0);
  const body = JSON.parse(captured.body);
  assert.equal(body.action, "reserve");
  assert.equal(body.channel, "whatsapp");
});

test.after(() => {
  if (oldSecret === undefined) delete process.env.CARTES_INTERNAL_SECRET;
  else process.env.CARTES_INTERNAL_SECRET = oldSecret;
});

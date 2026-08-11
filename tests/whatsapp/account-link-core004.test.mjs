import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import { completarVinculacionCentral } from "../../channels/whatsapp/functions/lib-cartes-account-client.mjs";

test("cliente interno envía link_complete firmado", async () => {
  const previous = process.env.CARTES_INTERNAL_SECRET;
  process.env.CARTES_INTERNAL_SECRET = "core004-secret";
  try {
    let captured;
    const result = await completarVinculacionCentral({
      userId: "usr_0123456789abcdef0123456789abcdef",
      code: "123456",
      fetchImpl: async (_url, options) => {
        captured = options;
        return new Response(JSON.stringify({ linked: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
    });
    assert.equal(result.linked, true);
    const body = JSON.parse(captured.body);
    assert.deepEqual(body, { action: "link_complete", user_id: "usr_0123456789abcdef0123456789abcdef", code: "123456" });
    const ts = captured.headers["X-Cartes-Timestamp"];
    const expected = crypto.createHmac("sha256", "core004-secret").update(`${ts}.${captured.body}`).digest("hex");
    assert.equal(captured.headers["X-Cartes-Signature"], expected);
  } finally {
    if (previous === undefined) delete process.env.CARTES_INTERNAL_SECRET;
    else process.env.CARTES_INTERNAL_SECRET = previous;
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  determinarPlanDesdeSuscripcion,
  obtenerPlanUsuario,
  obtenerSuscripcionUsuario,
  resolverOCrearUsuarioPorIdentidad,
  sincronizarSuscripcionUsuario
} from "../../core/ai/lib-cartes-account.mjs";

function memoryStore() {
  const data = new Map(); let seq = 0;
  return {
    async get(key) { const e = data.get(key); return e ? structuredClone(e.data) : null; },
    async getWithMetadata(key) { const e = data.get(key); return e ? { data: structuredClone(e.data), etag: e.etag, metadata: {} } : null; },
    async setJSON(key, value, options = {}) {
      const current = data.get(key);
      if (options.onlyIfNew && current) return { modified: false };
      if (options.onlyIfMatch && (!current || current.etag !== options.onlyIfMatch)) return { modified: false };
      seq += 1; const etag = `"e-${seq}"`; data.set(key, { data: structuredClone(value), etag }); return { modified: true, etag };
    }
  };
}

const NOW = new Date("2026-08-08T12:00:00.000Z");

test("una suscripción authorized convierte al user_id en Plus", async () => {
  const store = memoryStore();
  const user = await resolverOCrearUsuarioPorIdentidad({ tipo: "web", valor: "web_core005_plus", fecha: NOW, store });
  const result = await sincronizarSuscripcionUsuario({ userId: user.user_id, subscription: { preapproval_id: "pre-1", status: "authorized", plan: "cartes_plus" }, fecha: NOW, store });
  assert.equal(result.plan, "plus");
  assert.equal(await obtenerPlanUsuario({ userId: user.user_id, store }), "plus");
  const sub = await obtenerSuscripcionUsuario({ userId: user.user_id, fecha: NOW, store });
  assert.equal(sub.user_id, user.user_id);
  assert.equal(sub.preapproval_id, "pre-1");
});

test("cancelar renovación conserva Plus hasta access_until", () => {
  assert.equal(determinarPlanDesdeSuscripcion({ status: "cancelled", renovacion_cancelada: true, access_until: "2026-08-20T00:00:00.000Z" }, NOW), "plus");
  assert.equal(determinarPlanDesdeSuscripcion({ status: "cancelled", renovacion_cancelada: true, access_until: "2026-08-01T00:00:00.000Z" }, NOW), "gratuito");
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  actualizarIdiomaUsuario,
  obtenerIdiomaUsuario,
  resolverOCrearUsuarioPorIdentidad
} from "../../core/ai/lib-cartes-account.mjs";

function memoryStore() {
  const records = new Map();
  let sequence = 0;

  return {
    async get(key) {
      const entry = records.get(key);
      return entry ? structuredClone(entry.data) : null;
    },
    async getWithMetadata(key) {
      const entry = records.get(key);
      return entry
        ? { data: structuredClone(entry.data), etag: entry.etag, metadata: {} }
        : null;
    },
    async setJSON(key, value, options = {}) {
      const current = records.get(key);
      if (options.onlyIfNew && current) return { modified: false };
      if (options.onlyIfMatch && current?.etag !== options.onlyIfMatch) {
        return { modified: false };
      }

      sequence += 1;
      const etag = `etag-${sequence}`;
      records.set(key, { data: structuredClone(value), etag });
      return { modified: true, etag };
    }
  };
}

test("V140 una cuenta nueva conserva español como idioma predeterminado", async () => {
  const store = memoryStore();
  const account = await resolverOCrearUsuarioPorIdentidad({
    tipo: "web",
    valor: "web_locale_default",
    store
  });

  assert.equal(await obtenerIdiomaUsuario({ userId: account.user_id, store }), "es");
});

test("V140 el idioma de cuenta se actualiza y queda disponible para ambos canales", async () => {
  const store = memoryStore();
  const account = await resolverOCrearUsuarioPorIdentidad({
    tipo: "web",
    valor: "web_locale_shared",
    store
  });

  const updated = await actualizarIdiomaUsuario({
    userId: account.user_id,
    locale: "en-US",
    store
  });

  assert.equal(updated.locale, "en");
  assert.equal(updated.changed, true);
  assert.equal(await obtenerIdiomaUsuario({ userId: account.user_id, store }), "en");
});

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  completarVinculacionConWhatsApp,
  desvincularIdentidadUsuario,
  iniciarVinculacionWeb,
  obtenerEstadoUsoMensual,
  resolverOCrearUsuarioPorIdentidad,
  resolverUsuarioExistentePorIdentidad,
  sincronizarSuscripcionUsuario,
  vincularIdentidadUsuario
} from "../../core/ai/lib-cartes-account.mjs";

const NOW =
  new Date("2026-08-17T16:00:00.000Z");

function clone(value) {
  return value == null
    ? value
    : JSON.parse(JSON.stringify(value));
}

function memoryStore() {
  const values = new Map();
  const etags = new Map();
  let sequence = 0;

  function nextEtag() {
    sequence += 1;
    return `etag-${sequence}`;
  }

  return {
    async get(key) {
      return clone(values.get(key) ?? null);
    },

    async getWithMetadata(key) {
      return {
        data: clone(values.get(key) ?? null),
        etag: etags.get(key) || null
      };
    },

    async setJSON(key, value, options = {}) {
      const exists = values.has(key);
      const currentEtag =
        etags.get(key) || null;

      if (options.onlyIfNew && exists) {
        return {
          modified: false,
          etag: currentEtag
        };
      }

      if (
        Object.prototype.hasOwnProperty.call(
          options,
          "onlyIfMatch"
        ) &&
        options.onlyIfMatch !== currentEtag
      ) {
        return {
          modified: false,
          etag: currentEtag
        };
      }

      values.set(key, clone(value));

      const etag = nextEtag();
      etags.set(key, etag);

      return {
        modified: true,
        etag
      };
    },

    async delete(key) {
      values.delete(key);
      etags.delete(key);
    }
  };
}

test(
  "V115D3 un número revocado se revincula al user_id Web sin crear otra cuenta",
  async () => {
    const store = memoryStore();

    const web =
      await resolverOCrearUsuarioPorIdentidad({
        tipo: "web",
        valor: "web_v115d3_relink",
        fecha: NOW,
        store
      });

    await vincularIdentidadUsuario({
      userId: web.user_id,
      tipo: "whatsapp",
      valor: "5218115774235",
      fecha: NOW,
      store
    });

    await sincronizarSuscripcionUsuario({
      userId: web.user_id,
      subscription: {
        provider: "paypal",
        status: "authorized",
        subscription_id: "I-V115D3"
      },
      source: "test-v115d3",
      fecha: NOW,
      store
    });

    await desvincularIdentidadUsuario({
      userId: web.user_id,
      tipo: "whatsapp",
      valor: "5218115774235",
      fecha: NOW,
      store
    });

    await assert.rejects(
      () =>
        resolverOCrearUsuarioPorIdentidad({
          tipo: "whatsapp",
          valor: "5218115774235",
          fecha: NOW,
          store
        }),
      (error) =>
        error?.code ===
        "identity_unlinked"
    );

    const link =
      await iniciarVinculacionWeb({
        webIdentity: "web_v115d3_relink",
        fecha: NOW,
        store
      });

    const done =
      await completarVinculacionConWhatsApp({
        code: link.code,
        whatsappPhone: "5218115774235",
        fecha: NOW,
        store
      });

    assert.equal(done.linked, true);
    assert.equal(done.relinked, true);
    assert.equal(done.user_id, web.user_id);

    const phone =
      await resolverUsuarioExistentePorIdentidad({
        tipo: "whatsapp",
        valor: "5218115774235",
        store
      });

    assert.equal(
      phone.user_id,
      web.user_id
    );

    const usage =
      await obtenerEstadoUsoMensual({
        userId: web.user_id,
        fecha: NOW,
        store
      });

    assert.equal(usage.plan, "plus");
    assert.equal(usage.limite, 50);
  }
);

test(
  "V115D3 vinculación normal de número nuevo conserva convergencia histórica",
  async () => {
    const store = memoryStore();

    const web =
      await resolverOCrearUsuarioPorIdentidad({
        tipo: "web",
        valor: "web_v115d3_normal",
        fecha: NOW,
        store
      });

    const link =
      await iniciarVinculacionWeb({
        webIdentity: "web_v115d3_normal",
        fecha: NOW,
        store
      });

    const done =
      await completarVinculacionConWhatsApp({
        code: link.code,
        whatsappPhone: "5213312345678",
        fecha: NOW,
        store
      });

    assert.equal(done.linked, true);
    assert.notEqual(
      done.user_id,
      web.user_id
    );

    const webAfter =
      await resolverUsuarioExistentePorIdentidad({
        tipo: "web",
        valor: "web_v115d3_normal",
        store
      });

    const waAfter =
      await resolverUsuarioExistentePorIdentidad({
        tipo: "whatsapp",
        valor: "5213312345678",
        store
      });

    assert.equal(
      webAfter.user_id,
      waAfter.user_id
    );

    assert.equal(
      waAfter.user_id,
      done.user_id
    );
  }
);

test(
  "V115D3 WhatsApp procesa VINCULAR antes de resolver identidad",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "../../channels/whatsapp/functions/cartes-whatsapp.mjs",
          import.meta.url
        ),
        "utf8"
      );

    const processStart =
      source.indexOf(
        "async function processMessage("
      );

    const processEnd =
      source.indexOf(
        "async function rechazarArchivoNoCompatibleWhatsApp(",
        processStart
      );

    const block =
      source.slice(
        processStart,
        processEnd
      );

    const link =
      block.indexOf(
        "const linkMatch"
      );

    const resolve =
      block.indexOf(
        "resolverOCrearUsuarioPorIdentidad"
      );

    assert.ok(link >= 0);
    assert.ok(resolve > link);

    assert.match(
      block,
      /whatsappPhone:\s*phone/
    );

    assert.match(
      block,
      /identity_unlinked/
    );

    assert.match(
      block,
      /Este número está desvinculado/
    );
  }
);
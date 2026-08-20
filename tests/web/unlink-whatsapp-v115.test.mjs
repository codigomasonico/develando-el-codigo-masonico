import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  completarVinculacionConWhatsApp,
  desvincularWhatsAppUsuario,
  iniciarVinculacionWeb,
  obtenerEstadoVinculacionWeb,
  obtenerEstadoUsoMensual,
  resolverOCrearUsuarioPorIdentidad,
  resolverUsuarioExistentePorIdentidad,
  sincronizarSuscripcionUsuario
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
  "V115D4 Web desvincula WhatsApp sin alterar user_id, Plus ni consumo",
  async () => {
    const store = memoryStore();

    const wa =
      await resolverOCrearUsuarioPorIdentidad({
        tipo: "whatsapp",
        valor: "5218115774235",
        fecha: NOW,
        store
      });

    const webInitial =
      await resolverOCrearUsuarioPorIdentidad({
        tipo: "web",
        valor: "web_v115d4_unlink",
        fecha: NOW,
        store
      });

    const link =
      await iniciarVinculacionWeb({
        webIdentity: "web_v115d4_unlink",
        fecha: NOW,
        store
      });

    const linked =
      await completarVinculacionConWhatsApp({
        code: link.code,
        whatsappUserId: wa.user_id,
        fecha: NOW,
        store
      });

    assert.equal(linked.user_id, wa.user_id);
    assert.notEqual(webInitial.user_id, wa.user_id);

    await sincronizarSuscripcionUsuario({
      userId: wa.user_id,
      subscription: {
        provider: "paypal",
        status: "authorized",
        subscription_id: "I-V115D4"
      },
      source: "test-v115d4",
      fecha: NOW,
      store
    });

    const before =
      await obtenerEstadoUsoMensual({
        userId: wa.user_id,
        fecha: NOW,
        store
      });

    const result =
      await desvincularWhatsAppUsuario({
        userId: wa.user_id,
        fecha: NOW,
        store
      });

    assert.equal(result.unlinked, true);

    const oldPhone =
      await resolverUsuarioExistentePorIdentidad({
        tipo: "whatsapp",
        valor: "5218115774235",
        store
      });

    assert.equal(oldPhone, null);

    const web =
      await resolverUsuarioExistentePorIdentidad({
        tipo: "web",
        valor: "web_v115d4_unlink",
        store
      });

    assert.equal(web.user_id, wa.user_id);

    const after =
      await obtenerEstadoUsoMensual({
        userId: wa.user_id,
        fecha: NOW,
        store
      });

    assert.equal(after.user_id, wa.user_id);
    assert.equal(after.plan, "plus");
    assert.equal(after.limite, 50);
    assert.equal(after.usadas, before.usadas);

    const status =
      await obtenerEstadoVinculacionWeb({
        webIdentity: "web_v115d4_unlink",
        fecha: NOW,
        store
      });

    assert.equal(status.linked, false);
    assert.equal(status.status, "not_started");

    await assert.rejects(
      () =>
        resolverOCrearUsuarioPorIdentidad({
          tipo: "whatsapp",
          valor: "5218115774235",
          fecha: NOW,
          store
        }),
      (error) =>
        error?.code === "identity_unlinked"
    );
  }
);

test(
  "V115D4 no permite desvincular WhatsApp si es el único acceso",
  async () => {
    const store = memoryStore();

    const wa =
      await resolverOCrearUsuarioPorIdentidad({
        tipo: "whatsapp",
        valor: "5213311111111",
        fecha: NOW,
        store
      });

    await assert.rejects(
      () =>
        desvincularWhatsAppUsuario({
          userId: wa.user_id,
          fecha: NOW,
          store
        }),
      /única identidad de acceso/
    );

    const stillLinked =
      await resolverUsuarioExistentePorIdentidad({
        tipo: "whatsapp",
        valor: "5213311111111",
        store
      });

    assert.equal(
      stillLinked.user_id,
      wa.user_id
    );
  }
);

test(
  "V115D4 endpoint Web usa lookup existente y action unlink_whatsapp",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "../../core/ai/cartes-link.mjs",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      source,
      /action === "unlink_whatsapp"/
    );

    assert.match(
      source,
      /resolverUsuarioExistentePorIdentidad/
    );

    assert.match(
      source,
      /desvincularWhatsAppUsuario/
    );
  }
);

test(
  "V115D4 Web muestra acción, confirma y vuelve a Vincular",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "../../channels/web/public/bot/guia-masonico.js",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      source,
      /CARTES_UNLINK_CHANNEL_V115/
    );

    assert.match(
      source,
      /label: "Desvincular WhatsApp"/
    );

    assert.match(
      source,
      /confirm_unlink_whatsapp/
    );

    assert.match(
      source,
      /action: "unlink_whatsapp"/
    );

    assert.match(
      source,
      /ui\.link\.textContent = "Vincular"/
    );

    assert.match(
      source,
      /no cancela Cartes Plus/
    );
  }
);

test(
  "V115D4 WhatsApp confirma antes de desvincular y conserva menú principal",
  () => {
    const source =
      fs.readFileSync(
        new URL(
          "../../channels/whatsapp/functions/cartes-whatsapp.mjs",
          import.meta.url
        ),
        "utf8"
      );

    assert.match(
      source,
      /id: "unlink_whatsapp_confirm"/
    );

    assert.match(
      source,
      /d\.desvincularIdentidadUsuario/
    );

    assert.match(
      source,
      /única forma de acceso/
    );

    assert.match(
      source,
      /DESVINCULAR WHATSAPP/
    );

    const menuStart =
      source.indexOf(
        "async function sendMainMenu("
      );

    assert.ok(menuStart >= 0);

    const menuTail =
      source.slice(menuStart);

    const nextFunctionOffset =
      menuTail
        .slice(1)
        .search(
          /\n(?:async\s+)?function\s+[A-Za-z0-9_]+\s*\(/
        );

    const menuBlock =
      nextFunctionOffset >= 0
        ? menuTail.slice(
            0,
            nextFunctionOffset + 1
          )
        : menuTail;

    const menuIds = [
      "menu_conversar",
      "menu_plus",
      "menu_suscribirme",
      "menu_suscripcion",
      "menu_ayuda",
      "menu_legal"
    ];

    for (const id of menuIds) {
      assert.match(
        menuBlock,
        new RegExp(id)
      );
    }

    assert.doesNotMatch(
      menuBlock,
      /unlink_whatsapp/
    );
  }
);
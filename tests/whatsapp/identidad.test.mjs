import assert from "node:assert/strict";
import test from "node:test";
import {
  obtenerUsuarioCartes,
  resolverOCrearUsuarioPorIdentidad,
  vincularIdentidadUsuario
} from "../../channels/whatsapp/functions/lib-identidad-cartes.mjs";

function crearStoreMemoria() {
  const datos = new Map();
  let secuencia = 0;

  return {
    async get(clave) {
      const entrada = datos.get(clave);
      return entrada ? structuredClone(entrada.data) : null;
    },
    async getWithMetadata(clave) {
      const entrada = datos.get(clave);
      if (!entrada) return null;
      return {
        data: structuredClone(entrada.data),
        etag: entrada.etag,
        metadata: {}
      };
    },
    async setJSON(clave, valor, opciones = {}) {
      const actual = datos.get(clave);

      if (opciones.onlyIfNew && actual) return { modified: false };
      if (opciones.onlyIfMatch && actual?.etag !== opciones.onlyIfMatch) {
        return { modified: false };
      }
      if (opciones.onlyIfMatch && !actual) return { modified: false };

      secuencia += 1;
      const etag = `"etag-${secuencia}"`;
      datos.set(clave, { data: structuredClone(valor), etag });
      return { modified: true, etag };
    }
  };
}

test("el mismo WhatsApp conserva el mismo user_id", async () => {
  const store = crearStoreMemoria();

  const primero = await resolverOCrearUsuarioPorIdentidad({
    tipo: "whatsapp",
    valor: "5218115774235",
    store
  });
  const segundo = await resolverOCrearUsuarioPorIdentidad({
    tipo: "whatsapp",
    valor: "+52 81 1577 4235",
    store
  });

  assert.match(primero.user_id, /^usr_[a-f0-9]{32}$/);
  assert.equal(segundo.user_id, primero.user_id);
  assert.equal(primero.identity_value, "528115774235");
  assert.equal(segundo.created, false);
});

test("dos identidades diferentes crean usuarios diferentes", async () => {
  const store = crearStoreMemoria();
  const a = await resolverOCrearUsuarioPorIdentidad({
    tipo: "whatsapp",
    valor: "5218111111111",
    store
  });
  const b = await resolverOCrearUsuarioPorIdentidad({
    tipo: "whatsapp",
    valor: "5218222222222",
    store
  });

  assert.notEqual(a.user_id, b.user_id);
});

test("una identidad web puede vincularse al mismo usuario", async () => {
  const store = crearStoreMemoria();
  const whatsapp = await resolverOCrearUsuarioPorIdentidad({
    tipo: "whatsapp",
    valor: "5218115774235",
    store
  });

  await vincularIdentidadUsuario({
    userId: whatsapp.user_id,
    tipo: "web",
    valor: "web_abc123",
    store
  });

  const usuario = await obtenerUsuarioCartes({
    userId: whatsapp.user_id,
    store
  });

  assert.deepEqual(usuario.identities.whatsapp, ["528115774235"]);
  assert.deepEqual(usuario.identities.web, ["web_abc123"]);

  const web = await resolverOCrearUsuarioPorIdentidad({
    tipo: "web",
    valor: "web_abc123",
    store
  });
  assert.equal(web.user_id, whatsapp.user_id);
});

test("una identidad no puede pertenecer a dos usuarios", async () => {
  const store = crearStoreMemoria();
  const a = await resolverOCrearUsuarioPorIdentidad({
    tipo: "whatsapp",
    valor: "5218111111111",
    store
  });
  const b = await resolverOCrearUsuarioPorIdentidad({
    tipo: "whatsapp",
    valor: "5218222222222",
    store
  });

  await vincularIdentidadUsuario({
    userId: a.user_id,
    tipo: "web",
    valor: "web_conflict",
    store
  });

  await assert.rejects(
    () =>
      vincularIdentidadUsuario({
        userId: b.user_id,
        tipo: "web",
        valor: "web_conflict",
        store
      }),
    /otro usuario/
  );
});

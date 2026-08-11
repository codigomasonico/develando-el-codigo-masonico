import crypto from "node:crypto";
const PREFIJO_IDENTIDAD = "identity-v1";
const MAX_REINTENTOS = 8;

export async function getCartesIdentityStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({
    name: "cartes-whatsapp",
    consistency: "strong"
  });
}

export function normalizarIdentidadCartes(tipo, valor) {
  const tipoNormalizado = String(tipo || "").trim().toLowerCase();
  let valorNormalizado = String(valor || "").trim();

  if (tipoNormalizado === "whatsapp") {
    valorNormalizado = normalizarTelefonoMexico(valorNormalizado);
  } else if (tipoNormalizado === "email") {
    valorNormalizado = valorNormalizado.toLowerCase();
  }

  if (!tipoNormalizado || !valorNormalizado) {
    throw new Error("La identidad de Cartes requiere tipo y valor válidos.");
  }

  return { tipo: tipoNormalizado, valor: valorNormalizado };
}

export async function resolverOCrearUsuarioPorIdentidad({
  tipo,
  valor,
  fecha = new Date(),
  store = null
}) {
  store ||= await getCartesIdentityStore();
  const identidad = normalizarIdentidadCartes(tipo, valor);
  const clave = claveIdentidad(identidad.tipo, identidad.valor);

  const existente = await leerJSON(store, clave);
  if (existente?.user_id) {
    await asegurarRegistroUsuario({
      userId: existente.user_id,
      identidad,
      fecha,
      store
    });
    return construirResultado(existente.user_id, identidad, false);
  }

  for (let intento = 0; intento < MAX_REINTENTOS; intento += 1) {
    const userId = crearUserId();
    const ahora = fecha.toISOString();
    const mapping = {
      version: 1,
      user_id: userId,
      identity_type: identidad.tipo,
      identity_value: identidad.valor,
      created_at: ahora,
      updated_at: ahora
    };

    const resultado = await store.setJSON(clave, mapping, { onlyIfNew: true });

    if (resultado?.modified) {
      await asegurarRegistroUsuario({ userId, identidad, fecha, store });
      return construirResultado(userId, identidad, true);
    }

    const ganador = await leerJSON(store, clave);
    if (ganador?.user_id) {
      await asegurarRegistroUsuario({
        userId: ganador.user_id,
        identidad,
        fecha,
        store
      });
      return construirResultado(ganador.user_id, identidad, false);
    }
  }

  throw new Error("No se pudo resolver la identidad de Cartes por concurrencia.");
}

export async function vincularIdentidadUsuario({
  userId,
  tipo,
  valor,
  fecha = new Date(),
  store = null
}) {
  store ||= await getCartesIdentityStore();
  const id = String(userId || "").trim();
  if (!id) throw new Error("Se requiere un user_id válido para vincular una identidad.");

  const identidad = normalizarIdentidadCartes(tipo, valor);
  const clave = claveIdentidad(identidad.tipo, identidad.valor);
  const existente = await leerJSON(store, clave);

  if (existente?.user_id && existente.user_id !== id) {
    throw new Error("La identidad ya está vinculada a otro usuario de Cartes.");
  }

  if (!existente) {
    const ahora = fecha.toISOString();
    const mapping = {
      version: 1,
      user_id: id,
      identity_type: identidad.tipo,
      identity_value: identidad.valor,
      created_at: ahora,
      updated_at: ahora
    };
    const creado = await store.setJSON(clave, mapping, { onlyIfNew: true });

    if (!creado?.modified) {
      const ganador = await leerJSON(store, clave);
      if (ganador?.user_id !== id) {
        throw new Error("La identidad fue vinculada concurrentemente a otro usuario.");
      }
    }
  }

  await asegurarRegistroUsuario({ userId: id, identidad, fecha, store });
  return construirResultado(id, identidad, false);
}

export async function obtenerUsuarioCartes({
  userId,
  store = null
}) {
  store ||= await getCartesIdentityStore();
  const id = String(userId || "").trim();
  if (!id) return null;
  return await leerJSON(store, claveUsuario(id));
}

async function asegurarRegistroUsuario({ userId, identidad, fecha, store }) {
  const clave = claveUsuario(userId);

  for (let intento = 0; intento < MAX_REINTENTOS; intento += 1) {
    const entrada = await store.getWithMetadata(clave, {
      type: "json",
      consistency: "strong"
    });
    const ahora = fecha.toISOString();

    if (!entrada?.data) {
      const nuevo = {
        version: 1,
        user_id: userId,
        identities: {
          [identidad.tipo]: [identidad.valor]
        },
        created_at: ahora,
        updated_at: ahora
      };

      const creado = await store.setJSON(clave, nuevo, { onlyIfNew: true });
      if (creado?.modified) return nuevo;
      continue;
    }

    const actual = normalizarUsuario(entrada.data, userId);
    const actuales = new Set(actual.identities[identidad.tipo] || []);

    if (actuales.has(identidad.valor)) return actual;

    actuales.add(identidad.valor);
    const siguiente = {
      ...actual,
      identities: {
        ...actual.identities,
        [identidad.tipo]: [...actuales]
      },
      updated_at: ahora
    };

    const guardado = await store.setJSON(
      clave,
      siguiente,
      entrada?.etag ? { onlyIfMatch: entrada.etag } : { onlyIfNew: true }
    );

    if (guardado?.modified) return siguiente;
  }

  throw new Error("No se pudo actualizar el usuario de Cartes por concurrencia.");
}

function construirResultado(userId, identidad, creado) {
  return {
    user_id: userId,
    identity_type: identidad.tipo,
    identity_value: identidad.valor,
    created: creado
  };
}

function normalizarUsuario(valor, userId) {
  return {
    version: 1,
    user_id: String(valor?.user_id || userId),
    identities:
      valor?.identities && typeof valor.identities === "object"
        ? valor.identities
        : {},
    created_at: valor?.created_at || new Date().toISOString(),
    updated_at: valor?.updated_at || new Date().toISOString()
  };
}

function crearUserId() {
  return `usr_${crypto.randomUUID().replace(/-/g, "")}`;
}

function claveIdentidad(tipo, valor) {
  return `${PREFIJO_IDENTIDAD}:identity:${tipo}:${valor}`;
}

function claveUsuario(userId) {
  return `${PREFIJO_IDENTIDAD}:user:${userId}`;
}

async function leerJSON(store, clave) {
  return await store.get(clave, { type: "json", consistency: "strong" });
}

function normalizarTelefonoMexico(telefono) {
  const limpio = String(telefono || "").replace(/\D/g, "");

  if (limpio.startsWith("521") && limpio.length === 13) {
    return `52${limpio.slice(3)}`;
  }

  return limpio;
}

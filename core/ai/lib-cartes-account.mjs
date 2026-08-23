import { CARTES_CONCURRENCY_MAX_RETRIES } from "./config.mjs";
import { CARTES_CONVERSATION_MESSAGE_MAX_CHARS } from "./config.mjs";
import { CARTES_CONVERSATION_MEMORY_MESSAGES } from "./config.mjs";
import { CARTES_LINK_CODE_TTL_MS } from "./config.mjs";
import { CARTES_FREE_QUERY_LIMIT, CARTES_PLUS_QUERY_LIMIT } from "./config.mjs";
// CARTES_QA_DEPLOY_STORE_GENERIC
import crypto from "node:crypto";
import {
  completarConsultaCicloCartes,
  fusionarUsoCiclosCartes,
  liberarConsultaCicloCartes,
  obtenerEstadoUsoCicloCartes,
  reservarConsultaCicloCartes
} from "./lib-cartes-usage-cycle.mjs";
import { fusionarUsoRevisionesMensual } from "./lib-cartes-reviews.mjs";
import { fusionarPaquetesRevision } from "./lib-cartes-review-packs.mjs";

export const PLAN_CARTES_GRATUITO = "gratuito";
export const PLAN_CARTES_PLUS = "plus";
export const LIMITES_MENSUALES_CARTES = Object.freeze({
  [PLAN_CARTES_GRATUITO]: CARTES_FREE_QUERY_LIMIT,
  [PLAN_CARTES_PLUS]: CARTES_PLUS_QUERY_LIMIT
});

const STORE_NAME = "cartes-core";
const PREFIJO_IDENTIDAD = "account-v1";
const PREFIJO_USO = "usage-v2";
const PREFIJO_PLAN = "plan-v1";
const PREFIJO_VINCULO = "link-v1";
const PREFIJO_SUSCRIPCION = "subscription-v1";
const PREFIJO_CONVERSACION = "conversation-v1";
const MAX_MENSAJES_CONVERSACION = CARTES_CONVERSATION_MEMORY_MESSAGES;
const MAX_CHARS_MENSAJE = CARTES_CONVERSATION_MESSAGE_MAX_CHARS;
const VINCULO_TTL_MS = CARTES_LINK_CODE_TTL_MS;
const TIME_ZONE = "America/Mexico_City";
const RESERVA_PENDIENTE_MS = 10 * 60 * 1000;
const MAX_REINTENTOS = CARTES_CONCURRENCY_MAX_RETRIES;

export async function getCartesAccountStore() {
  const { getStore, getDeployStore } = await import("@netlify/blobs");
  return (process.env.SITE_ID === "c91954f4-08d6-4df6-a831-59457b9a59b3" && process.env.CARTES_QA_LOCAL_FRESH_STORE === "1" ? ((options) => getDeployStore({ ...options, deployID: process.env.DEPLOY_ID || undefined })) : getStore)({
      name: STORE_NAME,
      consistency: "strong"
    });
}

export function normalizarIdentidadCartes(tipo, valor) {
  const t = String(tipo || "").trim().toLowerCase();
  let v = String(valor || "").trim();
  if (t === "whatsapp") v = normalizarTelefonoMexico(v);
  if (t === "email") v = v.toLowerCase();
  if (!t || !v) throw new Error("La identidad de Cartes requiere tipo y valor válidos.");
  return { tipo: t, valor: v };
}

export async function resolverOCrearUsuarioPorIdentidad({ tipo, valor, fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const identidad = normalizarIdentidadCartes(tipo, valor);
  const clave = `${PREFIJO_IDENTIDAD}:identity:${identidad.tipo}:${identidad.valor}`;
  const existente = await store.get(clave, { type: "json", consistency: "strong" });

  // CARTES_SAFE_RELINK_V115
  // Una identidad explícitamente desvinculada no puede convertirse
  // silenciosamente en una cuenta gratuita nueva.
  if (
    existente &&
    !existente?.user_id &&
    String(existente?.status || "").toLowerCase() === "unlinked"
  ) {
    const error =
      new Error("Esta identidad de Cartes está desvinculada.");

    error.code = "identity_unlinked";
    error.identity_type = identidad.tipo;
    error.identity_value = identidad.valor;

    throw error;
  }

  if (existente?.user_id) {
    await asegurarUsuario({ userId: existente.user_id, identidad, fecha, store });
    return resultadoIdentidad(existente.user_id, identidad, false);
  }

  for (let i = 0; i < MAX_REINTENTOS; i += 1) {
    const userId = `usr_${crypto.randomUUID().replace(/-/g, "")}`;
    const ahora = fecha.toISOString();
    const creado = await store.setJSON(clave, {
      version: 1, user_id: userId, identity_type: identidad.tipo,
      identity_value: identidad.valor, created_at: ahora, updated_at: ahora
    }, { onlyIfNew: true });
    if (creado?.modified) {
      await asegurarUsuario({ userId, identidad, fecha, store });
      return resultadoIdentidad(userId, identidad, true);
    }
    const ganador = await store.get(clave, { type: "json", consistency: "strong" });
    if (ganador?.user_id) {
      await asegurarUsuario({ userId: ganador.user_id, identidad, fecha, store });
      return resultadoIdentidad(ganador.user_id, identidad, false);
    }
  }
  throw new Error("No se pudo resolver la identidad de Cartes por concurrencia.");
}

export async function vincularIdentidadUsuario({ userId, tipo, valor, fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const id = validarUserId(userId);
  const identidad = normalizarIdentidadCartes(tipo, valor);
  const clave = `${PREFIJO_IDENTIDAD}:identity:${identidad.tipo}:${identidad.valor}`;
  const entrada = await store.getWithMetadata(clave, { type: "json", consistency: "strong" });
  const existente = entrada?.data || null;

  if (existente?.user_id && existente.user_id !== id) {
    throw new Error("La identidad ya está vinculada a otro usuario de Cartes.");
  }

  const ahora = fecha.toISOString();

  if (!existente) {
    const creado = await store.setJSON(clave, {
      version: 1,
      user_id: id,
      identity_type: identidad.tipo,
      identity_value: identidad.valor,
      created_at: ahora,
      updated_at: ahora
    }, { onlyIfNew: true });

    if (!creado?.modified) {
      const ganador = await store.get(clave, { type: "json", consistency: "strong" });
      if (ganador?.user_id !== id) {
        throw new Error("La identidad fue vinculada concurrentemente a otro usuario.");
      }
    }
  }
  else if (!existente.user_id) {
    // CARTES_IDENTITY_MANAGEMENT_V115
    // Una identidad revocada no crea cuentas automáticamente, pero puede
    // reclamarse de forma explícita después de verificar el canal.
    const reclamada = await store.setJSON(clave, {
      version: 1,
      user_id: id,
      identity_type: identidad.tipo,
      identity_value: identidad.valor,
      created_at: existente.created_at || ahora,
      relinked_at: ahora,
      updated_at: ahora
    }, { onlyIfMatch: entrada.etag });

    if (!reclamada?.modified) {
      throw new Error("La identidad cambió mientras se intentaba volver a vincular.");
    }
  }

  await asegurarUsuario({ userId: id, identidad, fecha, store });
  return resultadoIdentidad(id, identidad, false);
}

// CARTES_IDENTITY_MANAGEMENT_V115
export async function resolverUsuarioExistentePorIdentidad({
  tipo,
  valor,
  store = null
}) {
  store ||= await getCartesAccountStore();

  const identidad =
    normalizarIdentidadCartes(tipo, valor);

  const clave =
    `${PREFIJO_IDENTIDAD}:identity:${identidad.tipo}:${identidad.valor}`;

  const existente =
    await store.get(clave, {
      type: "json",
      consistency: "strong"
    });

  if (!existente?.user_id) return null;

  return resultadoIdentidad(
    existente.user_id,
    identidad,
    false
  );
}

export async function desvincularIdentidadUsuario({
  userId,
  tipo,
  valor,
  fecha = new Date(),
  store = null,
  requireAlternative = true,
  actualizarEstadoVinculoWeb = true
}) {
  store ||= await getCartesAccountStore();

  const id = validarUserId(userId);
  const identidad =
    normalizarIdentidadCartes(tipo, valor);

  const claveIdentidad =
    `${PREFIJO_IDENTIDAD}:identity:${identidad.tipo}:${identidad.valor}`;

  const entrada =
    await store.getWithMetadata(claveIdentidad, {
      type: "json",
      consistency: "strong"
    });

  const existente = entrada?.data || null;

  if (!existente?.user_id) {
    return {
      user_id: id,
      identity_type: identidad.tipo,
      identity_value: identidad.valor,
      unlinked: false,
      already_unlinked: true
    };
  }

  if (existente.user_id !== id) {
    throw new Error(
      "La identidad pertenece a otra cuenta de Cartes."
    );
  }

  const claveUsuario =
    `${PREFIJO_IDENTIDAD}:user:${id}`;

  const usuario =
    await store.get(claveUsuario, {
      type: "json",
      consistency: "strong"
    });

  const identidades =
    usuario?.identities &&
    typeof usuario.identities === "object"
      ? usuario.identities
      : {};

  const restantes = {};

  for (const [identityType, values] of Object.entries(identidades)) {
    const lista =
      Array.isArray(values)
        ? values.map((item) => String(item))
        : [];

    const filtrada =
      identityType === identidad.tipo
        ? lista.filter((item) => item !== identidad.valor)
        : lista;

    if (filtrada.length > 0) {
      restantes[identityType] = [...new Set(filtrada)];
    }
  }

  const cantidadRestante =
    Object.values(restantes)
      .reduce(
        (total, values) =>
          total + (Array.isArray(values) ? values.length : 0),
        0
      );

  if (requireAlternative && cantidadRestante === 0) {
    throw new Error(
      "No puedes desvincular la única identidad de acceso de esta cuenta."
    );
  }

  const ahora = fecha.toISOString();

  // El registro no se elimina. Queda como tombstone sin user_id para:
  // 1) cortar inmediatamente el acceso a la cuenta anterior;
  // 2) impedir que resolverOCrearUsuarioPorIdentidad regale otra cuenta
  //    gratuita automáticamente al mismo número;
  // 3) permitir una revinculación explícita y verificada posteriormente.
  const revocado =
    await store.setJSON(
      claveIdentidad,
      {
        version: 1,
        user_id: null,
        identity_type: identidad.tipo,
        identity_value: identidad.valor,
        status: "unlinked",
        previous_user_id: id,
        created_at: existente.created_at || ahora,
        unlinked_at: ahora,
        updated_at: ahora
      },
      { onlyIfMatch: entrada.etag }
    );

  if (!revocado?.modified) {
    throw new Error(
      "La identidad cambió mientras se intentaba desvincular."
    );
  }

  // El acceso ya quedó revocado. Ahora limpiamos la metadata del usuario
  // con control optimista para no pisar cambios concurrentes.
  for (let intento = 0; intento < MAX_REINTENTOS; intento += 1) {
    const userEntry =
      await store.getWithMetadata(claveUsuario, {
        type: "json",
        consistency: "strong"
      });

    if (!userEntry?.data) break;

    const actual = userEntry.data;
    const actuales =
      actual?.identities &&
      typeof actual.identities === "object"
        ? actual.identities
        : {};

    const siguientes = {};

    for (const [identityType, values] of Object.entries(actuales)) {
      const lista =
        Array.isArray(values)
          ? values.map((item) => String(item))
          : [];

      const filtrada =
        identityType === identidad.tipo
          ? lista.filter((item) => item !== identidad.valor)
          : lista;

      if (filtrada.length > 0) {
        siguientes[identityType] = [...new Set(filtrada)];
      }
    }

    const guardado =
      await store.setJSON(
        claveUsuario,
        {
          ...actual,
          identities: siguientes,
          updated_at: ahora
        },
        { onlyIfMatch: userEntry.etag }
      );

    if (guardado?.modified) break;

    if (intento === MAX_REINTENTOS - 1) {
      throw new Error(
        "El acceso fue revocado, pero no se pudo actualizar la metadata de la cuenta por concurrencia."
      );
    }
  }

  // CARTES_UNLINK_CHANNEL_V115
  // Si se retira WhatsApp, todos los vínculos Web que permanecen
  // en la cuenta dejan de anunciarse como "linked". Esto no toca
  // plan, suscripción, consumo, revisiones ni conversación.
  if (
    identidad.tipo === "whatsapp" &&
    actualizarEstadoVinculoWeb
  ) {
    const webIdentities =
      Array.isArray(restantes.web)
        ? restantes.web
        : [];

    for (const webIdentity of webIdentities) {
      await store.setJSON(
        `${PREFIJO_VINCULO}:web:${webIdentity}`,
        {
          version: 1,
          status: "unlinked",
          linked: false,
          user_id: id,
          unlinked_at: ahora,
          updated_at: ahora
        }
      );
    }
  }

  return {
    user_id: id,
    identity_type: identidad.tipo,
    identity_value: identidad.valor,
    unlinked: true,
    already_unlinked: false
  };
}

export async function obtenerIdentidadesUsuario({
  userId,
  store = null
}) {
  store ||= await getCartesAccountStore();

  const id = validarUserId(userId);

  const usuario =
    await store.get(
      `${PREFIJO_IDENTIDAD}:user:${id}`,
      {
        type: "json",
        consistency: "strong"
      }
    );

  const raw =
    usuario?.identities &&
    typeof usuario.identities === "object"
      ? usuario.identities
      : {};

  const identities = {};

  for (const [tipo, values] of Object.entries(raw)) {
    const clean =
      Array.isArray(values)
        ? [...new Set(
            values
              .map((item) => String(item || "").trim())
              .filter(Boolean)
          )]
        : [];

    if (clean.length > 0) {
      identities[tipo] = clean;
    }
  }

  return {
    user_id: id,
    identities
  };
}

export async function desvincularWhatsAppUsuario({
  userId,
  fecha = new Date(),
  store = null
}) {
  store ||= await getCartesAccountStore();

  const id = validarUserId(userId);

  const account =
    await obtenerIdentidadesUsuario({
      userId: id,
      store
    });

  const phones =
    Array.isArray(account.identities.whatsapp)
      ? account.identities.whatsapp
      : [];

  if (phones.length === 0) {
    return {
      user_id: id,
      unlinked: false,
      already_unlinked: true
    };
  }

  if (phones.length !== 1) {
    throw new Error(
      "La cuenta tiene más de una identidad WhatsApp activa y requiere revisión antes de desvincular."
    );
  }

  return desvincularIdentidadUsuario({
    userId: id,
    tipo: "whatsapp",
    valor: phones[0],
    fecha,
    store,
    requireAlternative: true
  });
}

export async function cambiarNumeroWhatsAppUsuario({
  userId,
  numeroAnterior,
  numeroNuevo,
  fecha = new Date(),
  store = null
}) {
  store ||= await getCartesAccountStore();

  const id = validarUserId(userId);
  const anterior =
    normalizarIdentidadCartes("whatsapp", numeroAnterior);
  const nuevo =
    normalizarIdentidadCartes("whatsapp", numeroNuevo);

  if (anterior.valor === nuevo.valor) {
    return {
      user_id: id,
      changed: false,
      already_current: true,
      old_phone: anterior.valor,
      new_phone: nuevo.valor
    };
  }

  const oldKey =
    `${PREFIJO_IDENTIDAD}:identity:whatsapp:${anterior.valor}`;

  const oldRecord =
    await store.get(oldKey, {
      type: "json",
      consistency: "strong"
    });

  if (oldRecord?.user_id !== id) {
    throw new Error(
      "El número anterior no pertenece a esta cuenta de Cartes."
    );
  }

  const newKey =
    `${PREFIJO_IDENTIDAD}:identity:whatsapp:${nuevo.valor}`;

  const newRecord =
    await store.get(newKey, {
      type: "json",
      consistency: "strong"
    });

  if (
    newRecord?.user_id &&
    newRecord.user_id !== id
  ) {
    return {
      user_id: id,
      changed: false,
      conflict: "identity_in_use",
      old_phone: anterior.valor,
      new_phone: nuevo.valor
    };
  }

  // CARTES_ANTIABUSE_IDENTITY_V115
  // Un número tombstoned de otra cuenta requiere resolución explícita.
  // Si el tombstone pertenece a este mismo user_id, se permite recuperarlo.
  if (
    newRecord &&
    !newRecord?.user_id &&
    String(newRecord?.status || "").toLowerCase() === "unlinked"
  ) {
    const previousUserId =
      String(newRecord?.previous_user_id || "").trim();

    if (
      !previousUserId ||
      previousUserId !== id
    ) {
      return {
        user_id: id,
        changed: false,
        conflict: "identity_previous_account",
        old_phone: anterior.valor,
        new_phone: nuevo.valor
      };
    }
  }

  let linkedNew = false;

  try {
    await vincularIdentidadUsuario({
      userId: id,
      tipo: "whatsapp",
      valor: nuevo.valor,
      fecha,
      store
    });

    linkedNew = true;

    await desvincularIdentidadUsuario({
      userId: id,
      tipo: "whatsapp",
      valor: anterior.valor,
      fecha,
      store,
      requireAlternative: false,
      actualizarEstadoVinculoWeb: false
    });
  }
  catch (error) {
    // Si falla después de añadir el nuevo número, intentamos volver al
    // estado anterior. Nunca movemos plan, suscripción, uso ni conversación.
    if (linkedNew) {
      await desvincularIdentidadUsuario({
        userId: id,
        tipo: "whatsapp",
        valor: nuevo.valor,
        fecha,
        store,
        requireAlternative: false,
        actualizarEstadoVinculoWeb: false
      }).catch(() => {});
    }

    throw error;
  }

  return {
    user_id: id,
    changed: true,
    old_phone: anterior.valor,
    new_phone: nuevo.valor
  };
}
// CARTES_CHANGE_NUMBER_CODE_V115
export async function iniciarCambioNumeroWhatsApp({
  userId,
  fecha = new Date(),
  store = null
}) {
  store ||= await getCartesAccountStore();

  const id = validarUserId(userId);

  const account =
    await obtenerIdentidadesUsuario({
      userId: id,
      store
    });

  const phones =
    Array.isArray(account.identities.whatsapp)
      ? account.identities.whatsapp
      : [];

  if (phones.length !== 1) {
    throw new Error(
      phones.length === 0
        ? "La cuenta no tiene un número de WhatsApp activo para cambiar."
        : "La cuenta tiene más de un número de WhatsApp activo y requiere revisión."
    );
  }

  const oldPhone = phones[0];
  const userKey =
    `${PREFIJO_VINCULO}:change-whatsapp:user:${id}`;

  const previous =
    await store.get(
      userKey,
      {
        type: "json",
        consistency: "strong"
      }
    );

  if (
    previous?.status === "pending" &&
    Date.parse(String(previous.expires_at || "")) >
      fecha.getTime() &&
    /^\d{6}$/.test(String(previous.code || "")) &&
    previous.old_phone === oldPhone
  ) {
    return {
      status: "pending",
      changed: false,
      code: previous.code,
      expires_at: previous.expires_at,
      instruction: `CAMBIAR ${previous.code}`
    };
  }

  const now = fecha.toISOString();
  const expiresAt =
    new Date(
      fecha.getTime() + VINCULO_TTL_MS
    ).toISOString();

  for (
    let attempt = 0;
    attempt < MAX_REINTENTOS * 2;
    attempt += 1
  ) {
    const code =
      String(
        crypto.randomInt(
          0,
          1_000_000
        )
      ).padStart(6, "0");

    const codeKey =
      `${PREFIJO_VINCULO}:change-whatsapp:code:${code}`;

    const created =
      await store.setJSON(
        codeKey,
        {
          version: 1,
          purpose: "change_whatsapp_number",
          code,
          source_user_id: id,
          old_phone: oldPhone,
          status: "pending",
          created_at: now,
          expires_at: expiresAt,
          updated_at: now
        },
        {
          onlyIfNew: true
        }
      );

    if (!created?.modified) {
      continue;
    }

    await store.setJSON(
      userKey,
      {
        version: 1,
        purpose: "change_whatsapp_number",
        code,
        source_user_id: id,
        old_phone: oldPhone,
        status: "pending",
        created_at: now,
        expires_at: expiresAt,
        updated_at: now
      }
    );

    return {
      status: "pending",
      changed: false,
      code,
      expires_at: expiresAt,
      instruction: `CAMBIAR ${code}`
    };
  }

  throw new Error(
    "No se pudo generar un código para cambiar el número de WhatsApp."
  );
}

export async function completarCambioNumeroWhatsApp({
  code,
  whatsappPhone,
  fecha = new Date(),
  store = null
}) {
  store ||= await getCartesAccountStore();

  const codigo =
    String(code || "")
      .replace(/\D/g, "");

  if (!/^\d{6}$/.test(codigo)) {
    throw new Error(
      "El código para cambiar el número debe tener 6 dígitos."
    );
  }

  const newIdentity =
    normalizarIdentidadCartes(
      "whatsapp",
      whatsappPhone
    );

  const codeKey =
    `${PREFIJO_VINCULO}:change-whatsapp:code:${codigo}`;

  const entry =
    await store.getWithMetadata(
      codeKey,
      {
        type: "json",
        consistency: "strong"
      }
    );

  const request = entry?.data;

  if (
    !request ||
    request.purpose !== "change_whatsapp_number"
  ) {
    throw new Error(
      "El código para cambiar el número no existe."
    );
  }

  const sourceUserId =
    validarUserId(
      request.source_user_id
    );

  const oldIdentity =
    normalizarIdentidadCartes(
      "whatsapp",
      request.old_phone
    );

  if (request.status === "completed") {
    if (
      request.new_phone ===
      newIdentity.valor
    ) {
      return {
        user_id: sourceUserId,
        changed: true,
        already_changed: true,
        old_phone: oldIdentity.valor,
        new_phone: newIdentity.valor
      };
    }

    throw new Error(
      "El código para cambiar el número ya fue utilizado."
    );
  }

  if (
    Date.parse(
      String(request.expires_at || "")
    ) <= fecha.getTime()
  ) {
    throw new Error(
      "El código para cambiar el número expiró."
    );
  }

  if (
    oldIdentity.valor ===
    newIdentity.valor
  ) {
    throw new Error(
      "El número nuevo debe ser diferente al número actual."
    );
  }

  const oldKey =
    `${PREFIJO_IDENTIDAD}:identity:whatsapp:${oldIdentity.valor}`;

  const newKey =
    `${PREFIJO_IDENTIDAD}:identity:whatsapp:${newIdentity.valor}`;

  const [oldRecord, newRecord] =
    await Promise.all([
      store.get(
        oldKey,
        {
          type: "json",
          consistency: "strong"
        }
      ),
      store.get(
        newKey,
        {
          type: "json",
          consistency: "strong"
        }
      )
    ]);

  // Recuperación idempotente si el cambio terminó pero el registro
  // del código no alcanzó a marcarse como completed.
  if (
    newRecord?.user_id === sourceUserId &&
    !oldRecord?.user_id &&
    oldRecord?.status === "unlinked" &&
    oldRecord?.previous_user_id === sourceUserId
  ) {
    const now = fecha.toISOString();

    const completed = {
      ...request,
      status: "completed",
      new_phone: newIdentity.valor,
      completed_at: now,
      updated_at: now
    };

    if (entry?.etag) {
      await store.setJSON(
        codeKey,
        completed,
        {
          onlyIfMatch: entry.etag
        }
      );
    }
    else {
      await store.setJSON(
        codeKey,
        completed
      );
    }

    await store.setJSON(
      `${PREFIJO_VINCULO}:change-whatsapp:user:${sourceUserId}`,
      completed
    );

    return {
      user_id: sourceUserId,
      changed: true,
      recovered: true,
      old_phone: oldIdentity.valor,
      new_phone: newIdentity.valor
    };
  }

  if (
    oldRecord?.user_id !==
    sourceUserId
  ) {
    throw new Error(
      "El número actual de la cuenta cambió desde que se generó el código. Genera un código nuevo."
    );
  }

  if (
    newRecord?.user_id &&
    newRecord.user_id !== sourceUserId
  ) {
    return {
      user_id: sourceUserId,
      changed: false,
      conflict: "identity_in_use",
      old_phone: oldIdentity.valor,
      new_phone: newIdentity.valor
    };
  }

  const changed =
    await cambiarNumeroWhatsAppUsuario({
      userId: sourceUserId,
      numeroAnterior: oldIdentity.valor,
      numeroNuevo: newIdentity.valor,
      fecha,
      store
    });

  if (
    !changed?.changed &&
    changed?.conflict
  ) {
    return changed;
  }

  const now = fecha.toISOString();

  const completed = {
    ...request,
    status: "completed",
    new_phone: newIdentity.valor,
    completed_at: now,
    updated_at: now
  };

  if (entry?.etag) {
    const saved =
      await store.setJSON(
        codeKey,
        completed,
        {
          onlyIfMatch: entry.etag
        }
      );

    if (!saved?.modified) {
      throw new Error(
        "El número se cambió, pero el código cambió concurrentemente. Reintenta el mismo código desde el número nuevo."
      );
    }
  }
  else {
    await store.setJSON(
      codeKey,
      completed
    );
  }

  await store.setJSON(
    `${PREFIJO_VINCULO}:change-whatsapp:user:${sourceUserId}`,
    completed
  );

  return {
    user_id: sourceUserId,
    changed: true,
    old_phone: oldIdentity.valor,
    new_phone: newIdentity.valor
  };
}
export function obtenerPeriodoMensual(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit" }).formatToParts(fecha);
  const year = partes.find((p) => p.type === "year")?.value;
  const month = partes.find((p) => p.type === "month")?.value;
  if (!year || !month) throw new Error("No se pudo determinar el periodo mensual de Cartes.");
  return `${year}-${month}`;
}

export async function sincronizarPlanUsuario({ userId, plan, source = "unknown", fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const id = validarUserId(userId);
  const p = normalizarPlan(plan);
  const ahora = fecha.toISOString();
  await store.setJSON(`${PREFIJO_PLAN}:${id}`, { version: 1, user_id: id, plan: p, source, updated_at: ahora });
  return { user_id: id, plan: p, updated_at: ahora };
}


export async function sincronizarSuscripcionUsuario({ userId, subscription, source = "mercadopago", fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const id = validarUserId(userId);
  const actual = await store.get(`${PREFIJO_SUSCRIPCION}:${id}`, { type: "json", consistency: "strong" });
  const ahora = fecha.toISOString();
  const incoming = subscription && typeof subscription === "object" ? subscription : {};
  const registro = {
    ...(actual || {}),
    ...incoming,
    version: 1,
    user_id: id,
    source,
    updated_at: ahora,
    created_at: actual?.created_at || incoming.created_at || ahora
  };
  await store.setJSON(`${PREFIJO_SUSCRIPCION}:${id}`, registro);
  const plan = determinarPlanDesdeSuscripcion(registro, fecha);
  await sincronizarPlanUsuario({ userId: id, plan, source: `subscription:${source}`, fecha, store });
  return { user_id: id, plan, subscription: registro };
}

export async function obtenerSuscripcionUsuario({ userId, fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const id = validarUserId(userId);
  const registro = await store.get(`${PREFIJO_SUSCRIPCION}:${id}`, { type: "json", consistency: "strong" });
  return registro ? { ...registro, plan_actual: determinarPlanDesdeSuscripcion(registro, fecha) } : null;
}

export function determinarPlanDesdeSuscripcion(registro, fecha = new Date()) {
  const estado = String(registro?.status || "").toLowerCase();
  if (estado === "authorized") return PLAN_CARTES_PLUS;
  if (registro?.renovacion_cancelada) {
    const accesoHasta = Date.parse(String(registro?.access_until || registro?.fecha_fin || ""));
    if (Number.isFinite(accesoHasta) && accesoHasta > fecha.getTime()) return PLAN_CARTES_PLUS;
  }
  return PLAN_CARTES_GRATUITO;
}

export async function obtenerPlanUsuario({ userId, store = null }) {
  store ||= await getCartesAccountStore();
  const id = validarUserId(userId);
  const registro = await store.get(`${PREFIJO_PLAN}:${id}`, { type: "json", consistency: "strong" });
  return normalizarPlan(registro?.plan);
}

export async function obtenerEstadoUsoMensual({
  userId,
  plan = null,
  fecha = new Date(),
  store = null
}) {
  store ||= await getCartesAccountStore();

  const id = validarUserId(userId);

  const p = normalizarPlan(
    plan ||
    await obtenerPlanUsuario({
      userId: id,
      store
    })
  );

  const subscription =
    p === PLAN_CARTES_PLUS
      ? await obtenerSuscripcionUsuario({
          userId: id,
          fecha,
          store
        })
      : null;

  return obtenerEstadoUsoCicloCartes({
    userId: id,
    plan: p,
    subscription,
    fecha,
    store
  });
}

export async function reservarConsultaMensual({
  userId,
  plan = null,
  requestId,
  channel = "unknown",
  fecha = new Date(),
  store = null
}) {
  store ||= await getCartesAccountStore();

  const id = validarUserId(userId);

  const p = normalizarPlan(
    plan ||
    await obtenerPlanUsuario({
      userId: id,
      store
    })
  );

  const subscription =
    p === PLAN_CARTES_PLUS
      ? await obtenerSuscripcionUsuario({
          userId: id,
          fecha,
          store
        })
      : null;

  return reservarConsultaCicloCartes({
    userId: id,
    plan: p,
    subscription,
    requestId,
    channel,
    fecha,
    store
  });
}

export async function completarConsultaMensual({
  userId,
  requestId,
  fecha = new Date(),
  store = null
}) {
  store ||= await getCartesAccountStore();

  const id = validarUserId(userId);

  const p =
    await obtenerPlanUsuario({
      userId: id,
      store
    });

  const subscription =
    p === PLAN_CARTES_PLUS
      ? await obtenerSuscripcionUsuario({
          userId: id,
          fecha,
          store
        })
      : null;

  return completarConsultaCicloCartes({
    userId: id,
    plan: p,
    subscription,
    requestId,
    fecha,
    store
  });
}

export async function liberarConsultaMensual({
  userId,
  requestId,
  fecha = new Date(),
  store = null
}) {
  store ||= await getCartesAccountStore();

  const id = validarUserId(userId);

  const p =
    await obtenerPlanUsuario({
      userId: id,
      store
    });

  const subscription =
    p === PLAN_CARTES_PLUS
      ? await obtenerSuscripcionUsuario({
          userId: id,
          fecha,
          store
        })
      : null;

  return liberarConsultaCicloCartes({
    userId: id,
    plan: p,
    subscription,
    requestId,
    fecha,
    store
  });
}



export async function obtenerConversacionUsuario({ userId, store = null }) {
  store ||= await getCartesAccountStore();
  const id = validarUserId(userId);
  const registro = await store.get(`${PREFIJO_CONVERSACION}:${id}`, { type: "json", consistency: "strong" });
  return normalizarConversacion(registro, id);
}

export async function registrarIntercambioConversacion({ userId, question, answer, channel = "unknown", requestId = null, fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const id = validarUserId(userId);
  const q = limpiarMensajeConversacion(question);
  const a = limpiarMensajeConversacion(answer);
  if (!q || !a) return obtenerConversacionUsuario({ userId: id, store });
  const clave = `${PREFIJO_CONVERSACION}:${id}`;
  const ahora = fecha.toISOString();
  for (let i = 0; i < MAX_REINTENTOS; i += 1) {
    const entrada = await store.getWithMetadata(clave, { type: "json", consistency: "strong" });
    const actual = normalizarConversacion(entrada?.data, id);
    if (requestId && actual.exchanges.some((x) => x.request_id === String(requestId))) return actual;
    const exchange = {
      request_id: requestId ? String(requestId) : null,
      channel: String(channel || "unknown"),
      created_at: ahora,
      messages: [
        { role: "user", content: q },
        { role: "assistant", content: a }
      ]
    };
    const exchanges = [...actual.exchanges, exchange].slice(-Math.ceil(MAX_MENSAJES_CONVERSACION / 2));
    const nuevo = { version: 1, user_id: id, exchanges, updated_at: ahora };
    const opciones = entrada?.etag ? { onlyIfMatch: entrada.etag } : { onlyIfNew: true };
    const guardado = await store.setJSON(clave, nuevo, opciones);
    if (guardado?.modified) return nuevo;
  }
  throw new Error("No se pudo actualizar la conversación por concurrencia.");
}

export async function limpiarConversacionUsuario({ userId, fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const id = validarUserId(userId);
  const registro = { version: 1, user_id: id, exchanges: [], updated_at: fecha.toISOString() };
  await store.setJSON(`${PREFIJO_CONVERSACION}:${id}`, registro);
  return registro;
}

export function mensajesDeConversacion(registro) {
  return normalizarConversacion(registro, registro?.user_id || "usr_00000000000000000000000000000000")
    .exchanges.flatMap((x) => x.messages).slice(-MAX_MENSAJES_CONVERSACION);
}

export async function iniciarVinculacionWeb({ webIdentity, fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const identidad = normalizarIdentidadCartes("web", webIdentity);
  const claveWeb = `${PREFIJO_VINCULO}:web:${identidad.valor}`;
  const previo = await store.get(claveWeb, { type: "json", consistency: "strong" });
  if (previo?.status === "linked") return { status: "linked", linked: true };
  if (previo?.status === "pending" && Date.parse(String(previo.expires_at || "")) > fecha.getTime() && /^\d{6}$/.test(String(previo.code || ""))) {
    return { status: "pending", linked: false, code: previo.code, expires_at: previo.expires_at, instruction: `VINCULAR ${previo.code}` };
  }
  const origen = await resolverOCrearUsuarioPorIdentidad({ tipo: "web", valor: identidad.valor, fecha, store });
  const ahora = fecha.toISOString();
  const expira = new Date(fecha.getTime() + VINCULO_TTL_MS).toISOString();

  for (let i = 0; i < MAX_REINTENTOS * 2; i += 1) {
    const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const claveCodigo = `${PREFIJO_VINCULO}:code:${codigo}`;
    const creado = await store.setJSON(claveCodigo, {
      version: 1, code: codigo, source_user_id: origen.user_id, web_identity: identidad.valor,
      status: "pending", created_at: ahora, expires_at: expira, updated_at: ahora
    }, { onlyIfNew: true });
    if (!creado?.modified) continue;
    await store.setJSON(claveWeb, {
      version: 1, code: codigo, status: "pending", source_user_id: origen.user_id,
      created_at: ahora, expires_at: expira, updated_at: ahora
    });
    return { status: "pending", code: codigo, expires_at: expira, instruction: `VINCULAR ${codigo}` };
  }
  throw new Error("No se pudo generar un código de vinculación.");
}

export async function obtenerEstadoVinculacionWeb({ webIdentity, fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const identidad = normalizarIdentidadCartes("web", webIdentity);
  const registro = await store.get(`${PREFIJO_VINCULO}:web:${identidad.valor}`, { type: "json", consistency: "strong" });
  if (!registro) return { status: "not_started", linked: false };
  if (registro.status === "linked") return { status: "linked", linked: true };
  if (registro.status === "unlinked") return { status: "not_started", linked: false };
  if (Date.parse(String(registro.expires_at || "")) <= fecha.getTime()) return { status: "expired", linked: false };
  return { status: "pending", linked: false, expires_at: registro.expires_at };
}

export async function completarVinculacionConWhatsApp({
  code,
  whatsappUserId = null,
  whatsappPhone = null,
  fecha = new Date(),
  store = null
}) {
  store ||= await getCartesAccountStore();

  const codigo =
    String(code || "").replace(/\D/g, "");

  if (!/^\d{6}$/.test(codigo)) {
    throw new Error(
      "El código de vinculación debe tener 6 dígitos."
    );
  }

  const claveCodigo =
    `${PREFIJO_VINCULO}:code:${codigo}`;

  const entrada =
    await store.getWithMetadata(
      claveCodigo,
      {
        type: "json",
        consistency: "strong"
      }
    );

  const vinculo = entrada?.data;

  if (!vinculo) {
    throw new Error(
      "El código de vinculación no existe o ya fue utilizado."
    );
  }

  if (
    Date.parse(String(vinculo.expires_at || "")) <=
    fecha.getTime()
  ) {
    throw new Error(
      "El código de vinculación expiró."
    );
  }

  const origen =
    validarUserId(vinculo.source_user_id);

  let destino = null;
  let identidadWhatsApp = null;
  let identidadRevocada = false;
  let usuarioAnteriorIdentidadRevocada = null;

  if (whatsappPhone) {
    identidadWhatsApp =
      normalizarIdentidadCartes(
        "whatsapp",
        whatsappPhone
      );

    const claveWhatsApp =
      `${PREFIJO_IDENTIDAD}:identity:whatsapp:${identidadWhatsApp.valor}`;

    const registroWhatsApp =
      await store.get(
        claveWhatsApp,
        {
          type: "json",
          consistency: "strong"
        }
      );

    if (registroWhatsApp?.user_id) {
      destino =
        validarUserId(
          registroWhatsApp.user_id
        );
    }
    else if (
      registroWhatsApp &&
      String(
        registroWhatsApp.status || ""
      ).toLowerCase() === "unlinked"
    ) {
      identidadRevocada = true;
      usuarioAnteriorIdentidadRevocada =
        String(
          registroWhatsApp.previous_user_id || ""
        ).trim() || null;
    }
    else {
      const creada =
        await resolverOCrearUsuarioPorIdentidad({
          tipo: "whatsapp",
          valor: identidadWhatsApp.valor,
          fecha,
          store
        });

      destino = creada.user_id;
    }
  }
  else {
    destino =
      validarUserId(whatsappUserId);
  }

  if (vinculo.status === "linked") {
    if (
      destino &&
      vinculo.user_id === destino
    ) {
      return {
        linked: true,
        user_id: destino,
        already_linked: true
      };
    }

    throw new Error(
      "El código de vinculación ya fue utilizado."
    );
  }

  // CARTES_SAFE_RELINK_V115
  // CARTES_ANTIABUSE_IDENTITY_V115
  // Si el número fue desvinculado, el control del canal por sí solo no
  // autoriza moverlo a otra cuenta. La revinculación automática únicamente
  // restaura el número a su previous_user_id. Esto evita obtener cuotas
  // gratuitas nuevas creando otra identidad Web después de desvincular.
  if (identidadRevocada) {
    if (
      !usuarioAnteriorIdentidadRevocada ||
      usuarioAnteriorIdentidadRevocada !== origen
    ) {
      return {
        linked: false,
        conflict: "identity_previous_account"
      };
    }

    await vincularIdentidadUsuario({
      userId: origen,
      tipo: "whatsapp",
      valor: identidadWhatsApp.valor,
      fecha,
      store
    });

    const ahora =
      fecha.toISOString();

    const completado = {
      ...vinculo,
      status: "linked",
      user_id: origen,
      linked_at: ahora,
      relinked_identity: true,
      updated_at: ahora
    };

    if (entrada?.etag) {
      const guardado =
        await store.setJSON(
          claveCodigo,
          completado,
          { onlyIfMatch: entrada.etag }
        );

      if (!guardado?.modified) {
        throw new Error(
          "El código cambió mientras se completaba la revinculación."
        );
      }
    }
    else {
      await store.setJSON(
        claveCodigo,
        completado
      );
    }

    await store.setJSON(
      `${PREFIJO_VINCULO}:web:${vinculo.web_identity}`,
      {
        version: 1,
        code: codigo,
        status: "linked",
        user_id: origen,
        linked_at: ahora,
        updated_at: ahora
      }
    );

    return {
      linked: true,
      user_id: origen,
      web_identity: vinculo.web_identity,
      relinked: true
    };
  }

  // CARTES_SAFE_LINK_V059
  // La vinculación normal conserva el comportamiento aprobado:
  // si Web y WhatsApp eran cuentas independientes, ambas convergen
  // en la cuenta WhatsApp, salvo conflicto de dos Plus vigentes.
  const conflictoSuscripciones =
    await detectarConflictoSuscripcionesVinculacion({
      sourceUserId: origen,
      targetUserId: destino,
      fecha,
      store
    });

  if (conflictoSuscripciones) {
    return {
      linked: false,
      conflict: "active_subscriptions"
    };
  }

  await fusionarUsuarioEn({
    sourceUserId: origen,
    targetUserId: destino,
    fecha,
    store
  });

  const ahora =
    fecha.toISOString();

  const completado = {
    ...vinculo,
    status: "linked",
    user_id: destino,
    linked_at: ahora,
    updated_at: ahora
  };

  if (entrada?.etag) {
    await store.setJSON(
      claveCodigo,
      completado,
      { onlyIfMatch: entrada.etag }
    );
  }
  else {
    await store.setJSON(
      claveCodigo,
      completado
    );
  }

  await store.setJSON(
    `${PREFIJO_VINCULO}:web:${vinculo.web_identity}`,
    {
      version: 1,
      code: codigo,
      status: "linked",
      user_id: destino,
      linked_at: ahora,
      updated_at: ahora
    }
  );

  return {
    linked: true,
    user_id: destino,
    web_identity: vinculo.web_identity
  };
}
async function detectarConflictoSuscripcionesVinculacion({
  sourceUserId,
  targetUserId,
  fecha,
  store
}) {
  const source = validarUserId(sourceUserId);
  const target = validarUserId(targetUserId);

  if (source === target) return false;

  const sourceSub = await store.get(
    `${PREFIJO_SUSCRIPCION}:${source}`,
    { type: "json", consistency: "strong" }
  );

  const targetSub = await store.get(
    `${PREFIJO_SUSCRIPCION}:${target}`,
    { type: "json", consistency: "strong" }
  );

  if (!sourceSub || !targetSub) return false;

  const sourcePlus =
    determinarPlanDesdeSuscripcion(sourceSub, fecha) === PLAN_CARTES_PLUS;

  const targetPlus =
    determinarPlanDesdeSuscripcion(targetSub, fecha) === PLAN_CARTES_PLUS;

  if (!sourcePlus || !targetPlus) return false;

  const sourceKey = claveSuscripcionRecurrente(sourceSub);
  const targetKey = claveSuscripcionRecurrente(targetSub);

  // Si excepcionalmente ambos registros representan exactamente
  // la misma suscripción del mismo proveedor, no hay doble suscripción.
  if (sourceKey && targetKey && sourceKey === targetKey) {
    return false;
  }

  return true;
}

function claveSuscripcionRecurrente(subscription) {
  if (!subscription || typeof subscription !== "object") return "";

  let provider = String(subscription.provider || "").trim().toLowerCase();

  if (!provider) {
    if (subscription.subscription_id) provider = "paypal";
    else if (subscription.preapproval_id) provider = "mercadopago";
  }

  const id = String(
    subscription.subscription_id ||
    subscription.preapproval_id ||
    ""
  ).trim();

  return provider && id
    ? `${provider}:${id}`
    : "";
}

async function fusionarUsuarioEn({ sourceUserId, targetUserId, fecha, store }) {
  const source = validarUserId(sourceUserId);
  const target = validarUserId(targetUserId);
  if (source === target) return;
  const ahora = fecha.toISOString();
  const sourceKey = `${PREFIJO_IDENTIDAD}:user:${source}`;
  const targetKey = `${PREFIJO_IDENTIDAD}:user:${target}`;
  const sourceUser = await store.get(sourceKey, { type: "json", consistency: "strong" });
  const targetUser = await store.get(targetKey, { type: "json", consistency: "strong" }) || { version: 1, user_id: target, identities: {}, created_at: ahora };
  const mergedIdentities = { ...(targetUser.identities || {}) };
  for (const [tipo, valores] of Object.entries(sourceUser?.identities || {})) {
    const set = new Set([...(mergedIdentities[tipo] || []), ...(Array.isArray(valores) ? valores : [])]);
    mergedIdentities[tipo] = [...set];
    for (const valor of set) {
      const idKey = `${PREFIJO_IDENTIDAD}:identity:${tipo}:${valor}`;
      const pointer = await store.get(idKey, { type: "json", consistency: "strong" });
      if (!pointer?.user_id || pointer.user_id === source || pointer.user_id === target) {
        await store.setJSON(idKey, { ...(pointer || {}), version: 1, user_id: target, identity_type: tipo, identity_value: valor, updated_at: ahora });
      }
    }
  }
  await store.setJSON(targetKey, { ...targetUser, version: 1, user_id: target, identities: mergedIdentities, updated_at: ahora });
  if (sourceUser) await store.setJSON(sourceKey, { ...sourceUser, merged_into: target, merged_at: ahora, updated_at: ahora });

  const sourcePlan = await obtenerPlanUsuario({ userId: source, store });
  const targetPlan = await obtenerPlanUsuario({ userId: target, store });
  const mergedPlan = sourcePlan === PLAN_CARTES_PLUS || targetPlan === PLAN_CARTES_PLUS ? PLAN_CARTES_PLUS : PLAN_CARTES_GRATUITO;
  await sincronizarPlanUsuario({ userId: target, plan: mergedPlan, source: "identity_link", fecha, store });

  const sourceSub = await store.get(`${PREFIJO_SUSCRIPCION}:${source}`, { type: "json", consistency: "strong" });
  const targetSub = await store.get(`${PREFIJO_SUSCRIPCION}:${target}`, { type: "json", consistency: "strong" });
  if (sourceSub || targetSub) {
    const sourcePlus = determinarPlanDesdeSuscripcion(sourceSub, fecha) === PLAN_CARTES_PLUS;
    const targetPlus = determinarPlanDesdeSuscripcion(targetSub, fecha) === PLAN_CARTES_PLUS;
    let elegida = targetSub || sourceSub;
    if (sourcePlus && !targetPlus) elegida = sourceSub;
    else if (sourcePlus === targetPlus && sourceSub && targetSub) {
      const su = Date.parse(String(sourceSub.updated_at || sourceSub.created_at || "")) || 0;
      const tu = Date.parse(String(targetSub.updated_at || targetSub.created_at || "")) || 0;
      elegida = su > tu ? sourceSub : targetSub;
    }
    await sincronizarSuscripcionUsuario({ userId: target, subscription: elegida, source: "identity_link", fecha, store });
  }

  await fusionarUsoCiclosCartes({
    sourceUserId: source,
    targetUserId: target,
    plan: mergedPlan,
    subscription:
      sourceSub || targetSub
        ? await obtenerSuscripcionUsuario({
            userId: target,
            fecha,
            store
          })
        : null,
    fecha,
    store
  });
// DOCUMENT_REVIEWS_V068
  // El consumo de revisiones también pertenece a la cuenta central.
  await fusionarUsoRevisionesMensual({
    sourceUserId: source,
    targetUserId: target,
    fecha,
    store
  });

  // CARTES_REVIEW_PACKS_V091
  await fusionarPaquetesRevision({
    sourceUserId: source,
    targetUserId: target,
    fecha,
    store
  });

  const sourceConversation = normalizarConversacion(await store.get(`${PREFIJO_CONVERSACION}:${source}`, { type: "json", consistency: "strong" }), source);
  const targetConversation = normalizarConversacion(await store.get(`${PREFIJO_CONVERSACION}:${target}`, { type: "json", consistency: "strong" }), target);
  const mergedExchanges = [...targetConversation.exchanges, ...sourceConversation.exchanges]
    .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")))
    .filter((item, index, all) => !item.request_id || all.findIndex((x) => x.request_id === item.request_id) === index)
    .slice(-Math.ceil(MAX_MENSAJES_CONVERSACION / 2));
  if (mergedExchanges.length) {
    await store.setJSON(`${PREFIJO_CONVERSACION}:${target}`, { version: 1, user_id: target, exchanges: mergedExchanges, updated_at: ahora });
  }
}

async function asegurarUsuario({ userId, identidad, fecha, store }) {
  const clave = `${PREFIJO_IDENTIDAD}:user:${userId}`;
  for (let i = 0; i < MAX_REINTENTOS; i += 1) {
    const entrada = await store.getWithMetadata(clave, { type: "json", consistency: "strong" });
    const ahora = fecha.toISOString();
    if (!entrada?.data) {
      const nuevo = { version: 1, user_id: userId, identities: { [identidad.tipo]: [identidad.valor] }, created_at: ahora, updated_at: ahora };
      const creado = await store.setJSON(clave, nuevo, { onlyIfNew: true });
      if (creado?.modified) return nuevo;
      continue;
    }
    const actual = entrada.data;
    const existentes = new Set(actual?.identities?.[identidad.tipo] || []);
    if (existentes.has(identidad.valor)) return actual;
    existentes.add(identidad.valor);
    const siguiente = { ...actual, identities: { ...(actual.identities || {}), [identidad.tipo]: [...existentes] }, updated_at: ahora };
    const guardado = await store.setJSON(clave, siguiente, { onlyIfMatch: entrada.etag });
    if (guardado?.modified) return siguiente;
  }
  throw new Error("No se pudo actualizar el usuario de Cartes por concurrencia.");
}


function normalizarConversacion(valor, userId) {
  const r = valor && typeof valor === "object" ? valor : {};
  const exchanges = Array.isArray(r.exchanges) ? r.exchanges : [];
  return {
    version: 1,
    user_id: userId,
    exchanges: exchanges.filter((x) => Array.isArray(x?.messages) && x.messages.length === 2).slice(-Math.ceil(MAX_MENSAJES_CONVERSACION / 2)),
    updated_at: r.updated_at || null
  };
}
function limpiarMensajeConversacion(valor) {
  return String(valor || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, MAX_CHARS_MENSAJE);
}

function resultadoIdentidad(userId, identidad, created) { return { user_id: userId, identity_type: identidad.tipo, identity_value: identidad.valor, created }; }
function validarUserId(userId) { const id = String(userId || "").trim(); if (!/^usr_[a-f0-9]{32}$/.test(id)) throw new Error("Se requiere un user_id válido."); return id; }
function normalizarPlan(plan) { return String(plan || "").toLowerCase() === PLAN_CARTES_PLUS ? PLAN_CARTES_PLUS : PLAN_CARTES_GRATUITO; }
function claveUso(periodo, userId) { return `${PREFIJO_USO}:${periodo}:${userId}`; }
function normalizarRegistroUso(valor, { userId, periodo }) { const r = valor && typeof valor === "object" ? valor : {}; return { version: 2, user_id: userId, periodo, consultas: Array.isArray(r.consultas) ? r.consultas : [], updated_at: r.updated_at || null }; }
function filtrarConsultasVigentes(consultas, fecha) { const ahora = fecha.getTime(); return consultas.filter((c) => { if (!c?.request_id) return false; if (c.estado === "completada") return true; if (c.estado !== "pendiente") return false; const r = Date.parse(String(c.reserved_at || "")); return Number.isFinite(r) && ahora - r < RESERVA_PENDIENTE_MS; }); }
function contarConsultas(consultas) { return consultas.filter((c) => ["pendiente", "completada"].includes(c.estado)).length; }
function construirEstado({ userId, plan, periodo, limite, usadas }) { return { user_id: userId, plan, periodo, limite, usadas, disponibles: Math.max(0, limite - usadas) }; }
function normalizarTelefonoMexico(telefono) { const limpio = String(telefono || "").replace(/\D/g, ""); return limpio.startsWith("521") && limpio.length === 13 ? `52${limpio.slice(3)}` : limpio; }

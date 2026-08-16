import { getStore } from "@netlify/blobs";

import {
  MAX_PAQUETES_REVISION_POR_PERIODO,
  PRECIO_PAQUETE_REVISION_MXN,
  REVISIONES_POR_PAQUETE,
  obtenerEstadoPaquetesRevision
} from "./lib-cartes-review-packs.mjs";

export const LIMITE_REVISIONES_PLUS = 5;

const STORE_NAME = "cartes-core";
const PREFIJO_REVISIONES = "review-usage-v1";
const TIME_ZONE = "America/Mexico_City";
const RESERVA_PENDIENTE_MS = 10 * 60 * 1000;
const MAX_REINTENTOS = 10;

export async function obtenerEstadoRevisionesMensual({
  userId,
  plan,
  fecha = new Date(),
  store = null
}) {
  store ||= await getReviewStore();

  const id = validarUserId(userId);
  const p = normalizarPlan(plan);
  const periodo = obtenerPeriodoMensual(fecha);
  const limiteIncluido =
    p === "plus"
      ? LIMITE_REVISIONES_PLUS
      : 0;

  const paquetes =
    p === "plus"
      ? await obtenerEstadoPaquetesRevision({
          userId: id,
          fecha,
          store
        })
      : { extras: 0 };

  const limiteBase =
    limiteIncluido +
    Number(paquetes?.extras || 0);

  const entrada = await store.getWithMetadata(
    claveUso(periodo, id),
    { type: "json", consistency: "strong" }
  );

  const registro = normalizarRegistro(entrada?.data, {
    userId: id,
    periodo
  });

  const revisiones = filtrarVigentes(registro.revisiones, fecha);
  const usadas = contarUsadas(revisiones);

  return construirEstado({
    userId: id,
    plan: p,
    periodo,
    limiteBase,
    usadas
  });
}

export async function reservarRevisionMensual({
  userId,
  plan,
  requestId,
  channel = "unknown",
  fecha = new Date(),
  store = null
}) {
  store ||= await getReviewStore();

  const id = validarUserId(userId);
  const p = normalizarPlan(plan);
  const rid = String(requestId || "").trim();

  if (!rid) {
    throw new Error("No se puede reservar una revisión sin requestId.");
  }

  const periodo = obtenerPeriodoMensual(fecha);
  const limiteIncluido =
    p === "plus"
      ? LIMITE_REVISIONES_PLUS
      : 0;

  const paquetes =
    p === "plus"
      ? await obtenerEstadoPaquetesRevision({
          userId: id,
          fecha,
          store
        })
      : { extras: 0 };

  const limiteBase =
    limiteIncluido +
    Number(paquetes?.extras || 0);

  if (p !== "plus") {
    return {
      ...construirEstado({
        userId: id,
        plan: p,
        periodo,
        limiteBase,
        usadas: 0
      }),
      permitida: false,
      duplicada: false,
      code: "plus_required",
      request_id: rid
    };
  }

  const clave = claveUso(periodo, id);

  for (let i = 0; i < MAX_REINTENTOS; i += 1) {

    const entrada = await store.getWithMetadata(
      clave,
      { type: "json", consistency: "strong" }
    );

    const registro = normalizarRegistro(entrada?.data, {
      userId: id,
      periodo
    });

    const revisiones = filtrarVigentes(registro.revisiones, fecha);
    const existente = revisiones.find((r) => r.request_id === rid);
    const usadas = contarUsadas(revisiones);

    if (existente) {
      return {
        ...construirEstado({
          userId: id,
          plan: p,
          periodo,
          limiteBase,
          usadas
        }),
        permitida: false,
        duplicada: true,
        request_id: rid
      };
    }

    if (usadas >= limiteBase) {
      return {
        ...construirEstado({
          userId: id,
          plan: p,
          periodo,
          limiteBase,
          usadas
        }),
        permitida: false,
        duplicada: false,
        code: "review_limit",
        request_id: rid
      };
    }

    const ahora = fecha.toISOString();

    const siguiente = {
      version: 1,
      user_id: id,
      periodo,
      revisiones: [
        ...revisiones,
        {
          request_id: rid,
          estado: "pendiente",
          channel: String(channel || "unknown"),
          reserved_at: ahora
        }
      ],
      updated_at: ahora
    };

    const guardado = await store.setJSON(
      clave,
      siguiente,
      entrada?.etag
        ? { onlyIfMatch: entrada.etag }
        : { onlyIfNew: true }
    );

    if (guardado?.modified) {
      return {
        ...construirEstado({
          userId: id,
          plan: p,
          periodo,
          limiteBase,
          usadas: usadas + 1
        }),
        permitida: true,
        duplicada: false,
        request_id: rid
      };
    }
  }

  throw new Error("No se pudo reservar la revisión por concurrencia.");
}

export async function completarRevisionMensual({
  userId,
  periodo,
  requestId,
  fecha = new Date(),
  store = null
}) {
  return actualizarRevision({
    userId,
    periodo,
    requestId,
    fecha,
    store,
    transformar(revisiones, indice, ahora) {
      const siguiente = [...revisiones];
      siguiente[indice] = {
        ...siguiente[indice],
        estado: "completada",
        completed_at: ahora.toISOString()
      };
      return siguiente;
    }
  });
}

export async function liberarRevisionMensual({
  userId,
  periodo,
  requestId,
  fecha = new Date(),
  store = null
}) {
  return actualizarRevision({
    userId,
    periodo,
    requestId,
    fecha,
    store,
    transformar(revisiones, indice) {
      if (revisiones[indice]?.estado === "completada") {
        return revisiones;
      }

      return revisiones.filter((_r, pos) => pos !== indice);
    }
  });
}

export async function fusionarUsoRevisionesMensual({
  sourceUserId,
  targetUserId,
  fecha = new Date(),
  store = null
}) {
  store ||= await getReviewStore();

  const source = validarUserId(sourceUserId);
  const target = validarUserId(targetUserId);

  if (source === target) return false;

  const periodo = obtenerPeriodoMensual(fecha);

  const sourceUsage = await store.get(
    claveUso(periodo, source),
    { type: "json", consistency: "strong" }
  );

  const targetUsage = await store.get(
    claveUso(periodo, target),
    { type: "json", consistency: "strong" }
  );

  if (!sourceUsage && !targetUsage) return false;

  const map = new Map();

  for (const item of [
    ...(targetUsage?.revisiones || []),
    ...(sourceUsage?.revisiones || [])
  ]) {
    if (item?.request_id && !map.has(item.request_id)) {
      map.set(item.request_id, item);
    }
  }

  await store.setJSON(
    claveUso(periodo, target),
    {
      version: 1,
      user_id: target,
      periodo,
      revisiones: [...map.values()],
      updated_at: fecha.toISOString()
    }
  );

  return true;
}

async function actualizarRevision({
  userId,
  periodo,
  requestId,
  fecha,
  store,
  transformar
}) {
  store ||= await getReviewStore();

  const id = validarUserId(userId);
  const rid = String(requestId || "").trim();
  const per = String(periodo || obtenerPeriodoMensual(fecha));
  const clave = claveUso(per, id);

  if (!rid) return false;

  for (let i = 0; i < MAX_REINTENTOS; i += 1) {

    const entrada = await store.getWithMetadata(
      clave,
      { type: "json", consistency: "strong" }
    );

    if (!entrada?.etag) return false;

    const registro = normalizarRegistro(entrada.data, {
      userId: id,
      periodo: per
    });

    const revisiones = filtrarVigentes(registro.revisiones, fecha);
    const indice = revisiones.findIndex(
      (r) => r.request_id === rid
    );

    if (indice < 0) return false;

    const transformadas = transformar(
      revisiones,
      indice,
      fecha
    );

    if (transformadas === revisiones) return false;

    const guardado = await store.setJSON(
      clave,
      {
        ...registro,
        revisiones: transformadas,
        updated_at: fecha.toISOString()
      },
      { onlyIfMatch: entrada.etag }
    );

    if (guardado?.modified) return true;
  }

  throw new Error("No se pudo actualizar la revisión por concurrencia.");
}

async function getReviewStore() {
  return getStore({
    name: STORE_NAME,
    consistency: "strong"
  });
}

function obtenerPeriodoMensual(fecha) {
  const partes = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit"
    }
  ).formatToParts(fecha);

  const year = partes.find((p) => p.type === "year")?.value;
  const month = partes.find((p) => p.type === "month")?.value;

  if (!year || !month) {
    throw new Error("No se pudo determinar el periodo de revisiones.");
  }

  return `${year}-${month}`;
}

function normalizarRegistro(valor, { userId, periodo }) {
  const r = valor && typeof valor === "object" ? valor : {};

  return {
    version: 1,
    user_id: userId,
    periodo,
    revisiones: Array.isArray(r.revisiones) ? r.revisiones : [],
    updated_at: r.updated_at || null
  };
}

function filtrarVigentes(revisiones, fecha) {
  const ahora = fecha.getTime();

  return revisiones.filter((r) => {
    if (!r?.request_id) return false;
    if (r.estado === "completada") return true;
    if (r.estado !== "pendiente") return false;

    const reserved = Date.parse(String(r.reserved_at || ""));

    return (
      Number.isFinite(reserved) &&
      ahora - reserved < RESERVA_PENDIENTE_MS
    );
  });
}

function contarUsadas(revisiones) {
  return revisiones.filter(
    (r) => ["pendiente", "completada"].includes(r.estado)
  ).length;
}

function construirEstado({
  userId,
  plan,
  periodo,
  limiteBase,
  usadas
}) {
  const limiteIncluido =
    plan === "plus"
      ? LIMITE_REVISIONES_PLUS
      : 0;

  const limiteTotal =
    Math.max(0, Number(limiteBase || 0));

  const extras =
    Math.max(0, limiteTotal - limiteIncluido);

  const paquetesComprados =
    Math.min(
      MAX_PAQUETES_REVISION_POR_PERIODO,
      Math.trunc(extras / REVISIONES_POR_PAQUETE)
    );

  return {
    user_id: userId,
    plan,
    periodo,
    limite_base: limiteIncluido,
    extras,
    limite: limiteTotal,
    usadas,
    disponibles: Math.max(0, limiteTotal - usadas),
    paquetes_comprados: paquetesComprados,
    paquetes_maximo: MAX_PAQUETES_REVISION_POR_PERIODO,
    paquetes_disponibles: Math.max(
      0,
      MAX_PAQUETES_REVISION_POR_PERIODO - paquetesComprados
    ),
    creditos_por_paquete: REVISIONES_POR_PAQUETE,
    precio_paquete: PRECIO_PAQUETE_REVISION_MXN,
    moneda_paquete: "MXN"
  };
}

function claveUso(periodo, userId) {
  return `${PREFIJO_REVISIONES}:${periodo}:${userId}`;
}

function normalizarPlan(plan) {
  return String(plan || "").toLowerCase() === "plus"
    ? "plus"
    : "gratuito";
}

function validarUserId(userId) {
  const id = String(userId || "").trim();

  if (!/^usr_[a-f0-9]{32}$/.test(id)) {
    throw new Error("Se requiere un user_id válido.");
  }

  return id;
}
// CARTES_QA_DEPLOY_STORE_GENERIC
import { getStore, getDeployStore } from "@netlify/blobs";

export const REVISIONES_POR_PAQUETE = 3;
export const MAX_PAQUETES_REVISION_POR_PERIODO = 2;
export const PRECIO_PAQUETE_REVISION_MXN = 99;

const STORE_NAME = "cartes-core";
const PREFIJO_PAQUETES = "review-pack-v1";
const PREFIJO_PAGO = "review-pack-payment-v1";
const PREFIJO_ACCOUNT_USER = "account-v1:user";
const MAX_REINTENTOS = 10;

export async function obtenerEstadoPaquetesRevision({
  userId,
  fecha = new Date(),
  store = null
}) {
  store ||= await getStoreReviewPacks();

  const requested = validarUserId(userId);
  const id = await resolverUsuarioCanonico(requested, store);

  const registro = normalizarRegistro(
    await store.get(clavePaquetes(id), {
      type: "json",
      consistency: "strong"
    }),
    id
  );

  return construirEstado(id, registro.compras, fecha);
}

export async function registrarPaqueteRevisionPagado({
  userId,
  provider,
  paymentId,
  expiresAt,
  amount = PRECIO_PAQUETE_REVISION_MXN,
  currency = "MXN",
  fecha = new Date(),
  store = null
}) {
  store ||= await getStoreReviewPacks();

  const requested = validarUserId(userId);
  const id = await resolverUsuarioCanonico(requested, store);
  const prov = normalizarProvider(provider);
  const payment = String(paymentId || "").trim();

  if (!payment) {
    throw crearError("El pago no contiene un identificador válido.", "invalid_payment");
  }

  const expiresRaw = String(expiresAt || "").trim();
  const expiresMs = Date.parse(expiresRaw);

  if (!Number.isFinite(expiresMs)) {
    throw crearError("El vencimiento del paquete no es válido.", "invalid_expiration");
  }

  const amountNumber = Number(amount);

  if (
    !Number.isFinite(amountNumber) ||
    Math.abs(amountNumber - PRECIO_PAQUETE_REVISION_MXN) > 0.001
  ) {
    throw crearError("El importe del paquete no es válido.", "invalid_amount");
  }

  if (String(currency || "").trim().toUpperCase() !== "MXN") {
    throw crearError("La moneda del paquete no es válida.", "invalid_currency");
  }

  const paymentKey = clavePago(prov, payment);
  const pointer = await store.get(paymentKey, {
    type: "json",
    consistency: "strong"
  });

  if (pointer?.payment_id) {
    return {
      ...(await obtenerEstadoPaquetesRevision({ userId: id, fecha, store })),
      duplicado: true,
      payment_id: payment
    };
  }

  const key = clavePaquetes(id);

  for (let i = 0; i < MAX_REINTENTOS; i += 1) {
    const entrada = await store.getWithMetadata(key, {
      type: "json",
      consistency: "strong"
    });

    const registro = normalizarRegistro(entrada?.data, id);

    const existente = registro.compras.find(
      (item) => item?.provider === prov && item?.payment_id === payment
    );

    if (existente) {
      await store.setJSON(
        paymentKey,
        {
          version: 1,
          user_id: id,
          provider: prov,
          payment_id: payment,
          expires_at: existente.expires_at || null,
          updated_at: fecha.toISOString()
        },
        { onlyIfNew: true }
      );

      return {
        ...(await obtenerEstadoPaquetesRevision({ userId: id, fecha, store })),
        duplicado: true,
        payment_id: payment
      };
    }

    const activos = filtrarActivos(registro.compras, fecha);

    if (activos.length >= MAX_PAQUETES_REVISION_POR_PERIODO) {
      throw crearError(
        "Ya compraste los 2 paquetes adicionales permitidos durante este periodo de Cartes Plus.",
        "pack_limit"
      );
    }

    const ahora = fecha.toISOString();

    const compra = {
      provider: prov,
      payment_id: payment,
      estado: "pagado",
      creditos: REVISIONES_POR_PAQUETE,
      amount: PRECIO_PAQUETE_REVISION_MXN,
      currency: "MXN",
      paid_at: ahora,
      expires_at: new Date(expiresMs).toISOString()
    };

    const siguiente = {
      version: 1,
      user_id: id,
      compras: [...registro.compras, compra],
      updated_at: ahora
    };

    const guardado = await store.setJSON(
      key,
      siguiente,
      entrada?.etag
        ? { onlyIfMatch: entrada.etag }
        : { onlyIfNew: true }
    );

    if (!guardado?.modified) {
      continue;
    }

    await store.setJSON(
      paymentKey,
      {
        version: 1,
        user_id: id,
        provider: prov,
        payment_id: payment,
        expires_at: compra.expires_at,
        updated_at: ahora
      },
      { onlyIfNew: true }
    );

    return {
      ...(await obtenerEstadoPaquetesRevision({ userId: id, fecha, store })),
      duplicado: false,
      payment_id: payment
    };
  }

  throw new Error("No se pudo registrar el paquete por concurrencia.");
}

export async function fusionarPaquetesRevision({
  sourceUserId,
  targetUserId,
  fecha = new Date(),
  store = null
}) {
  store ||= await getStoreReviewPacks();

  const source = validarUserId(sourceUserId);
  const target = validarUserId(targetUserId);

  if (source === target) return false;

  const sourceRecord = normalizarRegistro(
    await store.get(clavePaquetes(source), {
      type: "json",
      consistency: "strong"
    }),
    source
  );

  const targetRecord = normalizarRegistro(
    await store.get(clavePaquetes(target), {
      type: "json",
      consistency: "strong"
    }),
    target
  );

  if (
    sourceRecord.compras.length === 0 &&
    targetRecord.compras.length === 0
  ) {
    return false;
  }

  const map = new Map();

  for (const compra of [...targetRecord.compras, ...sourceRecord.compras]) {
    if (!compra?.provider || !compra?.payment_id) continue;

    const key = `${compra.provider}:${compra.payment_id}`;

    if (!map.has(key)) {
      map.set(key, compra);
    }
  }

  const compras = [...map.values()];
  const ahora = fecha.toISOString();

  await store.setJSON(
    clavePaquetes(target),
    {
      version: 1,
      user_id: target,
      compras,
      updated_at: ahora
    }
  );

  for (const compra of compras) {
    await store.setJSON(
      clavePago(compra.provider, compra.payment_id),
      {
        version: 1,
        user_id: target,
        provider: compra.provider,
        payment_id: compra.payment_id,
        expires_at: compra.expires_at || null,
        updated_at: ahora
      }
    );
  }

  return true;
}

export function resolverVencimientoPaqueteRevision(subscription, fecha = new Date()) {
  const raw =
    subscription?.access_until ||
    subscription?.next_payment_date ||
    subscription?.fecha_fin ||
    "";

  const parsed = Date.parse(String(raw || ""));

  if (!Number.isFinite(parsed) || parsed <= fecha.getTime()) {
    return null;
  }

  return new Date(parsed).toISOString();
}

function construirEstado(userId, compras, fecha) {
  const activos = filtrarActivos(compras, fecha);

  return {
    user_id: userId,
    paquetes_comprados: activos.length,
    paquetes_maximo: MAX_PAQUETES_REVISION_POR_PERIODO,
    paquetes_disponibles: Math.max(
      0,
      MAX_PAQUETES_REVISION_POR_PERIODO - activos.length
    ),
    creditos_por_paquete: REVISIONES_POR_PAQUETE,
    extras: activos.length * REVISIONES_POR_PAQUETE,
    precio_paquete: PRECIO_PAQUETE_REVISION_MXN,
    moneda: "MXN",
    compras_activas: activos.map((item) => ({
      provider: item.provider,
      payment_id: item.payment_id,
      creditos: REVISIONES_POR_PAQUETE,
      expires_at: item.expires_at
    }))
  };
}

function filtrarActivos(compras, fecha) {
  const ahora = fecha.getTime();

  return (Array.isArray(compras) ? compras : []).filter((item) => {
    if (item?.estado !== "pagado") return false;
    if (!item?.provider || !item?.payment_id) return false;

    const expira = Date.parse(String(item.expires_at || ""));

    return Number.isFinite(expira) && expira > ahora;
  });
}

function normalizarRegistro(valor, userId) {
  const r = valor && typeof valor === "object" ? valor : {};

  return {
    version: 1,
    user_id: userId,
    compras: Array.isArray(r.compras)
      ? r.compras
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            ...item,
            provider: normalizarProvider(item.provider),
            payment_id: String(item.payment_id || "").trim()
          }))
      : [],
    updated_at: r.updated_at || null
  };
}

async function resolverUsuarioCanonico(userId, store) {
  let actual = validarUserId(userId);

  for (let i = 0; i < 5; i += 1) {
    const record = await store.get(
      `${PREFIJO_ACCOUNT_USER}:${actual}`,
      {
        type: "json",
        consistency: "strong"
      }
    );

    const merged = String(record?.merged_into || "").trim();

    if (!/^usr_[a-f0-9]{32}$/.test(merged) || merged === actual) {
      return actual;
    }

    actual = merged;
  }

  return actual;
}

async function getStoreReviewPacks() {
  return (process.env.SITE_ID === "c91954f4-08d6-4df6-a831-59457b9a59b3" ? ((options) => getDeployStore({ ...options, deployID: process.env.DEPLOY_ID || undefined })) : getStore)({
    name: STORE_NAME,
    consistency: "strong"
  });
}

function clavePaquetes(userId) {
  return `${PREFIJO_PAQUETES}:${userId}`;
}

function clavePago(provider, paymentId) {
  return `${PREFIJO_PAGO}:${provider}:${paymentId}`;
}

function normalizarProvider(provider) {
  const value = String(provider || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  if (["mercadopago", "mp"].includes(value)) return "mercadopago";
  if (["paypal", "pp"].includes(value)) return "paypal";

  return value;
}

function validarUserId(userId) {
  const id = String(userId || "").trim();

  if (!/^usr_[a-f0-9]{32}$/.test(id)) {
    throw new Error("Se requiere un user_id válido.");
  }

  return id;
}

function crearError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}
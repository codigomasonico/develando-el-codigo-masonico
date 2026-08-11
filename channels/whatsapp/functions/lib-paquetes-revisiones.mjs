import { getStore } from "@netlify/blobs";

export const PRECIO_PAQUETE_REVISIONES = 99;
export const REVISIONES_POR_PAQUETE = 3;
export const MAX_PAQUETES_POR_PERIODO = 2;
const PREFIJO = "paquetes-revisiones-v1";

export function getPaquetesStore() {
  return getStore({ name: "cartes-whatsapp", consistency: "strong" });
}

function telefonoLimpio(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function claveEstado(telefono) {
  return `${PREFIJO}:estado:${telefonoLimpio(telefono)}`;
}

function clavePago(paymentId) {
  return `${PREFIJO}:pago:${String(paymentId || "").trim()}`;
}

function fechaValida(valor) {
  const ms = Date.parse(String(valor || ""));
  return Number.isFinite(ms) ? new Date(ms) : null;
}

export function resolverFechaFinPeriodo(suscripcion, fecha = new Date()) {
  const candidatos = [
    suscripcion?.access_until,
    suscripcion?.next_payment_date,
    suscripcion?.auto_recurring?.next_payment_date
  ];
  for (const valor of candidatos) {
    const parsed = fechaValida(valor);
    if (parsed && parsed.getTime() > fecha.getTime()) return parsed.toISOString();
  }
  const fallback = new Date(fecha);
  fallback.setUTCMonth(fallback.getUTCMonth() + 1);
  return fallback.toISOString();
}

export function construirReferenciaPaquete({ telefono, fechaFin, entorno = "production", fecha = new Date() }) {
  const tel = telefonoLimpio(telefono);
  const fin = fechaValida(fechaFin);
  if (!/^\d{10,15}$/.test(tel)) throw new Error("Teléfono inválido para comprar revisiones.");
  if (!fin || fin.getTime() <= fecha.getTime()) throw new Error("Fecha final del periodo inválida.");
  return `cartes-revisiones:${entorno}:${tel}:${fin.getTime()}:${fecha.getTime()}`;
}

export function extraerReferenciaPaquete(referencia) {
  const match = String(referencia || "").match(/^cartes-revisiones:(production|test):(\d{10,15}):(\d{10,15}):(\d+)$/);
  if (!match) return null;
  return {
    entorno: match[1],
    telefono: match[2],
    fecha_fin: new Date(Number(match[3])).toISOString(),
    creada_at: new Date(Number(match[4])).toISOString()
  };
}

export async function obtenerEstadoPaquetes({ telefono, fecha = new Date(), store = getPaquetesStore() }) {
  const tel = telefonoLimpio(telefono);
  if (!tel) return { paquetes: 0, revisiones_adicionales: 0, fecha_fin: null, disponible_compra: false };
  const registro = await store.get(claveEstado(tel), { type: "json", consistency: "strong" });
  const fin = fechaValida(registro?.fecha_fin);
  if (!registro || !fin || fin.getTime() <= fecha.getTime()) {
    if (registro) await store.delete(claveEstado(tel));
    return { paquetes: 0, revisiones_adicionales: 0, fecha_fin: null, disponible_compra: true };
  }
  const paquetes = Math.max(0, Number(registro.paquetes || 0));
  return {
    paquetes,
    revisiones_adicionales: paquetes * REVISIONES_POR_PAQUETE,
    fecha_fin: fin.toISOString(),
    disponible_compra: paquetes < MAX_PAQUETES_POR_PERIODO
  };
}

export async function registrarPaquetePagado({ telefono, paymentId, fechaFin, fecha = new Date(), store = getPaquetesStore() }) {
  const tel = telefonoLimpio(telefono);
  const id = String(paymentId || "").trim();
  const fin = fechaValida(fechaFin);
  if (!/^\d{10,15}$/.test(tel) || !id || !fin || fin.getTime() <= fecha.getTime()) {
    throw new Error("Datos inválidos para acreditar el paquete de revisiones.");
  }

  const pagoPrevio = await store.get(clavePago(id), { type: "json", consistency: "strong" });
  if (pagoPrevio) return { ...pagoPrevio, duplicado: true };

  const estado = await obtenerEstadoPaquetes({ telefono: tel, fecha, store });
  if (estado.paquetes >= MAX_PAQUETES_POR_PERIODO) {
    return { acreditado: false, limite_alcanzado: true, duplicado: false, ...estado };
  }

  const mismoPeriodo = estado.fecha_fin && Math.abs(Date.parse(estado.fecha_fin) - fin.getTime()) < 60000;
  const paquetes = (mismoPeriodo ? estado.paquetes : 0) + 1;
  const registro = {
    version: 1,
    telefono: tel,
    payment_id: id,
    paquetes,
    revisiones_adicionales: paquetes * REVISIONES_POR_PAQUETE,
    fecha_fin: fin.toISOString(),
    acreditado: true,
    limite_alcanzado: false,
    acreditado_at: fecha.toISOString()
  };
  await store.setJSON(claveEstado(tel), registro);
  await store.setJSON(clavePago(id), registro, { onlyIfNew: true });
  return { ...registro, duplicado: false };
}

import { getStore } from "@netlify/blobs";
import { tieneAccesoCartesPlus } from "./lib-acceso-cartes.mjs";

export const PLAN_CARTES_GRATUITO = "gratuito";
export const PLAN_CARTES_PLUS = "plus";

export const LIMITES_MENSUALES_CARTES = Object.freeze({
  [PLAN_CARTES_GRATUITO]: 5,
  [PLAN_CARTES_PLUS]: 50
});

const PREFIJO_USO = "uso-v1";
const TIME_ZONE = "America/Mexico_City";
const RESERVA_PENDIENTE_MS = 10 * 60 * 1000;
const MAX_REINTENTOS_ESCRITURA = 10;

export function getCartesUsoStore() {
  return getStore({
    name: "cartes-whatsapp",
    consistency: "strong"
  });
}

export function determinarPlanCartes(registroSuscripcion, fecha = new Date()) {
  return tieneAccesoCartesPlus(registroSuscripcion, fecha)
    ? PLAN_CARTES_PLUS
    : PLAN_CARTES_GRATUITO;
}

export function obtenerPeriodoMensual(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit"
  }).formatToParts(fecha);

  const year = partes.find((parte) => parte.type === "year")?.value;
  const month = partes.find((parte) => parte.type === "month")?.value;

  if (!year || !month) {
    throw new Error("No se pudo determinar el periodo mensual de Cartes.");
  }

  return `${year}-${month}`;
}

export async function obtenerEstadoUsoMensual({
  telefono,
  plan = PLAN_CARTES_GRATUITO,
  fecha = new Date(),
  store = getCartesUsoStore()
}) {
  const telefonoNormalizado = normalizarTelefonoMexico(telefono);
  const periodo = obtenerPeriodoMensual(fecha);
  const limite = obtenerLimite(plan);

  if (!telefonoNormalizado) {
    throw new Error("No se puede consultar el uso sin un teléfono válido.");
  }

  const entrada = await store.getWithMetadata(
    claveUso(periodo, telefonoNormalizado),
    { type: "json", consistency: "strong" }
  );

  const registro = normalizarRegistro(entrada?.data, {
    telefono: telefonoNormalizado,
    periodo
  });
  const consultas = filtrarConsultasVigentes(registro.consultas, fecha);
  const usadas = contarConsultas(consultas);

  return construirEstado({
    plan,
    periodo,
    limite,
    usadas
  });
}

export async function reservarConsultaMensual({
  telefono,
  plan = PLAN_CARTES_GRATUITO,
  messageId,
  fecha = new Date(),
  store = getCartesUsoStore()
}) {
  const telefonoNormalizado = normalizarTelefonoMexico(telefono);
  const id = String(messageId || "").trim();
  const periodo = obtenerPeriodoMensual(fecha);
  const limite = obtenerLimite(plan);

  if (!telefonoNormalizado || !id) {
    throw new Error(
      "No se puede reservar una consulta sin teléfono y messageId válidos."
    );
  }

  const clave = claveUso(periodo, telefonoNormalizado);

  for (let intento = 0; intento < MAX_REINTENTOS_ESCRITURA; intento += 1) {
    const entrada = await store.getWithMetadata(clave, {
      type: "json",
      consistency: "strong"
    });
    const registro = normalizarRegistro(entrada?.data, {
      telefono: telefonoNormalizado,
      periodo
    });
    const consultas = filtrarConsultasVigentes(registro.consultas, fecha);
    const existente = consultas.find((consulta) => consulta.message_id === id);
    const usadas = contarConsultas(consultas);

    if (existente) {
      return {
        ...construirEstado({ plan, periodo, limite, usadas }),
        permitida: false,
        duplicada: true,
        message_id: id
      };
    }

    if (usadas >= limite) {
      return {
        ...construirEstado({ plan, periodo, limite, usadas }),
        permitida: false,
        duplicada: false,
        message_id: id
      };
    }

    const ahora = fecha.toISOString();
    const siguiente = {
      version: 1,
      telefono: telefonoNormalizado,
      periodo,
      consultas: [
        ...consultas,
        {
          message_id: id,
          estado: "pendiente",
          plan,
          reserved_at: ahora
        }
      ],
      updated_at: ahora
    };

    const resultado = await store.setJSON(
      clave,
      siguiente,
      entrada?.etag
        ? { onlyIfMatch: entrada.etag }
        : { onlyIfNew: true }
    );

    if (resultado?.modified) {
      return {
        ...construirEstado({
          plan,
          periodo,
          limite,
          usadas: usadas + 1
        }),
        permitida: true,
        duplicada: false,
        message_id: id
      };
    }
  }

  throw new Error(
    "No se pudo reservar la consulta por concurrencia. Intenta nuevamente."
  );
}

export async function completarConsultaMensual({
  telefono,
  periodo,
  messageId,
  fecha = new Date(),
  store = getCartesUsoStore()
}) {
  return await actualizarConsulta({
    telefono,
    periodo,
    messageId,
    fecha,
    store,
    transformar(consultas, indice) {
      const siguiente = [...consultas];
      siguiente[indice] = {
        ...siguiente[indice],
        estado: "completada",
        completed_at: fecha.toISOString()
      };
      return siguiente;
    }
  });
}

export async function liberarConsultaMensual({
  telefono,
  periodo,
  messageId,
  fecha = new Date(),
  store = getCartesUsoStore()
}) {
  return await actualizarConsulta({
    telefono,
    periodo,
    messageId,
    fecha,
    store,
    transformar(consultas, indice) {
      if (consultas[indice]?.estado === "completada") {
        return consultas;
      }

      return consultas.filter((_consulta, posicion) => posicion !== indice);
    }
  });
}

async function actualizarConsulta({
  telefono,
  periodo,
  messageId,
  fecha,
  store,
  transformar
}) {
  const telefonoNormalizado = normalizarTelefonoMexico(telefono);
  const periodoNormalizado = String(periodo || obtenerPeriodoMensual(fecha));
  const id = String(messageId || "").trim();

  if (!telefonoNormalizado || !id) return false;

  const clave = claveUso(periodoNormalizado, telefonoNormalizado);

  for (let intento = 0; intento < MAX_REINTENTOS_ESCRITURA; intento += 1) {
    const entrada = await store.getWithMetadata(clave, {
      type: "json",
      consistency: "strong"
    });

    if (!entrada?.etag) return false;

    const registro = normalizarRegistro(entrada.data, {
      telefono: telefonoNormalizado,
      periodo: periodoNormalizado
    });
    const consultas = filtrarConsultasVigentes(registro.consultas, fecha);
    const indice = consultas.findIndex((consulta) => consulta.message_id === id);

    if (indice < 0) return false;

    const transformadas = transformar(consultas, indice);

    if (transformadas === consultas) return false;

    const resultado = await store.setJSON(
      clave,
      {
        ...registro,
        consultas: transformadas,
        updated_at: fecha.toISOString()
      },
      { onlyIfMatch: entrada.etag }
    );

    if (resultado?.modified) return true;
  }

  throw new Error(
    "No se pudo actualizar la consulta por concurrencia. Intenta nuevamente."
  );
}

function normalizarRegistro(valor, { telefono, periodo }) {
  const registro = valor && typeof valor === "object" ? valor : {};

  return {
    version: 1,
    telefono,
    periodo,
    consultas: Array.isArray(registro.consultas) ? registro.consultas : [],
    updated_at: registro.updated_at || null
  };
}

function filtrarConsultasVigentes(consultas, fecha) {
  const ahora = fecha.getTime();

  return consultas.filter((consulta) => {
    if (!consulta?.message_id) return false;
    if (consulta.estado === "completada") return true;
    if (consulta.estado !== "pendiente") return false;

    const reservada = Date.parse(String(consulta.reserved_at || ""));
    return Number.isFinite(reservada) && ahora - reservada < RESERVA_PENDIENTE_MS;
  });
}

function contarConsultas(consultas) {
  return consultas.filter((consulta) =>
    ["pendiente", "completada"].includes(consulta.estado)
  ).length;
}

function construirEstado({ plan, periodo, limite, usadas }) {
  return {
    plan,
    periodo,
    limite,
    usadas,
    disponibles: Math.max(0, limite - usadas)
  };
}

function obtenerLimite(plan) {
  return LIMITES_MENSUALES_CARTES[plan] || LIMITES_MENSUALES_CARTES.gratuito;
}

function claveUso(periodo, telefono) {
  return `${PREFIJO_USO}:${periodo}:${telefono}`;
}

function normalizarTelefonoMexico(telefono) {
  const limpio = String(telefono || "").replace(/\D/g, "");

  if (limpio.startsWith("521") && limpio.length === 13) {
    return `52${limpio.slice(3)}`;
  }

  return limpio;
}

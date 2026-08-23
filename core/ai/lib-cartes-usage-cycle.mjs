import { CARTES_CONCURRENCY_MAX_RETRIES } from "./config.mjs";
import { CARTES_FREE_QUERY_LIMIT, CARTES_PLUS_QUERY_LIMIT } from "./config.mjs";
const LEGACY_PREFIX = "usage-v2";
const CYCLE_PREFIX = "usage-v3";
const FREE_LIMIT = CARTES_FREE_QUERY_LIMIT;
const PLUS_LIMIT = CARTES_PLUS_QUERY_LIMIT;
const PENDING_MS = 10 * 60 * 1000;
const FREE_CYCLE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_RETRIES = CARTES_CONCURRENCY_MAX_RETRIES;

export async function obtenerEstadoUsoCicloCartes({
  userId,
  plan,
  subscription = null,
  fecha = new Date(),
  store
}) {
  const loaded = await cargarEstado({
    userId,
    plan,
    subscription,
    fecha,
    store
  });

  const state =
    reconciliarEstado(
      loaded.state,
      {
        plan,
        subscription,
        fecha
      }
    );

  return construirEstadoPublico(
    state,
    plan
  );
}

export async function reservarConsultaCicloCartes({
  userId,
  plan,
  subscription = null,
  requestId,
  channel = "unknown",
  fecha = new Date(),
  store
}) {
  const rid = String(requestId || "").trim();

  if (!rid) {
    throw new Error(
      "No se puede reservar una consulta sin requestId válido."
    );
  }

  for (let intento = 0; intento < MAX_RETRIES; intento += 1) {
    const loaded = await cargarEstado({
      userId,
      plan,
      subscription,
      fecha,
      store
    });

    const state =
      reconciliarEstado(
        loaded.state,
        {
          plan,
          subscription,
          fecha
        }
      );

    const existentes =
      limpiarPendientes(
        state.consultas,
        fecha
      );

    const duplicate =
      existentes.find(
        (item) =>
          item?.request_id === rid
      );

    const base = {
      ...state,
      consultas: existentes
    };

    if (duplicate) {
      return {
        ...construirEstadoPublico(
          base,
          plan
        ),
        permitida: false,
        duplicada: true,
        request_id: rid
      };
    }

    const limit =
      plan === "plus"
        ? PLUS_LIMIT
        : FREE_LIMIT;

    if (contarConsultas(existentes) >= limit) {
      return {
        ...construirEstadoPublico(
          base,
          plan
        ),
        permitida: false,
        duplicada: false,
        request_id: rid
      };
    }

    const ahora = fecha.toISOString();

    const siguiente = {
      ...base,
      version: 3,
      user_id: userId,
      consultas: [
        ...existentes,
        {
          request_id: rid,
          estado: "pendiente",
          plan,
          channel:
            String(channel || "unknown"),
          reserved_at: ahora
        }
      ],
      updated_at: ahora
    };

    const saved =
      await guardarEstado(
        {
          userId,
          state: siguiente,
          etag: loaded.etag,
          store
        }
      );

    if (!saved) continue;

    return {
      ...construirEstadoPublico(
        siguiente,
        plan
      ),
      permitida: true,
      duplicada: false,
      request_id: rid
    };
  }

  throw new Error(
    "No se pudo reservar la consulta por concurrencia."
  );
}

export async function completarConsultaCicloCartes({
  userId,
  plan,
  subscription = null,
  requestId,
  fecha = new Date(),
  store
}) {
  const rid = String(requestId || "").trim();
  if (!rid) return false;

  for (let intento = 0; intento < MAX_RETRIES; intento += 1) {
    const loaded = await cargarEstado({
      userId,
      plan,
      subscription,
      fecha,
      store
    });

    let state =
      reconciliarEstado(
        loaded.state,
        {
          plan,
          subscription,
          fecha
        }
      );

    let consultas =
      limpiarPendientes(
        state.consultas,
        fecha
      );

    const index =
      consultas.findIndex(
        (item) =>
          item?.request_id === rid
      );

    if (index < 0) return false;

    if (
      consultas[index]?.estado ===
      "completada"
    ) {
      return false;
    }

    if (
      plan !== "plus" &&
      !state.cycle
    ) {
      state = {
        ...state,
        cycle:
          crearCicloGratuito(fecha)
      };
    }

    consultas = [...consultas];

    consultas[index] = {
      ...consultas[index],
      estado: "completada",
      completed_at:
        fecha.toISOString()
    };

    const siguiente = {
      ...state,
      version: 3,
      user_id: userId,
      consultas,
      updated_at:
        fecha.toISOString()
    };

    const saved =
      await guardarEstado({
        userId,
        state: siguiente,
        etag: loaded.etag,
        store
      });

    if (saved) return true;
  }

  throw new Error(
    "No se pudo completar la consulta por concurrencia."
  );
}

export async function liberarConsultaCicloCartes({
  userId,
  plan,
  subscription = null,
  requestId,
  fecha = new Date(),
  store
}) {
  const rid = String(requestId || "").trim();
  if (!rid) return false;

  for (let intento = 0; intento < MAX_RETRIES; intento += 1) {
    const loaded = await cargarEstado({
      userId,
      plan,
      subscription,
      fecha,
      store
    });

    const state =
      reconciliarEstado(
        loaded.state,
        {
          plan,
          subscription,
          fecha
        }
      );

    const consultas =
      limpiarPendientes(
        state.consultas,
        fecha
      );

    const index =
      consultas.findIndex(
        (item) =>
          item?.request_id === rid
      );

    if (index < 0) return false;

    if (
      consultas[index]?.estado ===
      "completada"
    ) {
      return false;
    }

    const siguiente = {
      ...state,
      version: 3,
      user_id: userId,
      consultas:
        consultas.filter(
          (_item, pos) =>
            pos !== index
        ),
      updated_at:
        fecha.toISOString()
    };

    const saved =
      await guardarEstado({
        userId,
        state: siguiente,
        etag: loaded.etag,
        store
      });

    if (saved) return true;
  }

  throw new Error(
    "No se pudo liberar la consulta por concurrencia."
  );
}

export async function fusionarUsoCiclosCartes({
  sourceUserId,
  targetUserId,
  plan,
  subscription = null,
  fecha = new Date(),
  store
}) {
  const source =
    await cargarEstado({
      userId: sourceUserId,
      plan,
      subscription,
      fecha,
      store
    });

  const target =
    await cargarEstado({
      userId: targetUserId,
      plan,
      subscription,
      fecha,
      store
    });

  const s =
    reconciliarEstado(
      source.state,
      {
        plan,
        subscription,
        fecha
      }
    );

  const t =
    reconciliarEstado(
      target.state,
      {
        plan,
        subscription,
        fecha
      }
    );

  let cycle = t.cycle || s.cycle || null;

  if (
    plan !== "plus" &&
    s.cycle &&
    t.cycle
  ) {
    const start =
      new Date(
        Math.min(
          Date.parse(s.cycle.start_at),
          Date.parse(t.cycle.start_at)
        )
      );

    cycle =
      crearCicloGratuito(start);
  }

  const map = new Map();

  for (
    const item of [
      ...limpiarPendientes(
        t.consultas,
        fecha
      ),
      ...limpiarPendientes(
        s.consultas,
        fecha
      )
    ]
  ) {
    if (
      item?.request_id &&
      !map.has(item.request_id)
    ) {
      map.set(
        item.request_id,
        item
      );
    }
  }

  let consultas =
    [...map.values()];

  if (cycle) {
    consultas =
      filtrarPorCiclo(
        consultas,
        cycle,
        fecha,
        true
      );
  }

  const siguiente = {
    version: 3,
    user_id: targetUserId,
    cycle,
    consultas,
    migrated_from_v2:
      Boolean(
        s.migrated_from_v2 ||
        t.migrated_from_v2
      ),
    updated_at:
      fecha.toISOString()
  };

  await store.setJSON(
    claveV3(targetUserId),
    siguiente
  );

  return siguiente;
}

async function cargarEstado({
  userId,
  plan,
  subscription,
  fecha,
  store
}) {
  const key =
    claveV3(userId);

  const entry =
    await store.getWithMetadata(
      key,
      {
        type: "json",
        consistency: "strong"
      }
    );

  if (entry?.data) {
    let etag =
      String(entry.etag || "").trim();

    /*
     * Netlify Dev puede devolver el contenido de un blob existente
     * sin exponer su ETag en getWithMetadata().
     *
     * Sin ETag, guardarEstado() interpretaría erróneamente el blob
     * existente como nuevo y usaría onlyIfNew, provocando un falso
     * conflicto de concurrencia.
     *
     * list() sí expone el ETag. El fallback sólo se ejecuta cuando
     * getWithMetadata() no lo proporcionó y conserva el CAS original.
     */
    if (!etag) {
      const listed =
        await store.list();

      const found =
        (listed?.blobs || []).find(
          (item) => {
            const candidate =
              String(item?.key || "");

            if (candidate === key) {
              return true;
            }

            try {
              return decodeURIComponent(candidate) === key;
            }
            catch {
              return false;
            }
          }
        );

      etag =
        String(found?.etag || "").trim();
    }

    if (!etag) {
      throw new Error(
        "No se pudo obtener el ETag del estado de uso existente."
      );
    }

    return {
      state:
        normalizarEstadoV3(
          entry.data,
          userId
        ),
      etag
    };
  }

  const migrated =
    await migrarLegacy({
      userId,
      plan,
      subscription,
      fecha,
      store
    });

  return {
    state: migrated,
    etag: null
  };
}

async function migrarLegacy({
  userId,
  plan,
  subscription,
  fecha,
  store
}) {
  const periods =
    periodosLegacyNecesarios(fecha);

  const records =
    await Promise.all(
      periods.map(
        (period) =>
          store.get(
            `${LEGACY_PREFIX}:${period}:${userId}`,
            {
              type: "json",
              consistency: "strong"
            }
          )
      )
    );

  const map = new Map();

  for (const record of records) {
    for (
      const item of
        Array.isArray(record?.consultas)
          ? record.consultas
          : []
    ) {
      if (
        item?.request_id &&
        !map.has(item.request_id)
      ) {
        map.set(
          item.request_id,
          item
        );
      }
    }
  }

  const consultas =
    limpiarPendientes(
      [...map.values()],
      fecha
    );

  if (plan === "plus") {
    const cycle =
      resolverCicloPlus(
        subscription,
        fecha
      );

    return {
      version: 3,
      user_id: userId,
      cycle,
      consultas:
        cycle
          ? filtrarPorCiclo(
              consultas,
              cycle,
              fecha,
              true
            )
          : consultas,
      migrated_from_v2: true,
      updated_at:
        fecha.toISOString()
    };
  }

  const reconstructed =
    reconstruirCicloGratuito(
      consultas,
      fecha
    );

  return {
    version: 3,
    user_id: userId,
    cycle:
      reconstructed.cycle,
    consultas:
      reconstructed.consultas,
    migrated_from_v2: true,
    updated_at:
      fecha.toISOString()
  };
}

function reconciliarEstado(
  input,
  {
    plan,
    subscription,
    fecha
  }
) {
  const state = {
    ...input,
    consultas:
      limpiarPendientes(
        input?.consultas || [],
        fecha
      )
  };

  if (plan === "plus") {
    const target =
      resolverCicloPlus(
        subscription,
        fecha
      );

    if (!target) {
      return {
        ...state,
        cycle:
          state.cycle?.kind === "plus"
            ? state.cycle
            : null
      };
    }

    if (
      state.cycle?.id ===
      target.id
    ) {
      return {
        ...state,
        cycle: target
      };
    }

    return {
      ...state,
      cycle: target,
      consultas:
        filtrarPorCiclo(
          state.consultas,
          target,
          fecha,
          true
        )
    };
  }

  if (
    state.cycle?.kind === "free"
  ) {
    const end =
      Date.parse(
        state.cycle.end_at
      );

    if (
      Number.isFinite(end) &&
      fecha.getTime() < end
    ) {
      return state;
    }

    return {
      ...state,
      cycle: null,
      consultas:
        state.consultas.filter(
          (item) =>
            item?.estado ===
            "pendiente"
        )
    };
  }

  if (
    state.cycle?.kind === "plus"
  ) {
    return {
      ...state,
      cycle: null,
      consultas:
        state.consultas.filter(
          (item) =>
            item?.estado ===
            "pendiente"
        )
    };
  }

  return {
    ...state,
    cycle: null
  };
}

function reconstruirCicloGratuito(
  consultas,
  fecha
) {
  const completed =
    consultas
      .filter(
        (item) =>
          item?.estado ===
          "completada"
      )
      .map(
        (item) => ({
          item,
          timestamp:
            timestampConsulta(item)
        })
      )
      .filter(
        (item) =>
          Number.isFinite(
            item.timestamp
          )
      )
      .sort(
        (a, b) =>
          a.timestamp -
          b.timestamp
      );

  let start = null;

  for (const entry of completed) {
    if (
      start === null ||
      entry.timestamp >=
        start + FREE_CYCLE_MS
    ) {
      start =
        entry.timestamp;
    }
  }

  if (
    start === null ||
    fecha.getTime() >=
      start + FREE_CYCLE_MS
  ) {
    return {
      cycle: null,
      consultas:
        consultas.filter(
          (item) =>
            item?.estado ===
            "pendiente"
        )
    };
  }

  const cycle =
    crearCicloGratuito(
      new Date(start)
    );

  return {
    cycle,
    consultas:
      filtrarPorCiclo(
        consultas,
        cycle,
        fecha,
        true
      )
  };
}

function resolverCicloPlus(
  subscription,
  fecha
) {
  if (
    !subscription ||
    typeof subscription !== "object"
  ) {
    return null;
  }

  const provider =
    String(
      subscription.provider ||
      "plus"
    )
      .trim()
      .toLowerCase();

  const subscriptionId =
    String(
      subscription.subscription_id ||
      subscription.preapproval_id ||
      "subscription"
    )
      .trim();

  let next =
    parseDate(
      subscription.next_payment_date ||
      subscription.access_until
    );

  if (next) {
    while (
      next.getTime() <=
      fecha.getTime()
    ) {
      next =
        addMonthsClampedUtc(
          next,
          1
        );
    }

    const start =
      addMonthsClampedUtc(
        next,
        -1
      );

    return crearCicloPlus({
      provider,
      subscriptionId,
      start,
      end: next,
      source:
        "next_payment_date"
    });
  }

  const created =
    parseDate(
      subscription.created_at
    );

  if (!created) return null;

  let start =
    new Date(
      created.getTime()
    );

  let end =
    addMonthsClampedUtc(
      start,
      1
    );

  let guard = 0;

  while (
    end.getTime() <=
      fecha.getTime() &&
    guard < 240
  ) {
    start = end;
    end =
      addMonthsClampedUtc(
        start,
        1
      );

    guard += 1;
  }

  return crearCicloPlus({
    provider,
    subscriptionId,
    start,
    end,
    source:
      "subscription_created_at"
  });
}

function crearCicloGratuito(fecha) {
  const start =
    new Date(
      fecha.getTime()
    );

  const end =
    new Date(
      start.getTime() +
      FREE_CYCLE_MS
    );

  return {
    kind: "free",
    id:
      `free:${start.toISOString()}`,
    start_at:
      start.toISOString(),
    end_at:
      end.toISOString(),
    source:
      "first_completed_query"
  };
}

function crearCicloPlus({
  provider,
  subscriptionId,
  start,
  end,
  source
}) {
  return {
    kind: "plus",
    id:
      `plus:${provider}:${subscriptionId}:${start.toISOString()}`,
    start_at:
      start.toISOString(),
    end_at:
      end.toISOString(),
    source
  };
}

function filtrarPorCiclo(
  consultas,
  cycle,
  fecha,
  preservePending = false
) {
  const start =
    Date.parse(
      cycle.start_at
    );

  const end =
    Date.parse(
      cycle.end_at
    );

  return consultas.filter(
    (item) => {
      if (
        preservePending &&
        item?.estado ===
          "pendiente"
      ) {
        const reserved =
          Date.parse(
            String(
              item.reserved_at ||
              ""
            )
          );

        if (
          Number.isFinite(
            reserved
          ) &&
          fecha.getTime() -
            reserved <
            PENDING_MS
        ) {
          return true;
        }
      }

      const stamp =
        timestampConsulta(item);

      return (
        Number.isFinite(stamp) &&
        stamp >= start &&
        stamp < end
      );
    }
  );
}

function limpiarPendientes(
  consultas,
  fecha
) {
  const now =
    fecha.getTime();

  return (
    Array.isArray(consultas)
      ? consultas
      : []
  ).filter(
    (item) => {
      if (!item?.request_id) {
        return false;
      }

      if (
        item.estado ===
        "completada"
      ) {
        return true;
      }

      if (
        item.estado !==
        "pendiente"
      ) {
        return false;
      }

      const reserved =
        Date.parse(
          String(
            item.reserved_at ||
            ""
          )
        );

      return (
        Number.isFinite(reserved) &&
        now - reserved <
          PENDING_MS
      );
    }
  );
}

function construirEstadoPublico(
  state,
  plan
) {
  const consultas =
    Array.isArray(state?.consultas)
      ? state.consultas
      : [];

  const usadas =
    contarConsultas(
      consultas
    );

  const limite =
    plan === "plus"
      ? PLUS_LIMIT
      : FREE_LIMIT;

  return {
    user_id:
      state?.user_id,
    plan,
    periodo:
      state?.cycle?.id ||
      (plan === "plus"
        ? "plus-pending"
        : "free-pending"),
    cycle_type:
      state?.cycle?.kind ||
      null,
    cycle_start:
      state?.cycle?.start_at ||
      null,
    cycle_end:
      state?.cycle?.end_at ||
      null,
    limite,
    usadas,
    disponibles:
      Math.max(
        0,
        limite - usadas
      )
  };
}

function contarConsultas(
  consultas
) {
  return consultas.filter(
    (item) =>
      [
        "pendiente",
        "completada"
      ].includes(
        item?.estado
      )
  ).length;
}

function timestampConsulta(item) {
  return Date.parse(
    String(
      item?.completed_at ||
      item?.reserved_at ||
      ""
    )
  );
}

function normalizarEstadoV3(
  value,
  userId
) {
  const raw =
    value &&
    typeof value === "object"
      ? value
      : {};

  return {
    version: 3,
    user_id: userId,
    cycle:
      raw.cycle &&
      typeof raw.cycle ===
        "object"
        ? raw.cycle
        : null,
    consultas:
      Array.isArray(
        raw.consultas
      )
        ? raw.consultas
        : [],
    migrated_from_v2:
      Boolean(
        raw.migrated_from_v2
      ),
    updated_at:
      raw.updated_at || null
  };
}

async function guardarEstado({
  userId,
  state,
  etag,
  store
}) {
  const result =
    await store.setJSON(
      claveV3(userId),
      state,
      etag
        ? {
            onlyIfMatch: etag
          }
        : {
            onlyIfNew: true
          }
    );

  return Boolean(
    result?.modified
  );
}

function claveV3(userId) {
  return `${CYCLE_PREFIX}:${userId}`;
}

function periodosLegacyNecesarios(
  fecha
) {
  const now =
    new Date(
      fecha.getTime()
    );

  const previous =
    new Date(
      fecha.getTime()
    );

  previous.setUTCDate(1);
  previous.setUTCMonth(
    previous.getUTCMonth() -
      1
  );

  return [
    periodoCalendar(now),
    periodoCalendar(previous)
  ];
}

function periodoCalendar(fecha) {
  const year =
    fecha.getUTCFullYear();

  const month =
    String(
      fecha.getUTCMonth() + 1
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}`;
}

function parseDate(value) {
  const date =
    new Date(
      String(value || "")
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}

function addMonthsClampedUtc(
  input,
  months
) {
  const original =
    new Date(
      input.getTime()
    );

  const day =
    original.getUTCDate();

  const result =
    new Date(
      Date.UTC(
        original.getUTCFullYear(),
        original.getUTCMonth() +
          months,
        1,
        original.getUTCHours(),
        original.getUTCMinutes(),
        original.getUTCSeconds(),
        original.getUTCMilliseconds()
      )
    );

  const lastDay =
    new Date(
      Date.UTC(
        result.getUTCFullYear(),
        result.getUTCMonth() + 1,
        0
      )
    ).getUTCDate();

  result.setUTCDate(
    Math.min(
      day,
      lastDay
    )
  );

  return result;
}
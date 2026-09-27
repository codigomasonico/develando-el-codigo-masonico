const STORE_NAME = "cartes-core";
const FREE_LIMIT = Number(process.env.CARTES_FREE_QUERY_LIMIT || 10);
const PLUS_LIMIT = Number(process.env.CARTES_PLUS_QUERY_LIMIT || 100);
const MAX_USER_ROWS = 1000;
const READ_CONCURRENCY = 12;
const ANALYTICS_WINDOW_DAYS = 30;

async function getStoreCartes() {
  const { getStore } = await import("@netlify/blobs");
  return getStore(STORE_NAME);
}

async function listByPrefix(store, prefix) {
  const result = await store.list({ prefix });
  return Array.isArray(result?.blobs) ? result.blobs : [];
}

async function mapLimit(items, limit, mapper) {
  if (!items.length) return [];

  const output = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      output[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );

  await Promise.all(workers);
  return output;
}

async function getJson(store, key) {
  try {
    return await store.get(key, { type: "json" });
  } catch (error) {
    console.warn("[cartes-admin-stats:get]", key, error?.message || error);
    return null;
  }
}

async function readListedJson(store, entries) {
  return mapLimit(entries, READ_CONCURRENCY, ({ key }) => getJson(store, key));
}

function parseDate(value) {
  const ms = Date.parse(String(value || ""));
  return Number.isFinite(ms) ? ms : null;
}

function isoDay(value) {
  const ms = typeof value === "number" ? value : parseDate(value);
  if (!Number.isFinite(ms)) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(ms));

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isWithin(ms, nowMs, days) {
  return Number.isFinite(ms) &&
    ms >= nowMs - days * 24 * 60 * 60 * 1000 &&
    ms <= nowMs;
}

function queryTimestamp(item) {
  return parseDate(item?.completed_at || item?.reserved_at);
}

function reviewTimestamp(item) {
  return parseDate(item?.completed_at || item?.reserved_at);
}

function normalizeChannel(value) {
  return value === "web" || value === "whatsapp" ? value : "unknown";
}

function currentUsageCount(usage) {
  return Array.isArray(usage?.consultas)
    ? usage.consultas.filter((q) => ["pendiente", "completada"].includes(q?.estado)).length
    : 0;
}

function freeBucket(used) {
  if (used <= 0) return "0";
  if (used === 1) return "1";
  if (used <= 5) return "2-5";
  if (used < FREE_LIMIT) return "6-9";
  return "limit";
}

function sanitizeUserRow(row) {
  return {
    user_id: row.user_id,
    plan: row.plan,
    channels: row.channels,
    queries: row.queries,
    current_cycle_used: row.current_cycle_used,
    current_cycle_limit: row.current_cycle_limit,
    last_activity: row.last_activity,
    created_at: row.created_at
  };
}

export function emptyCartesAdminStats(now = new Date()) {
  const nowMs = now.getTime();
  const daily = [];

  for (let i = ANALYTICS_WINDOW_DAYS - 1; i >= 0; i -= 1) {
    const day = isoDay(nowMs - i * 24 * 60 * 60 * 1000);
    daily.push({ date: day, queries: 0 });
  }

  return {
    generated_at: now.toISOString(),
    summary: {
      users_total: 0,
      users_with_queries: 0,
      active_today: 0,
      active_7d: 0,
      active_30d: 0,
      queries_today: 0,
      queries_7d: 0,
      queries_30d: 0,
      queries_stored_current_cycles: 0,
      avg_queries_per_active_30d: 0,
      reviews_completed: 0,
      reviews_pending: 0,
      reviews_completed_30d: 0,
      reviews_pending_30d: 0
    },
    plans: { gratuito: 0, plus: 0 },
    channels: { web: 0, whatsapp: 0, unknown: 0 },
    statuses: { completed: 0, pending: 0, other: 0 },
    consumption: { gratuito: { "0": 0, "1": 0, "2-5": 0, "6-9": 0, limit: 0 } },
    daily,
    users: [],
    metric_windows: {
      activity_days: ANALYTICS_WINDOW_DAYS,
      channels_days: ANALYTICS_WINDOW_DAYS,
      reviews_days: ANALYTICS_WINDOW_DAYS,
      consumption: "current_cycle",
      plans: "current"
    },
    data_quality: {
      channels_total_30d: 0,
      queries_total_30d: 0,
      channel_query_match: true
    },
    notes: []
  };
}

export async function buildCartesAdminStats({ now = new Date(), store = null } = {}) {
  store ||= await getStoreCartes();

  const nowMs = now.getTime();
  const today = isoDay(nowMs);

  const [userKeys, usageKeys, planKeys, reviewKeys] = await Promise.all([
    listByPrefix(store, "account-v1:user:"),
    listByPrefix(store, "usage-v3:"),
    listByPrefix(store, "plan-v1:"),
    listByPrefix(store, "review-usage-v1:")
  ]);

  const [usersRaw, usagesRaw, plansRaw, reviewsRaw] = await Promise.all([
    readListedJson(store, userKeys),
    readListedJson(store, usageKeys),
    readListedJson(store, planKeys),
    readListedJson(store, reviewKeys)
  ]);

  const users = usersRaw.filter((u) => u?.user_id && !u?.merged_into);
  const canonicalIds = new Set(users.map((u) => u.user_id));

  const plans = new Map(
    plansRaw
      .filter((p) => p?.user_id && canonicalIds.has(p.user_id))
      .map((p) => [p.user_id, p.plan === "plus" ? "plus" : "gratuito"])
  );

  const usages = new Map(
    usagesRaw
      .filter((u) => u?.user_id && canonicalIds.has(u.user_id))
      .map((u) => [u.user_id, u])
  );

  const activeToday = new Set();
  const active7 = new Set();
  const active30 = new Set();
  const withQueriesStored = new Set();
  const dailyMap = new Map();

  // IMPORTANTE: estos tres bloques usan la MISMA ventana móvil de 30 días.
  // De este modo, sum(channels) === queries_30d y completed === queries_30d.
  const channelCounts30 = { web: 0, whatsapp: 0, unknown: 0 };
  const statusCounts30 = { completed: 0, pending: 0, other: 0 };
  const planCounts = { gratuito: 0, plus: 0 };
  const freeConsumption = { "0": 0, "1": 0, "2-5": 0, "6-9": 0, limit: 0 };
  const userRows = [];

  let completedStoredCurrentCycles = 0;
  let queriesToday = 0;
  let queries7 = 0;
  let queries30 = 0;

  for (const user of users) {
    const plan = plans.get(user.user_id) || "gratuito";
    planCounts[plan] += 1;

    const usage = usages.get(user.user_id);
    const consultas = Array.isArray(usage?.consultas) ? usage.consultas : [];
    const currentUsed = currentUsageCount(usage);
    const limit = plan === "plus" ? PLUS_LIMIT : FREE_LIMIT;

    if (plan === "gratuito") {
      freeConsumption[freeBucket(currentUsed)] += 1;
    }

    let lastActivity = null;
    const channels30 = new Set();
    let userCompleted30 = 0;

    for (const q of consultas) {
      const ts = queryTimestamp(q);
      if (ts && (!lastActivity || ts > lastActivity)) lastActivity = ts;

      const channel = normalizeChannel(q?.channel);

      if (q?.estado === "completada") {
        completedStoredCurrentCycles += 1;
        withQueriesStored.add(user.user_id);

        if (!ts) continue;

        const day = isoDay(ts);
        if (day) dailyMap.set(day, (dailyMap.get(day) || 0) + 1);

        if (day === today) {
          activeToday.add(user.user_id);
          queriesToday += 1;
        }
        if (isWithin(ts, nowMs, 7)) {
          active7.add(user.user_id);
          queries7 += 1;
        }
        if (isWithin(ts, nowMs, ANALYTICS_WINDOW_DAYS)) {
          active30.add(user.user_id);
          queries30 += 1;
          userCompleted30 += 1;
          channels30.add(channel);
          channelCounts30[channel] += 1;
          statusCounts30.completed += 1;
        }
      } else if (ts && isWithin(ts, nowMs, ANALYTICS_WINDOW_DAYS)) {
        if (q?.estado === "pendiente") statusCounts30.pending += 1;
        else statusCounts30.other += 1;
      }
    }

    userRows.push({
      user_id: user.user_id,
      plan,
      channels: [...channels30].sort(),
      queries: userCompleted30,
      current_cycle_used: currentUsed,
      current_cycle_limit: limit,
      last_activity: lastActivity ? new Date(lastActivity).toISOString() : null,
      created_at: user.created_at || null
    });
  }

  let reviewsCompleted30 = 0;
  let reviewsPending30 = 0;

  for (const record of reviewsRaw.filter(Boolean)) {
    for (const review of Array.isArray(record?.revisiones) ? record.revisiones : []) {
      const ts = reviewTimestamp(review);
      if (!ts || !isWithin(ts, nowMs, ANALYTICS_WINDOW_DAYS)) continue;
      if (review?.estado === "completada") reviewsCompleted30 += 1;
      else if (review?.estado === "pendiente") reviewsPending30 += 1;
    }
  }

  const daily = [];
  for (let i = ANALYTICS_WINDOW_DAYS - 1; i >= 0; i -= 1) {
    const day = isoDay(nowMs - i * 24 * 60 * 60 * 1000);
    daily.push({ date: day, queries: dailyMap.get(day) || 0 });
  }

  userRows.sort((a, b) => {
    const byActivity = String(b.last_activity || "").localeCompare(String(a.last_activity || ""));
    return byActivity || String(a.user_id).localeCompare(String(b.user_id));
  });

  const channelsTotal30 = Object.values(channelCounts30).reduce((sum, n) => sum + n, 0);
  const channelQueryMatch = channelsTotal30 === queries30;

  return {
    generated_at: now.toISOString(),
    summary: {
      users_total: users.length,
      users_with_queries: withQueriesStored.size,
      active_today: activeToday.size,
      active_7d: active7.size,
      active_30d: active30.size,
      queries_today: queriesToday,
      queries_7d: queries7,
      queries_30d: queries30,
      queries_stored_current_cycles: completedStoredCurrentCycles,
      avg_queries_per_active_30d: active30.size
        ? Number((queries30 / active30.size).toFixed(2))
        : 0,
      reviews_completed: reviewsCompleted30,
      reviews_pending: reviewsPending30,
      reviews_completed_30d: reviewsCompleted30,
      reviews_pending_30d: reviewsPending30
    },
    plans: planCounts,
    channels: channelCounts30,
    statuses: statusCounts30,
    consumption: { gratuito: freeConsumption },
    daily,
    users: userRows.slice(0, MAX_USER_ROWS).map(sanitizeUserRow),
    metric_windows: {
      activity_days: ANALYTICS_WINDOW_DAYS,
      channels_days: ANALYTICS_WINDOW_DAYS,
      reviews_days: ANALYTICS_WINDOW_DAYS,
      consumption: "current_cycle",
      plans: "current"
    },
    data_quality: {
      channels_total_30d: channelsTotal30,
      queries_total_30d: queries30,
      channel_query_match: channelQueryMatch
    },
    notes: [
      "Canal, consultas por usuario y revisiones usan la misma ventana móvil de 30 días.",
      "Plan actual cuenta el plan vigente de cada usuario. Consumo Free refleja el ciclo vigente, no una ventana móvil de 30 días.",
      "El histórico disponible depende de lo que conserve usage-v3 en el ciclo vigente de cada usuario; Cartes todavía no tiene una bitácora analítica histórica independiente.",
      "No se exponen correos, teléfonos ni contenido de conversaciones en este panel."
    ]
  };
}

export const __test = {
  listByPrefix,
  isoDay,
  isWithin,
  freeBucket,
  normalizeChannel
};

import { getStore } from "@netlify/blobs";

const STORE_NAME = "cartes-core";
const FREE_LIMIT = Number(process.env.CARTES_FREE_QUERY_LIMIT || 10);
const PLUS_LIMIT = Number(process.env.CARTES_PLUS_QUERY_LIMIT || 100);

function getStoreCartes() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

async function listByPrefix(store, prefix) {
  const result = await store.list({ prefix });
  return Array.isArray(result?.blobs) ? result.blobs : [];
}

async function getJson(store, key) {
  return store.get(key, { type: "json", consistency: "strong" });
}

function parseDate(value) {
  const ms = Date.parse(String(value || ""));
  return Number.isFinite(ms) ? ms : null;
}

function isoDay(value) {
  const ms = typeof value === "number" ? value : parseDate(value);
  if (!Number.isFinite(ms)) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(ms));
}

function isWithin(ms, nowMs, days) {
  return Number.isFinite(ms) && ms >= nowMs - days * 24 * 60 * 60 * 1000 && ms <= nowMs;
}

function queryTimestamp(item) {
  return parseDate(item?.completed_at || item?.reserved_at);
}

function countCompleted(consultas) {
  return consultas.filter((q) => q?.estado === "completada").length;
}

function currentUsageCount(usage) {
  return Array.isArray(usage?.consultas)
    ? usage.consultas.filter((q) => ["pendiente", "completada"].includes(q?.estado)).length
    : 0;
}

function consumptionBucket(used, limit) {
  if (used <= 0) return "0";
  if (used === 1) return "1";
  if (used <= 5) return "2-5";
  if (used < limit) return "6-9";
  return "limit";
}

function blankBuckets() {
  return { "0": 0, "1": 0, "2-5": 0, "6-9": 0, limit: 0 };
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

export async function buildCartesAdminStats({ now = new Date(), store = null } = {}) {
  store ||= getStoreCartes();
  const nowMs = now.getTime();
  const today = isoDay(nowMs);

  const [userKeys, usageKeys, planKeys, reviewKeys] = await Promise.all([
    listByPrefix(store, "account-v1:user:"),
    listByPrefix(store, "usage-v3:"),
    listByPrefix(store, "plan-v1:"),
    listByPrefix(store, "review-usage-v1:")
  ]);

  const [usersRaw, usagesRaw, plansRaw, reviewsRaw] = await Promise.all([
    Promise.all(userKeys.map(({ key }) => getJson(store, key))),
    Promise.all(usageKeys.map(({ key }) => getJson(store, key))),
    Promise.all(planKeys.map(({ key }) => getJson(store, key))),
    Promise.all(reviewKeys.map(({ key }) => getJson(store, key)))
  ]);

  const users = usersRaw.filter((u) => u?.user_id && !u?.merged_into);
  const canonicalIds = new Set(users.map((u) => u.user_id));
  const plans = new Map(plansRaw.filter(Boolean).map((p) => [p.user_id, p.plan === "plus" ? "plus" : "gratuito"]));
  const usages = new Map(usagesRaw.filter((u) => u?.user_id && canonicalIds.has(u.user_id)).map((u) => [u.user_id, u]));

  const allQueries = [];
  const userRows = [];
  const activeToday = new Set();
  const active7 = new Set();
  const active30 = new Set();
  const withQueries = new Set();
  const channelCounts = { web: 0, whatsapp: 0, unknown: 0 };
  const planCounts = { gratuito: 0, plus: 0 };
  const completedStatus = { completed: 0, pending: 0, other: 0 };
  const consumption = { gratuito: blankBuckets(), plus: blankBuckets() };
  const dailyMap = new Map();

  for (const user of users) {
    const plan = plans.get(user.user_id) || "gratuito";
    planCounts[plan] += 1;
    const usage = usages.get(user.user_id);
    const consultas = Array.isArray(usage?.consultas) ? usage.consultas : [];
    const currentUsed = currentUsageCount(usage);
    const limit = plan === "plus" ? PLUS_LIMIT : FREE_LIMIT;
    const bucket = consumptionBucket(currentUsed, limit);
    consumption[plan][bucket] += 1;

    let lastActivity = parseDate(user.updated_at || user.created_at);
    const channels = new Set();

    for (const q of consultas) {
      const ts = queryTimestamp(q);
      if (ts && (!lastActivity || ts > lastActivity)) lastActivity = ts;
      const channel = q?.channel === "web" || q?.channel === "whatsapp" ? q.channel : "unknown";
      channels.add(channel);
      if (q?.estado === "completada") {
        completedStatus.completed += 1;
        if (q?.request_id) withQueries.add(user.user_id);
        channelCounts[channel] += 1;
        if (ts) {
          const day = isoDay(ts);
          if (day) dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
          if (day === today) activeToday.add(user.user_id);
          if (isWithin(ts, nowMs, 7)) active7.add(user.user_id);
          if (isWithin(ts, nowMs, 30)) active30.add(user.user_id);
        }
      }
      else if (q?.estado === "pendiente") completedStatus.pending += 1;
      else completedStatus.other += 1;
      allQueries.push({ ...q, user_id: user.user_id });
    }

    userRows.push({
      user_id: user.user_id,
      plan,
      channels: [...channels].sort(),
      queries: countCompleted(consultas),
      current_cycle_used: currentUsed,
      current_cycle_limit: limit,
      last_activity: lastActivity ? new Date(lastActivity).toISOString() : null,
      created_at: user.created_at || null
    });
  }

  let reviewsCompleted = 0;
  let reviewsPending = 0;
  for (const record of reviewsRaw.filter(Boolean)) {
    for (const review of Array.isArray(record?.revisiones) ? record.revisiones : []) {
      if (review?.estado === "completada") reviewsCompleted += 1;
      else if (review?.estado === "pendiente") reviewsPending += 1;
    }
  }

  const completedQueries = allQueries.filter((q) => q?.estado === "completada");
  const queriesToday = completedQueries.filter((q) => isoDay(queryTimestamp(q)) === today).length;
  const queries7 = completedQueries.filter((q) => isWithin(queryTimestamp(q), nowMs, 7)).length;
  const queries30 = completedQueries.filter((q) => isWithin(queryTimestamp(q), nowMs, 30)).length;

  const daily = [];
  for (let i = 29; i >= 0; i -= 1) {
    const date = new Date(nowMs - i * 24 * 60 * 60 * 1000);
    const day = isoDay(date.getTime());
    daily.push({ date: day, queries: dailyMap.get(day) || 0 });
  }

  userRows.sort((a, b) => String(b.last_activity || "").localeCompare(String(a.last_activity || "")));

  return {
    generated_at: now.toISOString(),
    summary: {
      users_total: users.length,
      users_with_queries: withQueries.size,
      active_today: activeToday.size,
      active_7d: active7.size,
      active_30d: active30.size,
      queries_today: queriesToday,
      queries_7d: queries7,
      queries_30d: queries30,
      queries_stored_current_cycles: completedQueries.length,
      avg_queries_per_active_30d: active30.size ? Number((queries30 / active30.size).toFixed(2)) : 0,
      reviews_completed: reviewsCompleted,
      reviews_pending: reviewsPending
    },
    plans: planCounts,
    channels: channelCounts,
    statuses: completedStatus,
    consumption,
    daily,
    users: userRows.slice(0, 250).map(sanitizeUserRow),
    notes: [
      "Las consultas históricas dependen de lo que conserve usage-v3 en el ciclo actual de cada usuario.",
      "No se exponen correos, teléfonos ni contenido de conversaciones en este panel."
    ]
  };
}

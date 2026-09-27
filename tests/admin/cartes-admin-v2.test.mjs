import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

const authPath = path.join(root, "netlify/lib/cartes-admin-auth.js");
const statsPath = path.join(root, "netlify/lib/cartes-admin-stats.js");
const indexPath = path.join(root, "channels/web/public/admin/cartes/index.html");

const auth = await import(pathToFileURL(authPath));
const statsLib = await import(pathToFileURL(statsPath));

function localEvent(extraHeaders = {}) {
  return {
    headers: {
      host: "localhost:8888",
      ...extraHeaders
    }
  };
}

function prodEvent(extraHeaders = {}) {
  return {
    headers: {
      host: "develandoelcodigomasonico.com",
      ...extraHeaders
    }
  };
}

test("auth local usa credenciales locales y genera token Bearer válido", () => {
  process.env.CARTES_ADMIN_PASSWORD = "remote-password";
  process.env.CARTES_ADMIN_SESSION_SECRET = "R".repeat(48);
  process.env.CARTES_ADMIN_LOCAL_PASSWORD = "local-password";
  process.env.CARTES_ADMIN_LOCAL_SESSION_SECRET = "L".repeat(48);

  const event = localEvent();
  assert.equal(auth.validatePassword("local-password", event), true);
  assert.equal(auth.validatePassword("remote-password", event), false);

  const now = Date.now();
  const token = auth.createSessionToken(event, now);
  assert.equal(auth.verifySessionToken(token, event, now + 1), true);

  const authorized = localEvent({ authorization: `Bearer ${token}` });
  assert.equal(auth.isAuthorized(authorized), true);
});

test("auth producción ignora CARTES_ADMIN_LOCAL_*", () => {
  process.env.CARTES_ADMIN_PASSWORD = "remote-password";
  process.env.CARTES_ADMIN_SESSION_SECRET = "R".repeat(48);
  process.env.CARTES_ADMIN_LOCAL_PASSWORD = "local-password";
  process.env.CARTES_ADMIN_LOCAL_SESSION_SECRET = "L".repeat(48);

  const event = prodEvent();
  assert.equal(auth.validatePassword("remote-password", event), true);
  assert.equal(auth.validatePassword("local-password", event), false);
});

test("token manipulado es rechazado", () => {
  process.env.CARTES_ADMIN_SESSION_SECRET = "S".repeat(48);
  delete process.env.CARTES_ADMIN_LOCAL_SESSION_SECRET;
  const event = prodEvent();
  const token = auth.createSessionToken(event, 1_000);
  const broken = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
  assert.equal(auth.verifySessionToken(broken, event, 1_001), false);
});

test("dashboard muestra login por defecto y no depende de JS externo", () => {
  const html = fs.readFileSync(indexPath, "utf8");
  assert.match(html, /id="loginView" class="login-card">/);
  assert.doesNotMatch(html, /id="loginView"[^>]*hidden/);
  assert.doesNotMatch(html, /<script\s+src=/i);
  assert.doesNotMatch(html, /admin\.js|dashboard\.js/);
  assert.match(html, /sessionStorage\.getItem\(TOKEN_KEY\)/);
  assert.match(html, /Authorization\s*=\s*`Bearer/);
});

test("JavaScript embebido del dashboard tiene sintaxis válida", () => {
  const html = fs.readFileSync(indexPath, "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(scripts[0][1]));
});

test("dashboard no contiene PII de cuentas", () => {
  const html = fs.readFileSync(indexPath, "utf8").toLowerCase();
  assert.doesNotMatch(html, /customer\?\.email|customer\?\.phone|identity_value/);
});

function makeFakeStore(records, pageSize = 2) {
  return {
    async list({ prefix, cursor }) {
      const keys = Object.keys(records).filter((key) => key.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const slice = keys.slice(start, start + pageSize);
      const next = start + pageSize < keys.length ? String(start + pageSize) : undefined;
      return {
        blobs: slice.map((key) => ({ key })),
        cursor: next
      };
    },
    async get(key) {
      return structuredClone(records[key] ?? null);
    }
  };
}

test("estadísticas cuentan usuarios canónicos, consultas, canales y planes", async () => {
  const now = new Date("2026-09-26T18:00:00.000Z");
  const records = {
    "account-v1:user:usr_a": { user_id: "usr_a", created_at: "2026-09-01T00:00:00Z" },
    "account-v1:user:usr_b": { user_id: "usr_b", created_at: "2026-09-02T00:00:00Z" },
    "account-v1:user:usr_merged": { user_id: "usr_merged", merged_into: "usr_a" },
    "account-v1:identity:web:web_x": { user_id: "usr_a" },
    "plan-v1:usr_a": { user_id: "usr_a", plan: "plus" },
    "plan-v1:usr_b": { user_id: "usr_b", plan: "gratuito" },
    "usage-v3:usr_a": {
      user_id: "usr_a",
      consultas: [
        { request_id: "q1", estado: "completada", channel: "web", completed_at: "2026-09-26T17:00:00Z" },
        { request_id: "q2", estado: "completada", channel: "whatsapp", completed_at: "2026-09-23T17:00:00Z" }
      ]
    },
    "usage-v3:usr_b": {
      user_id: "usr_b",
      consultas: [
        { request_id: "q3", estado: "completada", channel: "web", completed_at: "2026-09-10T17:00:00Z" },
        { request_id: "q4", estado: "pendiente", channel: "web", reserved_at: "2026-09-26T17:30:00Z" }
      ]
    },
    "review-usage-v1:2026-09:usr_a": {
      user_id: "usr_a",
      revisiones: [
        { estado: "completada" },
        { estado: "pendiente" }
      ]
    }
  };

  const result = await statsLib.buildCartesAdminStats({
    now,
    store: makeFakeStore(records, 1)
  });

  assert.equal(result.summary.users_total, 2);
  assert.equal(result.summary.users_with_queries, 2);
  assert.equal(result.summary.queries_7d, 2);
  assert.equal(result.summary.queries_30d, 3);
  assert.equal(result.plans.plus, 1);
  assert.equal(result.plans.gratuito, 1);
  assert.equal(result.channels.web, 2);
  assert.equal(result.channels.whatsapp, 1);
  assert.equal(result.statuses.pending, 1);
  assert.equal(result.summary.reviews_completed, 1);
  assert.equal(result.summary.reviews_pending, 1);
});

test("listado paginado de Netlify Blobs recorre todos los resultados", async () => {
  const records = {
    "account-v1:user:a": { user_id: "a" },
    "account-v1:user:b": { user_id: "b" },
    "account-v1:user:c": { user_id: "c" },
    "other:x": { x: true }
  };
  const rows = await statsLib.__test.listAllByPrefix(makeFakeStore(records, 1), "account-v1:user:");
  assert.deepEqual(rows.map((row) => row.key), [
    "account-v1:user:a",
    "account-v1:user:b",
    "account-v1:user:c"
  ]);
});

test("archivos backend no escriben ni eliminan blobs", () => {
  const files = [
    path.join(root, "netlify/lib/cartes-admin-stats.js"),
    path.join(root, "netlify/functions/cartes-admin-stats.js")
  ];
  const source = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /store\.(?:setJSON|set|delete)\s*\(/);
});

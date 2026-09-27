import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const auth = await import(pathToFileURL(path.join(root, "netlify/lib/cartes-admin-auth.js")));
const statsLib = await import(pathToFileURL(path.join(root, "netlify/lib/cartes-admin-stats.js")));
const indexPath = path.join(root, "channels/web/public/admin/cartes/index.html");

function localEvent(extraHeaders = {}) {
  return { headers: { host: "localhost:8888", ...extraHeaders } };
}

function prodEvent(extraHeaders = {}) {
  return { headers: { host: "develandoelcodigomasonico.com", ...extraHeaders } };
}

test("auth local usa credenciales locales y token Bearer válido", () => {
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
  assert.equal(auth.isAuthorized(localEvent({ authorization: `Bearer ${token}` })), true);
});

test("auth producción ignora credenciales locales", () => {
  process.env.CARTES_ADMIN_PASSWORD = "remote-password";
  process.env.CARTES_ADMIN_SESSION_SECRET = "R".repeat(48);
  process.env.CARTES_ADMIN_LOCAL_PASSWORD = "local-password";
  process.env.CARTES_ADMIN_LOCAL_SESSION_SECRET = "L".repeat(48);
  assert.equal(auth.validatePassword("remote-password", prodEvent()), true);
  assert.equal(auth.validatePassword("local-password", prodEvent()), false);
});

test("dashboard no depende de JavaScript externo y login es visible", () => {
  const html = fs.readFileSync(indexPath, "utf8");
  assert.match(html, /id="loginView" class="login-card">/);
  assert.doesNotMatch(html, /<script\s+src=/i);
  assert.doesNotMatch(html, /admin\.js|dashboard\.js/);
  assert.match(html, /cartes_admin_token_v3/);
  assert.match(html, /Authorization\s*=\s*`Bearer/);
});

test("JavaScript embebido tiene sintaxis válida", () => {
  const html = fs.readFileSync(indexPath, "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(scripts[0][1]));
});

test("dashboard no expone PII", () => {
  const html = fs.readFileSync(indexPath, "utf8").toLowerCase();
  assert.doesNotMatch(html, /customer\?\.email|customer\?\.phone|identity_value/);
});

function makeFakeStore(records) {
  return {
    async list({ prefix }) {
      return {
        blobs: Object.keys(records)
          .filter((key) => key.startsWith(prefix))
          .sort()
          .map((key) => ({ key }))
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
    "plan-v1:usr_a": { user_id: "usr_a", plan: "plus" },
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
      revisiones: [{ estado: "completada" }, { estado: "pendiente" }]
    }
  };

  const result = await statsLib.buildCartesAdminStats({ now, store: makeFakeStore(records) });
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

test("store analítico no fuerza strong consistency", () => {
  const source = fs.readFileSync(path.join(root, "netlify/lib/cartes-admin-stats.js"), "utf8");
  assert.doesNotMatch(source, /consistency\s*:\s*["']strong["']/);
  assert.match(source, /getStore\(STORE_NAME\)/);
});

test("backend del dashboard es solo lectura", () => {
  const files = [
    path.join(root, "netlify/lib/cartes-admin-stats.js"),
    path.join(root, "netlify/functions/cartes-admin-stats.js")
  ];
  const source = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /store\.(?:setJSON|set|delete)\s*\(/);
});

test("estadísticas vacías tienen estructura completa", () => {
  const empty = statsLib.emptyCartesAdminStats(new Date("2026-09-26T18:00:00Z"));
  assert.equal(empty.summary.users_total, 0);
  assert.equal(empty.daily.length, 30);
  assert.equal(empty.users.length, 0);
});

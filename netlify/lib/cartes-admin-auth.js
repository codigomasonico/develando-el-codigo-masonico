import * as crypto from "node:crypto";

const DEFAULT_SESSION_HOURS = 8;
const SCOPE = "cartes-admin-v2";

function clean(value, max = 1000) {
  return String(value || "").trim().slice(0, max);
}

function isLocalHost(event) {
  const host = String(
    event?.headers?.["x-forwarded-host"] ||
    event?.headers?.host ||
    ""
  ).toLowerCase();

  return host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host === "localhost" ||
    host === "127.0.0.1";
}

function getPassword(event) {
  const local = isLocalHost(event)
    ? clean(process.env.CARTES_ADMIN_LOCAL_PASSWORD, 500)
    : "";

  const value = local || clean(process.env.CARTES_ADMIN_PASSWORD, 500);

  if (!value) {
    throw new Error("Falta CARTES_ADMIN_PASSWORD.");
  }

  return value;
}

function getSessionSecret(event) {
  const local = isLocalHost(event)
    ? clean(process.env.CARTES_ADMIN_LOCAL_SESSION_SECRET, 1000)
    : "";

  const value = local || clean(process.env.CARTES_ADMIN_SESSION_SECRET, 1000);

  if (value.length < 32) {
    throw new Error("CARTES_ADMIN_SESSION_SECRET debe tener al menos 32 caracteres.");
  }

  return value;
}

function sessionHours() {
  const parsed = Number(process.env.CARTES_ADMIN_SESSION_HOURS);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 24
    ? parsed
    : DEFAULT_SESSION_HOURS;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function sign(value, event) {
  return crypto
    .createHmac("sha256", getSessionSecret(event))
    .update(value)
    .digest("base64url");
}

function createSessionToken(event, now = Date.now()) {
  const expiresAt = now + sessionHours() * 60 * 60 * 1000;
  const payload = Buffer.from(
    JSON.stringify({
      scope: SCOPE,
      exp: expiresAt,
      nonce: crypto.randomBytes(16).toString("hex")
    })
  ).toString("base64url");

  return `${payload}.${sign(payload, event)}`;
}

function verifySessionToken(token, event, now = Date.now()) {
  const parts = String(token || "").split(".");

  if (parts.length !== 2) {
    return false;
  }

  let expected;
  try {
    expected = sign(parts[0], event);
  } catch {
    return false;
  }

  if (!safeEqual(expected, parts[1])) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf8")
    );

    return payload?.scope === SCOPE && Number(payload?.exp) > now;
  } catch {
    return false;
  }
}

function authorizationToken(event) {
  const header = String(
    event?.headers?.authorization ||
    event?.headers?.Authorization ||
    ""
  ).trim();

  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || "";
}

function isAuthorized(event) {
  return verifySessionToken(authorizationToken(event), event);
}

function validatePassword(password, event) {
  return safeEqual(getPassword(event), password);
}

function sameOrigin(event) {
  const origin = String(event?.headers?.origin || "").trim();
  const host = String(
    event?.headers?.["x-forwarded-host"] ||
    event?.headers?.host ||
    ""
  ).trim();

  if (!origin || !host) {
    return true;
  }

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function unauthorized() {
  return {
    statusCode: 401,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify({
      ok: false,
      message: "Sesión administrativa requerida."
    })
  };
}

export {
  createSessionToken,
  verifySessionToken,
  isAuthorized,
  validatePassword,
  sameOrigin,
  isLocalHost,
  unauthorized
};

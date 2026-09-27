import * as crypto from "node:crypto";

const COOKIE_NAME = "cartes_admin_session";
const DEFAULT_SESSION_HOURS = 8;

function clean(value, max = 1000) {
  return String(value || "").trim().slice(0, max);
}

function getPassword() {
  const value = clean(process.env.CARTES_ADMIN_PASSWORD, 500);
  if (!value) throw new Error("Falta CARTES_ADMIN_PASSWORD.");
  return value;
}

function getSessionSecret() {
  const value = clean(process.env.CARTES_ADMIN_SESSION_SECRET, 1000);
  if (value.length < 32) {
    throw new Error("CARTES_ADMIN_SESSION_SECRET debe tener al menos 32 caracteres.");
  }
  return value;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function sign(value) {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function parseCookies(header) {
  const result = {};
  String(header || "").split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index <= 0) return;
    result[part.slice(0, index).trim()] = part.slice(index + 1).trim();
  });
  return result;
}

function sessionHours() {
  const parsed = Number(process.env.CARTES_ADMIN_SESSION_HOURS);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 24
    ? parsed
    : DEFAULT_SESSION_HOURS;
}

function createSessionToken() {
  const expiresAt = Date.now() + sessionHours() * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({
    exp: expiresAt,
    nonce: crypto.randomBytes(16).toString("hex")
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !safeEqual(sign(parts[0]), parts[1])) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return Number(payload.exp) > Date.now();
  } catch {
    return false;
  }
}

function isLocalHost(event) {
  const host = String(event?.headers?.host || "").toLowerCase();
  return host.startsWith("localhost:") || host.startsWith("127.0.0.1:") || host === "localhost" || host === "127.0.0.1";
}

function sessionCookie(event, token) {
  const maxAge = Math.round(sessionHours() * 60 * 60);
  const secure = isLocalHost(event) ? "" : "; Secure";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function clearSessionCookie(event) {
  const secure = isLocalHost(event) ? "" : "; Secure";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

function isAuthorized(event) {
  const cookies = parseCookies(event?.headers?.cookie);
  return verifySessionToken(cookies[COOKIE_NAME]);
}

function validatePassword(password) {
  return safeEqual(getPassword(), password);
}

function sameOrigin(event) {
  const origin = String(event?.headers?.origin || "").trim();
  const host = String(event?.headers?.host || "").trim();
  if (!origin || !host) return true;
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
    body: JSON.stringify({ ok: false, message: "Sesión administrativa requerida." })
  };
}

export {
  createSessionToken,
  sessionCookie,
  clearSessionCookie,
  isAuthorized,
  validatePassword,
  sameOrigin,
  unauthorized
};

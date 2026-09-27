import {
  createSessionToken,
  sessionCookie,
  validatePassword,
  sameOrigin
} from "../lib/cartes-admin-auth.js";

function jsonResponse(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    },
    body: JSON.stringify(payload)
  };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return jsonResponse(405, { ok: false, message: "Método no permitido." });
  if (!sameOrigin(event)) return jsonResponse(403, { ok: false, message: "Origen no autorizado." });

  let input;
  try { input = JSON.parse(event.body || "{}"); }
  catch { return jsonResponse(400, { ok: false, message: "Solicitud inválida." }); }

  try {
    if (!validatePassword(input.password)) {
      await new Promise((resolve) => setTimeout(resolve, 650));
      return jsonResponse(401, { ok: false, message: "Contraseña incorrecta." });
    }
    return jsonResponse(200, { ok: true }, { "Set-Cookie": sessionCookie(event, createSessionToken()) });
  } catch (error) {
    console.error("[cartes-admin-login]", error);
    return jsonResponse(500, { ok: false, message: "La autenticación administrativa de Cartes no está configurada." });
  }
}

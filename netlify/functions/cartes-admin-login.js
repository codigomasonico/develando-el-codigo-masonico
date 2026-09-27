import {
  createSessionToken,
  validatePassword,
  sameOrigin
} from "../lib/cartes-admin-auth.js";

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(payload)
  };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { ok: false, message: "Método no permitido." });
  }

  if (!sameOrigin(event)) {
    return jsonResponse(403, { ok: false, message: "Origen no autorizado." });
  }

  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { ok: false, message: "Solicitud inválida." });
  }

  try {
    if (!validatePassword(input.password, event)) {
      await new Promise((resolve) => setTimeout(resolve, 450));
      return jsonResponse(401, { ok: false, message: "Contraseña incorrecta." });
    }

    return jsonResponse(200, {
      ok: true,
      token: createSessionToken(event),
      expires_in_hours: Number(process.env.CARTES_ADMIN_SESSION_HOURS) || 8
    });
  } catch (error) {
    console.error("[cartes-admin-login]", error?.message || error);

    return jsonResponse(500, {
      ok: false,
      message: "La autenticación administrativa de Cartes no está configurada."
    });
  }
}

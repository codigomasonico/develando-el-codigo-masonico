import {
  clearSessionCookie,
  sameOrigin
} from "../lib/book-admin-auth.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Método no permitido."
    };
  }

  if (!sameOrigin(event)) {
    return {
      statusCode: 403,
      body: "Origen no autorizado."
    };
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": clearSessionCookie(event)
    },
    body: JSON.stringify({ ok: true })
  };
};

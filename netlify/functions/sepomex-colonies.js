/*
  Netlify Function · Colonias por código postal
  ---------------------------------------------
  Consulta un mirror público de datos SEPOMEX y devuelve los asentamientos
  asociados a un código postal mexicano.

  No utiliza credenciales.
  Si el servicio externo no responde, el frontend habilita captura manual.
*/

const SEPOMEX_BASE =
  (process.env.SEPOMEX_API_BASE || "https://sepomex.nitrostudio.com.mx/api/latest").replace(/\/$/, "");

const REQUEST_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const cache = new Map();

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    },
    body: JSON.stringify(payload)
  };
}

function cleanPostalCode(value) {
  const cp = String(value || "").trim();
  return /^\d{5}$/.test(cp) ? cp : "";
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function uniqueSorted(values) {
  return [...new Set(values.map(normalizeText).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es-MX", { sensitivity: "base" }));
}

async function fetchJsonWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.error ||
        payload?.data?.error ||
        `HTTP ${response.status}`;
      throw new Error(String(message));
    }

    return payload;
  } finally {
    clearTimeout(timer);
  }
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, {
      ok: false,
      message: "Método no permitido."
    });
  }

  const postalCode = cleanPostalCode(event.queryStringParameters?.cp);

  if (!postalCode) {
    return jsonResponse(400, {
      ok: false,
      message: "Introduce un código postal mexicano válido de cinco dígitos."
    });
  }

  const cached = cache.get(postalCode);

  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return jsonResponse(200, cached.payload);
  }

  try {
    const result = await fetchJsonWithTimeout(
      `${SEPOMEX_BASE}/cp/${encodeURIComponent(postalCode)}.json`
    );

    const postcodes = Array.isArray(result?.data?.postcodes)
      ? result.data.postcodes
      : [];

    const exact = postcodes.filter(
      (item) => String(item?.d_codigo || "").trim() === postalCode
    );

    if (!exact.length) {
      return jsonResponse(404, {
        ok: false,
        message: "No se encontraron colonias para este código postal."
      });
    }

    const neighborhoods = uniqueSorted(exact.map((item) => item?.d_asenta));
    const first = exact[0] || {};

    const payload = {
      ok: true,
      postalCode,
      state: normalizeText(first.d_estado),
      municipality: normalizeText(first.d_mnpio),
      neighborhoods,
      source: "SEPOMEX mirror"
    };

    cache.set(postalCode, {
      createdAt: Date.now(),
      payload
    });

    return jsonResponse(200, payload);
  } catch (error) {
    console.warn("No se pudo consultar el catálogo de colonias.", error);

    return jsonResponse(502, {
      ok: false,
      message: "No se pudieron consultar las colonias en este momento."
    });
  }
};

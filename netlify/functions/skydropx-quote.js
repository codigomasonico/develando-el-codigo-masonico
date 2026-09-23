/*
  Netlify Function · Cotización Skydropx
  --------------------------------------
  Variables de entorno obligatorias:
    SKYDROPX_CLIENT_ID
    SKYDROPX_CLIENT_SECRET
    SKYDROPX_ORIGIN_COLONY

  Opcional:
    SKYDROPX_API_BASE=https://api-pro.skydropx.com

  Las credenciales nunca se envían al navegador.
*/

const API_BASE = (process.env.SKYDROPX_API_BASE || "https://api-pro.skydropx.com").replace(/\/$/, "");

const ORIGIN = Object.freeze({
  country_code: "MX",
  postal_code: "45133",
  area_level1: "Jalisco",
  area_level2: "Zapopan"
});

const PARCEL = Object.freeze({
  length: 27,
  width: 19,
  height: 5,
  weight: 0.56
});

const MAX_QUOTATION_POLLS = 7;
const POLL_DELAY_MS = 700;

let tokenCache = {
  accessToken: "",
  expiresAt: 0
};

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value, maxLength = 120) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function parsePositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function publicApiError(prefix, response, body) {
  const detail = body?.message || body?.error_description || body?.error || `HTTP ${response.status}`;
  const error = new Error(`${prefix}: ${detail}`);
  error.status = response.status;
  return error;
}

async function getAccessToken() {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const clientId = cleanText(process.env.SKYDROPX_CLIENT_ID, 500);
  const clientSecret = cleanText(process.env.SKYDROPX_CLIENT_SECRET, 1000);

  if (!clientId || !clientSecret) {
    throw new Error("Faltan las credenciales de Skydropx en las variables de entorno.");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret
  });

  const response = await fetch(`${API_BASE}/api/v1/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    body: body.toString()
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.access_token) {
    throw publicApiError("No se pudo autenticar con Skydropx", response, payload);
  }

  const expiresInSeconds = Number(payload.expires_in) || 7200;
  const safetyWindowMs = 60 * 1000;

  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(60_000, expiresInSeconds * 1000 - safetyWindowMs)
  };

  return tokenCache.accessToken;
}

async function skydropxRequest(path, options, accessToken) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
      ...(options.headers || {})
    }
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw publicApiError("Skydropx rechazó la solicitud", response, payload);
  }

  return payload;
}

function rateCharge(rate) {
  const protectedTotal = parsePositiveNumber(rate?.total_value_with_protection);
  if (protectedTotal !== null) {
    return protectedTotal;
  }

  const total = parsePositiveNumber(rate?.total);
  if (total !== null) {
    return total;
  }

  return parsePositiveNumber(rate?.amount);
}

function getAvailableRates(quotation) {
  const rates = Array.isArray(quotation?.rates) ? quotation.rates : [];

  return rates
    .map((rate) => ({
      rate,
      charge: rateCharge(rate)
    }))
    .filter(({ rate, charge }) => (
      rate?.success === true &&
      charge !== null &&
      (!rate.currency_code || rate.currency_code === "MXN")
    ));
}

async function createCompletedQuotation(accessToken, destination, declaredValue) {
  const originColony = cleanText(process.env.SKYDROPX_ORIGIN_COLONY, 120);

  if (!originColony) {
    throw new Error("Falta SKYDROPX_ORIGIN_COLONY en las variables de entorno.");
  }

  const quotationPayload = {
    quotation: {
      address_from: {
        ...ORIGIN,
        area_level3: originColony
      },
      address_to: {
        country_code: "MX",
        postal_code: destination.postalCode,
        area_level1: destination.state,
        area_level2: destination.municipality,
        area_level3: destination.neighborhood
      },
      parcels: [
        {
          ...PARCEL,
          package_protected: true,
          declared_value: declaredValue
        }
      ]
    }
  };

  let quotation = await skydropxRequest(
    "/api/v1/quotations",
    {
      method: "POST",
      body: JSON.stringify(quotationPayload)
    },
    accessToken
  );

  if (!quotation?.id) {
    throw new Error("Skydropx no devolvió el ID de la cotización.");
  }

  if (quotation.is_completed === true) {
    return quotation;
  }

  for (let attempt = 0; attempt < MAX_QUOTATION_POLLS; attempt += 1) {
    await sleep(POLL_DELAY_MS);

    quotation = await skydropxRequest(
      `/api/v1/quotations/${encodeURIComponent(quotation.id)}`,
      { method: "GET" },
      accessToken
    );

    if (quotation?.is_completed === true) {
      return quotation;
    }
  }

  throw new Error("Skydropx no terminó la cotización dentro del tiempo esperado.");
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, {
      ok: false,
      message: "Método no permitido."
    });
  }

  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, {
      ok: false,
      message: "La solicitud no contiene JSON válido."
    });
  }

  const destination = {
    postalCode: cleanText(input.postalCode, 5),
    state: cleanText(input.state, 100),
    municipality: cleanText(input.municipality, 120),
    neighborhood: cleanText(input.neighborhood, 120)
  };

  const declaredValue = Number(input.declaredValue);

  if (!/^\d{5}$/.test(destination.postalCode)) {
    return jsonResponse(400, { ok: false, message: "Código postal inválido." });
  }

  if (!destination.state || !destination.municipality || destination.neighborhood.length < 2) {
    return jsonResponse(400, {
      ok: false,
      message: "Faltan estado, municipio o colonia para cotizar el envío."
    });
  }

  if (!Number.isFinite(declaredValue) || declaredValue <= 0 || declaredValue > 100000) {
    return jsonResponse(400, {
      ok: false,
      message: "El valor declarado del paquete es inválido."
    });
  }

  try {
    const accessToken = await getAccessToken();
    const quotation = await createCompletedQuotation(accessToken, destination, declaredValue);
    const availableRates = getAvailableRates(quotation);

    if (availableRates.length === 0) {
      return jsonResponse(422, {
        ok: false,
        message: "Skydropx no encontró tarifas disponibles para este destino."
      });
    }

    availableRates.sort((a, b) => a.charge - b.charge);
    const selected = availableRates[0];
    const rate = selected.rate;

    // Se cobra el entero inmediato superior para no absorber centavos de la tarifa real.
    const shippingCost = Math.ceil(selected.charge);

    return jsonResponse(200, {
      ok: true,
      quotationId: quotation.id,
      rateId: rate.id,
      shippingCost,
      rawShippingCost: selected.charge,
      currency: rate.currency_code || "MXN",
      provider: rate.provider_display_name || rate.provider_name || "Skydropx",
      service: rate.provider_service_name || rate.provider_service_code || "Servicio disponible",
      estimatedDays: Number.isFinite(Number(rate.days)) ? Number(rate.days) : null,
      deliveryType: "Paquetería nacional",
      protected: true
    });
  } catch (error) {
    console.error("[skydropx-quote]", {
      message: error?.message,
      status: error?.status || null
    });

    return jsonResponse(502, {
      ok: false,
      message: "No pudimos obtener una tarifa confirmada de Skydropx. Inténtalo nuevamente en unos momentos."
    });
  }
};

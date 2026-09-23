const API_BASE = (
  process.env.SKYDROPX_API_BASE || "https://api-pro.skydropx.com"
).replace(/\/$/, "");

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

const MAX_QUOTATION_POLLS = 8;
const MAX_SHIPMENT_POLLS = 8;
const POLL_DELAY_MS = 750;

let tokenCache = {
  accessToken: "",
  expiresAt: 0
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value, maxLength = 160) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeMexicanPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("52")) {
    digits = digits.slice(2);
  }

  if (digits.length > 10) {
    digits = digits.slice(-10);
  }

  if (digits.length !== 10) {
    throw new Error("El teléfono debe contener 10 dígitos para generar la guía.");
  }

  return digits;
}

function apiError(prefix, response, body) {
  const detail =
    body?.message ||
    body?.error_description ||
    body?.error ||
    body?.errors?.[0]?.detail ||
    `HTTP ${response.status}`;

  const error = new Error(`${prefix}: ${detail}`);
  error.status = response.status;
  error.payload = body;
  return error;
}

async function getAccessToken() {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const clientId = cleanText(process.env.SKYDROPX_CLIENT_ID, 500);
  const clientSecret = cleanText(process.env.SKYDROPX_CLIENT_SECRET, 1000);

  if (!clientId || !clientSecret) {
    throw new Error("Faltan SKYDROPX_CLIENT_ID o SKYDROPX_CLIENT_SECRET.");
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

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.access_token) {
    throw apiError("No se pudo autenticar con Skydropx", response, payload);
  }

  const expiresInSeconds = Number(payload.expires_in) || 7200;

  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(60_000, expiresInSeconds * 1000 - 60_000)
  };

  return tokenCache.accessToken;
}

async function requestSkydropx(path, options, token) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(options?.headers || {})
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw apiError("Skydropx rechazó la solicitud", response, payload);
  }

  return payload;
}

function rateCharge(rate) {
  return (
    positiveNumber(rate?.total_value_with_protection) ??
    positiveNumber(rate?.total) ??
    positiveNumber(rate?.amount)
  );
}

function availableRates(quotation) {
  const rates = Array.isArray(quotation?.rates)
    ? quotation.rates
    : Array.isArray(quotation?.data?.attributes?.rates)
      ? quotation.data.attributes.rates
      : [];

  return rates
    .map((rate) => ({
      rate,
      charge: rateCharge(rate)
    }))
    .filter(({ rate, charge }) =>
      rate?.success === true &&
      charge !== null &&
      (!rate.currency_code || rate.currency_code === "MXN")
    )
    .sort((a, b) => a.charge - b.charge);
}

async function createBestQuotation(destination, declaredValue) {
  const token = await getAccessToken();
  const originColony = cleanText(process.env.SKYDROPX_ORIGIN_COLONY, 120);

  if (!originColony) {
    throw new Error("Falta SKYDROPX_ORIGIN_COLONY.");
  }

  const payload = {
    quotation: {
      address_from: {
        ...ORIGIN,
        area_level3: originColony
      },
      address_to: {
        country_code: "MX",
        postal_code: cleanText(destination.postalCode, 5),
        area_level1: cleanText(destination.state, 100),
        area_level2: cleanText(destination.municipality, 120),
        area_level3: cleanText(destination.neighborhood, 120)
      },
      parcels: [
        {
          ...PARCEL,
          package_protected: true,
          declared_value: Number(declaredValue)
        }
      ]
    }
  };

  let quotation = await requestSkydropx(
    "/api/v1/quotations",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );

  const quotationId = quotation?.id || quotation?.data?.id;

  if (!quotationId) {
    throw new Error("Skydropx no devolvió el ID de la cotización.");
  }

  const isCompleted = () =>
    quotation?.is_completed === true ||
    quotation?.data?.attributes?.is_completed === true ||
    quotation?.data?.attributes?.status === "completed";

  if (!isCompleted()) {
    for (let attempt = 0; attempt < MAX_QUOTATION_POLLS; attempt += 1) {
      await sleep(POLL_DELAY_MS);

      quotation = await requestSkydropx(
        `/api/v1/quotations/${encodeURIComponent(quotationId)}`,
        { method: "GET" },
        token
      );

      if (isCompleted()) {
        break;
      }
    }
  }

  const rates = availableRates(quotation);

  if (!rates.length) {
    throw new Error("Skydropx no encontró tarifas disponibles para este destino.");
  }

  const selected = rates[0];
  const rate = selected.rate;

  return {
    quotationId,
    rateId: cleanText(rate.id, 100),
    rawCost: selected.charge,
    chargedRecommendation: Math.ceil(selected.charge),
    currency: cleanText(rate.currency_code || "MXN", 10),
    provider: cleanText(
      rate.provider_display_name || rate.provider_name || "Skydropx",
      120
    ),
    providerName: cleanText(rate.provider_name || "", 120),
    service: cleanText(
      rate.provider_service_name ||
      rate.provider_service_code ||
      "Servicio disponible",
      160
    ),
    serviceCode: cleanText(rate.provider_service_code || "", 120),
    estimatedDays: numberOrNull(rate.days),
    packagingType: cleanText(
      rate.packaging_type || process.env.SKYDROPX_BOOK_PACKAGE_TYPE || "",
      40
    ),
    quotedAt: new Date().toISOString()
  };
}

function requiredOriginConfig() {
  const config = {
    street1: cleanText(process.env.SKYDROPX_ORIGIN_STREET1, 180),
    name: cleanText(process.env.SKYDROPX_ORIGIN_NAME, 120),
    company: cleanText(
      process.env.SKYDROPX_ORIGIN_COMPANY || "Develando el Código Masónico",
      120
    ),
    phone: cleanText(process.env.SKYDROPX_ORIGIN_PHONE, 40),
    email: cleanText(process.env.SKYDROPX_ORIGIN_EMAIL, 160),
    reference: cleanText(
      process.env.SKYDROPX_ORIGIN_REFERENCE || "Origen de envíos del libro",
      160
    ),
    apartmentNumber: cleanText(
      process.env.SKYDROPX_ORIGIN_APARTMENT_NUMBER,
      40
    ),
    furtherInformation: cleanText(
      process.env.SKYDROPX_ORIGIN_FURTHER_INFORMATION,
      70
    ),
    colony: cleanText(process.env.SKYDROPX_ORIGIN_COLONY, 120)
  };

  const missing = [];

  if (!config.street1) missing.push("SKYDROPX_ORIGIN_STREET1");
  if (!config.name) missing.push("SKYDROPX_ORIGIN_NAME");
  if (!config.phone) missing.push("SKYDROPX_ORIGIN_PHONE");
  if (!config.email) missing.push("SKYDROPX_ORIGIN_EMAIL");
  if (!config.colony) missing.push("SKYDROPX_ORIGIN_COLONY");

  if (missing.length) {
    throw new Error(
      `Faltan variables de origen para generar la guía: ${missing.join(", ")}.`
    );
  }

  config.phone = normalizeMexicanPhone(config.phone);

  return config;
}

function normalizeShipmentData(payload) {
  const root = Array.isArray(payload?.data)
    ? payload.data[0]
    : payload?.data || payload || {};

  const attrs = root?.attributes || root || {};
  const rate = attrs?.rate || root?.rate || {};

  const packages = Array.isArray(attrs?.packages)
    ? attrs.packages
    : Array.isArray(root?.packages)
      ? root.packages
      : [];

  const firstPackage = packages[0]?.attributes || packages[0] || {};

  return {
    id: cleanText(root?.id || attrs?.id, 120),
    status: cleanText(attrs?.status || root?.status, 80),
    trackingNumber: cleanText(
      attrs?.master_tracking_number ||
      root?.master_tracking_number ||
      firstPackage?.tracking_number,
      120
    ),
    trackingUrl: cleanText(
      firstPackage?.tracking_url_provider ||
      attrs?.tracking_url_provider ||
      root?.tracking_url_provider,
      1000
    ),
    labelUrl: cleanText(
      attrs?.label_url ||
      root?.label_url ||
      firstPackage?.label_url,
      1000
    ),
    provider: cleanText(
      rate?.provider_display_name ||
      rate?.provider_name ||
      "",
      120
    ),
    service: cleanText(
      rate?.provider_service_name ||
      rate?.provider_service_code ||
      "",
      160
    )
  };
}

async function createShipment(order, quote) {
  const token = await getAccessToken();
  const origin = requiredOriginConfig();

  const destinationPhone = normalizeMexicanPhone(order.customer.phone);
  const street1 = cleanText(
    `${order.address.street} ${order.address.exteriorNumber}`,
    180
  );

  const shipment = {
    rate_id: quote.rateId,
    unique_shipment: true,
    printing_format: "standard",
    include_order_detail: false,
    address_from: {
      ...ORIGIN,
      area_level3: origin.colony,
      street1: origin.street1,
      name: origin.name,
      company: origin.company,
      phone: origin.phone,
      email: origin.email,
      reference: origin.reference
    },
    address_to: {
      country_code: "MX",
      postal_code: order.address.postalCode,
      area_level1: order.address.state,
      area_level2: order.address.municipality,
      area_level3: order.address.neighborhood,
      street1,
      name: order.customer.name,
      company: "Particular",
      phone: destinationPhone,
      email: order.customer.email,
      reference: cleanText(
        order.address.deliveryReferences || "Domicilio particular",
        160
      )
    },
    packages: [
      {
        package_number: "1",
        package_protected: true,
        declared_value: Number(order.bookPrice)
      }
    ]
  };

  if (origin.apartmentNumber) {
    shipment.address_from.apartment_number = origin.apartmentNumber;
  }

  if (origin.furtherInformation) {
    shipment.address_from.further_information = origin.furtherInformation;
  }

  if (order.address.interiorNumber) {
    shipment.address_to.apartment_number = cleanText(
      order.address.interiorNumber,
      40
    );
  }

  if (order.address.deliveryReferences) {
    shipment.address_to.further_information = cleanText(
      order.address.deliveryReferences,
      70
    );
  }

  const consignmentNote = cleanText(
    process.env.SKYDROPX_BOOK_CONSIGNMENT_NOTE,
    40
  );

  if (consignmentNote) {
    shipment.packages[0].consignment_note = consignmentNote;
  }

  if (quote.packagingType) {
    shipment.packages[0].package_type = quote.packagingType;
  }

  let payload = await requestSkydropx(
    "/api/v1/shipments",
    {
      method: "POST",
      body: JSON.stringify({ shipment })
    },
    token
  );

  let normalized = normalizeShipmentData(payload);

  if (!normalized.id) {
    throw new Error("Skydropx no devolvió el ID del envío.");
  }

  for (
    let attempt = 0;
    attempt < MAX_SHIPMENT_POLLS &&
    (!normalized.trackingNumber || !normalized.labelUrl);
    attempt += 1
  ) {
    await sleep(POLL_DELAY_MS);

    payload = await requestSkydropx(
      `/api/v1/shipments/${encodeURIComponent(normalized.id)}`,
      { method: "GET" },
      token
    );

    normalized = {
      ...normalized,
      ...normalizeShipmentData(payload)
    };
  }

  return {
    ...normalized,
    createdAt: new Date().toISOString()
  };
}

export {
  createBestQuotation,
  createShipment
};

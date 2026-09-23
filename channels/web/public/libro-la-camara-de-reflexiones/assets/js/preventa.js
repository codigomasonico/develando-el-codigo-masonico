/*
  LA CÁMARA DE REFLEXIONES · VENTA FÍSICA POR TRANSFERENCIA SPEI
  ----------------------------------------------------------------
  Origen fijo: Zapopan, Jalisco, C.P. 45133.
  Paquete: 560 g, 27 × 19 × 5 cm.
  Cotización nacional: Skydropx API, mediante función segura de Netlify.
*/

const BANK_DETAILS = {
  bank: "BBVA",
  beneficiary: "Daniel Marcelo Pazos Vidal",
  clabe: "012580012341242007"
};

const SHIPPING_ORIGIN = Object.freeze({
  municipality: "Zapopan",
  state: "Jalisco",
  postalCode: "45133"
});

const SKYDROPX_QUOTE_ENDPOINT = "/.netlify/functions/skydropx-quote";
const BOOK_ORDER_CREATE_ENDPOINT = "/.netlify/functions/book-order-create";
const POSTAL_CATALOG_URL = "assets/data/codigos-postales-mx.json?v=20260910-03";
const QUOTE_CACHE_TTL_MS = 10 * 60 * 1000;

const SALE_CONFIG = {
  preorderEndsAt: new Date("2026-09-16T06:00:00.000Z"),
  preorderPrice: 429,
  regularPrice: 499
};

const FREE_LOCAL_DELIVERY = [
  { state: "Jalisco", city: "Guadalajara", postalCodeStart: 44100, postalCodeEnd: 44999 },
  { state: "Jalisco", city: "Zapopan", municipality: "Zapopan" },
  { state: "Nuevo León", city: "Monterrey", postalCodeStart: 64000, postalCodeEnd: 64999 }
];

const FORMAT_LABELS = {
  fisico: "Libro físico"
};

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.querySelector("#preorderModal");
  const modalKicker = document.querySelector("#preorderModalKicker");
  const modalTitle = document.querySelector("#preorderModalTitle");
  const form = document.querySelector("#preorderForm");
  const stepForm = document.querySelector("#preorderStepForm");
  const stepPayment = document.querySelector("#preorderStepPayment");
  const localPreorderNotice = document.querySelector("#localPreorderNotice");

  const formatField = document.querySelector("#preorderFormat");
  const amountField = document.querySelector("#preorderAmount");
  const bookPriceField = document.querySelector("#preorderBookPrice");
  const shippingCostField = document.querySelector("#preorderShippingCost");
  const deliveryTypeField = document.querySelector("#preorderDeliveryType");
  const priceStageField = document.querySelector("#preorderPriceStage");
  const deliveryStateHiddenField = document.querySelector("#preorderDeliveryState");
  const deliveryMunicipalityHiddenField = document.querySelector("#preorderDeliveryMunicipality");
  const deliveryNeighborhoodHiddenField = document.querySelector("#preorderDeliveryNeighborhood");
  const shippingOriginField = document.querySelector("#preorderShippingOrigin");
  const skydropxQuotationIdField = document.querySelector("#preorderSkydropxQuotationId");
  const skydropxRateIdField = document.querySelector("#preorderSkydropxRateId");
  const skydropxProviderField = document.querySelector("#preorderSkydropxProvider");
  const skydropxServiceField = document.querySelector("#preorderSkydropxService");
  const skydropxRawCostField = document.querySelector("#preorderSkydropxRawCost");
  const referenceField = document.querySelector("#preorderReferenceField");

  const selectedFormat = document.querySelector("#preorderSelectedFormat");
  const selectedBookPrice = document.querySelector("#preorderSelectedBookPrice");
  const selectedShipping = document.querySelector("#preorderSelectedShipping");
  const selectedAmount = document.querySelector("#preorderSelectedAmount");
  const referenceOutput = document.querySelector("#preorderReference");
  const paymentAmount = document.querySelector("#paymentAmount");
  const paymentConcept = document.querySelector("#paymentConcept");

  const deliveryStateField = document.querySelector("#deliveryStateField");
  const deliveryPostalCodeField = document.querySelector("#deliveryPostalCodeField");
  const deliveryMunicipalityField = document.querySelector("#deliveryMunicipalityField");
  const deliveryNeighborhoodField = document.querySelector("#deliveryNeighborhoodField");
  const deliveryNeighborhoodCustomField = document.querySelector("#deliveryNeighborhoodCustomField");
  const deliveryStreetField = document.querySelector("#deliveryStreetField");
  const deliveryExteriorNumberField = document.querySelector("#deliveryExteriorNumberField");
  const deliveryInteriorNumberField = document.querySelector("#deliveryInteriorNumberField");
  const deliveryReferencesField = document.querySelector("#deliveryReferencesField");
  const buyerState = document.querySelector("#buyerState");
  const buyerPostalCode = document.querySelector("#buyerPostalCode");
  const buyerMunicipality = document.querySelector("#buyerMunicipality");
  const buyerNeighborhood = document.querySelector("#buyerNeighborhood");
  const buyerNeighborhoodCustom = document.querySelector("#buyerNeighborhoodCustom");
  const buyerStreet = document.querySelector("#buyerStreet");
  const buyerExteriorNumber = document.querySelector("#buyerExteriorNumber");
  const buyerInteriorNumber = document.querySelector("#buyerInteriorNumber");
  const buyerDeliveryReferences = document.querySelector("#buyerDeliveryReferences");
  const physicalDeliveryNote = document.querySelector("#physicalDeliveryNote");

  const physicalBookPrice = document.querySelector("#physicalBookPrice");
  const physicalBookPriceLabel = document.querySelector("#physicalBookPriceLabel");
  const physicalOfferIntro = document.querySelector("#physicalOfferIntro");
  const physicalOfferBadge = document.querySelector("#physicalOfferBadge");
  const physicalOfferBenefit = document.querySelector("#physicalOfferBenefit");
  const physicalRegularPriceNote = document.querySelector("#physicalRegularPriceNote");
  const physicalDeliveryPageNote = document.querySelector("#physicalDeliveryPageNote");
  const physicalButton = document.querySelector('.js-preorder[data-format="fisico"]');

  const submitButton = form.querySelector(".preorder-continue");
  const submitButtonLabel = submitButton.textContent.trim();
  const isLocalPreview = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

  let postalCatalogPromise = null;
  let postalLookupRequestId = 0;
  let neighborhoodDebounceTimer = null;
  let neighborhoodLookupRequestId = 0;
  const quoteCache = new Map();

  const formError = document.createElement("p");
  formError.className = "preorder-important";
  formError.setAttribute("role", "alert");
  formError.hidden = true;
  submitButton.before(formError);

  function formatMXN(value) {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0
    }).format(value);
  }

  function getSaleState(now = new Date()) {
    const isPreorder = now < SALE_CONFIG.preorderEndsAt;

    return {
      isPreorder,
      bookPrice: isPreorder ? SALE_CONFIG.preorderPrice : SALE_CONFIG.regularPrice,
      stage: isPreorder ? "Preventa" : "Precio regular"
    };
  }

  function loadPostalCatalog() {
    if (!postalCatalogPromise) {
      postalCatalogPromise = fetch(POSTAL_CATALOG_URL, { cache: isLocalPreview ? "no-store" : "force-cache" })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`No se pudo cargar el catálogo postal (${response.status}).`);
          }
          return response.json();
        })
        .then((catalog) => catalog.codes || {})
        .catch((error) => {
          postalCatalogPromise = null;
          throw error;
        });
    }

    return postalCatalogPromise;
  }

  function resolvePostalCode(postalCatalog) {
    const postalCodeText = buyerPostalCode.value.trim();

    if (!/^\d{5}$/.test(postalCodeText)) {
      return { postalCode: null, postalCodeText: "", state: "", municipality: "" };
    }

    const postalRecord = postalCatalog[postalCodeText];

    if (!postalRecord) {
      return { postalCode: null, postalCodeText: "", state: "", municipality: "" };
    }

    return {
      postalCode: Number(postalCodeText),
      postalCodeText,
      municipality: postalRecord[0],
      state: postalRecord[1],
      neighborhoods: Array.isArray(postalRecord[2]) ? postalRecord[2] : []
    };
  }

  function normalizeNeighborhoods(values) {
    return [...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim().replace(/\s+/g, " "))
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "es-MX", { sensitivity: "base" }));
  }

  function resetNeighborhoodSelector(message = "Selecciona primero el C.P.") {
    buyerNeighborhood.innerHTML = "";

    const option = document.createElement("option");
    option.value = "";
    option.textContent = message;
    buyerNeighborhood.appendChild(option);

    buyerNeighborhood.value = "";
    buyerNeighborhood.disabled = true;
    buyerNeighborhood.required = false;

    buyerNeighborhoodCustom.value = "";
    buyerNeighborhoodCustom.disabled = true;
    buyerNeighborhoodCustom.required = false;
    deliveryNeighborhoodCustomField.hidden = true;
    deliveryNeighborhoodCustomField.style.display = "none";

    deliveryNeighborhoodHiddenField.value = "";
  }

  function setNeighborhoodOptions(neighborhoods) {
    const values = normalizeNeighborhoods(neighborhoods);

    buyerNeighborhood.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = values.length
      ? "Selecciona la colonia"
      : "No hay colonias disponibles";
    buyerNeighborhood.appendChild(placeholder);

    values.forEach((neighborhood) => {
      const option = document.createElement("option");
      option.value = neighborhood;
      option.textContent = neighborhood;
      buyerNeighborhood.appendChild(option);
    });

    const other = document.createElement("option");
    other.value = "__other__";
    other.textContent = "Otra / mi colonia no aparece";
    buyerNeighborhood.appendChild(other);

    buyerNeighborhood.disabled = false;
    buyerNeighborhood.required = true;
  }

  function showCustomNeighborhood(show) {
    // El selector principal de colonia debe permanecer visible siempre.
    deliveryNeighborhoodField.hidden = false;
    deliveryNeighborhoodField.style.display = "";
    buyerNeighborhood.style.display = "";

    deliveryNeighborhoodCustomField.hidden = !show;
    deliveryNeighborhoodCustomField.style.display = show ? "" : "none";
    buyerNeighborhoodCustom.disabled = !show;
    buyerNeighborhoodCustom.required = show;

    if (!show) {
      buyerNeighborhoodCustom.value = "";
    }
  }

  function getNeighborhoodValue() {
    return buyerNeighborhood.value === "__other__"
      ? buyerNeighborhoodCustom.value.trim()
      : buyerNeighborhood.value.trim();
  }

  function syncNeighborhoodValue() {
    deliveryNeighborhoodHiddenField.value = getNeighborhoodValue();
  }

  function loadNeighborhoodsForPostalCode(resolvedPostalCode) {
    const neighborhoods = normalizeNeighborhoods(resolvedPostalCode.neighborhoods);

    if (neighborhoods.length) {
      setNeighborhoodOptions(neighborhoods);
      return neighborhoods;
    }

    setNeighborhoodOptions([]);
    buyerNeighborhood.value = "__other__";
    showCustomNeighborhood(true);
    return [];
  }

  function getFreeLocalDelivery(resolvedPostalCode) {
    const sale = getSaleState();

    if (!sale.isPreorder || !resolvedPostalCode.state || resolvedPostalCode.postalCode === null) {
      return null;
    }

    return FREE_LOCAL_DELIVERY.find((zone) => {
      if (zone.state !== resolvedPostalCode.state) {
        return false;
      }

      if (zone.municipality) {
        return resolvedPostalCode.municipality === zone.municipality;
      }

      return (
        resolvedPostalCode.postalCode >= zone.postalCodeStart &&
        resolvedPostalCode.postalCode <= zone.postalCodeEnd
      );
    }) || null;
  }

  function clearSkydropxMetadata() {
    skydropxQuotationIdField.value = "";
    skydropxRateIdField.value = "";
    skydropxProviderField.value = "";
    skydropxServiceField.value = "";
    skydropxRawCostField.value = "";
  }

  function clearQuoteFields(message = "Ingresa el C.P.") {
    shippingCostField.value = "";
    deliveryTypeField.value = "";
    amountField.value = "";
    selectedShipping.textContent = message;
    selectedAmount.textContent = "—";
    clearSkydropxMetadata();
  }

  function applyQuote(quote, sale) {
    const total = sale.bookPrice + quote.shippingCost;

    shippingCostField.value = String(quote.shippingCost);
    deliveryTypeField.value = quote.deliveryType;
    amountField.value = String(total);
    selectedShipping.textContent = quote.shippingCost === 0
      ? "Gratis (entrega local)"
      : formatMXN(quote.shippingCost);
    selectedAmount.textContent = formatMXN(total);

    skydropxQuotationIdField.value = quote.quotationId || "";
    skydropxRateIdField.value = quote.rateId || "";
    skydropxProviderField.value = quote.provider || "";
    skydropxServiceField.value = quote.service || "";
    skydropxRawCostField.value = quote.rawShippingCost != null
      ? String(quote.rawShippingCost)
      : "";
  }

  function buildQuoteCacheKey(resolvedPostalCode, neighborhood, declaredValue) {
    return [
      resolvedPostalCode.postalCodeText,
      resolvedPostalCode.state,
      resolvedPostalCode.municipality,
      neighborhood.trim().toLowerCase(),
      declaredValue
    ].join("|");
  }

  function getCachedQuote(key) {
    const entry = quoteCache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() - entry.createdAt > QUOTE_CACHE_TTL_MS) {
      quoteCache.delete(key);
      return null;
    }

    return entry.quote;
  }

  function setCachedQuote(key, quote) {
    quoteCache.set(key, {
      createdAt: Date.now(),
      quote
    });
  }

  async function requestSkydropxQuote(resolvedPostalCode, neighborhood, declaredValue, forceLive = false) {
    const cacheKey = buildQuoteCacheKey(resolvedPostalCode, neighborhood, declaredValue);

    if (!forceLive) {
      const cached = getCachedQuote(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const response = await fetch(SKYDROPX_QUOTE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({
        postalCode: resolvedPostalCode.postalCodeText,
        state: resolvedPostalCode.state,
        municipality: resolvedPostalCode.municipality,
        neighborhood: neighborhood.trim(),
        declaredValue
      })
    });

    let payload = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok || !payload?.ok) {
      const message = payload?.message || "No fue posible obtener la cotización de envío.";
      throw new Error(message);
    }

    const quote = {
      shippingCost: Number(payload.shippingCost),
      rawShippingCost: Number(payload.rawShippingCost),
      deliveryType: payload.deliveryType || "Paquetería nacional",
      quotationId: payload.quotationId || "",
      rateId: payload.rateId || "",
      provider: payload.provider || "",
      service: payload.service || "",
      estimatedDays: payload.estimatedDays ?? null
    };

    if (!Number.isFinite(quote.shippingCost) || quote.shippingCost <= 0) {
      throw new Error("Skydropx no devolvió una tarifa válida para este destino.");
    }

    setCachedQuote(cacheKey, quote);
    return quote;
  }

  async function updateOrderSummary({ forceLive = false } = {}) {
    const requestId = ++postalLookupRequestId;
    const sale = getSaleState();
    const postalCodeText = buyerPostalCode.value.trim();

    buyerState.value = "";
    buyerMunicipality.value = "";
    deliveryStateHiddenField.value = "";
    deliveryMunicipalityHiddenField.value = "";
    buyerPostalCode.setCustomValidity("");
    buyerNeighborhood.setCustomValidity("");
    buyerNeighborhoodCustom.setCustomValidity("");
    syncNeighborhoodValue();

    bookPriceField.value = String(sale.bookPrice);
    priceStageField.value = sale.stage;
    selectedBookPrice.textContent = formatMXN(sale.bookPrice);

    if (!/^\d{5}$/.test(postalCodeText)) {
      resetNeighborhoodSelector();
      clearQuoteFields("Ingresa el C.P.");
      return null;
    }

    clearQuoteFields("Consultando C.P.…");

    let postalCatalog;

    try {
      postalCatalog = await loadPostalCatalog();
    } catch (error) {
      if (requestId !== postalLookupRequestId) {
        return null;
      }

      console.warn("No se pudo consultar el catálogo postal.", error);
      buyerPostalCode.setCustomValidity("No pudimos validar el código postal. Inténtalo nuevamente.");
      clearQuoteFields("No se pudo validar");
      return null;
    }

    if (requestId !== postalLookupRequestId) {
      return null;
    }

    const resolvedPostalCode = resolvePostalCode(postalCatalog);

    if (!resolvedPostalCode.state || resolvedPostalCode.postalCode === null) {
      buyerPostalCode.setCustomValidity("Introduce un código postal mexicano válido.");
      resetNeighborhoodSelector("C.P. no reconocido");
      clearQuoteFields("C.P. no reconocido");
      return null;
    }

    buyerState.value = resolvedPostalCode.state;
    buyerMunicipality.value = resolvedPostalCode.municipality;
    deliveryStateHiddenField.value = resolvedPostalCode.state;
    deliveryMunicipalityHiddenField.value = resolvedPostalCode.municipality;

    if (buyerNeighborhood.dataset.postalCode !== resolvedPostalCode.postalCodeText) {
      buyerNeighborhood.dataset.postalCode = resolvedPostalCode.postalCodeText;
      await loadNeighborhoodsForPostalCode(resolvedPostalCode);

      if (requestId !== postalLookupRequestId) {
        return null;
      }
    }

    const freeZone = getFreeLocalDelivery(resolvedPostalCode);

    const neighborhood = getNeighborhoodValue();
    syncNeighborhoodValue();

    if (freeZone) {
      const quote = {
        shippingCost: 0,
        rawShippingCost: 0,
        deliveryType: `Entrega local gratuita en ${freeZone.city}`,
        quotationId: "",
        rateId: "",
        provider: "Entrega local",
        service: freeZone.city
      };

      applyQuote(quote, sale);
      return quote;
    }

    if (!buyerNeighborhood.value) {
      clearQuoteFields("Selecciona la colonia");
      return null;
    }

    if (buyerNeighborhood.value === "__other__" && neighborhood.length < 2) {
      clearQuoteFields("Ingresa la colonia");
      return null;
    }

    if (neighborhood.length < 2) {
      clearQuoteFields("Selecciona la colonia");
      return null;
    }

    selectedShipping.textContent = "Cotizando envío...";

    let quote;

    try {
      quote = await requestSkydropxQuote(
        resolvedPostalCode,
        neighborhood,
        sale.bookPrice,
        forceLive
      );
    } catch (error) {
      if (requestId !== postalLookupRequestId) {
        return null;
      }

      console.warn("No se pudo obtener la cotización de Skydropx.", error);
      buyerNeighborhood.setCustomValidity(
        "No pudimos cotizar el envío para esta dirección. Verifica la colonia o inténtalo nuevamente."
      );
      clearQuoteFields("No se pudo cotizar");
      return null;
    }

    if (requestId !== postalLookupRequestId) {
      return null;
    }

    applyQuote(quote, sale);
    return quote;
  }

  function configureDeliveryFields(format) {
    const includesPhysicalBook = format === "fisico";

    deliveryStateField.hidden = !includesPhysicalBook;
    deliveryStateField.style.display = includesPhysicalBook ? "" : "none";
    deliveryPostalCodeField.hidden = !includesPhysicalBook;
    deliveryPostalCodeField.style.display = includesPhysicalBook ? "" : "none";
    deliveryMunicipalityField.hidden = !includesPhysicalBook;
    deliveryMunicipalityField.style.display = includesPhysicalBook ? "" : "none";
    deliveryNeighborhoodField.hidden = !includesPhysicalBook;
    deliveryNeighborhoodField.style.display = includesPhysicalBook ? "" : "none";
    deliveryNeighborhoodCustomField.hidden = true;
    deliveryNeighborhoodCustomField.style.display = "none";
    deliveryStreetField.hidden = !includesPhysicalBook;
    deliveryStreetField.style.display = includesPhysicalBook ? "" : "none";
    deliveryExteriorNumberField.hidden = !includesPhysicalBook;
    deliveryExteriorNumberField.style.display = includesPhysicalBook ? "" : "none";
    deliveryInteriorNumberField.hidden = !includesPhysicalBook;
    deliveryInteriorNumberField.style.display = includesPhysicalBook ? "" : "none";
    deliveryReferencesField.hidden = !includesPhysicalBook;
    deliveryReferencesField.style.display = includesPhysicalBook ? "" : "none";
    physicalDeliveryNote.hidden = !includesPhysicalBook;
    physicalDeliveryNote.style.display = includesPhysicalBook ? "" : "none";

    buyerState.disabled = true;
    buyerPostalCode.disabled = !includesPhysicalBook;
    buyerPostalCode.required = includesPhysicalBook;
    resetNeighborhoodSelector();
    buyerStreet.disabled = !includesPhysicalBook;
    buyerStreet.required = includesPhysicalBook;
    buyerExteriorNumber.disabled = !includesPhysicalBook;
    buyerExteriorNumber.required = includesPhysicalBook;
    buyerInteriorNumber.disabled = !includesPhysicalBook;
    buyerDeliveryReferences.disabled = !includesPhysicalBook;

    buyerState.value = "";
    buyerMunicipality.value = "";
    buyerNeighborhood.dataset.postalCode = "";
    buyerStreet.value = "";
    buyerExteriorNumber.value = "";
    buyerInteriorNumber.value = "";
    buyerDeliveryReferences.value = "";
    deliveryStateHiddenField.value = "";
    deliveryMunicipalityHiddenField.value = "";
    deliveryNeighborhoodHiddenField.value = "";
    buyerPostalCode.value = "";
    clearQuoteFields();
  }

  function updateVisibleOffer() {
    const sale = getSaleState();

    physicalBookPrice.textContent = formatMXN(sale.bookPrice);
    physicalButton.dataset.price = String(sale.bookPrice);

    if (sale.isPreorder) {
      physicalBookPriceLabel.textContent = "MXN · preventa*";
      physicalOfferBadge.textContent = "Preventa disponible";
      physicalOfferBenefit.textContent = "Precio especial de preventa";
      physicalRegularPriceNote.hidden = false;
      physicalButton.textContent = "Reservar libro físico";
      physicalOfferIntro.innerHTML =
        "Reserva la edición física con precio especial hasta el 15 de septiembre de 2026.<br>" +
        "La edición Kindle está disponible en preventa exclusivamente en Amazon.";
      physicalDeliveryPageNote.textContent =
        "* Hasta el 15 de septiembre la entrega local es gratuita en Guadalajara, Zapopan y Monterrey. " +
        "Para el resto de México el costo de envío se cotiza en tiempo real. Desde el 16 de septiembre todos los pedidos se envían por paquetería.";
      physicalDeliveryNote.textContent = physicalDeliveryPageNote.textContent;
      modalKicker.textContent = "Preventa";
      modalTitle.textContent = "Reserva tu ejemplar";
      return;
    }

    physicalBookPriceLabel.textContent = "MXN · precio regular*";
    physicalOfferBadge.textContent = "Disponible";
    physicalOfferBenefit.textContent = "Envíos a todo México";
    physicalRegularPriceNote.hidden = true;
    physicalButton.textContent = "Comprar libro físico";
    physicalOfferIntro.innerHTML =
      "Compra la edición física y recibe el libro por paquetería en cualquier estado de México.<br>" +
      "La edición Kindle está disponible exclusivamente en Amazon.";
    physicalDeliveryPageNote.textContent =
      "* El costo de envío se cotiza en tiempo real y se suma automáticamente al total de la compra.";
    physicalDeliveryNote.textContent = physicalDeliveryPageNote.textContent;
    modalKicker.textContent = "Compra";
    modalTitle.textContent = "Solicita tu ejemplar";
  }

  function buildReference(name = "") {
    const now = new Date();
    const y = String(now.getFullYear()).slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const stamp = String(now.getTime()).slice(-5);
    const cleanName = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase()
      .slice(0, 3) || "XXX";

    return `CAM-${y}${m}${d}-${cleanName}${stamp}`;
  }

  function formDataToObject(formData) {
    const result = {};

    for (const [key, value] of formData.entries()) {
      result[key] = typeof value === "string" ? value : String(value);
    }

    return result;
  }

  async function persistBookOrder(formData) {
    const response = await fetch(BOOK_ORDER_CREATE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify(formDataToObject(formData))
    });

    let payload = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.message || `No se pudo guardar el pedido (${response.status}).`);
    }

    return payload.order;
  }

  function showPaymentStep(reference, localPreview = false) {
    referenceOutput.textContent = reference;
    paymentAmount.textContent = formatMXN(Number(amountField.value));
    paymentConcept.textContent = reference;

    if (localPreview) {
      localPreorderNotice.innerHTML =
        "<strong>Modo de prueba local:</strong> el pedido se guardó únicamente en el almacenamiento sandbox local de Netlify. " +
        "No realices la transferencia.";
      localPreorderNotice.hidden = false;
    } else {
      localPreorderNotice.hidden = true;
    }

    stepForm.hidden = true;
    stepPayment.hidden = false;
  }

  function resetPreorderFormState() {
    window.clearTimeout(neighborhoodDebounceTimer);
    postalLookupRequestId += 1;

    form.reset();

    // Limpieza explícita de campos visibles para evitar que queden datos de la apertura anterior.
    document.querySelector("#buyerName").value = "";
    document.querySelector("#buyerEmail").value = "";
    document.querySelector("#buyerPhone").value = "";

    buyerPostalCode.value = "";
    buyerState.value = "";
    buyerMunicipality.value = "";
    buyerStreet.value = "";
    buyerExteriorNumber.value = "";
    buyerInteriorNumber.value = "";
    buyerDeliveryReferences.value = "";
    buyerNeighborhoodCustom.value = "";

    buyerNeighborhood.dataset.postalCode = "";
    resetNeighborhoodSelector();

    deliveryStateHiddenField.value = "";
    deliveryMunicipalityHiddenField.value = "";
    deliveryNeighborhoodHiddenField.value = "";
    shippingCostField.value = "";
    deliveryTypeField.value = "";
    amountField.value = "";
    referenceField.value = "";
    clearSkydropxMetadata();

    selectedFormat.textContent = "—";
    selectedBookPrice.textContent = "—";
    selectedShipping.textContent = "Ingresa el C.P.";
    selectedAmount.textContent = "—";

    formError.hidden = true;
    formError.textContent = "";

    stepForm.hidden = false;
    stepPayment.hidden = true;
    localPreorderNotice.hidden = true;

    submitButton.disabled = false;
    submitButton.textContent = submitButtonLabel;
  }

  function openModal(format) {
    resetPreorderFormState();

    formatField.value = format;
    selectedFormat.textContent = FORMAT_LABELS[format] || format;
    configureDeliveryFields(format);

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    setTimeout(() => document.querySelector("#buyerName")?.focus(), 50);
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    resetPreorderFormState();
  }

  updateVisibleOffer();
  configureDeliveryFields("");

  document.querySelector("#bankName").textContent = BANK_DETAILS.bank;
  document.querySelector("#bankBeneficiary").textContent = BANK_DETAILS.beneficiary;
  document.querySelector("#bankClabe").textContent = BANK_DETAILS.clabe;
  shippingOriginField.value = `${SHIPPING_ORIGIN.municipality}, ${SHIPPING_ORIGIN.state}, C.P. ${SHIPPING_ORIGIN.postalCode}`;

  buyerPostalCode.addEventListener("input", () => {
    buyerPostalCode.value = buyerPostalCode.value.replace(/\D/g, "").slice(0, 5);
    buyerNeighborhood.dataset.postalCode = "";
    resetNeighborhoodSelector();
    updateOrderSummary();
  });

  buyerNeighborhood.addEventListener("change", () => {
    buyerNeighborhood.setCustomValidity("");
    buyerNeighborhoodCustom.setCustomValidity("");

    const useCustom = buyerNeighborhood.value === "__other__";
    showCustomNeighborhood(useCustom);
    syncNeighborhoodValue();

    if (useCustom) {
      clearQuoteFields("Ingresa la colonia");
      setTimeout(() => buyerNeighborhoodCustom.focus(), 0);
      return;
    }

    if (!buyerNeighborhood.value) {
      clearQuoteFields("Selecciona la colonia");
      return;
    }

    updateOrderSummary();
  });

  buyerNeighborhoodCustom.addEventListener("input", () => {
    buyerNeighborhoodCustom.setCustomValidity("");
    syncNeighborhoodValue();
    window.clearTimeout(neighborhoodDebounceTimer);

    if (buyerNeighborhoodCustom.value.trim().length < 2) {
      clearQuoteFields("Ingresa la colonia");
      return;
    }

    neighborhoodDebounceTimer = window.setTimeout(() => {
      updateOrderSummary();
    }, 500);
  });

  document.querySelectorAll(".js-preorder").forEach((button) => {
    button.addEventListener("click", () => {
      openModal(button.dataset.format);
    });
  });

  document.querySelectorAll("[data-close-preorder]").forEach((button) => {
    button.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (submitButton.disabled) {
      return;
    }

    formError.hidden = true;
    formError.textContent = "";
    submitButton.disabled = true;
    submitButton.textContent = "Verificando envío...";

    let quote = null;

    try {
      quote = await updateOrderSummary({ forceLive: true });

      if (!quote || shippingCostField.value === "" || amountField.value === "") {
        formError.textContent =
          "No pudimos confirmar el costo del envío. Revisa el código postal y la colonia antes de continuar.";
        formError.hidden = false;
        buyerPostalCode.focus();
        return;
      }

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      syncNeighborhoodValue();

      if (!deliveryNeighborhoodHiddenField.value.trim()) {
        formError.textContent = "Selecciona una colonia o escríbela si no aparece en la lista.";
        formError.hidden = false;

        if (buyerNeighborhood.value === "__other__") {
          buyerNeighborhoodCustom.focus();
        } else {
          buyerNeighborhood.focus();
        }
        return;
      }

      const name = document.querySelector("#buyerName").value.trim();
      const reference = buildReference(name);
      referenceField.value = reference;
      const formData = new FormData(form);

      submitButton.textContent = "Registrando pedido...";

      // Fuente operativa del panel administrativo.
      await persistBookOrder(formData);

      // Netlify Forms se conserva como respaldo de los pedidos en producción.
      if (!isLocalPreview) {
        try {
          const response = await fetch("/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(formData).toString()
          });

          if (!response.ok) {
            console.warn(`El respaldo de Netlify Forms respondió con estado ${response.status}.`);
          }
        } catch (backupError) {
          console.warn("No se pudo registrar el respaldo en Netlify Forms.", backupError);
        }
      }

      showPaymentStep(reference, isLocalPreview);
    } catch (error) {
      console.warn("No se pudo registrar automáticamente el pedido.", error);
      formError.textContent =
        "No pudimos registrar tu pedido. Revisa tu conexión e inténtalo nuevamente. No realices ninguna transferencia hasta que aparezcan tu referencia y los datos de pago.";
      formError.hidden = false;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = submitButtonLabel;
    }
  });
});

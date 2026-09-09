/*
  LA CÁMARA DE REFLEXIONES · VENTA FÍSICA POR TRANSFERENCIA SPEI
  ----------------------------------------------------------------
  Origen fijo: Zapopan, Jalisco, C.P. 45133.
  Tarifas estimadas para un paquete de 560 g, 27 × 19 × 5 cm.
  Modifica SHIPPING_RATES cuando cambien los precios de la paquetería.
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

const POSTAL_CATALOG_URL = "assets/data/codigos-postales-mx.json";

const SALE_CONFIG = {
  preorderEndsAt: new Date("2026-09-16T06:00:00.000Z"),
  preorderPrice: 429,
  regularPrice: 499
};

const SHIPPING_RATES = {
  "Aguascalientes": 129,
  "Baja California": 219,
  "Baja California Sur": 229,
  "Campeche": 189,
  "Chiapas": 199,
  "Chihuahua": 189,
  "Ciudad de México": 149,
  "Coahuila": 169,
  "Colima": 129,
  "Durango": 159,
  "Estado de México": 149,
  "Guanajuato": 129,
  "Guerrero": 169,
  "Hidalgo": 159,
  "Jalisco": 119,
  "Michoacán": 129,
  "Morelos": 159,
  "Nayarit": 129,
  "Nuevo León": 169,
  "Oaxaca": 189,
  "Puebla": 159,
  "Querétaro": 149,
  "Quintana Roo": 209,
  "San Luis Potosí": 149,
  "Sinaloa": 169,
  "Sonora": 189,
  "Tabasco": 189,
  "Tamaulipas": 179,
  "Tlaxcala": 159,
  "Veracruz": 179,
  "Yucatán": 199,
  "Zacatecas": 139
};

const FREE_LOCAL_DELIVERY = [
  { state: "Jalisco", city: "Guadalajara", postalCodeStart: 44100, postalCodeEnd: 44999 },
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
  const shippingOriginField = document.querySelector("#preorderShippingOrigin");
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
  const buyerState = document.querySelector("#buyerState");
  const buyerPostalCode = document.querySelector("#buyerPostalCode");
  const buyerMunicipality = document.querySelector("#buyerMunicipality");
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
      postalCatalogPromise = fetch(POSTAL_CATALOG_URL, { cache: "force-cache" })
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
      return { postalCode: null, state: "", municipality: "" };
    }

    const postalRecord = postalCatalog[postalCodeText];

    if (!postalRecord) {
      return { postalCode: null, state: "", municipality: "" };
    }

    return {
      postalCode: Number(postalCodeText),
      municipality: postalRecord[0],
      state: postalRecord[1]
    };
  }

  function getDeliveryQuote(resolvedPostalCode) {
    const { state, postalCode } = resolvedPostalCode;
    const sale = getSaleState();

    if (!state || postalCode === null || !(state in SHIPPING_RATES)) {
      return null;
    }

    const freeZone = sale.isPreorder
      ? FREE_LOCAL_DELIVERY.find((zone) => (
          zone.state === state &&
          postalCode >= zone.postalCodeStart &&
          postalCode <= zone.postalCodeEnd
        ))
      : null;

    if (freeZone) {
      return {
        shippingCost: 0,
        deliveryType: `Entrega local gratuita en ${freeZone.city}`
      };
    }

    return {
      shippingCost: SHIPPING_RATES[state],
      deliveryType: "Paquetería nacional"
    };
  }

  async function updateOrderSummary() {
    const requestId = ++postalLookupRequestId;
    const sale = getSaleState();
    const postalCodeText = buyerPostalCode.value.trim();

    buyerState.value = "";
    buyerMunicipality.value = "";
    deliveryStateHiddenField.value = "";
    deliveryMunicipalityHiddenField.value = "";
    buyerPostalCode.setCustomValidity("");

    bookPriceField.value = String(sale.bookPrice);
    priceStageField.value = sale.stage;
    selectedBookPrice.textContent = formatMXN(sale.bookPrice);

    if (!/^\d{5}$/.test(postalCodeText)) {
      shippingCostField.value = "";
      deliveryTypeField.value = "";
      amountField.value = "";
      selectedShipping.textContent = "Ingresa el C.P.";
      selectedAmount.textContent = "—";
      return null;
    }

    shippingCostField.value = "";
    deliveryTypeField.value = "";
    amountField.value = "";
    selectedShipping.textContent = "Consultando C.P.…";
    selectedAmount.textContent = "—";

    let postalCatalog;

    try {
      postalCatalog = await loadPostalCatalog();
    } catch (error) {
      if (requestId !== postalLookupRequestId) {
        return null;
      }

      console.warn("No se pudo consultar el catálogo postal.", error);
      buyerPostalCode.setCustomValidity("No pudimos validar el código postal. Inténtalo nuevamente.");
      selectedShipping.textContent = "No se pudo validar";
      return null;
    }

    if (requestId !== postalLookupRequestId) {
      return null;
    }

    const resolvedPostalCode = resolvePostalCode(postalCatalog);
    const quote = getDeliveryQuote(resolvedPostalCode);

    if (!quote) {
      buyerPostalCode.setCustomValidity("Introduce un código postal mexicano válido.");
      selectedShipping.textContent = "C.P. no reconocido";
      return null;
    }

    buyerState.value = resolvedPostalCode.state;
    buyerMunicipality.value = resolvedPostalCode.municipality;
    deliveryStateHiddenField.value = resolvedPostalCode.state;
    deliveryMunicipalityHiddenField.value = resolvedPostalCode.municipality;

    const total = sale.bookPrice + quote.shippingCost;
    shippingCostField.value = String(quote.shippingCost);
    deliveryTypeField.value = quote.deliveryType;
    amountField.value = String(total);
    selectedShipping.textContent = quote.shippingCost === 0
      ? "Gratis (entrega local)"
      : formatMXN(quote.shippingCost);
    selectedAmount.textContent = formatMXN(total);
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
    physicalDeliveryNote.hidden = !includesPhysicalBook;
    physicalDeliveryNote.style.display = includesPhysicalBook ? "" : "none";

    buyerState.disabled = true;
    buyerPostalCode.disabled = !includesPhysicalBook;
    buyerPostalCode.required = includesPhysicalBook;

    buyerState.value = "";
    buyerMunicipality.value = "";
    deliveryStateHiddenField.value = "";
    deliveryMunicipalityHiddenField.value = "";
    buyerPostalCode.value = "";
    updateOrderSummary();
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
        "* Hasta el 15 de septiembre la entrega local es gratuita en Guadalajara y Monterrey. " +
        "Para el resto de México se calcula una tarifa de envío por estado. Desde el 16 de septiembre todos los pedidos se envían por paquetería.";
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
      "* El costo de envío se calcula por estado y se suma automáticamente al total de la compra.";
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

  function showPaymentStep(reference, localPreview = false) {
    referenceOutput.textContent = reference;
    paymentAmount.textContent = formatMXN(Number(amountField.value));
    paymentConcept.textContent = reference;
    localPreorderNotice.hidden = !localPreview;

    stepForm.hidden = true;
    stepPayment.hidden = false;
  }

  function openModal(format) {
    formatField.value = format;
    selectedFormat.textContent = FORMAT_LABELS[format] || format;
    configureDeliveryFields(format);
    formError.hidden = true;
    formError.textContent = "";

    stepForm.hidden = false;
    stepPayment.hidden = true;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    setTimeout(() => document.querySelector("#buyerName")?.focus(), 50);
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  updateVisibleOffer();
  configureDeliveryFields("");

  document.querySelector("#bankName").textContent = BANK_DETAILS.bank;
  document.querySelector("#bankBeneficiary").textContent = BANK_DETAILS.beneficiary;
  document.querySelector("#bankClabe").textContent = BANK_DETAILS.clabe;
  shippingOriginField.value = `${SHIPPING_ORIGIN.municipality}, ${SHIPPING_ORIGIN.state}, C.P. ${SHIPPING_ORIGIN.postalCode}`;

  buyerPostalCode.addEventListener("input", () => {
    buyerPostalCode.value = buyerPostalCode.value.replace(/\D/g, "").slice(0, 5);
    updateOrderSummary();
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

    await updateOrderSummary();

    if (shippingCostField.value === "" || amountField.value === "") {
      formError.textContent =
        "Introduce un código postal mexicano válido de cinco dígitos para calcular el envío.";
      formError.hidden = false;
      buyerPostalCode.focus();
      return;
    }

    const name = document.querySelector("#buyerName").value.trim();
    const reference = buildReference(name);
    referenceField.value = reference;
    const formData = new FormData(form);

    formError.hidden = true;
    formError.textContent = "";
    submitButton.disabled = true;
    submitButton.textContent = "Registrando pedido...";

    try {
      if (!isLocalPreview) {
        const response = await fetch("/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(formData).toString()
        });

        if (!response.ok) {
          throw new Error(`Netlify respondió con estado ${response.status}`);
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

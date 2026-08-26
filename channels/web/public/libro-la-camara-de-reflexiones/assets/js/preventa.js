/*
  LA CÁMARA DE REFLEXIONES · PREVENTA POR TRANSFERENCIA SPEI
  ----------------------------------------------------------
  Completa estos datos antes de publicar:
*/
const BANK_DETAILS = {
  bank: "BBVA",
  beneficiary: "Daniel Marcelo Pazos Vidal",
  clabe: "012580012341242007"
};

const FORMAT_LABELS = {
  fisico: "Libro físico"
};

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.querySelector("#preorderModal");
  const form = document.querySelector("#preorderForm");
  const stepForm = document.querySelector("#preorderStepForm");
  const stepPayment = document.querySelector("#preorderStepPayment");
  const localPreorderNotice = document.querySelector("#localPreorderNotice");

  const formatField = document.querySelector("#preorderFormat");
  const amountField = document.querySelector("#preorderAmount");
  const referenceField = document.querySelector("#preorderReferenceField");

  const selectedFormat = document.querySelector("#preorderSelectedFormat");
  const selectedAmount = document.querySelector("#preorderSelectedAmount");
  const referenceOutput = document.querySelector("#preorderReference");
  const paymentAmount = document.querySelector("#paymentAmount");
  const paymentConcept = document.querySelector("#paymentConcept");
  const deliveryCityField = document.querySelector("#deliveryCityField");
  const deliveryCityLabel = document.querySelector("#deliveryCityLabel");
  const buyerCity = document.querySelector("#buyerCity");
  const physicalDeliveryNote = document.querySelector("#physicalDeliveryNote");
  const submitButton = form.querySelector(".preorder-continue");
  const submitButtonLabel = submitButton.textContent.trim();
  const isLocalPreview = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

  const formError = document.createElement("p");
  formError.className = "preorder-important";
  formError.setAttribute("role", "alert");
  formError.hidden = true;
  submitButton.before(formError);

  function configureDeliveryFields(format) {
    const includesPhysicalBook = format === "fisico";

    deliveryCityField.hidden = !includesPhysicalBook;
    deliveryCityField.style.display = includesPhysicalBook ? "" : "none";
    physicalDeliveryNote.hidden = !includesPhysicalBook;
    physicalDeliveryNote.style.display = includesPhysicalBook ? "" : "none";
    deliveryCityLabel.textContent = "Ciudad de entrega";
    buyerCity.disabled = !includesPhysicalBook;
    buyerCity.required = includesPhysicalBook;
    buyerCity.value = "";
  }

  configureDeliveryFields("");

  document.querySelector("#bankName").textContent = BANK_DETAILS.bank;
  document.querySelector("#bankBeneficiary").textContent = BANK_DETAILS.beneficiary;
  document.querySelector("#bankClabe").textContent = BANK_DETAILS.clabe;

  function formatMXN(value) {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0
    }).format(value);
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

  function openModal(format, amount) {
    formatField.value = format;
    amountField.value = amount;
    selectedFormat.textContent = FORMAT_LABELS[format] || format;
    selectedAmount.textContent = formatMXN(Number(amount));
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

  document.querySelectorAll(".js-preorder").forEach((button) => {
    button.addEventListener("click", () => {
      openModal(button.dataset.format, button.dataset.price);
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

    const name = document.querySelector("#buyerName").value.trim();
    const reference = buildReference(name);
    referenceField.value = reference;

    const formData = new FormData(form);

    formError.hidden = true;
    formError.textContent = "";
    submitButton.disabled = true;
    submitButton.textContent = "Registrando preventa...";

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
      console.warn("No se pudo registrar automáticamente la preventa.", error);
      formError.textContent =
        "No pudimos registrar tu preventa. Revisa tu conexión e inténtalo nuevamente. No realices ninguna transferencia hasta que aparezcan tu referencia y los datos de pago.";
      formError.hidden = false;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = submitButtonLabel;
    }
  });
});

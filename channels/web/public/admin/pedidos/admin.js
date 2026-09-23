const ENDPOINTS = Object.freeze({
  login: "/.netlify/functions/book-admin-login",
  logout: "/.netlify/functions/book-admin-logout",
  orders: "/.netlify/functions/book-admin-orders",
  quote: "/.netlify/functions/book-admin-quote",
  shipment: "/.netlify/functions/book-admin-create-shipment"
});

let orders = [];

const loginView = document.querySelector("#loginView");
const panelView = document.querySelector("#panelView");
const loginForm = document.querySelector("#loginForm");
const passwordInput = document.querySelector("#adminPassword");
const loginError = document.querySelector("#loginError");
const ordersContainer = document.querySelector("#ordersContainer");
const emptyState = document.querySelector("#emptyState");
const panelMessage = document.querySelector("#panelMessage");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const refreshButton = document.querySelector("#refreshButton");
const logoutButton = document.querySelector("#logoutButton");

function formatMoney(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => null);

  if (response.status === 401) {
    showLogin();
    throw new Error("Sesión expirada.");
  }

  if (!response.ok || !payload?.ok) {
    const error = new Error(payload?.message || `Error ${response.status}`);
    error.payload = payload;
    error.status = response.status;
    throw error;
  }

  return payload;
}

function showLogin() {
  panelView.hidden = true;
  loginView.hidden = false;
  passwordInput.value = "";
  setTimeout(() => passwordInput.focus(), 30);
}

function showPanel() {
  loginView.hidden = true;
  panelView.hidden = false;
}

function showPanelMessage(message, isError = false) {
  panelMessage.textContent = message;
  panelMessage.className = isError
    ? "message message--error"
    : "message";
  panelMessage.hidden = false;
}

function clearPanelMessage() {
  panelMessage.hidden = true;
  panelMessage.textContent = "";
}

function isLocalDelivery(order) {
  return /entrega local gratuita/i.test(order.deliveryType || "");
}

function renderStats() {
  const paid = orders.filter((order) => order.payment?.confirmed).length;
  const guides = orders.filter((order) => order.shipment?.id).length;

  document.querySelector("#statTotal").textContent = String(orders.length);
  document.querySelector("#statPending").textContent = String(orders.length - paid);
  document.querySelector("#statPaid").textContent = String(paid);
  document.querySelector("#statGuides").textContent = String(guides);
}

function matchesFilter(order) {
  const text = searchInput.value.trim().toLowerCase();

  if (text) {
    const haystack = [
      order.reference,
      order.customer?.name,
      order.customer?.email,
      order.customer?.phone,
      order.address?.postalCode,
      order.address?.state,
      order.address?.municipality
    ]
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(text)) {
      return false;
    }
  }

  switch (statusFilter.value) {
    case "pending":
      return !order.payment?.confirmed;
    case "paid":
      return Boolean(order.payment?.confirmed);
    case "guide":
      return Boolean(order.shipment?.id);
    default:
      return true;
  }
}

function quoteBlock(order) {
  if (isLocalDelivery(order)) {
    return `
      <span class="block-title">Skydropx</span>
      <div class="primary">No aplica</div>
      <div class="small">Entrega local gratuita.</div>
    `;
  }

  if (!order.payment?.confirmed) {
    return `
      <span class="block-title">Skydropx</span>
      <div class="small">Confirma primero el pago.</div>
    `;
  }

  if (order.shipment?.id) {
    return `
      <span class="block-title">Skydropx</span>
      <div class="primary">${escapeHtml(order.shipment.provider || "Skydropx")}</div>
      <div class="small">${escapeHtml(order.shipment.service || "")}</div>
    `;
  }

  const quote = order.shipment?.latestQuote;

  if (!quote) {
    return `
      <span class="block-title">Tarifa actual</span>
      <div class="small">Aún no actualizada.</div>
      <div class="actions">
        <button type="button" data-action="quote" data-reference="${escapeHtml(order.reference)}">
          Cotizar ahora
        </button>
      </div>
    `;
  }

  const difference = Number(order.shippingCharged) - Number(quote.rawCost);
  const className = difference >= 0 ? "quote-positive" : "quote-negative";
  const label = difference >= 0 ? "Margen" : "Diferencia a absorber";

  return `
    <span class="block-title">Tarifa actual</span>
    <div class="primary">${formatMoney(quote.rawCost)}</div>
    <div class="small">${escapeHtml(quote.provider)} · ${escapeHtml(quote.service)}</div>
    <div class="small ${className}">${label}: ${formatMoney(Math.abs(difference))}</div>
    <div class="small">Cotizada: ${escapeHtml(formatDate(quote.quotedAt))}</div>
    <div class="actions">
      <button type="button" data-action="quote" data-reference="${escapeHtml(order.reference)}">
        Actualizar tarifa
      </button>
    </div>
  `;
}

function shipmentBlock(order) {
  if (isLocalDelivery(order)) {
    return `
      <span class="block-title">Guía</span>
      <div class="status-chip">Entrega local</div>
      <div class="small">No requiere guía de paquetería.</div>
    `;
  }

  const shipment = order.shipment || {};

  if (shipment.id) {
    const links = [];

    if (shipment.labelUrl) {
      links.push(
        `<a href="${escapeHtml(shipment.labelUrl)}" target="_blank" rel="noopener noreferrer">Ver guía</a>`
      );
    }

    if (shipment.trackingUrl) {
      links.push(
        `<a href="${escapeHtml(shipment.trackingUrl)}" target="_blank" rel="noopener noreferrer">Rastrear</a>`
      );
    }

    return `
      <span class="block-title">Guía</span>
      <div class="primary">${escapeHtml(shipment.trackingNumber || "Generada")}</div>
      <div class="small">${escapeHtml(shipment.provider || "")} ${escapeHtml(shipment.service || "")}</div>
      <div class="status-chip">${escapeHtml(shipment.status || "creada")}</div>
      ${links.length ? `<div class="actions">${links.join("")}</div>` : ""}
    `;
  }

  const canGenerate = Boolean(
    order.payment?.confirmed &&
    order.shipment?.latestQuote
  );

  return `
    <span class="block-title">Guía</span>
    <div class="small">${
      order.payment?.confirmed
        ? "Pendiente de generación."
        : "Esperando confirmación del pago."
    }</div>
    <div class="actions">
      <button
        type="button"
        class="action-primary"
        data-action="shipment"
        data-reference="${escapeHtml(order.reference)}"
        ${canGenerate ? "" : "disabled"}
      >
        Generar guía
      </button>
    </div>
  `;
}

function renderOrders() {
  const visible = orders.filter(matchesFilter);

  ordersContainer.innerHTML = visible.map((order) => {
    const address = [
      `${order.address?.street || ""} ${order.address?.exteriorNumber || ""}`.trim(),
      order.address?.interiorNumber ? `Int. ${order.address.interiorNumber}` : "",
      order.address?.neighborhood,
      `${order.address?.postalCode || ""} ${order.address?.municipality || ""}`.trim(),
      order.address?.state
    ].filter(Boolean).join(", ");

    return `
      <article class="order-card">
        <div class="order-card__top">
          <div>
            <span class="block-title">Pedido</span>
            <div class="reference">${escapeHtml(order.reference)}</div>
            <div class="small">${escapeHtml(formatDate(order.createdAt))}</div>
            <div class="status-chip">${escapeHtml(order.priceStage || "")}</div>
          </div>

          <div>
            <span class="block-title">Cliente</span>
            <div class="primary">${escapeHtml(order.customer?.name)}</div>
            <div class="small">${escapeHtml(order.customer?.email)}</div>
            <div class="small">${escapeHtml(order.customer?.phone)}</div>
          </div>

          <div>
            <span class="block-title">Entrega</span>
            <div class="small">${escapeHtml(address)}</div>
            ${
              order.address?.deliveryReferences
                ? `<div class="small">Ref.: ${escapeHtml(order.address.deliveryReferences)}</div>`
                : ""
            }
          </div>

          <div>
            <span class="block-title">Importes</span>
            <div class="money-grid">
              <span>Libro</span><strong>${formatMoney(order.bookPrice)}</strong>
              <span>Envío cobrado</span><strong>${formatMoney(order.shippingCharged)}</strong>
              <span>Total pagado</span><strong>${formatMoney(order.total)}</strong>
            </div>
          </div>
        </div>

        <div class="order-card__bottom">
          <div>
            <span class="block-title">Pago</span>
            <div class="payment-control">
              <input
                id="paid-${escapeHtml(order.reference)}"
                type="checkbox"
                data-action="payment"
                data-reference="${escapeHtml(order.reference)}"
                ${order.payment?.confirmed ? "checked" : ""}
                ${order.shipment?.id ? "disabled" : ""}
              />
              <label for="paid-${escapeHtml(order.reference)}">
                ${order.payment?.confirmed ? "Pago confirmado" : "Confirmar pago"}
              </label>
            </div>
            ${
              order.payment?.confirmedAt
                ? `<div class="small">Confirmado: ${escapeHtml(formatDate(order.payment.confirmedAt))}</div>`
                : ""
            }
          </div>

          <div>${quoteBlock(order)}</div>
          <div>${shipmentBlock(order)}</div>
        </div>
      </article>
    `;
  }).join("");

  emptyState.hidden = visible.length !== 0;
}

async function loadOrders() {
  clearPanelMessage();
  refreshButton.disabled = true;

  try {
    const payload = await api(ENDPOINTS.orders, {
      method: "GET",
      headers: {}
    });

    orders = payload.orders || [];
    showPanel();
    renderStats();
    renderOrders();
  } catch (error) {
    if (error.message !== "Sesión expirada.") {
      showPanelMessage(error.message, true);
    }
  } finally {
    refreshButton.disabled = false;
  }
}

async function setPayment(reference, paid, checkbox) {
  const message = paid
    ? `¿Confirmas que recibiste el pago del pedido ${reference}?`
    : `¿Quieres retirar la confirmación de pago de ${reference}?`;

  if (!window.confirm(message)) {
    checkbox.checked = !paid;
    return;
  }

  checkbox.disabled = true;

  try {
    await api(ENDPOINTS.orders, {
      method: "POST",
      body: JSON.stringify({
        action: "set-payment",
        reference,
        paid
      })
    });

    await loadOrders();
  } catch (error) {
    checkbox.checked = !paid;
    showPanelMessage(error.message, true);
  } finally {
    checkbox.disabled = false;
  }
}

async function updateQuote(reference, button) {
  clearPanelMessage();
  button.disabled = true;
  button.textContent = "Cotizando...";

  try {
    const payload = await api(ENDPOINTS.quote, {
      method: "POST",
      body: JSON.stringify({ reference })
    });

    const difference = Number(payload.difference);
    const message = difference >= 0
      ? `Tarifa actual ${formatMoney(payload.quote.rawCost)}. Margen frente a lo cobrado: ${formatMoney(difference)}.`
      : `Tarifa actual ${formatMoney(payload.quote.rawCost)}. Diferencia que absorberías: ${formatMoney(Math.abs(difference))}.`;

    showPanelMessage(message, false);
    await loadOrders();
  } catch (error) {
    showPanelMessage(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Actualizar tarifa";
  }
}

async function createGuide(reference, button) {
  const order = orders.find((item) => item.reference === reference);
  const quote = order?.shipment?.latestQuote;

  if (!order || !quote) {
    showPanelMessage("Actualiza primero la tarifa.", true);
    return;
  }

  const difference = Number(order.shippingCharged) - Number(quote.rawCost);
  const detail = difference >= 0
    ? `Queda un margen de ${formatMoney(difference)}.`
    : `Absorberás ${formatMoney(Math.abs(difference))} de diferencia.`;

  if (!window.confirm(
    `Vas a generar una guía REAL para ${reference} por una tarifa aproximada de ${formatMoney(quote.rawCost)}.\n\n${detail}\n\nEsta acción puede descontar saldo de Skydropx. ¿Continuar?`
  )) {
    return;
  }

  clearPanelMessage();
  button.disabled = true;
  button.textContent = "Generando...";

  try {
    const payload = await api(ENDPOINTS.shipment, {
      method: "POST",
      body: JSON.stringify({ reference })
    });

    if (payload.alreadyGenerated) {
      showPanelMessage("La guía ya había sido generada. No se creó una segunda.", false);
    } else {
      showPanelMessage(
        `Guía generada. Rastreo: ${payload.shipment?.trackingNumber || "pendiente de asignación"}.`,
        false
      );
    }

    await loadOrders();
  } catch (error) {
    if (error.payload?.rateChanged) {
      const current = error.payload.quote?.rawCost;
      showPanelMessage(
        `${error.message} Nueva tarifa: ${formatMoney(current)}.`,
        true
      );
      await loadOrders();
      return;
    }

    showPanelMessage(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Generar guía";
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.hidden = true;

  const submit = loginForm.querySelector("button");
  submit.disabled = true;
  submit.textContent = "Ingresando...";

  try {
    await api(ENDPOINTS.login, {
      method: "POST",
      body: JSON.stringify({
        password: passwordInput.value
      })
    });

    passwordInput.value = "";
    await loadOrders();
  } catch (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = "Ingresar";
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await fetch(ENDPOINTS.logout, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store"
    });
  } finally {
    orders = [];
    showLogin();
  }
});

refreshButton.addEventListener("click", loadOrders);
searchInput.addEventListener("input", renderOrders);
statusFilter.addEventListener("change", renderOrders);

ordersContainer.addEventListener("change", (event) => {
  const target = event.target;

  if (target?.dataset?.action === "payment") {
    setPayment(
      target.dataset.reference,
      target.checked,
      target
    );
  }
});

ordersContainer.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");

  if (!button) return;

  const reference = button.dataset.reference;

  if (button.dataset.action === "quote") {
    updateQuote(reference, button);
  }

  if (button.dataset.action === "shipment") {
    createGuide(reference, button);
  }
});

loadOrders();

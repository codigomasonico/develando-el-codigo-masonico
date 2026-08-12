(() => {
  "use strict";

  if (window.__GUIA_MASONICO_CARGADO__) return;
  window.__GUIA_MASONICO_CARGADO__ = true;

  const CONFIG = {
    endpoint: "/.netlify/functions/guia-masonico",
    linkEndpoint: "/.netlify/functions/cartes-link",
    conversationEndpoint: "/.netlify/functions/cartes-conversation",
    whatsappNumber: "523322338888",
    maxChars: 900,
    maxHistory: 8,
    storageKey: "dcm_guia_masonico_v1",
    identityKey: "dcm_cartes_web_identity_v1"
  };

  const suggestions = [
    "¿La masonería es una religión?",
    "¿Qué representa la escuadra?",
    "¿Qué es la Cámara de Reflexiones?",
    "¿Por qué los masones utilizan mandil?"
  ];

  const history = loadHistory();
  const webIdentity = loadOrCreateWebIdentity();
  let busy = false;

  loadStyles();
  const ui = createInterface();
  restoreConversation();

  // El estado de cuenta se solicita al cargar Cartes, no solamente cuando
  // el usuario abre el panel. Esto evita que el encabezado quede en "…".
  void initializeServerState();

  async function initializeServerState() {
    await Promise.allSettled([
      syncConversationFromServer(),
      refreshLinkStatus({ retries: 3 })
    ]);
  }

  function loadStyles() {
    if (document.querySelector('link[data-guia-masonico-css]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/bot/guia-masonico.css";
    link.dataset.guiaMasonicoCss = "true";
    document.head.appendChild(link);
  }

  function createInterface() {
    const launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "gm-launcher";
    launcher.setAttribute("aria-label", "Abrir Cartes");
    launcher.setAttribute("aria-expanded", "false");
    launcher.innerHTML = `
      <span class="gm-launcher__icon" aria-hidden="true">✦</span>
      <span class="gm-launcher__label">Cartes</span>
    `;

    const shell = document.createElement("section");
    shell.className = "gm-shell";
    shell.dataset.open = "false";
    shell.setAttribute("role", "dialog");
    shell.setAttribute("aria-modal", "false");
    shell.setAttribute("aria-label", "Cartes, asistente de Develando el Código Masónico");
    shell.innerHTML = `
      <header class="gm-header">
        <img class="gm-header__logo" src="/assets/img/cartes-isotipo.gif" alt="Cartes">
        <div>
          <h2 class="gm-header__title">Cartes</h2>
          <div class="gm-header__status">Asistente de Develando el Código Masónico</div>
          <div class="gm-header__usage" aria-live="polite">Consultas disponibles: cargando…</div>
        </div>
        <div class="gm-header__actions">
          <button class="gm-link" type="button" aria-label="Vincular Cartes con WhatsApp" title="Vincular con WhatsApp">Vincular</button>
          <button class="gm-clear" type="button" aria-label="Limpiar conversación" title="Limpiar conversación">
            <span aria-hidden="true">↺</span>
            <span class="gm-clear__label">Limpiar</span>
          </button>
          <button class="gm-close" type="button" aria-label="Cerrar Cartes">×</button>
        </div>
      </header>
      <div class="gm-messages" aria-live="polite" aria-label="Conversación"></div>
      <div class="gm-suggestions" aria-label="Preguntas sugeridas"></div>
      <div>
        <form class="gm-form">
          <textarea class="gm-input" rows="1" maxlength="${CONFIG.maxChars}" placeholder="Escribe tu pregunta sobre masonería…" aria-label="Pregunta"></textarea>
          <button class="gm-send" type="submit" aria-label="Enviar pregunta">➤</button>
        </form>
        <p class="gm-footer-note">Cartes puede equivocarse. Contrasta la información importante con fuentes confiables. No representa oficialmente a ninguna obediencia, rito o jurisdicción.</p>
      </div>
    `;

    document.body.append(launcher, shell);

    const close = shell.querySelector(".gm-close");
    const clear = shell.querySelector(".gm-clear");
    const link = shell.querySelector(".gm-link");
    const form = shell.querySelector(".gm-form");
    const input = shell.querySelector(".gm-input");
    const send = shell.querySelector(".gm-send");
    const messages = shell.querySelector(".gm-messages");
    const suggestionBox = shell.querySelector(".gm-suggestions");
    const usage = shell.querySelector(".gm-header__usage");

    suggestions.forEach((question) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gm-suggestion";
      button.textContent = question;
      button.addEventListener("click", () => submitQuestion(question));
      suggestionBox.appendChild(button);
    });

    launcher.addEventListener("click", () => setOpen(shell.dataset.open !== "true"));
    close.addEventListener("click", () => setOpen(false));
    clear.addEventListener("click", clearConversation);
    link.addEventListener("click", startWhatsAppLink);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && shell.dataset.open === "true") setOpen(false);
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitQuestion(input.value);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submitQuestion(input.value);
      }
    });

    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
    });

    return { launcher, shell, input, send, messages, suggestionBox, link, usage };
  }

  function setOpen(open) {
    ui.shell.dataset.open = String(open);
    ui.launcher.setAttribute("aria-expanded", String(open));
    if (open) {
      window.setTimeout(() => ui.input.focus(), 50);
      void refreshLinkStatus({ retries: 2 });
    }
  }

  function showWelcomeMessage() {
    addMessage(
      "assistant",
      "Hola, soy Cartes. Puedo ayudarte a explorar la historia, la simbología, la filosofía y los valores de la Masonería con rigor, prudencia y pensamiento crítico. ¿Qué te gustaría comprender?",
      false
    );
  }

  function restoreConversation() {
    if (history.length === 0) {
      showWelcomeMessage();
      return;
    }

    history.forEach((item) => addMessage(item.role, item.content, false));
  }

  async function clearConversation() {
    if (busy) return;

    const confirmed = window.confirm(
      "¿Quieres borrar toda la conversación guardada? Si vinculaste WhatsApp, también se borrará el contexto compartido. Esta acción no se puede deshacer."
    );

    if (!confirmed) return;

    try {
      await fetch(CONFIG.conversationEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear", web_identity: webIdentity })
      });
    } catch {
      // La limpieza local continúa aunque el servidor no esté disponible.
    }

    history.splice(0, history.length);
    localStorage.removeItem(CONFIG.storageKey);
    ui.messages.replaceChildren();
    ui.input.value = "";
    ui.input.style.height = "auto";
    showWelcomeMessage();
    ui.input.focus();

    // La limpieza de conversación no debe alterar el contador, pero
    // refrescamos el estado para mantener la UI sincronizada.
    void refreshLinkStatus({ retries: 2 });
  }

  async function syncConversationFromServer() {
    try {
      const response = await fetch(CONFIG.conversationEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "history", web_identity: webIdentity })
      });

      if (!response.ok) return;

      const data = await response.json().catch(() => ({}));

      // Si este endpoint ya entrega el uso, aprovecharlo inmediatamente.
      updateUsage(data.usage);

      if (!Array.isArray(data.messages) || data.messages.length === 0) return;

      history.splice(0, history.length, ...data.messages.slice(-(CONFIG.maxHistory + 2)));
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(history));
      ui.messages.replaceChildren();
      history.forEach((item) => addMessage(item.role, item.content, false));
    } catch {
      // El historial local sirve como respaldo si la memoria central no responde.
    }
  }

  function mostrarAccionesVinculacionWhatsApp(url, instruction) {
    const wrapper = document.createElement("div");
    wrapper.className = "gm-suggestions";

    const abrir = document.createElement("button");
    abrir.type = "button";
    abrir.className = "gm-suggestion";
    abrir.textContent = "Abrir chat con Cartes";
    abrir.addEventListener("click", () => {
      window.open(url, "_blank", "noopener,noreferrer");
    });

    const copiar = document.createElement("button");
    copiar.type = "button";
    copiar.className = "gm-suggestion";
    copiar.textContent = "Copiar código";
    copiar.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(instruction);
        copiar.textContent = "Código copiado";
      } catch {
        const area = document.createElement("textarea");
        area.value = instruction;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
        copiar.textContent = "Código copiado";
      }
    });

    wrapper.append(abrir, copiar);
    ui.messages.appendChild(wrapper);
    ui.messages.scrollTop = ui.messages.scrollHeight;
  }

  async function startWhatsAppLink() {
    if (busy) return;
    ui.link.disabled = true;

    try {
      const response = await fetch(CONFIG.linkEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", web_identity: webIdentity })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "No se pudo iniciar la vinculación.");
      }

      updateUsage(data.usage);

      if (data.linked) {
        ui.link.textContent = "Vinculado";
        ui.link.dataset.linked = "true";
        addMessage("assistant", "Este navegador ya está vinculado con tu Cartes de WhatsApp.", false);
        return;
      }

      const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(data.instruction)}`;

      addMessage(
        "assistant",
        `Generé tu código ${data.code}. Intentaré abrir el chat de Cartes en WhatsApp. Si tu navegador o WhatsApp Desktop no abre el chat directamente, usa “Abrir chat con Cartes” o “Copiar código”. El código vence en 10 minutos.`,
        false
      );

      mostrarAccionesVinculacionWhatsApp(url, data.instruction);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      addMessage(
        "assistant",
        error instanceof Error ? error.message : "No se pudo iniciar la vinculación.",
        false,
        true
      );
    } finally {
      ui.link.disabled = false;
    }
  }

  async function refreshLinkStatus({ retries = 2 } = {}) {
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const response = await fetch(CONFIG.linkEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "status", web_identity: webIdentity }),
          cache: "no-store"
        });

        const data = await response.json().catch(() => ({}));

        // Incluso si el endpoint responde con error, intentamos recuperar
        // cualquier bloque usage válido incluido en la respuesta.
        const usageUpdated = updateUsage(data.usage);

        if (response.ok) {
          if (data.linked) {
            ui.link.textContent = "Vinculado";
            ui.link.disabled = true;
            ui.link.dataset.linked = "true";
          } else {
            ui.link.textContent = "Vincular";
            ui.link.disabled = false;
            delete ui.link.dataset.linked;
          }

          if (usageUpdated) return true;

          lastError = new Error("El estado de Cartes no devolvió datos de uso válidos.");
        } else {
          lastError = new Error(
            data.error || `No fue posible consultar el estado de Cartes (HTTP ${response.status}).`
          );
        }
      } catch (error) {
        lastError = error;
      }

      if (attempt < retries) {
        await wait(350 * (attempt + 1));
      }
    }

    // Nunca dejar el placeholder "…" indefinidamente. Si el backend no
    // devuelve uso, se muestra un estado explícito y se volverá a intentar
    // la próxima vez que el usuario abra Cartes o envíe una consulta.
    if (ui?.usage && !hasRenderedUsage()) {
      ui.usage.title =
        lastError instanceof Error
          ? lastError.message
          : "No fue posible consultar el estado de uso.";

      /*
       * No reemplazamos el contador por un texto falso o ambiguo.
       * Si el backend no entrega usage válido, el estado sigue pendiente
       * y refreshLinkStatus volverá a ejecutarse cuando el usuario abra
       * Cartes o realice una consulta.
       *
       * El PASS funcional sólo se obtiene cuando updateUsage recibe
       * limite y disponibles numéricos y renderiza X de Y.
       */
      delete ui.usage.dataset.state;
    }

    return false;
  }

  function normalizarComandoWeb(texto) {
    return String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[¿?¡!.,;:]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function esComandoEstadoSuscripcionWeb(texto) {
    return new Set([
      "suscripcion",
      "mi suscripcion",
      "estado de mi suscripcion",
      "ver mi suscripcion"
    ]).has(normalizarComandoWeb(texto));
  }

  async function mostrarEstadoSuscripcionWeb(question) {
    setBusy(true);
    ui.input.value = "";
    ui.input.style.height = "auto";
    addMessage("user", question, true);
    const typing = addTyping();

    try {
      const response = await fetch(CONFIG.linkEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "status",
          web_identity: webIdentity
        }),
        cache: "no-store"
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "No fue posible consultar tu suscripción.");
      }

      updateUsage(data.usage);

      const usage = data.usage || {};
      const plan = String(usage.plan || "gratuito").toLowerCase();
      const limite = Number(usage.limite || 0);
      const disponibles = Number(usage.disponibles || 0);
      const usadas = Math.max(0, limite - disponibles);

      const texto =
        plan === "plus"
          ? `Plan actual: Cartes Plus\nEstado Cartes Plus: Activo\nConsultas utilizadas en este periodo: ${usadas} de ${limite}\nConsultas disponibles: ${disponibles}`
          : `Plan actual: Cartes gratuito\nEstado Cartes Plus: Inactivo\nConsultas utilizadas en este periodo: ${usadas} de ${limite}\nConsultas disponibles: ${disponibles}`;

      addMessage("assistant", texto, true);
    } catch (error) {
      addMessage(
        "assistant",
        error instanceof Error ? error.message : "No fue posible consultar tu suscripción.",
        false,
        true
      );
    } finally {
      typing.remove();
      setBusy(false);
    }
  }

  function restoreDefaultSuggestionsWeb() {
    ui.suggestionBox.replaceChildren();

    suggestions.forEach((question) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gm-suggestion";
      button.textContent = question;
      button.addEventListener("click", () => submitQuestion(question));
      ui.suggestionBox.appendChild(button);
    });
  }

  function renderMenuButtonsWeb() {
    const options = [
      ["1", "Conversar con Cartes"],
      ["2", "Conocer Cartes Plus"],
      ["3", "Suscribirme"],
      ["4", "Mi suscripción"],
      ["5", "Ayuda y soporte"],
      ["6", "Privacidad y términos"]
    ];

    ui.suggestionBox.replaceChildren();

    options.forEach(([id, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gm-suggestion";
      button.textContent = `${id}. ${label}`;
      button.addEventListener("click", () => ejecutarOpcionMenuWeb(id));
      ui.suggestionBox.appendChild(button);
    });
  }

  function mostrarMenuWeb() {
    ui.input.value = "";
    ui.input.style.height = "auto";

    addMessage(
      "assistant",
      "Cartes | Menú\n\nElige una opción:",
      false
    );

    renderMenuButtonsWeb();
  }

  function esComandoMenuWeb(texto) {
    return new Set([
      "menu",
      "inicio",
      "ayuda",
      "opciones",
      "hola",
      "buenas",
      "buen dia",
      "buenos dias",
      "buenas tardes",
      "buenas noches",
      "hola quiero conocer a cartes"
    ]).has(normalizarComandoWeb(texto));
  }

  function resolverOpcionMenuWeb(texto) {
    const opciones = {
      "1": "conversar",
      "conversar": "conversar",
      "conversar con cartes": "conversar",

      "2": "plus_info",
      "conocer cartes plus": "plus_info",
      "cartes plus": "plus_info",

      "3": "suscribirme",
      "suscribirme": "suscribirme",

      "4": "mi_suscripcion",
      "mi suscripcion": "mi_suscripcion",
      "suscripcion": "mi_suscripcion",
      "estado de mi suscripcion": "mi_suscripcion",
      "ver mi suscripcion": "mi_suscripcion",

      "5": "ayuda",
      "ayuda y soporte": "ayuda",

      "6": "legal",
      "privacidad y terminos": "legal",
      "privacidad": "legal",
      "terminos": "legal"
    };

    return opciones[normalizarComandoWeb(texto)] || "";
  }

  async function ejecutarOpcionMenuWeb(opcion) {
    const id = resolverOpcionMenuWeb(opcion) || String(opcion || "").trim();

    if (id === "conversar") {
      addMessage(
        "assistant",
        "Escribe tu consulta masónica o elige una de las preguntas sugeridas.",
        false
      );
      restoreDefaultSuggestionsWeb();
      ui.input.focus();
      return;
    }

    if (id === "plus_info") {
      addMessage(
        "assistant",
        "Cartes Plus cuesta $149 MXN al mes, amplía tu límite a 50 consultas mensuales y mantiene plan, uso y beneficios compartidos entre Web y WhatsApp.",
        false
      );
      renderMenuButtonsWeb();
      return;
    }

    if (id === "suscribirme") {
      if (ui.link.dataset.linked === "true") {
        const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent("Suscribirme")}`;
        addMessage(
          "assistant",
          "Abriré WhatsApp para continuar con la suscripción a Cartes Plus en tu misma cuenta vinculada.",
          false
        );
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        addMessage(
          "assistant",
          "Para que Cartes Plus quede asociado a esta misma cuenta, primero vincula Web con WhatsApp.",
          false
        );
        await startWhatsAppLink();
      }
      renderMenuButtonsWeb();
      return;
    }

    if (id === "mi_suscripcion") {
      await mostrarEstadoSuscripcionWeb("Mi suscripción");
      renderMenuButtonsWeb();
      return;
    }

    if (id === "ayuda") {
      addMessage(
        "assistant",
        "Puedes escribir una consulta masónica directamente, revisar tu suscripción, conocer Cartes Plus o vincular esta Web con WhatsApp. Las entradas sin contenido útil no consumen consultas.",
        false
      );
      renderMenuButtonsWeb();
      return;
    }

    if (id === "legal") {
      const privacyUrl = `${window.location.origin}/cartes-whatsapp/privacy.html`;
      const termsUrl = `${window.location.origin}/cartes-whatsapp/terminos.html`;

      addMessage(
        "assistant",
        `Privacidad: ${privacyUrl}\nTérminos: ${termsUrl}`,
        false
      );
      renderMenuButtonsWeb();
    }
  }

  function isNonQueryInput(value) {
    const raw = String(value || "").trim();
    if (!raw) return true;

    // Puntuación, símbolos o emojis sin contenido textual/numérico.
    if (!/[\p{L}\p{N}]/u.test(raw)) return true;

    // Entradas sociales/de prueba que no deben consumir una consulta.
    const normalized = raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");

    return new Set([
      "hola",
      "buen dia",
      "buenos dias",
      "buenas",
      "buenas tardes",
      "buenas noches",
      "gracias",
      "ok",
      "okay",
      "listo",
      "test",
      "prueba"
    ]).has(normalized);
  }

  async function submitQuestion(rawQuestion) {
    const question = String(rawQuestion || "").trim();
    if (!question || busy) return;

    const menuOption = resolverOpcionMenuWeb(question);

    if (esComandoMenuWeb(question) || isNonQueryInput(question)) {
      mostrarMenuWeb();
      return;
    }

    if (menuOption) {
      ui.input.value = "";
      ui.input.style.height = "auto";
      await ejecutarOpcionMenuWeb(menuOption);
      return;
    }

    if (esComandoEstadoSuscripcionWeb(question)) {
      await mostrarEstadoSuscripcionWeb(question);
      return;
    }

    if (question.length > CONFIG.maxChars) {
      addMessage(
        "assistant",
        `La pregunta supera el máximo de ${CONFIG.maxChars} caracteres.`,
        false,
        true
      );
      return;
    }

    const payloadHistory = history
      .slice(-CONFIG.maxHistory)
      .map(({ role, content }) => ({ role, content }));

    setBusy(true);
    ui.input.value = "";
    ui.input.style.height = "auto";
    addMessage("user", question, true);
    const typing = addTyping();

    try {
      const response = await fetch(CONFIG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: payloadHistory,
          client: {
            channel: "web",
            external_user_id: webIdentity,
            request_id: createRequestId()
          }
        })
      });

      const data = await response.json().catch(() => ({}));
      updateUsage(data.usage);

      if (!response.ok) {
        throw new Error(data.error || "No fue posible obtener una respuesta.");
      }

      const answer = typeof data.answer === "string" ? data.answer.trim() : "";

      if (!answer) {
        throw new Error("Cartes devolvió una respuesta vacía.");
      }

      addMessage("assistant", answer, true);
    } catch (error) {
      addMessage(
        "assistant",
        error instanceof Error ? error.message : "Ocurrió un error inesperado.",
        false,
        true
      );
    } finally {
      typing.remove();
      setBusy(false);

      // Si la respuesta no incluyó usage por cualquier motivo, refrescar
      // explícitamente el estado de cuenta sin consumir otra consulta.
      if (!hasRenderedUsage()) {
        void refreshLinkStatus({ retries: 1 });
      }
    }
  }

  function updateUsage(usage) {
    if (!ui?.usage || !usage || typeof usage !== "object") return false;

    const limite = Number(usage.limite);
    const disponibles = Number(usage.disponibles);

    if (!Number.isFinite(limite) || !Number.isFinite(disponibles)) return false;

    const restantes = Math.max(0, Math.trunc(disponibles));
    const total = Math.max(0, Math.trunc(limite));

    ui.usage.textContent =
      `Consultas disponibles: ${restantes} de ${total}`;

    ui.usage.title =
      `${restantes} ${restantes === 1 ? "consulta disponible" : "consultas disponibles"} de ${total}`;

    ui.usage.dataset.plan = String(usage.plan || "gratuito");
    ui.usage.dataset.state = "ready";
    ui.usage.dataset.remaining = String(restantes);
    ui.usage.dataset.limit = String(total);

    return true;
  }

  function hasRenderedUsage() {
    return ui?.usage?.dataset?.state === "ready";
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function addMessage(role, content, persist = true, isError = false) {
    const message = document.createElement("div");
    message.className = `gm-message gm-message--${role}${isError ? " gm-message--error" : ""}`;
    message.textContent = content;
    ui.messages.appendChild(message);
    ui.messages.scrollTop = ui.messages.scrollHeight;

    if (persist && !isError) {
      history.push({ role, content });
      while (history.length > CONFIG.maxHistory + 2) history.shift();
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(history));
    }

    return message;
  }

  function addTyping() {
    const wrapper = document.createElement("div");
    wrapper.className = "gm-message gm-message--assistant gm-typing";
    wrapper.setAttribute("aria-label", "Cartes está escribiendo");
    wrapper.innerHTML = "<span></span><span></span><span></span>";
    ui.messages.appendChild(wrapper);
    ui.messages.scrollTop = ui.messages.scrollHeight;
    return wrapper;
  }

  function setBusy(value) {
    busy = value;
    ui.input.disabled = value;
    ui.send.disabled = value;
    ui.suggestionBox.querySelectorAll("button").forEach((button) => {
      button.disabled = value;
    });
  }

  function loadHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CONFIG.storageKey) || "[]");
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter(
          (item) =>
            item &&
            ["user", "assistant"].includes(item.role) &&
            typeof item.content === "string"
        )
        .slice(-(CONFIG.maxHistory + 2));
    } catch {
      return [];
    }
  }

  function createRequestId() {
    const randomPart =
      window.crypto?.randomUUID?.().replace(/-/g, "") ||
      `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

    return `webreq_${randomPart}`;
  }

  function loadOrCreateWebIdentity() {
    try {
      const existing = String(localStorage.getItem(CONFIG.identityKey) || "").trim();
      if (existing) return existing;

      const randomPart =
        window.crypto?.randomUUID?.().replace(/-/g, "") ||
        `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

      const identity = `web_${randomPart}`;
      localStorage.setItem(CONFIG.identityKey, identity);
      return identity;
    } catch {
      return `web_session_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    }
  }
})();


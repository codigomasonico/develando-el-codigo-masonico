(() => {
  "use strict";

  if (window.__GUIA_MASONICO_CARGADO__) return;
  window.__GUIA_MASONICO_CARGADO__ = true;

  const CONFIG = {
    endpoint: "/.netlify/functions/guia-masonico",
    maxChars: 900,
    maxHistory: 8,
    dailySoftLimit: 10,
    storageKey: "dcm_guia_masonico_v1",
    usageKey: "dcm_guia_masonico_usage_v1"
  };

  const suggestions = [
    "¿La masonería es una religión?",
    "¿Qué representa la escuadra?",
    "¿Qué es la Cámara de Reflexiones?",
    "¿Por qué los masones utilizan mandil?"
  ];

  const history = loadHistory();
  let busy = false;

  loadStyles();
  const ui = createInterface();
  restoreConversation();

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
        </div>
        <div class="gm-header__actions">
          <button class="gm-clear" type="button" aria-label="Limpiar conversación" title="Limpiar conversación">
            <span aria-hidden="true">↺</span>
            <span class="gm-clear__label">Limpiar</span>
          </button>
          <button class="gm-close" type="button" aria-label="Cerrar guía">×</button>
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
    const form = shell.querySelector(".gm-form");
    const input = shell.querySelector(".gm-input");
    const send = shell.querySelector(".gm-send");
    const messages = shell.querySelector(".gm-messages");
    const suggestionBox = shell.querySelector(".gm-suggestions");

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

    return { launcher, shell, input, send, messages, suggestionBox };
  }

  function setOpen(open) {
    ui.shell.dataset.open = String(open);
    ui.launcher.setAttribute("aria-expanded", String(open));
    if (open) window.setTimeout(() => ui.input.focus(), 50);
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

  function clearConversation() {
    if (busy) return;

    const confirmed = window.confirm(
      "¿Quieres borrar toda la conversación guardada? Esta acción no se puede deshacer."
    );

    if (!confirmed) return;

    history.splice(0, history.length);
    localStorage.removeItem(CONFIG.storageKey);
    ui.messages.replaceChildren();
    ui.input.value = "";
    ui.input.style.height = "auto";
    showWelcomeMessage();
    ui.input.focus();
  }

  async function submitQuestion(rawQuestion) {
    const question = String(rawQuestion || "").trim();
    if (!question || busy) return;

    if (question.length > CONFIG.maxChars) {
      addMessage("assistant", `La pregunta supera el máximo de ${CONFIG.maxChars} caracteres.`, false, true);
      return;
    }

    if (!consumeSoftQuota()) {
      addMessage(
        "assistant",
        "Alcanzaste el límite de consultas de hoy para esta versión de prueba. Puedes volver mañana.",
        false,
        true
      );
      return;
    }

    setBusy(true);
    ui.input.value = "";
    ui.input.style.height = "auto";
    addMessage("user", question, true);
    const typing = addTyping();

    try {
      const payloadHistory = history
        .slice(-CONFIG.maxHistory)
        .map(({ role, content }) => ({ role, content }));

      const response = await fetch(CONFIG.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history: payloadHistory })
      });

      const data = await response.json().catch(() => ({}));
      typing.remove();

      if (!response.ok) {
        throw new Error(data.error || "No fue posible obtener una respuesta.");
      }

      addMessage("assistant", data.answer, true);
    } catch (error) {
      typing.remove();
      addMessage(
        "assistant",
        error instanceof Error ? error.message : "Ocurrió un error inesperado.",
        false,
        true
      );
    } finally {
      setBusy(false);
    }
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
      return parsed.filter(
        (item) =>
          item &&
          ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string"
      );
    } catch {
      return [];
    }
  }

  function consumeSoftQuota() {
    const today = new Date().toISOString().slice(0, 10);
    let usage = { date: today, count: 0 };

    try {
      const stored = JSON.parse(localStorage.getItem(CONFIG.usageKey) || "null");
      if (stored && stored.date === today && Number.isFinite(stored.count)) usage = stored;
    } catch {
      // Reinicia un registro local corrupto.
    }

    if (usage.count >= CONFIG.dailySoftLimit) return false;
    usage.count += 1;
    localStorage.setItem(CONFIG.usageKey, JSON.stringify(usage));
    return true;
  }
})();

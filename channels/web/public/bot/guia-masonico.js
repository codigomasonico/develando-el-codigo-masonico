(() => {
  "use strict";

  if (window.__GUIA_MASONICO_CARGADO__) return;
  window.__GUIA_MASONICO_CARGADO__ = true;

  const CONFIG = {
    endpoint: "/.netlify/functions/guia-masonico",
    linkEndpoint: "/.netlify/functions/cartes-link",
    conversationEndpoint: "/.netlify/functions/cartes-conversation",
    subscriptionEndpoint: "/.netlify/functions/cartes-subscription",
    subscriptionStatusEndpoint: "/.netlify/functions/cartes-subscription-status",
    documentReviewEndpoint: "/.netlify/functions/cartes-document-review",
    reviewPackEndpoint: "/.netlify/functions/cartes-review-pack",
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

  const history = sanitizeLegacyMenuNoise(loadHistory());
  const webIdentity = loadOrCreateWebIdentity();
  let busy = false;
  let webSubscriptionFlow = "";
  let currentWebPlan = "gratuito";
  let recoveryNoticeShown = false;
  let reviewStatusLoading = false;
  let currentReviewPackExpiration = "";

  loadStyles();
  const ui = createInterface();
  restoreConversation();

  // El estado de cuenta se solicita al cargar Cartes, no solamente cuando
  // el usuario abre el panel. Esto evita que el encabezado quede en "…".
  void initializeServerState();

  // CARTES_REVIEW_PACKS_WEB_V091
  window.addEventListener("focus", () => {
    if (currentWebPlan === "plus") {
      void refreshMenuPlanWeb();
      void refreshReviewStatus();
    }
  });

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
        <div class="gm-header__identity">
          <img class="gm-header__logo" src="/assets/img/cartes-isotipo.gif" alt="Cartes">
          <div class="gm-header__identity-text">
            <h2 class="gm-header__title">Cartes</h2>
          </div>
        </div>
        <div class="gm-header__actions">
          <button class="gm-link" type="button" aria-label="Vincular Cartes con WhatsApp" title="Vincular con WhatsApp">Vincular</button>
          <button class="gm-clear" type="button" aria-label="Limpiar conversación" title="Limpiar conversación">
            <span aria-hidden="true">↺</span>
            <span class="gm-clear__label">Limpiar</span>
          </button>
          <button class="gm-close" type="button" aria-label="Cerrar Cartes">×</button>
        </div>
        <div class="gm-header__subtitle gm-header__status">Asistente de Develando el Código Masónico</div>
        <div class="gm-header__metrics">
          <div class="gm-header__usage" aria-live="polite">Consultas disponibles: cargando…</div>
          <div class="gm-header__reviews" aria-live="polite" hidden>Revisiones de documentos disponibles: cargando…</div>
        </div>
      </header>
      <div class="gm-messages" aria-live="polite" aria-label="Conversación"></div>
      <div class="gm-suggestions" aria-label="Preguntas sugeridas"></div>
      <div>
        <input
          class="gm-document-input"
          type="file"
          accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
          hidden
        >
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
    const reviewsUsage = shell.querySelector(".gm-header__reviews");
    const documentInput = shell.querySelector(".gm-document-input");

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

    documentInput.addEventListener("change", () => {
      const file = documentInput.files?.[0] || null;

      if (file) {
        void processDocumentReviewWeb(file);
      }
    });

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

    return {
      launcher,
      shell,
      input,
      send,
      messages,
      suggestionBox,
      link,
      usage,
      reviewsUsage,
      documentInput
    };
  }

  function setOpen(open) {
    ui.shell.dataset.open = String(open);
    ui.launcher.setAttribute("aria-expanded", String(open));
    if (open) {
      window.setTimeout(() => ui.input.focus(), 50);
      void refreshLinkStatus({ retries: 2 });
    }
  }

  function sanitizeLegacyMenuNoise(messages) {
    if (!Array.isArray(messages)) return [];

    const rejection =
      "No puedo ayudarte con esa consulta. Esta guía está dedicada a temas de Masonería, historia, simbología, filosofía, ética y los contenidos de Develando el Código Masónico.";

    const cleaned = [];

    for (let index = 0; index < messages.length; index += 1) {
      const current = messages[index];
      const next = messages[index + 1];

      const currentContent = String(current?.content || "").trim();
      const nextContent = String(next?.content || "").trim();

      const isLegacyUselessInput =
        current?.role === "user" &&
        currentContent &&
        !/[\p{L}\p{N}]/u.test(currentContent);

      const isLegacyRejection =
        next?.role === "assistant" &&
        nextContent === rejection;

      if (isLegacyUselessInput && isLegacyRejection) {
        index += 1;
        continue;
      }

      cleaned.push(current);
    }

    return cleaned;
  }
  function showWelcomeMessage() {
    addMessage(
      "assistant",
      "Hola, soy Cartes, el asistente de Develando el Código Masónico. Puedo ayudarte con consultas sobre historia, simbolismo, filosofía y pensamiento masónico. También puedo revisar tus trabajos si tienes Cartes Plus.",
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

      if (!Array.isArray(data.messages)) return;

      const sanitizedMessages = sanitizeLegacyMenuNoise(data.messages);

      history.splice(
        0,
        history.length,
        ...sanitizedMessages.slice(-(CONFIG.maxHistory + 2))
      );

      localStorage.setItem(CONFIG.storageKey, JSON.stringify(history));
      ui.messages.replaceChildren();

      if (history.length === 0) {
        showWelcomeMessage();
        return;
      }

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
        `Envía desde el WhatsApp que deseas vincular: ${data.instruction}. Al enviarlo, tu cuenta Web y ese WhatsApp compartirán plan, consultas, suscripción y conversación. El código vence en 10 minutos. Intentaré abrir el chat de Cartes; si no se abre, usa “Abrir chat con Cartes” o “Copiar código”.`,
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

            if (currentWebPlan === "plus" && !recoveryNoticeShown) {
              recoveryNoticeShown = true;

              addMessage(
                "assistant",
                "Protege tu cuenta Cartes Plus: vincúlala con WhatsApp. Así podrás recuperar tu suscripción, consultas y conversación si cambias de navegador, borras los datos del sitio o pierdes esta sesión.",
                false
              );
            }
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
      .normalize("NFKC")
      .replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[*_~`]/g, " ")
      .replace(/[¿?¡!.,;:()[\]{}"'“”‘’]/g, " ")
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
      const response = await fetch(CONFIG.subscriptionStatusEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          web_identity: webIdentity
        }),
        cache: "no-store"
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || "No fue posible consultar tu suscripción."
        );
      }

      updateUsage(data.usage);
      updateReviewUsage(data.reviews);

      const usage = data.usage || {};
      const reviews = data.reviews || {};
      const subscription = data.subscription || null;

      const plan = String(
        data.plan || usage.plan || "gratuito"
      ).toLowerCase();

      const limite = Number(usage.limite || 0);
      const disponibles = Number(usage.disponibles || 0);

      const usadas = Number.isFinite(Number(usage.usadas))
        ? Number(usage.usadas)
        : Math.max(0, limite - disponibles);

      const provider =
        subscription?.provider === "paypal"
          ? "PayPal"
          : subscription?.provider === "mercadopago"
            ? "Mercado Pago"
            : "Sin suscripción recurrente";

      const expirationRaw =
        subscription?.access_until ||
        subscription?.next_payment_date ||
        "";

      currentReviewPackExpiration = expirationRaw;

      const expiration =
        formatCartesDateWeb(expirationRaw) ||
        "No aplica";

      const renewal =
        subscription?.renovacion_cancelada
          ? "Cancelada"
          : (
              formatCartesDateWeb(subscription?.next_payment_date) ||
              "No aplica"
            );

      const packagesBought =
        Number(reviews.paquetes_comprados || 0);

      const packagesMax =
        Number(reviews.paquetes_maximo || 2);

      const reviewLines =
        plan === "plus"
          ? `\nRevisiones disponibles: ${Number(reviews.disponibles || 0)}\nPaquetes adicionales: ${packagesBought} de ${packagesMax}`
          : "";

      const freeCycleEnd =
        plan === "plus"
          ? ""
          : formatCartesDateWeb(usage?.cycle_end);

      const periodLines =
        plan === "plus"
          ? `\nFecha de vencimiento: ${expiration}\nRenovación: ${renewal}`
          : freeCycleEnd
            ? `\nRenovación de consultas gratuitas: ${freeCycleEnd}`
            : "\nPeriodo gratuito: comienza con la primera consulta válida respondida por Cartes";

      const texto =
        `Plan: ${plan === "plus" ? "Cartes Plus" : "Cartes gratuito"}\n` +
        `Medio de pago: ${provider}\n` +
        `Consultas usadas: ${usadas} de ${limite}\n` +
        `Consultas disponibles: ${disponibles}` +
        `${reviewLines}` +
        `${periodLines}`;

      addMessage("assistant", texto, true);

      const recurring =
        subscription?.provider === "paypal" ||
        subscription?.provider === "mercadopago";

      // CARTES_UNLINK_CHANNEL_V115
      const whatsappLinked =
        ui.link?.dataset.linked === "true";

      const actions = [];

      if (plan === "plus") {
        if (packagesBought < packagesMax) {
          actions.push({
            label: "Comprar 3 revisiones - $99",
            value: "comprar revisiones"
          });
        }

        if (
          recurring &&
          !subscription?.renovacion_cancelada
        ) {
          actions.push({
            label: "Cancelar renovación",
            value: "cancelar renovacion"
          });
        }
      }

      if (whatsappLinked) {
        actions.push({
          label: "Cambiar número de WhatsApp",
          value: "cambiar numero whatsapp"
        });

        actions.push({
          label: "Desvincular WhatsApp",
          value: "desvincular whatsapp"
        });
      }

      if (actions.length > 0) {
        actions.push({
          label: "Volver al menú",
          value: "menu",
          secondary: true
        });

        webSubscriptionFlow = "subscription_actions";
        renderSubscriptionActionsWeb(actions);
        return;
      }

      webSubscriptionFlow = "";
      restoreDefaultSuggestionsWeb();
    }
    catch (error) {
      addMessage(
        "assistant",
        error instanceof Error
          ? error.message
          : "No fue posible consultar tu suscripción.",
        false,
        true
      );
    }
    finally {
      typing.remove();
      setBusy(false);
    }
  }

  async function iniciarCambioNumeroWhatsAppWeb() {
    setBusy(true);

    ui.input.value = "";
    ui.input.style.height = "auto";

    const typing = addTyping();

    try {
      const response =
        await fetch(
          CONFIG.linkEndpoint,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              action: "start_change_whatsapp",
              web_identity: webIdentity
            }),
            cache: "no-store"
          }
        );

      const data =
        await response.json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
          "No fue posible iniciar el cambio de número."
        );
      }

      updateUsage(data.usage);

      const instruction =
        String(data.instruction || "").trim();

      if (!/^CAMBIAR \d{6}$/.test(instruction)) {
        throw new Error(
          "Cartes no devolvió un código de cambio válido."
        );
      }

      webSubscriptionFlow = "";

      addMessage(
        "assistant",
        `Código generado: ${instruction}\n\nDesde el NUEVO número de WhatsApp, abre el chat con Cartes y envía exactamente ese código. Vence en 10 minutos. Tu número actual seguirá vinculado hasta que el nuevo complete la verificación.`,
        false
      );

      restoreDefaultSuggestionsWeb();
    }
    catch (error) {
      addMessage(
        "assistant",
        error instanceof Error
          ? error.message
          : "No fue posible iniciar el cambio de número.",
        false,
        true
      );

      webSubscriptionFlow = "";
      restoreDefaultSuggestionsWeb();
    }
    finally {
      typing.remove();
      setBusy(false);
    }
  }
  async function desvincularWhatsAppWeb() {
    setBusy(true);

    ui.input.value = "";
    ui.input.style.height = "auto";

    const typing = addTyping();

    try {
      const response =
        await fetch(
          CONFIG.linkEndpoint,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              action: "unlink_whatsapp",
              web_identity: webIdentity
            }),
            cache: "no-store"
          }
        );

      const data =
        await response.json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
          "No fue posible desvincular WhatsApp."
        );
      }

      updateUsage(data.usage);

      ui.link.textContent = "Vincular";
      ui.link.disabled = false;
      delete ui.link.dataset.linked;

      webSubscriptionFlow = "";

      addMessage(
        "assistant",
        "WhatsApp quedó desvinculado de esta cuenta. El número anterior ya no puede acceder a ella. Tu plan, consultas, revisiones y suscripción permanecen sin cambios. Puedes volver a vincular WhatsApp cuando quieras desde Vincular.",
        false
      );

      restoreDefaultSuggestionsWeb();
    }
    catch (error) {
      addMessage(
        "assistant",
        error instanceof Error
          ? error.message
          : "No fue posible desvincular WhatsApp.",
        false,
        true
      );

      webSubscriptionFlow = "";
      restoreDefaultSuggestionsWeb();
    }
    finally {
      typing.remove();
      setBusy(false);
    }
  }
  function formatCartesDateWeb(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const months = [
      "Ene", "Feb", "Mar", "Abr", "May", "Jun",
      "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
    ];

    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (iso) {
      const year = iso[1];
      const month = Number(iso[2]);
      const day = iso[3];

      if (month >= 1 && month <= 12) {
        return `${day}-${months[month - 1]}-${year}`;
      }
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;

    const day = String(parsed.getDate()).padStart(2, "0");
    const month = months[parsed.getMonth()];
    const year = parsed.getFullYear();

    return `${day}-${month}-${year}`;
  }
  function restoreDefaultSuggestionsWeb() {
    ui.suggestionBox.replaceChildren();
    ui.suggestionBox.classList.remove("gm-suggestions--menu", "gm-suggestions--main-menu");

    suggestions.forEach((question) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gm-suggestion";
      button.textContent = question;
      button.addEventListener("click", () => submitQuestion(question));
      ui.suggestionBox.appendChild(button);
    });
  }

  async function refreshMenuPlanWeb() {
    try {
      const response = await fetch(CONFIG.subscriptionStatusEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          web_identity: webIdentity
        }),
        cache: "no-store"
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) return false;

      currentWebPlan = String(
        data.plan ||
        data.usage?.plan ||
        "gratuito"
      ).toLowerCase();

      updateUsage(data.usage);
      updateReviewUsage(data.reviews);

      const subscription = data.subscription || null;

      currentReviewPackExpiration =
        subscription?.access_until ||
        subscription?.next_payment_date ||
        "";

      return true;
    }
    catch {
      return false;
    }
  }

  function clearDocumentReviewMenuWeb() {
    ui.suggestionBox.replaceChildren();

    ui.suggestionBox.classList.remove(
      "gm-suggestions--menu",
      "gm-suggestions--main-menu"
    );
  }

  function renderMenuButtonsWeb() {
    ui.suggestionBox.classList.add("gm-suggestions--menu", "gm-suggestions--main-menu");

    const options = [
      ["1", "Conversar con Cartes"],
      ...(currentWebPlan === "plus"
        ? [
            ["7", "Revisar documento"]
          ]
        : [
            ["2", "Conoce Cartes Plus"],
            ["3", "Suscribirme"]
          ]),
      ["4", "Mi suscripción"],
      ["5", "Ayuda y soporte"],
      ["6", "Privacidad y términos"]
    ];

    ui.suggestionBox.replaceChildren();

    const heading = document.createElement("div");
    heading.className = "gm-menu-heading";

    const title = document.createElement("div");
    title.className = "gm-menu-heading__title";
    title.textContent = "Menú de Cartes";

    const subtitle = document.createElement("div");
    subtitle.className = "gm-menu-heading__subtitle";
    subtitle.textContent = "Selecciona una opción:";

    heading.append(title, subtitle);
    ui.suggestionBox.appendChild(heading);

    options.forEach(([id, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gm-suggestion";
      button.textContent = label;
      button.addEventListener("click", () => ejecutarOpcionMenuWeb(id));
      ui.suggestionBox.appendChild(button);
    });
  }

  async function mostrarMenuWeb() {
    webSubscriptionFlow = "";
    ui.input.value = "";
    ui.input.style.height = "auto";

    await refreshMenuPlanWeb();

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
      "conoce cartes plus": "plus_info",
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

      "7": "revisar_documento",
      "revisar documento": "revisar_documento",
      "revisar un documento": "revisar_documento",
      "revision de documento": "revisar_documento",
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
        "Escribe tu pregunta sobre historia, simbolismo o filosofía masónica y con gusto te ayudaré.",
        false
      );
      restoreDefaultSuggestionsWeb();
      ui.input.focus();
      return;
    }

    if (id === "revisar_documento") {
      await refreshMenuPlanWeb();

      if (currentWebPlan !== "plus") {
        addMessage(
          "assistant",
          "La revisión de documentos está disponible únicamente para Cartes Plus.",
          false
        );

        restoreDefaultSuggestionsWeb();
        return;
      }

      restoreDefaultSuggestionsWeb();
      ui.documentInput.value = "";
      ui.documentInput.click();
      return;
    }

    if (id === "plus_info") {
      addMessage(
        "assistant",
        "Cartes Plus amplía tu conocimiento con más consultas, revisión y retroalimentación de documentos.\n\nPor $149 MXN al mes tendrás hasta 50 consultas y 5 revisiones mensuales de documentos Word de hasta 5 páginas cada uno.\n\nEn cada revisión recibirás observaciones sobre estructura, claridad y contenido para mejorar tu trabajo antes de presentarlo en Logia.\n\nLa suscripción quedará vinculada a tu número de WhatsApp. Desde este mismo chat podrás consultar su estado o cancelarla.\n\nLa versión gratuita está pensada para consultas puntuales. Cartes Plus es para quienes desean estudiar con mayor profundidad y recibir apoyo en la preparación de sus trabajos.\n\nPara comenzar, selecciona “Suscribirme”.",
        false
      );
      restoreDefaultSuggestionsWeb();
      return;
    }

    if (id === "suscribirme") {
      await refreshMenuPlanWeb();

      if (currentWebPlan === "plus") {
        addMessage(
          "assistant",
          "Tu cuenta ya tiene Cartes Plus vigente. Consulta “Mi suscripción” para revisar su estado y vigencia.",
          false
        );
        restoreDefaultSuggestionsWeb();
        return;
      }

      await comenzarSuscripcionWeb();
      return;
    }

    if (id === "mi_suscripcion") {
      await mostrarEstadoSuscripcionWeb("Mi suscripción");
      return;
    }

    if (id === "ayuda") {
      addMessage(
        "assistant",
        "Para recibir ayuda con Cartes, tu suscripción o un pago, escríbenos a soporte@develandoelcodigomasonico.com y cuéntanos brevemente qué ocurrió.",
        false
      );
      restoreDefaultSuggestionsWeb();
      return;
    }

    if (id === "legal") {
      const privacyUrl = `${window.location.origin}/cartes-whatsapp/privacy.html`;
      const termsUrl = `${window.location.origin}/cartes-whatsapp/terminos.html`;

      addMessage(
        "assistant",
        `Al utilizar Cartes aceptas sus Términos de uso y el Aviso de privacidad de Develando el Código Masónico. Tus mensajes y los documentos que envíes serán tratados únicamente para prestar el servicio y mejorar tu experiencia. Puedes consultar la información completa en nuestros términos y aviso de privacidad. Para cualquier duda, escríbenos a soporte@develandoelcodigomasonico.com.\n\nAviso de privacidad:\n${privacyUrl}\n\nTérminos:\n${termsUrl}`,
        false
      );
      restoreDefaultSuggestionsWeb();
    }
  }

  // WEB_SUBSCRIPTION_FLOW_V018
  // WEB_SUBSCRIPTION_UX_V019
  function renderSubscriptionActionsWeb(actions) {
    ui.suggestionBox.classList.add("gm-suggestions--menu");
    ui.suggestionBox.classList.remove("gm-suggestions--main-menu");
    ui.suggestionBox.replaceChildren();

    actions.forEach(({ label, value, secondary = false }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `gm-suggestion${secondary ? " gm-suggestion--secondary" : ""}`;
      button.textContent = label;
      button.addEventListener("click", () => submitQuestion(value));
      ui.suggestionBox.appendChild(button);
    });
  }

  function addLegalMessageWeb() {
    const message = document.createElement("div");
    message.className = "gm-message gm-message--assistant gm-message--legal";

    const intro = document.createElement("p");
    intro.textContent =
      "Antes de continuar, confirma que leíste y aceptas los Términos de uso y el Aviso de privacidad de Cartes.";

    const links = document.createElement("div");
    links.className = "gm-legal-links";

    const terms = document.createElement("a");
    terms.className = "gm-legal-link";
    terms.href = `${window.location.origin}/cartes-whatsapp/terminos.html`;
    terms.target = "_blank";
    terms.rel = "noopener noreferrer";
    terms.textContent = "Ver Términos de uso";

    const privacy = document.createElement("a");
    privacy.className = "gm-legal-link";
    privacy.href = `${window.location.origin}/cartes-whatsapp/privacy.html`;
    privacy.target = "_blank";
    privacy.rel = "noopener noreferrer";
    privacy.textContent = "Ver Aviso de privacidad";

    links.append(terms, privacy);
    message.append(intro, links);
    ui.messages.appendChild(message);
    ui.messages.scrollTop = ui.messages.scrollHeight;
  }

  // WEB_SUBSCRIPTION_BACK_MENU_V019
  function renderLegalActionsWeb() {
    renderSubscriptionActionsWeb([
      { label: "Aceptar", value: "acepto" },
      { label: "No aceptar", value: "no acepto", secondary: true },
      { label: "Volver al menú", value: "menu", secondary: true }
    ]);
  }

  function renderOpcionesPagoWeb() {
    renderSubscriptionActionsWeb([
      { label: "Mercado Pago", value: "mercado pago" },
      { label: "PayPal", value: "paypal" },
      { label: "Volver al menú", value: "menu", secondary: true }
    ]);
  }

  function renderOpcionesPagoPaqueteWeb() {
    renderSubscriptionActionsWeb([
      { label: "Mercado Pago", value: "paquete mercado pago" },
      { label: "PayPal", value: "paquete paypal" },
      { label: "Volver al menú", value: "menu", secondary: true }
    ]);
  }

  function mostrarAccionPagoWeb(provider, url) {
    ui.suggestionBox.replaceChildren();
    ui.suggestionBox.classList.remove(
      "gm-suggestions--menu",
      "gm-suggestions--main-menu"
    );

    const wrapper = document.createElement("div");
    wrapper.className = "gm-suggestions";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "gm-suggestion";
    button.textContent = `Abrir ${provider}`;
    button.addEventListener("click", () => {
      window.open(url, "_blank", "noopener,noreferrer");
    });

    const back = document.createElement("button");
    back.type = "button";
    back.className = "gm-suggestion gm-suggestion--secondary";
    back.textContent = "Volver al menú";
    back.addEventListener("click", () => {
      void mostrarMenuWeb();
    });

    wrapper.append(button, back);
    ui.messages.appendChild(wrapper);
    ui.messages.scrollTop = ui.messages.scrollHeight;
  }

  function mostrarLimiteGratuitoWeb(usage) {
    const cycleEnd =
      formatCartesDateWeb(usage?.cycle_end);

    const renewalLine =
      cycleEnd
        ? `\n\nTus 5 consultas gratuitas estarán disponibles nuevamente el ${cycleEnd}.`
        : "";

    addMessage(
      "assistant",
      "Consultas disponibles: 0 de 5\n\n" +
        "Ya utilizaste las 5 consultas gratuitas de este periodo." +
        renewalLine +
        "\n\nSi quieres seguir conversando con Cartes ahora, puedes activar Cartes Plus por $149 MXN al mes, con hasta 50 consultas y 5 revisiones de documentos Word.",
      false
    );

    renderSubscriptionActionsWeb([
      { label: "Contratar Plus", value: "suscribirme" },
      { label: "Volver al menú", value: "menu", secondary: true }
    ]);
  }
  async function comenzarSuscripcionWeb() {
    webSubscriptionFlow = "accept_terms";
    ui.input.value = "";
    ui.input.style.height = "auto";

    addLegalMessageWeb();
    renderLegalActionsWeb();
    ui.input.focus();
  }

  async function procesarFlujoSuscripcionWeb(rawQuestion) {
    if (!webSubscriptionFlow) return false;

    const normalized = normalizarComandoWeb(rawQuestion);

    if (webSubscriptionFlow === "accept_terms") {
      if (["no aceptar", "no acepto", "rechazar"].includes(normalized)) {
        webSubscriptionFlow = "";
        ui.input.value = "";
        ui.input.style.height = "auto";
        addMessage(
          "assistant",
          "No se generará ningún enlace de pago ni se activará Cartes Plus. Puedes seguir utilizando Cartes y volver a Suscribirme cuando quieras.",
          false
        );
        renderMenuButtonsWeb();
        return true;
      }

      if (!["acepto", "aceptar", "si"].includes(normalized)) {
        addMessage(
          "assistant",
          "Selecciona Aceptar para continuar o No aceptar para volver sin activar Cartes Plus.",
          false
        );
        renderLegalActionsWeb();
        return true;
      }

      webSubscriptionFlow = "payment_provider";
      ui.input.value = "";
      ui.input.style.height = "auto";
      addMessage(
        "assistant",
        "Gracias. Tu aceptación quedó registrada. Ahora selecciona el medio de pago que te resulte más conveniente.",
        false
      );
      renderOpcionesPagoWeb();
      return true;
    }

    if (webSubscriptionFlow === "confirm_change_whatsapp") {
      if (["no", "no cambiar", "cancelar"].includes(normalized)) {
        webSubscriptionFlow = "";

        addMessage(
          "assistant",
          "No se realizó ningún cambio. Tu número actual continúa vinculado a Cartes.",
          false
        );

        restoreDefaultSuggestionsWeb();
        return true;
      }

      if (!["si", "confirmar", "generar codigo"].includes(normalized)) {
        addMessage(
          "assistant",
          "Confirma si deseas iniciar el cambio de número. El número actual seguirá funcionando hasta que verifiques el nuevo número.",
          false
        );

        renderSubscriptionActionsWeb([
          { label: "Sí, generar código", value: "si" },
          { label: "No cambiar", value: "no", secondary: true }
        ]);

        return true;
      }

      await iniciarCambioNumeroWhatsAppWeb();
      return true;
    }
    if (webSubscriptionFlow === "confirm_unlink_whatsapp") {
      if (["no", "no desvincular", "cancelar"].includes(normalized)) {
        webSubscriptionFlow = "";

        addMessage(
          "assistant",
          "No se realizó ningún cambio. WhatsApp continúa vinculado a tu cuenta Cartes.",
          false
        );

        restoreDefaultSuggestionsWeb();
        return true;
      }

      if (!["si", "sí", "confirmar", "si desvincular"].includes(normalized)) {
        addMessage(
          "assistant",
          "Confirma si deseas desvincular WhatsApp. Esta acción no cancela Cartes Plus ni modifica tu saldo o suscripción.",
          false
        );

        renderSubscriptionActionsWeb([
          { label: "Sí, desvincular", value: "si" },
          { label: "No desvincular", value: "no", secondary: true }
        ]);

        return true;
      }

      await desvincularWhatsAppWeb();
      return true;
    }
    if (webSubscriptionFlow === "subscription_actions") {
      if (
        [
          "cambiar numero whatsapp",
          "cambiar numero de whatsapp",
          "cambiar mi numero whatsapp"
        ].includes(normalized)
      ) {
        webSubscriptionFlow =
          "confirm_change_whatsapp";

        addMessage(
          "assistant",
          "¿Confirmas que deseas cambiar el número de WhatsApp vinculado? Tu número actual seguirá funcionando hasta que el nuevo número sea verificado. Tu plan, consultas, revisiones, suscripción y conversación permanecerán en la misma cuenta.",
          false
        );

        renderSubscriptionActionsWeb([
          { label: "Sí, generar código", value: "si" },
          { label: "No cambiar", value: "no", secondary: true }
        ]);

        return true;
      }

      if (
        [
          "desvincular whatsapp",
          "desvincular mi whatsapp",
          "quitar whatsapp"
        ].includes(normalized)
      ) {
        webSubscriptionFlow =
          "confirm_unlink_whatsapp";

        addMessage(
          "assistant",
          "¿Confirmas que deseas desvincular WhatsApp? Ese número dejará de acceder a esta cuenta. Tu plan, consultas, revisiones y suscripción permanecerán en Cartes Web y esta acción no cancela Cartes Plus.",
          false
        );

        renderSubscriptionActionsWeb([
          { label: "Sí, desvincular", value: "si" },
          { label: "No desvincular", value: "no", secondary: true }
        ]);

        return true;
      }

      if (
        [
          "comprar revisiones",
          "comprar 3 revisiones",
          "paquete de revisiones"
        ].includes(normalized)
      ) {
        webSubscriptionFlow = "review_pack_provider";

        const expiration =
          formatCartesDateWeb(currentReviewPackExpiration) ||
          "el vencimiento de tu periodo Plus vigente";

        addMessage(
          "assistant",
          `El paquete incluye 3 revisiones adicionales por $99 MXN en un solo pago. No es recurrente y las revisiones vencerán el ${expiration}.\n\nSelecciona el medio de pago.`,
          false
        );

        renderOpcionesPagoPaqueteWeb();
        return true;
      }

      if (
        [
          "cancelar",
          "cancelar renovacion",
          "cancelar suscripcion",
          "darme de baja"
        ].includes(normalized)
      ) {
        webSubscriptionFlow = "confirm_cancel";

        addMessage(
          "assistant",
          "¿Confirmas que deseas cancelar la renovación de Cartes Plus? Conservarás tus beneficios hasta finalizar el periodo ya pagado.",
          false
        );

        renderSubscriptionActionsWeb([
          { label: "Sí, cancelar", value: "si" },
          { label: "No cancelar", value: "no", secondary: true }
        ]);

        return true;
      }

      addMessage(
        "assistant",
        "Selecciona Cancelar renovación o Volver al menú.",
        false
      );

      renderSubscriptionActionsWeb([
        { label: "Cancelar renovación", value: "cancelar renovacion" },
        { label: "Volver al menú", value: "menu", secondary: true }
      ]);

      return true;
    }

    if (webSubscriptionFlow === "confirm_cancel") {
      if (["no", "no cancelar", "volver"].includes(normalized)) {
        webSubscriptionFlow = "";

        addMessage(
          "assistant",
          "Entendido. No se realizó ningún cambio y la renovación de Cartes Plus continúa activa.",
          false
        );

        await mostrarMenuWeb();
        return true;
      }

      if (!["si", "sí"].includes(normalized)) {
        addMessage(
          "assistant",
          "Selecciona Sí, cancelar o No cancelar.",
          false
        );

        renderSubscriptionActionsWeb([
          { label: "Sí, cancelar", value: "si" },
          { label: "No cancelar", value: "no", secondary: true }
        ]);

        return true;
      }

      setBusy(true);
      const typing = addTyping();

      try {
        const response = await fetch(CONFIG.subscriptionEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "cancel",
            web_identity: webIdentity
          }),
          cache: "no-store"
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.error || "No fue posible cancelar la renovación."
          );
        }

        webSubscriptionFlow = "";

        addMessage(
          "assistant",
          data.already_cancelled
            ? "La renovación de Cartes Plus ya estaba cancelada. Conservas tus beneficios hasta finalizar el periodo vigente."
            : "La renovación de Cartes Plus fue cancelada. Conservas tus beneficios hasta finalizar el periodo ya pagado.",
          false
        );

        await refreshMenuPlanWeb();
        await mostrarEstadoSuscripcionWeb("Mi suscripción");

        return true;
      } catch (error) {
        addMessage(
          "assistant",
          error instanceof Error
            ? error.message
            : "No fue posible cancelar la renovación.",
          false
        );

        webSubscriptionFlow = "confirm_cancel";

        renderSubscriptionActionsWeb([
          { label: "Sí, cancelar", value: "si" },
          { label: "No cancelar", value: "no", secondary: true }
        ]);

        return true;
      } finally {
        typing.remove();
        setBusy(false);
      }
    }

    if (webSubscriptionFlow === "payment_provider") {
      const provider =
        ["1", "mercado pago", "mercadopago"].includes(normalized)
          ? "mercadopago"
          : ["2", "paypal", "pay pal"].includes(normalized)
            ? "paypal"
            : "";

      if (!provider) {
        addMessage(
          "assistant",
          "Selecciona Mercado Pago o PayPal para continuar.",
          false
        );
        renderOpcionesPagoWeb();
        return true;
      }

      const providerLabel = provider === "paypal" ? "PayPal" : "Mercado Pago";
      setBusy(true);
      ui.input.value = "";
      ui.input.style.height = "auto";
      const typing = addTyping();

      try {
        const response = await fetch(CONFIG.subscriptionEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "checkout",
            provider,
            accepted_terms: true,
            web_identity: webIdentity
          }),
          cache: "no-store"
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.url) {
          throw new Error(data.error || `No fue posible iniciar ${providerLabel}.`);
        }

        webSubscriptionFlow = "";
        addMessage(
          "assistant",
          `${providerLabel} está listo. Abre el enlace para completar la suscripción. Cartes Plus se activará en esta misma cuenta cuando el proveedor confirme el pago.`,
          false
        );
        mostrarAccionPagoWeb(providerLabel, data.url);
        return true;
      } catch (error) {
        addMessage(
          "assistant",
          error instanceof Error ? error.message : "No fue posible iniciar el pago.",
          false,
          true
        );
        renderOpcionesPagoWeb();
        return true;
      } finally {
        typing.remove();
        setBusy(false);
      }
    }

    if (webSubscriptionFlow === "review_pack_provider") {
      if (
        ["menu", "volver al menu", "inicio", "opciones"].includes(normalized)
      ) {
        webSubscriptionFlow = "";
        await mostrarMenuWeb();
        return true;
      }

      const provider =
        ["paquete mercado pago", "mercado pago", "mercadopago", "1"].includes(normalized)
          ? "mercadopago"
          : ["paquete paypal", "paypal", "pay pal", "2"].includes(normalized)
            ? "paypal"
            : "";

      if (!provider) {
        addMessage(
          "assistant",
          "Selecciona Mercado Pago o PayPal para comprar el paquete.",
          false
        );

        renderOpcionesPagoPaqueteWeb();
        return true;
      }

      const providerLabel =
        provider === "paypal"
          ? "PayPal"
          : "Mercado Pago";

      setBusy(true);
      const typing = addTyping();

      try {
        const response = await fetch(
          CONFIG.reviewPackEndpoint,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              action: "checkout",
              provider,
              web_identity: webIdentity
            }),
            cache: "no-store"
          }
        );

        const data =
          await response.json().catch(() => ({}));

        if (!response.ok || !data?.url) {
          throw new Error(
            data.error ||
            `No fue posible iniciar ${providerLabel}.`
          );
        }

        webSubscriptionFlow = "";

        addMessage(
          "assistant",
          `${providerLabel} está listo. El pago es único por $99 MXN e incluye 3 revisiones adicionales. Al confirmarse, el saldo se actualizará en la misma cuenta de Web y WhatsApp.`,
          false
        );

        mostrarAccionPagoWeb(providerLabel, data.url);
        return true;
      }
      catch (error) {
        addMessage(
          "assistant",
          error instanceof Error
            ? error.message
            : "No fue posible iniciar la compra.",
          false,
          true
        );

        renderOpcionesPagoPaqueteWeb();
        return true;
      }
      finally {
        typing.remove();
        setBusy(false);
      }
    }

    webSubscriptionFlow = "";
    return false;
  }

  // CARTES_DOCUMENT_WEB_V069
  function updateDocumentControlsByPlan() {
    if (!ui?.reviewsUsage) return;

    const isPlus =
      currentWebPlan === "plus";

    ui.reviewsUsage.hidden = !isPlus;

    if (!isPlus) {
      delete ui.reviewsUsage.dataset.state;
      ui.reviewsUsage.textContent =
        "Revisiones de documentos disponibles: cargando…";
    }
  }

  function updateReviewUsage(reviews) {
    if (
      !ui?.reviewsUsage ||
      !reviews ||
      typeof reviews !== "object"
    ) {
      return false;
    }

    const limite = Number(reviews.limite);
    const disponibles = Number(reviews.disponibles);

    if (
      !Number.isFinite(limite) ||
      !Number.isFinite(disponibles)
    ) {
      return false;
    }

    const total =
      Math.max(0, Math.trunc(limite));

    const restantes =
      Math.max(0, Math.trunc(disponibles));

    ui.reviewsUsage.textContent =
      `Revisiones de documentos disponibles: ${restantes}`;

    ui.reviewsUsage.title =
      `${restantes} ${
        restantes === 1
          ? "revisión disponible"
          : "revisiones disponibles"
      }`;

    ui.reviewsUsage.dataset.state = "ready";
    ui.reviewsUsage.dataset.remaining =
      String(restantes);
    ui.reviewsUsage.dataset.limit =
      String(total);

    return true;
  }

  async function refreshReviewStatus() {
    if (
      currentWebPlan !== "plus" ||
      reviewStatusLoading
    ) {
      return false;
    }

    reviewStatusLoading = true;

    try {
      const response = await fetch(
        CONFIG.documentReviewEndpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            action: "status",
            web_identity: webIdentity
          }),
          cache: "no-store"
        }
      );

      const data =
        await response.json().catch(() => ({}));

      if (!response.ok) {
        return false;
      }

      return updateReviewUsage(data.reviews);
    }
    catch {
      return false;
    }
    finally {
      reviewStatusLoading = false;
    }
  }

  async function processDocumentReviewWeb(file) {
    if (
      busy ||
      currentWebPlan !== "plus"
    ) {
      return;
    }

    const name =
      String(file?.name || "").trim();

    if (!/\.(docx|doc)$/i.test(name)) {
      addMessage(
        "assistant",
        "Este tipo de archivo no es compatible. Cartes admite únicamente documentos Word en formato .doc o .docx para revisión.\n\nEl archivo no fue revisado y no se consumió ninguna revisión.",
        false,
        true
      );

      ui.documentInput.value = "";
      return;
    }

    const maxBytes =
      4 * 1024 * 1024;

    if (
      Number(file?.size || 0) > maxBytes
    ) {
      addMessage(
        "assistant",
        "El documento supera el tamaño técnico máximo de 4 MB.",
        false,
        true
      );

      ui.documentInput.value = "";
      return;
    }

    const accepted =
      window.confirm(
        `Cartes procesará temporalmente "${name}" para validar que tenga un máximo de 5 páginas y, si cumple, realizar la revisión. El archivo no se guardará después del procesamiento.\n\n¿Autorizas el procesamiento de este documento?`
      );

    if (!accepted) {
      ui.documentInput.value = "";
      return;
    }

    // CARTES_DOCUMENT_FLOW_WEB_V087
    // La revisión ya fue autorizada:
    // el menú anterior deja de estar disponible
    // mientras Cartes procesa el documento.
    clearDocumentReviewMenuWeb();

    setBusy(true);

    addMessage(
      "user",
      `Documento para revisión: ${name}`,
      false
    );

    const typing = addTyping();

    try {
      const form = new FormData();

      form.append(
        "web_identity",
        webIdentity
      );

      form.append(
        "request_id",
        createReviewRequestId()
      );

      form.append(
        "accepted_processing",
        "true"
      );

      form.append(
        "document",
        file,
        name
      );

      const response = await fetch(
        CONFIG.documentReviewEndpoint,
        {
          method: "POST",
          body: form,
          cache: "no-store"
        }
      );

      const data =
        await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
          "No fue posible revisar el documento."
        );
      }

      const review =
        String(data?.review || "").trim();

      if (!review) {
        throw new Error(
          "Cartes devolvió una revisión vacía."
        );
      }

      addMessage(
        "assistant",
        review,
        false
      );

      updateReviewUsage(data.reviews);

      if (
        data?.reviews &&
        Number.isFinite(
          Number(data.reviews.disponibles)
        )
      ) {
        addMessage(
          "assistant",
          `Revisiones de documentos disponibles: ${data.reviews.disponibles}`,
          false
        );
      }
    }
    catch (error) {
      addMessage(
        "assistant",
        error instanceof Error
          ? error.message
          : "No fue posible revisar el documento.",
        false,
        true
      );

      void refreshReviewStatus();
    }
    finally {
      typing.remove();
      ui.documentInput.value = "";
      setBusy(false);

      // CARTES_DOCUMENT_FLOW_WEB_V089
      // El menú permanece oculto después de la revisión.
      // El usuario puede solicitarlo nuevamente cuando lo necesite.
    }
  }

  function createReviewRequestId() {
    const randomPart =
      window.crypto?.randomUUID?.().replace(/-/g, "") ||
      `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

    return `webreview_${randomPart}`;
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
      await mostrarMenuWeb();
      return;
    }

    if (webSubscriptionFlow) {
      const handledSubscriptionFlow = await procesarFlujoSuscripcionWeb(question);
      if (handledSubscriptionFlow) return;
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

    restoreDefaultSuggestionsWeb();

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
        const usagePlan =
          String(
            data?.usage?.plan ||
            currentWebPlan ||
            "gratuito"
          ).toLowerCase();

        if (
          data?.code === "usage_limit" &&
          usagePlan !== "plus"
        ) {
          mostrarLimiteGratuitoWeb(data.usage);
          return;
        }

        throw new Error(
          data.error ||
          "No fue posible obtener una respuesta."
        );
      }

      const answer = typeof data.answer === "string" ? data.answer.trim() : "";

      if (!answer) {
        throw new Error("Cartes devolvió una respuesta vacía.");
      }

      addMessage("assistant", answer, true);

      if (
        String(
          data?.usage?.plan ||
          currentWebPlan ||
          "gratuito"
        ).toLowerCase() !== "plus" &&
        Number(data?.usage?.disponibles) <= 0
      ) {
        mostrarLimiteGratuitoWeb(data.usage);
      }
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

    if (usage.plan) {
      currentWebPlan = String(usage.plan).toLowerCase();
    }

    updateDocumentControlsByPlan();

    if (
      currentWebPlan === "plus" &&
      ui?.reviewsUsage?.dataset?.state !== "ready"
    ) {
      void refreshReviewStatus();
    }

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




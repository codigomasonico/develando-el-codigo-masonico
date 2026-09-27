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
    publicConfigEndpoint: "/.netlify/functions/cartes-public-config",
    documentReviewEndpoint: "/.netlify/functions/cartes-document-review",
    reviewPackEndpoint: "/.netlify/functions/cartes-review-pack",
    whatsappNumber: "523322338888",
    maxChars: 900,
    maxHistory: 8,
    storageKey: "dcm_guia_masonico_v1",
    identityKey: "dcm_cartes_web_identity_v1",
    localeKey: "dcm_cartes_locale_v1"
  };

  const UI_TEXT = Object.freeze({
    es: Object.freeze({
      open: "Abrir Cartes",
      dialog: "Cartes, asistente de Develando el Código Masónico",
      link: "Vincular",
      linked: "Vinculado",
      linkLabel: "Vincular Cartes con WhatsApp",
      linkTitle: "Vincular con WhatsApp",
      clear: "Limpiar",
      clearLabel: "Limpiar conversación",
      close: "Cerrar Cartes",
      subtitle: "Asistente de Develando el Código Masónico",
      usageLoading: "Consultas disponibles: cargando…",
      reviewsLoading: "Revisiones de documentos disponibles: cargando…",
      conversation: "Conversación",
      suggestions: "Preguntas sugeridas",
      placeholder: "Escribe tu pregunta sobre masonería…",
      question: "Pregunta",
      send: "Enviar pregunta",
      language: "Idioma de Cartes",
      disclaimer: "Cartes puede equivocarse. Contrasta la información importante con fuentes confiables. No representa oficialmente a ninguna obediencia, rito o jurisdicción.",
      menuTitle: "Menú de Cartes",
      menuSubtitle: "Selecciona una opción:",
      mySubscription: "Mi suscripción",
      typing: "Cartes está escribiendo"
    }),
    en: Object.freeze({
      open: "Open Cartes",
      dialog: "Cartes, assistant for Develando el Código Masónico",
      link: "Connect",
      linked: "Connected",
      linkLabel: "Connect Cartes with WhatsApp",
      linkTitle: "Connect with WhatsApp",
      clear: "Clear",
      clearLabel: "Clear conversation",
      close: "Close Cartes",
      subtitle: "Assistant for Develando el Código Masónico",
      usageLoading: "Questions available: loading…",
      reviewsLoading: "Document reviews available: loading…",
      conversation: "Conversation",
      suggestions: "Suggested questions",
      placeholder: "Enter your question about Freemasonry…",
      question: "Question",
      send: "Send question",
      language: "Cartes language",
      disclaimer: "Cartes can make mistakes. Verify important information with reliable sources. It does not officially represent any Masonic obedience, rite, or jurisdiction.",
      menuTitle: "Cartes Menu",
      menuSubtitle: "Select an option:",
      mySubscription: "My subscription",
      typing: "Cartes is typing"
    })
  });

  const SUGGESTIONS = Object.freeze({
    es: Object.freeze([
      "¿La masonería es una religión?",
      "¿Qué representa la escuadra?",
      "¿Qué es la Cámara de Reflexiones?",
      "¿Por qué los masones utilizan mandil?"
    ]),
    en: Object.freeze([
      "Is Freemasonry a religion?",
      "What does the square represent?",
      "What is the Chamber of Reflection?",
      "Why do Freemasons wear aprons?"
    ])
  });

  const WEB_SEGMENT_EN = Object.freeze([
    ["Hola, soy Cartes, el asistente de Develando el Código Masónico.", "Hello, I am Cartes, the assistant for Develando el Código Masónico."],
    ["Puedo ayudarte con consultas sobre historia, simbolismo, filosofía y pensamiento masónico.", "I can help with questions about Masonic history, symbolism, philosophy, and thought."],
    ["También puedo revisar tus trabajos si tienes Cartes Plus.", "I can also review your papers if you have Cartes Plus."],
    ["¿Quieres borrar toda la conversación guardada? Si vinculaste WhatsApp, también se borrará el contexto compartido. Esta acción no se puede deshacer.", "Do you want to delete the entire saved conversation? If you linked WhatsApp, the shared context will also be deleted. This action cannot be undone."],
    ["Este navegador ya está vinculado con tu Cartes de WhatsApp.", "This browser is already linked with your Cartes account on WhatsApp."],
    ["Protege tu cuenta Cartes Plus: vincúlala con WhatsApp. Así podrás recuperar tu suscripción, consultas y conversación si cambias de navegador, borras los datos del sitio o pierdes esta sesión.", "Protect your Cartes Plus account by linking it with WhatsApp. This lets you recover your subscription, questions, and conversation if you change browsers, clear site data, or lose this session."],
    ["Envía desde el WhatsApp que deseas vincular:", "Send this from the WhatsApp account you want to link:"],
    ["Al enviarlo, tu cuenta Web y ese WhatsApp compartirán plan, consultas, suscripción y conversación.", "Once sent, your Web account and that WhatsApp account will share the same plan, questions, subscription, and conversation."],
    ["El código vence en", "The code expires in"],
    ["Intentaré abrir el chat de Cartes; si no se abre, usa “Abrir chat con Cartes” o “Copiar código”.", "I will try to open the Cartes chat. If it does not open, use “Open chat with Cartes” or “Copy code”."],
    ["El estado de Cartes no devolvió datos de uso válidos.", "The Cartes status did not return valid usage data."],
    ["No fue posible consultar el estado de uso.", "Unable to retrieve usage status."],
    ["Cartes Plus amplía tu conocimiento con más consultas, revisión y retroalimentación de documentos.", "Cartes Plus expands your access with more questions and document review feedback."],
    ["En cada revisión recibirás observaciones sobre estructura, claridad y contenido para mejorar tu trabajo antes de presentarlo en Logia.", "Each review provides feedback on structure, clarity, and content so you can improve your paper before presenting it in lodge."],
    ["La suscripción quedará vinculada a tu número de WhatsApp. Desde este mismo chat podrás consultar su estado o cancelarla.", "The subscription will be linked to your WhatsApp number. You can view its status or cancel renewal from this chat."],
    ["La versión gratuita está pensada para consultas puntuales. Cartes Plus es para quienes desean estudiar con mayor profundidad y recibir apoyo en la preparación de sus trabajos.", "The free plan is intended for occasional questions. Cartes Plus is for those who want to study in greater depth and receive support preparing their papers."],
    ["Para comenzar, selecciona “Suscribirme”.", "To begin, select “Subscribe”."],
    ["MXN al mes tendrás hasta", "MXN per month, you will receive up to"],
    ["documentos Word de hasta", "Word documents of up to"],
    ["cada uno.", "each."],
    ["Al utilizar Cartes aceptas sus Términos de uso y el Aviso de privacidad de Develando el Código Masónico.", "By using Cartes, you accept its Terms of Use and the Develando el Código Masónico Privacy Notice."],
    ["Tus mensajes y los documentos que envíes serán tratados únicamente para prestar el servicio y mejorar tu experiencia.", "Your messages and submitted documents will be processed only to provide the service and improve your experience."],
    ["Puedes consultar la información completa en nuestros términos y aviso de privacidad.", "You can review the complete information in our terms and privacy notice."],
    ["Para cualquier duda, escríbenos a soporte@develandoelcodigomasonico.com.", "For questions, email soporte@develandoelcodigomasonico.com."],
    ["Antes de continuar, confirma que leíste y aceptas los Términos de uso y el Aviso de privacidad de Cartes.", "Before continuing, confirm that you have read and accept the Cartes Terms of Use and Privacy Notice."],
    ["No se generará ningún enlace de pago ni se activará Cartes Plus. Puedes seguir utilizando Cartes y volver a Suscribirme cuando quieras.", "No payment link will be generated and Cartes Plus will not be activated. You can continue using Cartes and subscribe whenever you wish."],
    ["Gracias. Tu aceptación quedó registrada. Ahora selecciona el medio de pago que te resulte más conveniente.", "Thank you. Your acceptance has been recorded. Now select the payment method you prefer."],
    ["Tu cuenta ya tiene Cartes Plus vigente. Consulta “Mi suscripción” para revisar su estado y vigencia.", "Your account already has an active Cartes Plus plan. Select “My subscription” to review its status and validity."],
    ["Para recibir ayuda con Cartes, tu suscripción o un pago, escríbenos a soporte@develandoelcodigomasonico.com y cuéntanos brevemente qué ocurrió.", "For help with Cartes, your subscription, or a payment, email soporte@develandoelcodigomasonico.com and briefly describe what happened."],
    ["La revisión de documentos está disponible únicamente para Cartes Plus.", "Document review is available only with Cartes Plus."],
    ["Este tipo de archivo no es compatible. Cartes admite únicamente documentos Word en formato .doc o .docx para revisión.", "This file type is not supported. Cartes accepts only Word documents in .doc or .docx format for review."],
    ["El archivo no fue revisado y no se consumió ninguna revisión.", "The file was not reviewed and no review credit was used."],
    ["El archivo no se guardará después del procesamiento.", "The file will not be retained after processing."],
    ["¿Autorizas el procesamiento de este documento?", "Do you authorize processing this document?"],
    ["No se realizó ningún cambio. Tu número actual continúa vinculado a Cartes.", "No changes were made. Your current number remains linked to Cartes."],
    ["No se realizó ningún cambio. WhatsApp continúa vinculado a tu cuenta Cartes.", "No changes were made. WhatsApp remains linked to your Cartes account."],
    ["Entendido. No se realizó ningún cambio y la renovación de Cartes Plus continúa activa.", "Understood. No changes were made and your Cartes Plus renewal remains active."],
    ["La renovación de Cartes Plus ya estaba cancelada. Conservas tus beneficios hasta finalizar el periodo vigente.", "Cartes Plus renewal was already canceled. Your benefits remain available until the current period ends."],
    ["La renovación de Cartes Plus fue cancelada. Conservas tus beneficios hasta finalizar el periodo ya pagado.", "Cartes Plus renewal has been canceled. Your benefits remain available until the paid period ends."],
    ["WhatsApp quedó desvinculado de esta cuenta.", "WhatsApp has been unlinked from this account."],
    ["El número anterior ya no puede acceder a ella.", "The previous number can no longer access it."],
    ["Tu plan, consultas, revisiones y suscripción permanecen sin cambios.", "Your plan, questions, reviews, and subscription remain unchanged."],
    ["Puedes volver a vincular WhatsApp cuando quieras desde Vincular.", "You can link WhatsApp again at any time by selecting Connect."],
    ["Cartes Plus se activará en esta misma cuenta cuando el proveedor confirme el pago.", "Cartes Plus will be activated on this same account when the provider confirms payment."],
    ["Al confirmarse, el saldo se actualizará en la misma cuenta de Web y WhatsApp.", "Once confirmed, the balance will be updated on the same Web and WhatsApp account."],
    ["Escribe tu pregunta sobre historia, simbolismo o filosofía masónica y con gusto te ayudaré.", "Enter your question about Masonic history, symbolism, or philosophy and I will be glad to help."],
    ["Selecciona Aceptar para continuar o No aceptar para volver sin activar Cartes Plus.", "Select Accept to continue or Do not accept to return without activating Cartes Plus."],
    ["Selecciona Mercado Pago o PayPal para continuar.", "Select Mercado Pago or PayPal to continue."],
    ["Selecciona Mercado Pago o PayPal para comprar el paquete.", "Select Mercado Pago or PayPal to purchase the package."],
    ["Selecciona el medio de pago.", "Select a payment method."],
    ["Selecciona Cancelar renovación o Volver al menú.", "Select Cancel renewal or Back to menu."],
    ["Selecciona Sí, cancelar o No cancelar.", "Select Yes, cancel or Do not cancel."],
    ["Confirma si deseas iniciar el cambio de número.", "Confirm whether you want to start changing your number."],
    ["Confirma si deseas desvincular WhatsApp.", "Confirm whether you want to unlink WhatsApp."],
    ["Esta acción no cancela Cartes Plus ni modifica tu saldo o suscripción.", "This action does not cancel Cartes Plus or change your balance or subscription."],
    ["Tu número actual seguirá funcionando hasta que verifiques el nuevo número.", "Your current number will keep working until you verify the new number."],
    ["¿Confirmas que deseas cambiar el número de WhatsApp vinculado?", "Do you confirm that you want to change the linked WhatsApp number?"],
    ["Tu número actual seguirá funcionando hasta que el nuevo número sea verificado.", "Your current number will keep working until the new number is verified."],
    ["Tu plan, consultas, revisiones, suscripción y conversación permanecerán en la misma cuenta.", "Your plan, questions, reviews, subscription, and conversation will remain on the same account."],
    ["¿Confirmas que deseas desvincular WhatsApp?", "Do you confirm that you want to unlink WhatsApp?"],
    ["Ese número dejará de acceder a esta cuenta.", "That number will no longer have access to this account."],
    ["Tu plan, consultas, revisiones y suscripción permanecerán en Cartes Web y esta acción no cancela Cartes Plus.", "Your plan, questions, reviews, and subscription will remain in Cartes Web, and this action does not cancel Cartes Plus."],
    ["¿Confirmas que deseas cancelar la renovación de Cartes Plus?", "Do you confirm that you want to cancel Cartes Plus renewal?"],
    ["Conservarás tus beneficios hasta finalizar el periodo ya pagado.", "You will keep your benefits until the paid period ends."],
    ["El pago es único por", "This is a one-time payment of"],
    ["No es recurrente y las revisiones vencerán el", "It is non-recurring and the reviews will expire on"],
    ["El paquete incluye", "The package includes"],
    ["revisiones adicionales por", "additional reviews for"],
    ["en un solo pago.", "as a one-time payment."],
    ["está listo. Abre el enlace para completar la suscripción.", "is ready. Open the link to complete your subscription."],
    ["está listo.", "is ready."],
    ["Documento para revisión:", "Document for review:"],
    ["Cartes procesará temporalmente", "Cartes will temporarily process"],
    ["para validar que tenga un máximo de", "to verify that it has no more than"],
    ["páginas y, si cumple, realizar la revisión.", "pages and, if eligible, perform the review."],
    ["El documento supera el tamaño técnico máximo de", "The document exceeds the technical maximum size of"],
    ["Cartes devolvió una revisión vacía.", "Cartes returned an empty review."],
    ["Cartes no devolvió un código de cambio válido.", "Cartes did not return a valid number-change code."],
    ["Código generado:", "Code generated:"],
    ["Desde el NUEVO número de WhatsApp, abre el chat con Cartes y envía exactamente ese código.", "From the NEW WhatsApp number, open the Cartes chat and send that exact code."],
    ["Vence en", "It expires in"],
    ["minutos.", "minutes."],
    ["Tu número actual seguirá vinculado hasta que el nuevo complete la verificación.", "Your current number will remain linked until the new number completes verification."],
    ["No fue posible revisar el documento.", "The document could not be reviewed."],
    ["No fue posible obtener una respuesta.", "Unable to obtain an answer."],
    ["Cartes devolvió una respuesta vacía.", "Cartes returned an empty answer."],
    ["Ocurrió un error inesperado.", "An unexpected error occurred."],
    ["No fue posible consultar tu suscripción.", "Unable to retrieve your subscription."],
    ["No fue posible cancelar la renovación.", "Unable to cancel renewal."],
    ["No fue posible iniciar el pago.", "Unable to start payment."],
    ["No fue posible iniciar la compra.", "Unable to start the purchase."],
    ["No se pudo iniciar la vinculación.", "Unable to start linking."],
    ["No fue posible iniciar el cambio de número.", "Unable to start the number change."],
    ["No fue posible desvincular WhatsApp.", "Unable to unlink WhatsApp."],
    ["No encontré una suscripción recurrente asociada a tu cuenta.", "I did not find a recurring subscription associated with your account."],
    ["No encontré una suscripción cancelable de Mercado Pago o PayPal.", "I did not find a Mercado Pago or PayPal subscription that can be canceled."],
    ["Debes aceptar los Términos y el Aviso de privacidad antes de continuar.", "You must accept the Terms and Privacy Notice before continuing."],
    ["Proveedor de pago no soportado.", "Unsupported payment provider."],
    ["Los paquetes adicionales están disponibles únicamente para Cartes Plus vigente.", "Additional packages are available only with an active Cartes Plus plan."],
    ["Ya compraste los 2 paquetes adicionales permitidos durante este periodo de Cartes Plus.", "You have already purchased the two additional packages allowed during this Cartes Plus period."],
    ["No fue posible determinar la fecha de vencimiento del periodo Plus vigente.", "Unable to determine the expiration date of the current Plus period."],
    ["No fue posible obtener la configuración de Cartes.", "Unable to retrieve the Cartes configuration."],
    ["La configuración de límites de Cartes es inválida.", "The Cartes limits configuration is invalid."],
    ["La pregunta supera el máximo de", "The question exceeds the maximum of"],
    ["caracteres.", "characters."],
    ["Sin suscripción recurrente", "No recurring subscription"],
    ["Cartes gratuito", "Cartes Free"],
    ["Consultas usadas:", "Questions used:"],
    ["Consultas disponibles:", "Questions available:"],
    ["consulta disponible", "question available"],
    ["consultas disponibles", "questions available"],
    ["Revisiones de documentos disponibles:", "Document reviews available:"],
    ["Revisiones disponibles:", "Reviews available:"],
    ["revisión disponible", "review available"],
    ["revisiones disponibles", "reviews available"],
    ["Paquetes adicionales:", "Additional packages:"],
    ["Fecha de vencimiento:", "Expiration date:"],
    ["Renovación de consultas gratuitas:", "Free question renewal:"],
    ["Renovación:", "Renewal:"],
    ["Periodo gratuito: comienza con la primera consulta válida respondida por Cartes", "Free period: begins with the first valid question answered by Cartes"],
    ["Medio de pago:", "Payment method:"],
    ["No aplica", "Not applicable"],
    ["Cancelada", "Canceled"],
    ["Conversar con Cartes", "Talk with Cartes"],
    ["Revisar documento", "Review document"],
    ["Conoce Cartes Plus", "Learn about Cartes Plus"],
    ["Suscribirme", "Subscribe"],
    ["Mi suscripción", "My subscription"],
    ["Ayuda y soporte", "Help and support"],
    ["Privacidad y términos", "Privacy and terms"],
    ["Idioma / Language", "Language"],
    ["Cambiar número de WhatsApp", "Change WhatsApp number"],
    ["Desvincular WhatsApp", "Unlink WhatsApp"],
    ["Comprar", "Buy"],
    ["Cancelar renovación", "Cancel renewal"],
    ["Volver al menú", "Back to menu"],
    ["Contratar Plus", "Get Plus"],
    ["Sí, generar código", "Yes, generate code"],
    ["No cambiar", "Do not change"],
    ["Sí, desvincular", "Yes, unlink"],
    ["No desvincular", "Do not unlink"],
    ["Sí, cancelar", "Yes, cancel"],
    ["No cancelar", "Do not cancel"],
    ["No aceptar", "Do not accept"],
    ["Aceptar", "Accept"],
    ["Ver Términos de uso", "View Terms of Use"],
    ["Ver Aviso de privacidad", "View Privacy Notice"],
    ["Abrir chat con Cartes", "Open chat with Cartes"],
    ["Copiar código", "Copy code"],
    ["Código copiado", "Code copied"],
    ["Abrir ", "Open "],
    ["Aviso de privacidad:", "Privacy Notice:"],
    ["Términos:", "Terms:"],
    ["revisiones mensuales", "monthly reviews"],
    ["consultas gratuitas", "free questions"],
    ["consultas", "questions"],
    ["revisiones", "reviews"],
    ["páginas", "pages"],
    ["al mes", "per month"],
    ["estarán disponibles nuevamente el", "will be available again on"],
    ["Ya utilizaste las", "You have used all"],
    ["de este periodo.", "for this period."],
    ["Si quieres seguir conversando con Cartes ahora, puedes activar Cartes Plus por", "To continue talking with Cartes now, you can activate Cartes Plus for"]
  ]);

  let currentLocale = loadPreferredLocaleWeb();

  function normalizeLocaleWeb(value) {
    return String(value || "").trim().toLowerCase().startsWith("en") ? "en" : "es";
  }

  function t(key) {
    return UI_TEXT[currentLocale]?.[key] || UI_TEXT.es[key] || key;
  }

  function getSuggestionsWeb() {
    return SUGGESTIONS[currentLocale] || SUGGESTIONS.es;
  }

  function translateWebText(value) {
    const text = String(value ?? "");
    if (currentLocale !== "en" || !text) return text;

    let result = text;
    for (const [spanish, english] of WEB_SEGMENT_EN) {
      result = result.split(spanish).join(english);
    }

    return result
      .replace(/\/cartes-whatsapp\/terminos\.html/g, "/cartes-whatsapp/terms.html")
      .replace(/\/cartes-whatsapp\/privacy\.html/g, "/cartes-whatsapp/privacy-en.html")
      .replace(/\/cartes-whatsapp\/suscripcion\.html/g, "/cartes-whatsapp/subscription.html");
  }

  const history = sanitizeLegacyMenuNoise(loadHistory());
  const webIdentity = loadOrCreateWebIdentity();
  let busy = false;
  let webSubscriptionFlow = "";
  let currentWebPlan = "gratuito";
  let currentQueryLimits = null;
  let currentReviewLimits = null;
  let currentPlusPrice = null;
  let currentReviewPackPrice = null;
  let currentReviewPackSize = null;
  let currentReviewPackMaxPerPeriod = null;
  let currentDocumentMaxPages = null;
  let currentDocumentMaxMb = null;
  let currentLinkCodeTtlMinutes = null;
  let recoveryNoticeShown = false;
  let reviewStatusLoading = false;
  let currentReviewPackExpiration = "";
  let subscriptionCheckoutPending = false;
  let subscriptionRefreshLoading = false;

  loadStyles();
  const ui = createInterface();
  restoreConversation();

  // El estado de cuenta se solicita al cargar Cartes, no solamente cuando
  // el usuario abre el panel. Esto evita que el encabezado quede en "…".
  void initializeServerState();

  // CARTES_REVIEW_PACKS_WEB_V091
  // CARTES_SUBSCRIPTION_AUTO_REFRESH_V132
  window.addEventListener("focus", () => {
    void refreshAccountAfterCheckoutWeb();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void refreshAccountAfterCheckoutWeb();
    }
  });

  async function initializeServerState() {
    await Promise.allSettled([
      refreshPublicQueryLimitsWeb(),
      syncConversationFromServer(),
      refreshLinkStatus({ retries: 3 })
    ]);
  }

  async function refreshPublicQueryLimitsWeb() {
    const response = await fetch(CONFIG.publicConfigEndpoint, {
      method: "GET",
      cache: "no-store"
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error || "No fue posible obtener la configuración de Cartes."
      );
    }

    const gratuito = Number(data?.query_limits?.gratuito);
    const plus = Number(data?.query_limits?.plus);
    const reviewPlus = Number(data?.review_limits?.plus);
    const plusPrice = Number(data?.pricing?.plus_mxn);
    const reviewPackPrice = Number(data?.pricing?.review_pack_mxn);
    const reviewPackSize = Number(data?.review_pack?.size);
    const reviewPackMaxPerPeriod = Number(data?.review_pack?.max_per_period);
    const documentMaxPages = Number(data?.document_limits?.max_pages);
    const documentMaxMb = Number(data?.document_limits?.max_mb);
    const linkCodeTtlMinutes = Number(data?.link_code_ttl_minutes);

    if (
      !Number.isSafeInteger(gratuito) ||
      gratuito <= 0 ||
      !Number.isSafeInteger(plus) ||
      plus <= gratuito ||
      !Number.isSafeInteger(reviewPlus) ||
      reviewPlus <= 0 ||
      !Number.isSafeInteger(plusPrice) ||
      plusPrice <= 0 ||
      !Number.isSafeInteger(reviewPackPrice) ||
      reviewPackPrice <= 0 ||
      !Number.isSafeInteger(reviewPackSize) ||
      reviewPackSize <= 0 ||
      !Number.isSafeInteger(reviewPackMaxPerPeriod) ||
      reviewPackMaxPerPeriod <= 0 ||
      !Number.isSafeInteger(documentMaxPages) ||
      documentMaxPages <= 0 ||
      !Number.isSafeInteger(documentMaxMb) ||
      documentMaxMb <= 0 ||
      !Number.isSafeInteger(linkCodeTtlMinutes) ||
      linkCodeTtlMinutes <= 0
    ) {
      throw new Error("La configuración de límites de Cartes es inválida.");
    }

    currentQueryLimits = Object.freeze({
      gratuito,
      plus
    });

    currentReviewLimits = Object.freeze({
      plus: reviewPlus
    });

    currentPlusPrice = plusPrice;
    currentReviewPackPrice = reviewPackPrice;
    currentReviewPackSize = reviewPackSize;
    currentReviewPackMaxPerPeriod = reviewPackMaxPerPeriod;
    currentDocumentMaxPages = documentMaxPages;
    currentDocumentMaxMb = documentMaxMb;
    currentLinkCodeTtlMinutes = linkCodeTtlMinutes;

    return currentQueryLimits;
  }

  async function getQueryLimitsWeb() {
    return currentQueryLimits || await refreshPublicQueryLimitsWeb();
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
    launcher.setAttribute("aria-label", t("open"));
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
    shell.setAttribute("aria-label", t("dialog"));
    shell.innerHTML = `
      <header class="gm-header">
        <div class="gm-header__identity">
          <img class="gm-header__logo" src="/assets/img/cartes-isotipo.gif" alt="Cartes">
          <div class="gm-header__identity-text">
            <h2 class="gm-header__title">Cartes</h2>
          </div>
        </div>
        <div class="gm-header__actions">
          <div class="gm-language" role="group" aria-label="${t("language")}" title="${t("language")}">
            <button
              class="gm-language__option${currentLocale === "es" ? " is-active" : ""}"
              type="button"
              data-locale="es"
              aria-pressed="${currentLocale === "es" ? "true" : "false"}"
            >ES</button>
            <span class="gm-language__separator" aria-hidden="true">|</span>
            <button
              class="gm-language__option${currentLocale === "en" ? " is-active" : ""}"
              type="button"
              data-locale="en"
              aria-pressed="${currentLocale === "en" ? "true" : "false"}"
            >EN</button>
          </div>
          <button class="gm-link" type="button" aria-label="${t("linkLabel")}" title="${t("linkTitle")}">${t("link")}</button>
          <button class="gm-clear" type="button" aria-label="${t("clearLabel")}" title="${t("clearLabel")}">
            <span aria-hidden="true">↺</span>
            <span class="gm-clear__label">${t("clear")}</span>
          </button>
          <button class="gm-close" type="button" aria-label="${t("close")}">×</button>
        </div>
        <div class="gm-header__subtitle gm-header__status">${t("subtitle")}</div>
        <div class="gm-header__metrics">
          <div class="gm-header__usage" aria-live="polite">${t("usageLoading")}</div>
          <div class="gm-header__reviews" aria-live="polite" hidden>${t("reviewsLoading")}</div>
        </div>
      </header>
      <div class="gm-messages" aria-live="polite" aria-label="${t("conversation")}"></div>
      <div class="gm-suggestions" aria-label="${t("suggestions")}"></div>
      <div>
        <input
          class="gm-document-input"
          type="file"
          accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
          hidden
        >
        <form class="gm-form">
          <textarea class="gm-input" rows="1" maxlength="${CONFIG.maxChars}" placeholder="${t("placeholder")}" aria-label="${t("question")}"></textarea>
          <button class="gm-send" type="submit" aria-label="${t("send")}">➤</button>
        </form>
        <p class="gm-footer-note">${t("disclaimer")}</p>
      </div>
    `;

    document.body.append(launcher, shell);

    const close = shell.querySelector(".gm-close");
    const clear = shell.querySelector(".gm-clear");
    const link = shell.querySelector(".gm-link");
    const language = shell.querySelector(".gm-language");
    const form = shell.querySelector(".gm-form");
    const input = shell.querySelector(".gm-input");
    const send = shell.querySelector(".gm-send");
    const messages = shell.querySelector(".gm-messages");
    const suggestionBox = shell.querySelector(".gm-suggestions");
    const usage = shell.querySelector(".gm-header__usage");
    const reviewsUsage = shell.querySelector(".gm-header__reviews");
    const documentInput = shell.querySelector(".gm-document-input");

    getSuggestionsWeb().forEach((question) => {
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
    language.addEventListener("click", (event) => {
      const option = event.target.closest(".gm-language__option");
      if (!option) return;

      void setLocaleWeb(option.dataset.locale, {
        sync: true,
        announce: true
      });
    });

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
      language,
      usage,
      reviewsUsage,
      documentInput
    };
  }

  function setLocalizedText(element, source) {
    if (!element) return;
    const original = String(source ?? "");
    element.dataset.cartesI18nSource = original;
    element.textContent = translateWebText(original);
  }

  function applyStaticLocaleWeb() {
    if (!ui) return;

    ui.language
      .querySelectorAll(".gm-language__option")
      .forEach((option) => {
        const active = option.dataset.locale === currentLocale;
        option.classList.toggle("is-active", active);
        option.setAttribute("aria-pressed", active ? "true" : "false");
      });
    ui.launcher.setAttribute("aria-label", t("open"));
    ui.shell.setAttribute("aria-label", t("dialog"));
    ui.link.setAttribute("aria-label", t("linkLabel"));
    ui.link.setAttribute("title", t("linkTitle"));
    ui.link.textContent = ui.link.dataset.linked === "true" ? t("linked") : t("link");
    ui.shell.querySelector(".gm-clear")?.setAttribute("aria-label", t("clearLabel"));
    ui.shell.querySelector(".gm-clear")?.setAttribute("title", t("clearLabel"));
    const clearLabel = ui.shell.querySelector(".gm-clear__label");
    if (clearLabel) clearLabel.textContent = t("clear");
    ui.shell.querySelector(".gm-close")?.setAttribute("aria-label", t("close"));
    const subtitle = ui.shell.querySelector(".gm-header__subtitle");
    if (subtitle) subtitle.textContent = t("subtitle");
    ui.messages.setAttribute("aria-label", t("conversation"));
    ui.suggestionBox.setAttribute("aria-label", t("suggestions"));
    ui.input.placeholder = t("placeholder");
    ui.input.setAttribute("aria-label", t("question"));
    ui.send.setAttribute("aria-label", t("send"));
    ui.language.setAttribute("aria-label", t("language"));
    ui.language.setAttribute("title", t("language"));
    const footer = ui.shell.querySelector(".gm-footer-note");
    if (footer) footer.textContent = t("disclaimer");

    if (ui.usage.dataset.state === "ready") {
      renderUsageFromDatasetWeb();
    } else {
      ui.usage.textContent = t("usageLoading");
    }

    if (ui.reviewsUsage.dataset.state === "ready") {
      renderReviewUsageFromDatasetWeb();
    } else {
      ui.reviewsUsage.textContent = t("reviewsLoading");
    }

    ui.shell.querySelectorAll("[data-cartes-i18n-source]").forEach((element) => {
      element.textContent = translateWebText(element.dataset.cartesI18nSource || "");
    });

    if (ui.suggestionBox.classList.contains("gm-suggestions--main-menu")) {
      renderMenuButtonsWeb();
    } else if (!webSubscriptionFlow) {
      restoreDefaultSuggestionsWeb();
    }
  }

  async function setLocaleWeb(value, { sync = true, announce = false } = {}) {
    const nextLocale = normalizeLocaleWeb(value);
    const changed = nextLocale !== currentLocale;
    currentLocale = nextLocale;

    try {
      localStorage.setItem(CONFIG.localeKey, currentLocale);
    } catch {}

    applyStaticLocaleWeb();

    if (sync) {
      try {
        const response = await fetch(CONFIG.linkEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Cartes-Locale": currentLocale
          },
          body: JSON.stringify({
            action: "locale_set",
            web_identity: webIdentity,
            locale: currentLocale
          }),
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Unable to save the Cartes language preference.");
        }
      } catch (error) {
        console.warn("CARTES_WEB_LOCALE_SYNC_V140", error);
      }
    }

    if (announce && changed) {
      addMessage(
        "assistant",
        currentLocale === "en"
          ? "Language changed to English. Your preference is shared with Cartes on WhatsApp."
          : "Idioma cambiado a español. Tu preferencia se comparte con Cartes en WhatsApp.",
        false
      );
    }
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

    const confirmed = window.confirm(translateWebText(
      "¿Quieres borrar toda la conversación guardada? Si vinculaste WhatsApp, también se borrará el contexto compartido. Esta acción no se puede deshacer."
    ));

    if (!confirmed) return;

    try {
      await fetch(CONFIG.conversationEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear", web_identity: webIdentity, locale: currentLocale })
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
        body: JSON.stringify({ action: "history", web_identity: webIdentity, locale: currentLocale })
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
    setLocalizedText(abrir, "Abrir chat con Cartes");
    abrir.addEventListener("click", () => {
      window.open(url, "_blank", "noopener,noreferrer");
    });

    const copiar = document.createElement("button");
    copiar.type = "button";
    copiar.className = "gm-suggestion";
    setLocalizedText(copiar, "Copiar código");
    copiar.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(instruction);
        setLocalizedText(copiar, "Código copiado");
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
        setLocalizedText(copiar, "Código copiado");
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
        body: JSON.stringify({ action: "start", web_identity: webIdentity, locale: currentLocale })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "No se pudo iniciar la vinculación.");
      }

      updateUsage(data.usage);

      if (data.linked) {
        ui.link.textContent = t("linked");
        ui.link.dataset.linked = "true";
        addMessage("assistant", "Este navegador ya está vinculado con tu Cartes de WhatsApp.", false);
        return;
      }

      const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(data.instruction)}`;

      addMessage(
        "assistant",
        `Envía desde el WhatsApp que deseas vincular: ${data.instruction}. Al enviarlo, tu cuenta Web y ese WhatsApp compartirán plan, consultas, suscripción y conversación. El código vence en ${currentLinkCodeTtlMinutes} minutos. Intentaré abrir el chat de Cartes; si no se abre, usa “Abrir chat con Cartes” o “Copiar código”.`,
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
          body: JSON.stringify({ action: "status", web_identity: webIdentity, locale: currentLocale }),
          cache: "no-store"
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data.locale && normalizeLocaleWeb(data.locale) !== currentLocale) {
          await setLocaleWeb(data.locale, { sync: false, announce: false });
        }

        // Incluso si el endpoint responde con error, intentamos recuperar
        // cualquier bloque usage válido incluido en la respuesta.
        const usageUpdated = updateUsage(data.usage);

        if (response.ok) {
          if (data.linked) {
            ui.link.textContent = t("linked");
            ui.link.disabled = true;
            ui.link.dataset.linked = "true";
          } else {
            ui.link.textContent = t("link");
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
      "ver mi suscripcion",
      "subscription",
      "my subscription",
      "subscription status",
      "view my subscription"
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
          web_identity: webIdentity,
          locale: currentLocale
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
        formatCartesDateWeb(expirationRaw, currentLocale) ||
        "No aplica";

      const renewal =
        subscription?.renovacion_cancelada
          ? "Cancelada"
          : (
              formatCartesDateWeb(subscription?.next_payment_date, currentLocale) ||
              "No aplica"
            );

      const packagesBought =
        Number(reviews.paquetes_comprados || 0);

      const packagesMax =
        Number(reviews.paquetes_maximo ?? currentReviewPackMaxPerPeriod);

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
            label: `Comprar ${currentReviewPackSize} revisiones - $${currentReviewPackPrice}`,
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
              web_identity: webIdentity,
              locale: currentLocale
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
        `Código generado: ${instruction}\n\nDesde el NUEVO número de WhatsApp, abre el chat con Cartes y envía exactamente ese código. Vence en ${currentLinkCodeTtlMinutes} minutos. Tu número actual seguirá vinculado hasta que el nuevo complete la verificación.`,
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
              web_identity: webIdentity,
              locale: currentLocale
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
      if (currentLocale === "en") {
        ui.link.textContent = "Connect";
      }
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
  function formatCartesDateWeb(value, locale = currentLocale) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const months = normalizeLocaleWeb(locale) === "en"
      ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      : ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

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

    const remaining = Number(ui?.usage?.dataset?.remaining);
    if (
      ui?.usage?.dataset?.state === "ready" &&
      Number.isFinite(remaining) &&
      remaining <= 0
    ) {
      return;
    }

    getSuggestionsWeb().forEach((question) => {
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
          web_identity: webIdentity,
          locale: currentLocale
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

  // CARTES_SUBSCRIPTION_AUTO_REFRESH_V132
  async function refreshAccountAfterCheckoutWeb() {
    if (subscriptionRefreshLoading) return false;

    if (
      !subscriptionCheckoutPending &&
      currentWebPlan !== "plus"
    ) {
      return false;
    }

    subscriptionRefreshLoading = true;

    try {
      const retries =
        subscriptionCheckoutPending ? 7 : 0;

      for (
        let attempt = 0;
        attempt <= retries;
        attempt += 1
      ) {
        const refreshed =
          await refreshMenuPlanWeb();

        if (
          refreshed &&
          currentWebPlan === "plus"
        ) {
          subscriptionCheckoutPending = false;
          await refreshReviewStatus();
          return true;
        }

        if (
          !subscriptionCheckoutPending ||
          attempt >= retries
        ) {
          subscriptionCheckoutPending = false;
          return refreshed;
        }

        await wait(1500);
      }

      subscriptionCheckoutPending = false;
      return false;
    }
    finally {
      subscriptionRefreshLoading = false;
    }
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
      ["6", "Privacidad y términos"],
      ["8", "Idioma / Language"]
    ];

    ui.suggestionBox.replaceChildren();

    const heading = document.createElement("div");
    heading.className = "gm-menu-heading";

    const title = document.createElement("div");
    title.className = "gm-menu-heading__title";
    title.textContent = t("menuTitle");

    const subtitle = document.createElement("div");
    subtitle.className = "gm-menu-heading__subtitle";
    subtitle.textContent = t("menuSubtitle");

    heading.append(title, subtitle);
    ui.suggestionBox.appendChild(heading);

    options.forEach(([id, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gm-suggestion";
      setLocalizedText(button, label);
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
      "hola quiero conocer a cartes",
      "hello",
      "hi",
      "good morning",
      "good afternoon",
      "good evening",
      "hello i want to meet cartes",
      "options"
    ]).has(normalizarComandoWeb(texto));
  }

  function resolverOpcionMenuWeb(texto) {
    const opciones = {
      "1": "conversar",
      "conversar": "conversar",
      "conversar con cartes": "conversar",
      "talk": "conversar",
      "talk with cartes": "conversar",

      "2": "plus_info",
      "conocer cartes plus": "plus_info",
      "conoce cartes plus": "plus_info",
      "cartes plus": "plus_info",
      "learn about cartes plus": "plus_info",

      "3": "suscribirme",
      "suscribirme": "suscribirme",
      "subscribe": "suscribirme",
      "subscribe to cartes plus": "suscribirme",

      "4": "mi_suscripcion",
      "mi suscripcion": "mi_suscripcion",
      "suscripcion": "mi_suscripcion",
      "estado de mi suscripcion": "mi_suscripcion",
      "ver mi suscripcion": "mi_suscripcion",
      "my subscription": "mi_suscripcion",
      "subscription": "mi_suscripcion",
      "subscription status": "mi_suscripcion",

      "5": "ayuda",
      "ayuda y soporte": "ayuda",
      "help": "ayuda",
      "help and support": "ayuda",
      "support": "ayuda",

      "6": "legal",
      "privacidad y terminos": "legal",
      "privacy and terms": "legal",
      "privacy": "legal",
      "terms": "legal",

      "7": "revisar_documento",
      "revisar documento": "revisar_documento",
      "revisar un documento": "revisar_documento",
      "revision de documento": "revisar_documento",
      "review document": "revisar_documento",
      "review a document": "revisar_documento",
      "document review": "revisar_documento",
      "privacidad": "legal",
      "terminos": "legal",

      "8": "language",
      "idioma": "language",
      "cambiar idioma": "language",
      "language": "language",
      "change language": "language"
    };

    return opciones[normalizarComandoWeb(texto)] || "";
  }

  async function ejecutarOpcionMenuWeb(opcion) {
    const id = resolverOpcionMenuWeb(opcion) || String(opcion || "").trim();

    if (id === "language") {
      addMessage(
        "assistant",
        currentLocale === "en"
          ? "Choose the Cartes language. Your preference will be shared between Web and WhatsApp."
          : "Selecciona el idioma de Cartes. La preferencia se compartirá entre Web y WhatsApp.",
        false
      );

      ui.suggestionBox.classList.add("gm-suggestions--menu");
      ui.suggestionBox.classList.remove("gm-suggestions--main-menu");
      ui.suggestionBox.replaceChildren();

      const spanish = document.createElement("button");
      spanish.type = "button";
      spanish.className = "gm-suggestion";
      spanish.textContent = "Español";
      spanish.addEventListener("click", async () => {
        await setLocaleWeb("es", { sync: true, announce: true });
        await mostrarMenuWeb();
      });

      const english = document.createElement("button");
      english.type = "button";
      english.className = "gm-suggestion";
      english.textContent = "English";
      english.addEventListener("click", async () => {
        await setLocaleWeb("en", { sync: true, announce: true });
        await mostrarMenuWeb();
      });

      const back = document.createElement("button");
      back.type = "button";
      back.className = "gm-suggestion gm-suggestion--secondary";
      setLocalizedText(back, "Volver al menú");
      back.addEventListener("click", () => void mostrarMenuWeb());

      ui.suggestionBox.append(spanish, english, back);
      return;
    }

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
      const queryLimits = await getQueryLimitsWeb();

      addMessage(
        "assistant",
        `Cartes Plus amplía tu conocimiento con más consultas, revisión y retroalimentación de documentos.\n\nPor $${currentPlusPrice} MXN al mes tendrás hasta ${queryLimits.plus} consultas y ${currentReviewLimits.plus} revisiones mensuales de documentos Word de hasta ${currentDocumentMaxPages} páginas cada uno.\n\nEn cada revisión recibirás observaciones sobre estructura, claridad y contenido para mejorar tu trabajo antes de presentarlo en Logia.\n\nLa suscripción quedará vinculada a tu número de WhatsApp. Desde este mismo chat podrás consultar su estado o cancelarla.\n\nLa versión gratuita está pensada para consultas puntuales. Cartes Plus es para quienes desean estudiar con mayor profundidad y recibir apoyo en la preparación de sus trabajos.\n\nPara comenzar, selecciona “Suscribirme”.`,
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
      await mostrarEstadoSuscripcionWeb(t("mySubscription"));
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
      const privacyUrl = `${window.location.origin}/cartes-whatsapp/${currentLocale === "en" ? "privacy-en.html" : "privacy.html"}`;
      const termsUrl = `${window.location.origin}/cartes-whatsapp/${currentLocale === "en" ? "terms.html" : "terminos.html"}`;

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
      setLocalizedText(button, label);
      button.addEventListener("click", () => submitQuestion(value));
      ui.suggestionBox.appendChild(button);
    });
  }

  function addLegalMessageWeb() {
    const message = document.createElement("div");
    message.className = "gm-message gm-message--assistant gm-message--legal";

    const intro = document.createElement("p");
    setLocalizedText(
      intro,
      "Antes de continuar, confirma que leíste y aceptas los Términos de uso y el Aviso de privacidad de Cartes."
    );

    const links = document.createElement("div");
    links.className = "gm-legal-links";

    const terms = document.createElement("a");
    terms.className = "gm-legal-link";
    terms.href = `${window.location.origin}/cartes-whatsapp/${currentLocale === "en" ? "terms.html" : "terminos.html"}`;
    terms.target = "_blank";
    terms.rel = "noopener noreferrer";
    setLocalizedText(terms, "Ver Términos de uso");

    const privacy = document.createElement("a");
    privacy.className = "gm-legal-link";
    privacy.href = `${window.location.origin}/cartes-whatsapp/${currentLocale === "en" ? "privacy-en.html" : "privacy.html"}`;
    privacy.target = "_blank";
    privacy.rel = "noopener noreferrer";
    setLocalizedText(privacy, "Ver Aviso de privacidad");

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

  function mostrarAccionPagoWeb(provider, url, { trackSubscription = false } = {}) {
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
    setLocalizedText(button, `Abrir ${provider}`);
    button.addEventListener("click", () => {
      if (trackSubscription) {
        subscriptionCheckoutPending = true;
      }

      window.open(url, "_blank", "noopener,noreferrer");
    });

    const back = document.createElement("button");
    back.type = "button";
    back.className = "gm-suggestion gm-suggestion--secondary";
    setLocalizedText(back, "Volver al menú");
    back.addEventListener("click", () => {
      void mostrarMenuWeb();
    });

    wrapper.append(button, back);
    ui.messages.appendChild(wrapper);
    ui.messages.scrollTop = ui.messages.scrollHeight;
  }

  async function mostrarLimiteGratuitoWeb(usage) {
    const queryLimits = await getQueryLimitsWeb();
    const freeLimit = queryLimits.gratuito;
    const plusLimit = queryLimits.plus;

    const cycleEnd =
      formatCartesDateWeb(usage?.cycle_end, currentLocale);

    const renewalLine =
      cycleEnd
        ? `\n\nTus ${freeLimit} consultas gratuitas estarán disponibles nuevamente el ${cycleEnd}.`
        : "";

    addMessage(
      "assistant",
      `Consultas disponibles: 0 de ${freeLimit}\n\n` +
        `Ya utilizaste las ${freeLimit} consultas gratuitas de este periodo.` +
        renewalLine +
        `\n\nSi quieres seguir conversando con Cartes ahora, puedes activar Cartes Plus por $${currentPlusPrice} MXN al mes, con hasta ${plusLimit} consultas y ${currentReviewLimits.plus} revisiones de documentos Word.`,
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
      if (["no aceptar", "no acepto", "rechazar", "do not accept", "i do not accept", "decline"].includes(normalized)) {
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

      if (!["acepto", "aceptar", "si", "accept", "i accept", "yes"].includes(normalized)) {
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
      if (["no", "no cambiar", "cancelar", "do not change", "cancel"].includes(normalized)) {
        webSubscriptionFlow = "";

        addMessage(
          "assistant",
          "No se realizó ningún cambio. Tu número actual continúa vinculado a Cartes.",
          false
        );

        restoreDefaultSuggestionsWeb();
        return true;
      }

      if (!["si", "confirmar", "generar codigo", "yes", "confirm", "generate code"].includes(normalized)) {
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
      if (["no", "no desvincular", "cancelar", "do not unlink", "cancel"].includes(normalized)) {
        webSubscriptionFlow = "";

        addMessage(
          "assistant",
          "No se realizó ningún cambio. WhatsApp continúa vinculado a tu cuenta Cartes.",
          false
        );

        restoreDefaultSuggestionsWeb();
        return true;
      }

      if (!["si", "sí", "confirmar", "si desvincular", "yes", "confirm", "yes unlink"].includes(normalized)) {
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
          "cambiar mi numero whatsapp",
          "change whatsapp number",
          "change my whatsapp number"
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
          "quitar whatsapp",
          "unlink whatsapp",
          "unlink my whatsapp"
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
          `comprar ${currentReviewPackSize} revisiones`,
          "paquete de revisiones",
          "buy reviews",
          `buy ${currentReviewPackSize} reviews`,
          "review package"
        ].includes(normalized)
      ) {
        webSubscriptionFlow = "review_pack_provider";

        const expiration =
          formatCartesDateWeb(currentReviewPackExpiration, currentLocale) ||
          "el vencimiento de tu periodo Plus vigente";

        addMessage(
          "assistant",
          `El paquete incluye ${currentReviewPackSize} revisiones adicionales por $${currentReviewPackPrice} MXN en un solo pago. No es recurrente y las revisiones vencerán el ${expiration}.\n\nSelecciona el medio de pago.`,
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
          "darme de baja",
          "cancel",
          "cancel renewal",
          "cancel subscription"
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
      if (["no", "no cancelar", "volver", "do not cancel", "back"].includes(normalized)) {
        webSubscriptionFlow = "";

        addMessage(
          "assistant",
          "Entendido. No se realizó ningún cambio y la renovación de Cartes Plus continúa activa.",
          false
        );

        await mostrarMenuWeb();
        return true;
      }

      if (!["si", "sí", "yes"].includes(normalized)) {
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
            web_identity: webIdentity,
            locale: currentLocale
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
        await mostrarEstadoSuscripcionWeb(t("mySubscription"));

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
            web_identity: webIdentity,
            locale: currentLocale
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
        mostrarAccionPagoWeb(providerLabel, data.url, { trackSubscription: true });
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
        ["menu", "volver al menu", "inicio", "opciones", "back to menu", "home", "options"].includes(normalized)
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
              web_identity: webIdentity,
              locale: currentLocale
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
          `${providerLabel} está listo. El pago es único por $${currentReviewPackPrice} MXN e incluye ${currentReviewPackSize} revisiones adicionales. Al confirmarse, el saldo se actualizará en la misma cuenta de Web y WhatsApp.`,
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
      ui.reviewsUsage.textContent = t("reviewsLoading");
    }
  }

  function renderReviewUsageFromDatasetWeb() {
    if (!ui?.reviewsUsage) return;

    const restantes = Number(ui.reviewsUsage.dataset.remaining);
    if (!Number.isFinite(restantes)) return;

    ui.reviewsUsage.textContent = currentLocale === "en"
      ? `Document reviews available: ${restantes}`
      : `Revisiones de documentos disponibles: ${restantes}`;

    ui.reviewsUsage.title = currentLocale === "en"
      ? `${restantes} ${restantes === 1 ? "review available" : "reviews available"}`
      : `${restantes} ${restantes === 1 ? "revisión disponible" : "revisiones disponibles"}`;
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

    ui.reviewsUsage.dataset.state = "ready";
    ui.reviewsUsage.dataset.remaining =
      String(restantes);
    ui.reviewsUsage.dataset.limit =
      String(total);

    renderReviewUsageFromDatasetWeb();

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
            web_identity: webIdentity,
            locale: currentLocale
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
      currentDocumentMaxMb * 1024 * 1024;

    if (
      Number(file?.size || 0) > maxBytes
    ) {
      addMessage(
        "assistant",
        `El documento supera el tamaño técnico máximo de ${currentDocumentMaxMb} MB.`,
        false,
        true
      );

      ui.documentInput.value = "";
      return;
    }

    const accepted = window.confirm(translateWebText(
      `Cartes procesará temporalmente "${name}" para validar que tenga un máximo de ${currentDocumentMaxPages} páginas y, si cumple, realizar la revisión. El archivo no se guardará después del procesamiento.\n\n¿Autorizas el procesamiento de este documento?`
    ));

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
        "locale",
        currentLocale
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
      "hello",
      "hi",
      "good morning",
      "good afternoon",
      "good evening",
      "thanks",
      "thank you",
      "ready",
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
          locale: currentLocale,
          client: {
            channel: "web",
            external_user_id: webIdentity,
            request_id: createRequestId(),
            locale: currentLocale
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
          await mostrarLimiteGratuitoWeb(data.usage);
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
        await mostrarLimiteGratuitoWeb(data.usage);
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

    ui.usage.dataset.plan = String(usage.plan || "gratuito");
    ui.usage.dataset.state = "ready";
    ui.usage.dataset.remaining = String(restantes);
    ui.usage.dataset.limit = String(total);

    renderUsageFromDatasetWeb();

    if (
      restantes <= 0 &&
      !ui.suggestionBox.classList.contains("gm-suggestions--menu")
    ) {
      ui.suggestionBox.replaceChildren();
    }

    return true;
  }

  function renderUsageFromDatasetWeb() {
    if (!ui?.usage) return;

    const remaining = Number(ui.usage.dataset.remaining);
    const limit = Number(ui.usage.dataset.limit);
    if (!Number.isFinite(remaining) || !Number.isFinite(limit)) return;

    ui.usage.textContent = currentLocale === "en"
      ? `Questions available: ${remaining} of ${limit}`
      : `Consultas disponibles: ${remaining} de ${limit}`;

    ui.usage.title = currentLocale === "en"
      ? `${remaining} ${remaining === 1 ? "question available" : "questions available"} of ${limit}`
      : `${remaining} ${remaining === 1 ? "consulta disponible" : "consultas disponibles"} de ${limit}`;
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
    if (role === "assistant") {
      setLocalizedText(message, content);
    } else {
      message.textContent = content;
    }
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
    wrapper.setAttribute("aria-label", t("typing"));
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

  function loadPreferredLocaleWeb() {
    try {
      return normalizeLocaleWeb(localStorage.getItem(CONFIG.localeKey) || "es");
    } catch {
      return "es";
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

import { normalizeLocale } from "../../core/ai/i18n.mjs";

const EXACT_EN = new Map([
  ["Verificación rechazada", "Verification rejected"],
  ["Método no permitido", "Method not allowed"],
  ["No pude responder tu consulta en este momento. Intenta nuevamente en unos minutos.", "I could not answer your question at this time. Please try again in a few minutes."],
  ["Este número ya está vinculado a otra cuenta Cartes. Por seguridad no se realizó ningún cambio ni se fusionaron cuentas. Contacta a soporte si necesitas resolver esta situación.", "This number is already linked to another Cartes account. For security, no changes were made and no accounts were merged. Contact support if you need help resolving this situation."],
  ["Este número fue utilizado anteriormente por otra cuenta Cartes. Por seguridad no puedo reasignarlo automáticamente mediante cambio de número. Ninguna cuenta fue modificada. Contacta a soporte para validar la reasignación.", "This number was previously used by another Cartes account. For security, I cannot automatically reassign it through the change-number process. No account was modified. Contact support to validate the reassignment."],
  ["Listo. Este es ahora el número de WhatsApp vinculado a tu cuenta Cartes. Conservas la misma cuenta, plan, consultas, revisiones, suscripción y conversación. El número anterior ya no puede acceder a esta cuenta.", "Done. This is now the WhatsApp number linked to your Cartes account. Your account, plan, questions, reviews, subscription, and conversation remain unchanged. The previous number can no longer access this account."],
  ["No fue posible completar el cambio de número. Ninguna cuenta fue modificada.", "The number change could not be completed. No account was modified."],
  ["No fue posible iniciar el cambio de número.", "The number change could not be started."],
  ["No pude vincular estas cuentas porque ambas tienen una suscripción Cartes Plus vigente. Para proteger tus pagos, Cartes no fusionará dos suscripciones vigentes diferentes. Ninguna cuenta fue modificada. Espera a que una de las suscripciones termine o contacta a soporte para decidir cuál conservar.", "I could not link these accounts because both have an active Cartes Plus subscription. To protect your payments, Cartes will not merge two different active subscriptions. No account was modified. Wait until one subscription ends or contact support to decide which one to keep."],
  ["Este número fue desvinculado previamente de otra cuenta Cartes. Por seguridad no puedo reasignarlo automáticamente a una cuenta distinta. Ninguna cuenta fue modificada. Si el número fue reasignado legítimamente, contacta a soporte para resolverlo.", "This number was previously unlinked from another Cartes account. For security, I cannot automatically assign it to a different account. No account was modified. If the number was legitimately reassigned, contact support."],
  ["Tu cuenta Web y WhatsApp ya estaban vinculadas.", "Your Web and WhatsApp accounts were already linked."],
  ["Listo. Tu cuenta Web y WhatsApp quedaron vinculadas y ahora comparten plan, uso, suscripción y conversación.", "Done. Your Web and WhatsApp accounts are now linked and share the same plan, usage, subscription, and conversation."],
  ["Este número está desvinculado de tu cuenta Cartes. Para volver a vincularlo, abre Cartes en la Web, pulsa Vincular y envía aquí el código de 6 dígitos con el formato *VINCULAR 123456*. Tu plan, consultas y demás beneficios permanecen en tu cuenta.", "This number is unlinked from your Cartes account. To link it again, open Cartes on the Web, select Link, and send the six-digit code here in the format *VINCULAR 123456*. Your plan, usage, and other benefits remain in your account."],
  ["Listo. Este número quedó desvinculado de tu cuenta Cartes y ya no puede acceder a ella. Tu plan, consultas, revisiones y suscripción permanecen sin cambios. Para volver a vincularlo, abre Cartes en la Web, pulsa Vincular y envía aquí el nuevo código.", "Done. This number has been unlinked from your Cartes account and can no longer access it. Your plan, questions, reviews, and subscription remain unchanged. To link it again, open Cartes on the Web, select Link, and send the new code here."],
  ["No puedo desvincular este número porque actualmente es tu única forma de acceso a la cuenta. Vincula primero Cartes desde la Web y después vuelve a intentar la desvinculación.", "I cannot unlink this number because it is currently your only way to access the account. First link Cartes from the Web, then try again."],
  ["No fue posible desvincular WhatsApp en este momento. Ningún dato de tu cuenta fue modificado.", "WhatsApp could not be unlinked at this time. No account data was modified."],
  ["Entendido. El documento no será procesado y no se consumirá ninguna revisión.", "Understood. The document will not be processed and no review credit will be used."],
  ["No se generará ningún enlace de pago ni se activará Cartes Plus. Puedes seguir utilizando Cartes y volver a Suscribirme cuando quieras.", "No payment link will be generated and Cartes Plus will not be activated. You can continue using Cartes and subscribe whenever you wish."],
  ["Entendido. No se realizó ningún cambio y la renovación de Cartes Plus continúa activa.", "Understood. No changes were made and your Cartes Plus renewal remains active."],
  ["Responde *SÍ* para cancelar la renovación o *NO* para mantenerla activa.", "Reply *YES* to cancel renewal or *NO* to keep it active."],
  ["Escribe tu pregunta sobre historia, simbolismo o filosofía masónica y con gusto te ayudaré.", "Enter your question about Masonic history, symbolism, or philosophy and I will be glad to help."],
  ["Tu cuenta ya tiene Cartes Plus vigente. Consulta *Mi suscripción* para revisar su estado y vigencia.", "Your account already has an active Cartes Plus plan. Select *My subscription* to review its status and validity."],
  ["Para recibir ayuda con Cartes, tu suscripción o un pago, escríbenos a soporte@develandoelcodigomasonico.com y cuéntanos brevemente qué ocurrió. Para cambiar el idioma, escribe *IDIOMA* o *LANGUAGE*.", "For help with Cartes, your subscription, or a payment, email soporte@develandoelcodigomasonico.com and briefly describe what happened. To change the language, enter *LANGUAGE*."],
  ["No encontré una suscripción recurrente activa asociada a tu cuenta.", "I did not find an active recurring subscription associated with your account."],
  ["No encontré una suscripción cancelable de Mercado Pago o PayPal.", "I did not find a Mercado Pago or PayPal subscription that can be canceled."],
  ["¿Confirmas que deseas cancelar la renovación de Cartes Plus? Responde *SÍ* o *NO*.", "Do you confirm that you want to cancel Cartes Plus renewal? Reply *YES* or *NO*."],
  ["Este tipo de archivo no es compatible. Cartes admite únicamente documentos Word en formato .doc o .docx para revisión.\n\nEl archivo no fue revisado y no se consumió ninguna revisión.", "This file type is not supported. Cartes accepts only Word documents in .doc or .docx format for review.\n\nThe file was not reviewed and no review credit was used."],
  ["No pude identificar correctamente el documento enviado. Intenta adjuntarlo nuevamente.\n\nEl documento no fue revisado y no se consumió ninguna revisión.", "I could not identify the document correctly. Please attach it again.\n\nThe document was not reviewed and no review credit was used."],
  ["El documento pendiente ya no está disponible. Envíalo nuevamente para iniciar otra revisión.", "The pending document is no longer available. Send it again to start a new review."],
  ["No fue posible revisar el documento.", "The document could not be reviewed."],
  ["La revisión de documentos está disponible únicamente para Cartes Plus.", "Document review is available only with Cartes Plus."],
  ["Los paquetes adicionales están disponibles únicamente para Cartes Plus vigente.", "Additional review packages are available only with an active Cartes Plus plan."],
  ["Ya compraste los 2 paquetes adicionales permitidos durante este periodo de Cartes Plus.", "You have already purchased the two additional packages allowed during this Cartes Plus period."],
  ["No pude determinar la fecha de vencimiento de tu periodo Plus. No se generó ningún enlace de pago.", "I could not determine the expiration date of your Plus period. No payment link was generated."],
  ["Tu periodo Cartes Plus ya no está vigente. No se generó ningún enlace de pago.", "Your Cartes Plus period is no longer active. No payment link was generated."],
  ["No pude determinar la vigencia del paquete. No se generó ningún enlace de pago.", "I could not determine the package validity period. No payment link was generated."],
  ["Gracias. Tu aceptación quedó registrada.\n\nSelecciona el medio de pago que te resulte más conveniente.", "Thank you. Your acceptance has been recorded.\n\nSelect the payment method you prefer."],
  ["Selecciona Mercado Pago o PayPal para continuar.", "Select Mercado Pago or PayPal to continue."],
  ["La renovación de Cartes Plus fue cancelada. Si todavía tienes periodo pagado vigente, conservarás tus beneficios hasta su fecha de término.", "Cartes Plus renewal has been canceled. If you still have a paid period remaining, your benefits will continue until it ends."],
  ["Sin suscripción recurrente", "No recurring subscription"],
  ["No aplica", "Not applicable"],
  ["No disponible", "Not available"],
  ["Cancelada", "Canceled"],
  ["Conversar con Cartes", "Talk with Cartes"],
  ["Revisar documento", "Review document"],
  ["Conoce Cartes Plus", "Learn about Cartes Plus"],
  ["Suscribirme", "Subscribe"],
  ["Mi suscripción", "My subscription"],
  ["Ayuda y soporte", "Help and support"],
  ["Privacidad y términos", "Privacy and terms"],
  ["Comprar revisiones", "Buy reviews"],
  ["Cancelar renovación", "Cancel renewal"],
  ["Menú", "Menu"],
  ["Volver al menú", "Back to menu"],
  ["Contratar Plus", "Get Plus"],
  ["Sí, acepto", "Yes, I accept"],
  ["No acepto", "I do not accept"],
  ["Sí, revisar", "Yes, review"],
  ["No revisar", "Do not review"],
  ["Sí, generar código", "Yes, generate code"],
  ["No cambiar", "Do not change"],
  ["Sí, desvincular", "Yes, unlink"],
  ["No desvincular", "Do not unlink"],
  ["Ver opciones", "View options"],
  ["Menú principal", "Main menu"],
  ["Haz una consulta sobre la masonería.", "Ask a question about Freemasonry."],
  ["Consulta beneficios y condiciones.", "View benefits and terms."],
  ["Activa Cartes Plus.", "Activate Cartes Plus."],
  ["Consulta plan, uso y estado.", "View your plan, usage, and status."],
  ["Obtén ayuda con Cartes o pagos.", "Get help with Cartes or payments."],
  ["Consulta información legal.", "View legal information."],
  ["Web y WhatsApp comparten la misma cuenta Cartes.", "Web and WhatsApp share the same Cartes account."],
  ["Puedes cancelar y volver al menú en cualquier momento.", "You can cancel and return to the menu at any time."],
  ["El documento no fue descargado ni procesado.", "The document was not downloaded or processed."],
  ["Este tipo de archivo no es compatible.", "This file type is not supported."],
  ["Cartes admite únicamente documentos Word en formato .doc o .docx para revisión.", "Cartes accepts only Word documents in .doc or .docx format for review."],
  ["No pude identificar correctamente el documento enviado.", "I could not identify the submitted document correctly."],
  ["Intenta adjuntarlo nuevamente.", "Please attach it again."],
  ["el final de tu periodo Plus vigente", "the end of your current Plus period"]
]);

const SEGMENT_EN = Object.freeze([
  ["Este tipo de archivo no es compatible.", "This file type is not supported."],
  ["Cartes admite únicamente documentos Word en formato .doc o .docx para revisión.", "Cartes accepts only Word documents in .doc or .docx format for review."],
  ["No pude identificar correctamente el documento enviado.", "I could not identify the submitted document correctly."],
  ["Intenta adjuntarlo nuevamente.", "Please attach it again."],
  ["El archivo no fue revisado y no se consumió ninguna revisión.", "The file was not reviewed and no review credit was used."],
  ["El documento no fue descargado ni procesado.", "The document was not downloaded or processed."],
  ["el final de tu periodo Plus vigente", "the end of your current Plus period"],
  ["*Menú de Cartes*", "*Cartes Menu*"],
  ["Menú de Cartes", "Cartes Menu"],
  ["Elige una opción o escribe directamente tu consulta sobre la masonería:", "Choose an option or enter your question about Freemasonry:"],
  ["Selecciona una opción o escribe directamente tu consulta sobre la masonería.", "Select an option or enter your question about Freemasonry."],
  ["Para cambiar el idioma, escribe IDIOMA o LANGUAGE.", "To change the language, enter LANGUAGE."],
  ["Para cambiar el idioma, escribe *IDIOMA* o *LANGUAGE*.", "To change the language, enter *LANGUAGE*."],
  ["Selecciona una opción:", "Select an option:"],
  ["• Conversar con Cartes", "• Talk with Cartes"],
  ["• Conoce Cartes Plus", "• Learn about Cartes Plus"],
  ["• Suscribirme", "• Subscribe"],
  ["• Mi suscripción", "• My subscription"],
  ["• Revisar documento", "• Review document"],
  ["• Ayuda y soporte", "• Help and support"],
  ["• Privacidad y términos", "• Privacy and terms"],
  ["• Idioma / Language", "• Language"],
  ["Idioma / Language", "Language"],
  ["Cambia el idioma de Cartes.", "Change the Cartes language."],
  ["¡Bienvenido a Cartes Plus!", "Welcome to Cartes Plus!"],
  ["Tu suscripción de", "Your subscription of"],
  ["ya está activa.", "is now active."],
  ["Tus beneficios se comparten entre Web y WhatsApp.", "Your benefits are shared between Web and WhatsApp."],
  ["¡Listo! Se agregaron", "Done! We added"],
  ["revisiones adicionales a tu cuenta Cartes.", "additional reviews to your Cartes account."],
  ["Puedo ayudarte con consultas sobre historia, simbolismo, filosofía y pensamiento masónico.", "I can help with questions about Masonic history, symbolism, philosophy, and thought."],
  ["Hola, soy Cartes, el asistente de Develando el Código Masónico.", "Hello, I am Cartes, the assistant for Develando el Código Masónico."],
  ["Esta bienvenida y el uso del menú no consumen ninguna consulta.", "This welcome message and use of the menu do not consume any question credits."],
  ["*Bienvenido de nuevo a Cartes.*", "*Welcome back to Cartes.*"],
  ["Tu cuenta y tu saldo se mantienen sin cambios.", "Your account and balance remain unchanged."],
  ["Cartes Plus amplía tu conocimiento con más consultas, revisión y retroalimentación de documentos.", "Cartes Plus expands your access with more questions and document review feedback."],
  ["La versión gratuita está pensada para consultas puntuales. Cartes Plus es para quienes desean estudiar con mayor profundidad y recibir apoyo en la preparación de sus trabajos.", "The free plan is intended for occasional questions. Cartes Plus is for users who want to study in greater depth and receive support preparing their papers."],
  ["Para comenzar, selecciona “Suscribirme”.", "To begin, select “Subscribe”."],
  ["En cada revisión recibirás observaciones sobre estructura, claridad y contenido para mejorar tu trabajo antes de presentarlo en Logia.", "Each review provides feedback on structure, clarity, and content so you can improve your paper before presenting it in lodge."],
  ["La suscripción quedará vinculada a tu número de WhatsApp. Desde este mismo chat podrás consultar su estado o cancelarla.", "The subscription will be linked to your WhatsApp number. You can view its status or cancel renewal from this chat."],
  ["Abre el siguiente enlace seguro para completar tu suscripción:", "Open the secure link below to complete your subscription:"],
  ["Cuando Mercado Pago confirme el pago, Cartes Plus se activará en tu misma cuenta de Web y WhatsApp.", "When Mercado Pago confirms payment, Cartes Plus will be activated on the same Web and WhatsApp account."],
  ["Cuando PayPal confirme el pago, Cartes Plus se activará en tu misma cuenta de Web y WhatsApp.", "When PayPal confirms payment, Cartes Plus will be activated on the same Web and WhatsApp account."],
  ["*Consultas disponibles:*", "*Questions available:*"],
  ["Sin suscripción recurrente", "No recurring subscription"],
  ["No aplica", "Not applicable"],
  ["No disponible", "Not available"],
  ["Cancelada", "Canceled"],
  ["Consultas disponibles:", "Questions available:"],
  ["Consultas usadas:", "Questions used:"],
  ["*Revisiones disponibles:*", "*Reviews available:*"],
  ["Revisiones disponibles:", "Reviews available:"],
  ["Paquetes adicionales:", "Additional packages:"],
  ["Fecha de vencimiento:", "Expiration date:"],
  ["Renovación:", "Renewal:"],
  ["Medio de pago:", "Payment method:"],
  ["Plan:", "Plan:"],
  ["Cartes gratuito", "Cartes Free"],
  ["Renovación de consultas gratuitas:", "Free question renewal:"],
  ["Periodo gratuito: comienza con la primera consulta válida respondida por Cartes", "Free period: begins with the first valid question answered by Cartes"],
  ["Antes de continuar, revisa y acepta los Términos de uso y el Aviso de privacidad de Cartes.", "Before continuing, review and accept the Cartes Terms of Use and Privacy Notice."],
  ["*Privacidad y términos*", "*Privacy and terms*"],
  ["Aviso de privacidad:", "Privacy Notice:"],
  ["Términos:", "Terms:"],
  ["Al utilizar Cartes aceptas sus Términos de uso y el Aviso de privacidad de Develando el Código Masónico.", "By using Cartes, you accept its Terms of Use and the Develando el Código Masónico Privacy Notice."],
  ["Tus mensajes y los documentos que envíes serán tratados únicamente para prestar el servicio y mejorar tu experiencia.", "Your messages and submitted documents will be processed only to provide the service and improve your experience."],
  ["Puedes consultar la información completa en nuestros términos y aviso de privacidad.", "You can review the complete information in our terms and privacy notice."],
  ["Para cualquier duda, escríbenos a soporte@develandoelcodigomasonico.com.", "For questions, email soporte@develandoelcodigomasonico.com."],
  ["Recibí el documento", "I received the document"],
  ["Cartes procesará temporalmente el documento para validar que tenga un máximo de", "Cartes will temporarily process the document to verify that it has no more than"],
  ["páginas y, si cumple, realizar la revisión.", "pages and, if it complies, perform the review."],
  ["El archivo no se conservará después del procesamiento.", "The file will not be retained after processing."],
  ["Cartes Plus incluye hasta", "Cartes Plus includes up to"],
  ["revisiones mensuales.", "monthly reviews."],
  ["¿Autorizas a Cartes a procesar temporalmente este documento?", "Do you authorize Cartes to process this document temporarily?"],
  ["Responde *ACEPTO DOCUMENTO* para continuar o *NO ACEPTO DOCUMENTO* para descartarlo.", "Reply *ACCEPT DOCUMENT* to continue or *DO NOT ACCEPT DOCUMENT* to discard it."],
  ["El documento no fue revisado y no se consumió ninguna revisión.", "The document was not reviewed and no review credit was used."],
  ["*Revisar documento*", "*Review document*"],
  ["Adjunta ahora tu documento Word (.docx) o Word antiguo (.doc) usando el botón de adjuntar de WhatsApp.", "Attach your Word document (.docx) or legacy Word file (.doc) using the WhatsApp attachment button."],
  ["Antes de procesarlo, Cartes te pedirá autorización. El archivo no se conservará después de la revisión.", "Cartes will ask for authorization before processing it. The file will not be retained after the review."],
  ["Ya utilizaste las", "You have used all"],
  ["consultas gratuitas de este periodo.", "free questions for this period."],
  ["consultas incluidas en Cartes Plus durante este periodo.", "questions included with Cartes Plus during this period."],
  ["Si quieres seguir conversando con Cartes ahora, puedes activar *Cartes Plus* por", "To continue talking with Cartes now, you can activate *Cartes Plus* for"],
  ["al mes, con hasta", "per month, with up to"],
  ["consultas y", "questions and"],
  ["revisiones de documentos Word.", "Word document reviews."],
  ["*La revisión de documentos está disponible con Cartes Plus.*", "*Document review is available with Cartes Plus.*"],
  ["Con Plus tienes hasta", "With Plus you receive up to"],
  ["revisiones de documentos por mes", "document reviews per month"],
  ["consultas mensuales", "monthly questions"],
  ["Contrata Cartes Plus para revisar este documento.", "Get Cartes Plus to review this document."],
  ["Para cambiar el número vinculado, escribe *CAMBIAR NÚMERO*.", "To change the linked number, enter *CHANGE NUMBER*."],
  ["Para desvincular este número de tu cuenta, escribe *DESVINCULAR WHATSAPP*.", "To unlink this number from your account, enter *UNLINK WHATSAPP*."],
  ["Si este número es tu única forma de acceso, Cartes no permitirá la operación.", "If this number is your only means of access, Cartes will not allow the operation."],
  ["El paquete cuesta", "The package costs"],
  ["e incluye", "and includes"],
  ["revisiones adicionales.", "additional reviews."],
  ["Es un pago único, no recurrente.", "It is a one-time, non-recurring payment."],
  ["Completa el pago aquí:", "Complete payment here:"],
  ["Cuando el proveedor confirme la compra, las revisiones se agregarán a tu misma cuenta de Web y WhatsApp.", "When the provider confirms the purchase, the reviews will be added to the same Web and WhatsApp account."],
  ["Pago único, no recurrente.", "One-time, non-recurring payment."],
  ["Las revisiones vencerán el", "The reviews will expire on"],
  ["Selecciona el medio de pago.", "Select a payment method."],
  ["Responde *1* o *2*.", "Reply *1* or *2*."],
  ["Escribe *Suscribirme* para continuar o *Menú* para volver.", "Enter *SUBSCRIBE* to continue or *MENU* to go back."],
  ["Escribe *Suscribirme* para activar Cartes Plus o *Menú* para volver.", "Enter *SUBSCRIBE* to activate Cartes Plus or *MENU* to go back."],
  ["Puedes escribir *MENÚ* para volver.", "You can enter *MENU* to go back."],
  ["Escribe *COMPRAR REVISIONES* para adquirir", "Enter *BUY REVIEWS* to purchase"],
  ["Tu cuenta gratuita incluye", "Your free account includes"],
  ["consultas.", "questions."],
  ["Tu periodo de 30 días comenzará con la primera consulta válida que Cartes responda.", "Your 30-day period will begin with the first valid question Cartes answers."],
  ["También puedes conocer Cartes Plus, que amplía las consultas e incluye revisión de documentos Word.", "You can also learn about Cartes Plus, which expands your question allowance and includes Word document reviews."],
  ["Tu periodo gratuito de 30 días comenzará con tu primera consulta válida respondida por Cartes.", "Your free 30-day period will begin with the first valid question Cartes answers."],
  ["Tus", "Your"],
  ["consultas gratuitas se renuevan el", "free questions renew on"],
  ["consultas gratuitas estarán disponibles nuevamente el", "free questions will be available again on"],
  ["Máximo", "Maximum"],
  ["páginas", "pages"],
  ["Selecciona el medio de pago que te resulte más conveniente.", "Select the payment method you prefer."],
  ["¿Confirmas que deseas cambiar el número de WhatsApp vinculado a tu cuenta Cartes?", "Do you confirm that you want to change the WhatsApp number linked to your Cartes account?"],
  ["¿Confirmas que deseas desvincular este número de tu cuenta Cartes?", "Do you confirm that you want to unlink this number from your Cartes account?"],
  ["El número dejará de acceder a la cuenta.", "The number will no longer have access to the account."],
  ["Este número seguirá funcionando hasta que verifiques el nuevo.", "This number will continue working until you verify the new one."],
  ["Tu plan, consultas, revisiones y suscripción permanecerán sin cambios.", "Your plan, questions, reviews, and subscription will remain unchanged."],
  ["Tu plan, consultas, revisiones y suscripción no se cancelan ni se reinician.", "Your plan, questions, reviews, and subscription will not be canceled or reset."],
  ["Código generado:", "Code generated:"],
  ["Desde el NUEVO número de WhatsApp, escribe a Cartes y envía exactamente ese código.", "From the NEW WhatsApp number, contact Cartes and send that exact code."],
  ["Vence en", "It expires in"],
  ["minutos.", "minutes."],
  ["Este número actual seguirá vinculado hasta que el nuevo complete la verificación.", "The current number will remain linked until the new number completes verification."]
]);

export function translateWhatsAppText(value, locale = "es") {
  const text = String(value ?? "");
  if (normalizeLocale(locale) !== "en" || !text) return text;

  const exact = EXACT_EN.get(text);
  if (exact) return localizeLegalUrls(exact);

  let result = text;
  for (const [spanish, english] of SEGMENT_EN) {
    result = result.split(spanish).join(english);
  }

  return localizeLegalUrls(result);
}

function localizeLegalUrls(value) {
  return String(value)
    .replace(/\/cartes-whatsapp\/terminos\.html/g, "/cartes-whatsapp/terms.html")
    .replace(/\/cartes-whatsapp\/privacy\.html/g, "/cartes-whatsapp/privacy-en.html")
    .replace(/\/cartes-whatsapp\/suscripcion\.html/g, "/cartes-whatsapp/subscription.html");
}

export function localizeWhatsAppDeps(deps, locale = "es") {
  const selectedLocale = normalizeLocale(locale);
  const raw = deps?.__cartesRawDeps || deps;
  if (selectedLocale === "es") {
    return { ...raw, locale: selectedLocale, __cartesRawDeps: raw };
  }

  return {
    ...raw,
    locale: selectedLocale,
    __cartesRawDeps: raw,
    sendWhatsAppTextParts(payload) {
      return raw.sendWhatsAppTextParts({
        ...payload,
        text: translateWhatsAppText(payload?.text, selectedLocale)
      });
    },
    sendWhatsAppReplyButtons(payload) {
      return raw.sendWhatsAppReplyButtons({
        ...payload,
        body: translateWhatsAppText(payload?.body, selectedLocale),
        footer: translateWhatsAppText(payload?.footer, selectedLocale),
        buttons: (payload?.buttons || []).map((button) => ({
          ...button,
          title: translateWhatsAppText(button?.title, selectedLocale)
        }))
      });
    },
    sendWhatsAppInteractiveList(payload) {
      return raw.sendWhatsAppInteractiveList({
        ...payload,
        header: translateWhatsAppText(payload?.header, selectedLocale),
        body: translateWhatsAppText(payload?.body, selectedLocale),
        button: translateWhatsAppText(payload?.button, selectedLocale),
        footer: translateWhatsAppText(payload?.footer, selectedLocale),
        sections: (payload?.sections || []).map((section) => ({
          ...section,
          title: translateWhatsAppText(section?.title, selectedLocale),
          rows: (section?.rows || []).map((row) => ({
            ...row,
            title: translateWhatsAppText(row?.title, selectedLocale),
            description: translateWhatsAppText(row?.description, selectedLocale)
          }))
        }))
      });
    }
  };
}
